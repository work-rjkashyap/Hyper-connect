import fs from 'fs'
import path from 'path'
import net from 'net'
import stream from 'stream'
import { v4 as uuidv4 } from 'uuid'
import { BrowserWindow, ipcMain, dialog, app, shell } from 'electron'
import { connectionManager } from './protocol'
import { discoveryManager } from './discovery'
import { tcpServer } from './tcpServer'
import { FileMetadata, NetworkMessage, FileTransferProgress } from '@shared/messageTypes'
import { getDeviceInfo } from './identity'
import { createDecryptionStream, createEncryptionStream } from './crypto/streamCrypto'
import { getSession } from './crypto/sessionKey'
import crypto from 'node:crypto'

class FileTransferManager {
  private activeTransfers: Map<
    string,
    FileTransferProgress & {
      filePath?: string
      metadata?: FileMetadata
      writeStream?: fs.WriteStream
    }
  > = new Map()
  private mainWindow?: BrowserWindow

  setup(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow

    ipcMain.handle('send-file', async (_, deviceId: string, filePath: string, replyTo?: string) => {
      return this.initiateSend(deviceId, filePath, replyTo)
    })

    ipcMain.handle('accept-file', async (_, fileId: string) => {
      const transfer = this.activeTransfers.get(fileId)
      if (!transfer || !transfer.metadata) return

      // Get custom download path or use default Downloads folder
      const Store = (await import('electron-store')).default
      const store = new Store()
      const customPath = store.get('downloadPath') as string | undefined
      const downloadsPath = customPath || app.getPath('downloads')
      let filePath = path.join(downloadsPath, transfer.metadata.name)

      // Handle file name conflicts by appending a number
      let counter = 1
      const ext = path.extname(transfer.metadata.name)
      const baseName = path.basename(transfer.metadata.name, ext)

      while (fs.existsSync(filePath)) {
        filePath = path.join(downloadsPath, `${baseName} (${counter})${ext}`)
        counter++
      }

      this.sendAccept(fileId, filePath)
    })

    ipcMain.handle('reject-file', (_, fileId: string) => {
      this.sendReject(fileId)
    })

    ipcMain.handle('select-file', async () => {
      if (!this.mainWindow) return null
      const { canceled, filePaths } = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openFile']
      })
      if (canceled || filePaths.length === 0) return null
      return filePaths[0]
    })

    ipcMain.handle('open-file-location', async (_, filePath: string) => {
      if (filePath && fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath)
      }
    })

    // Handle raw connections from TCPServer
    tcpServer.on('raw-connection', (socket: net.Socket, initialBuffer: Buffer) => {
      // Header format: "FILE_STREAM:<fileId>\n"
      const str = initialBuffer.toString()
      const match = str.match(/^FILE_STREAM:([a-zA-Z0-9-]+)\n/)
      if (match) {
        const fileId = match[1]
        const transfer = this.activeTransfers.get(fileId)
        if (transfer && transfer.filePath) {
          transfer.writeStream = fs.createWriteStream(transfer.filePath)
          transfer.status = 'active'
          let receivedBytes = 0
          const startTime = Date.now()

          // Process remaining bytes in initialBuffer after header
          const headerLength = match[0].length
          const bufferedData = initialBuffer.slice(headerLength)

          const session = getSession(transfer.deviceId)

          if (!session) {
            console.error(`[FileTransfer] No session key for device ${transfer.deviceId}`)
            socket.destroy()
            return
          }

          let decipherStream: stream.Transform | null = null
          let ivBuffer = Buffer.alloc(0)

          const processChunk = (chunk: Buffer): void => {
            if (!decipherStream) {
              ivBuffer = Buffer.concat([ivBuffer, chunk])
              if (ivBuffer.length >= 16) {
                const iv = ivBuffer.slice(0, 16)
                const remaining = ivBuffer.slice(16)

                decipherStream = createDecryptionStream(session.sessionKey, iv)
                decipherStream.pipe(transfer.writeStream!)

                if (remaining.length > 0) {
                  decipherStream.write(remaining)
                  receivedBytes += remaining.length
                }
              }
            } else {
              decipherStream.write(chunk)
              receivedBytes += chunk.length
            }

            // Update progress
            const now = Date.now()
            const duration = (now - startTime) / 1000
            const speed = duration > 0 ? receivedBytes / duration : 0
            const progress = receivedBytes / (transfer.metadata?.size || 1)
            const eta = speed > 0 ? ((transfer.metadata?.size || 0) - receivedBytes) / speed : 0

            transfer.progress = progress
            transfer.speed = speed
            transfer.eta = eta
            this.mainWindow?.webContents.send('file-transfer-progress', {
              fileId: transfer.fileId,
              deviceId: transfer.deviceId,
              progress: transfer.progress,
              speed: transfer.speed,
              eta: transfer.eta,
              status: transfer.status,
              name: transfer.metadata?.name,
              path: transfer.filePath,
              size: transfer.metadata?.size,
              direction: 'incoming'
            })
          }

          if (bufferedData.length > 0) {
            processChunk(bufferedData)
          }

          socket.on('data', (data) => {
            processChunk(data)
          })

          socket.on('end', () => {
            if (decipherStream) decipherStream.end()
            if (transfer.writeStream) {
              transfer.writeStream.end()
              transfer.status = 'completed'
              this.mainWindow?.webContents.send('file-transfer-progress', {
                fileId: transfer.fileId,
                deviceId: transfer.deviceId,
                progress: 1,
                speed: transfer.speed,
                eta: 0,
                status: 'completed',
                name: transfer.metadata?.name,
                path: transfer.filePath,
                size: transfer.metadata?.size,
                direction: 'incoming'
              })
            }
          })
        }
      }
    })
  }

  async initiateSend(
    deviceId: string,
    filePath: string,
    replyTo?: string
  ): Promise<NetworkMessage> {
    const stats = fs.statSync(filePath)
    const fileId = uuidv4()
    const metadata: FileMetadata = {
      fileId,
      name: path.basename(filePath),
      size: stats.size,
      path: filePath
    }

    const device = discoveryManager.getDiscoveredDevices().find((d) => d.deviceId === deviceId)
    if (!device) throw new Error('Device not found')

    const message: NetworkMessage = {
      type: 'FILE_META',
      deviceId: getDeviceInfo().deviceId,
      payload: metadata,
      id: uuidv4(),
      timestamp: Date.now(),
      replyTo
    }

    this.activeTransfers.set(fileId, {
      fileId,
      deviceId,
      progress: 0,
      speed: 0,
      eta: 0,
      status: 'pending',
      filePath,
      metadata,
      direction: 'outgoing'
    })

    // Notify renderer of new pending transfer
    this.mainWindow?.webContents.send('file-transfer-progress', {
      fileId,
      deviceId,
      progress: 0,
      speed: 0,
      eta: 0,
      status: 'pending',
      name: metadata.name,
      path: filePath,
      size: metadata.size,
      direction: 'outgoing'
    })

    await connectionManager.getConnection(device)
    connectionManager.sendMessage(deviceId, message)

    return message
  }

  public async handleIncomingMeta(message: NetworkMessage): Promise<void> {
    const metadata: FileMetadata = message.payload as FileMetadata
    this.activeTransfers.set(metadata.fileId, {
      fileId: metadata.fileId,
      deviceId: message.deviceId,
      progress: 0,
      speed: 0,
      eta: 0,
      status: 'pending',
      metadata,
      direction: 'incoming'
    })

    // Notify renderer of new incoming file request
    this.mainWindow?.webContents.send('file-transfer-progress', {
      fileId: metadata.fileId,
      deviceId: message.deviceId,
      progress: 0,
      speed: 0,
      eta: 0,
      status: 'pending',
      name: metadata.name,
      size: metadata.size,
      direction: 'incoming'
    })

    this.mainWindow?.webContents.send('file-received', message)

    // Handle Auto-accept
    const Store = (await import('electron-store')).default
    const store = new Store()
    const autoAccept = store.get('autoAccept', false) as boolean

    if (autoAccept) {
      console.log(`[FileTransfer] Auto-accepting file: ${metadata.name}`)
      const customPath = store.get('downloadPath') as string | undefined
      const downloadsPath = customPath || app.getPath('downloads')
      let filePath = path.join(downloadsPath, metadata.name)

      // Handle file name conflicts
      let counter = 1
      const ext = path.extname(metadata.name)
      const baseName = path.basename(metadata.name, ext)

      while (fs.existsSync(filePath)) {
        filePath = path.join(downloadsPath, `${baseName} (${counter})${ext}`)
        counter++
      }

      await this.sendAccept(metadata.fileId, filePath)
    }
  }

  public async handleAccept(message: NetworkMessage): Promise<void> {
    const { fileId } = message.payload as { fileId: string }
    const transfer = this.activeTransfers.get(fileId)
    if (!transfer || !transfer.filePath) return

    transfer.status = 'active'
    this.mainWindow?.webContents.send('file-transfer-progress', {
      fileId,
      deviceId: transfer.deviceId,
      progress: transfer.progress,
      speed: transfer.speed,
      eta: transfer.eta,
      status: 'active',
      name: transfer.metadata?.name,
      size: transfer.metadata?.size,
      direction: 'outgoing'
    })
    this.startStreaming(fileId, transfer.filePath, transfer.deviceId)
  }

  public handleReject(message: NetworkMessage): void {
    const { fileId } = message.payload as { fileId: string }
    const transfer = this.activeTransfers.get(fileId)
    if (transfer) {
      transfer.status = 'rejected'
      this.mainWindow?.webContents.send('file-transfer-progress', {
        ...transfer,
        name: transfer.metadata?.name,
        size: transfer.metadata?.size
      })
    }
  }

  private async sendAccept(fileId: string, savePath: string): Promise<void> {
    const transfer = this.activeTransfers.get(fileId)
    if (!transfer) return

    const device = discoveryManager
      .getDiscoveredDevices()
      .find((d) => d.deviceId === transfer.deviceId)
    if (!device) return

    transfer.filePath = savePath

    const message: NetworkMessage = {
      type: 'FILE_ACCEPT',
      deviceId: getDeviceInfo().deviceId,
      payload: { fileId },
      id: uuidv4(),
      timestamp: Date.now()
    }

    await connectionManager.getConnection(device)
    connectionManager.sendMessage(transfer.deviceId, message)
  }

  private async sendReject(fileId: string): Promise<void> {
    const transfer = this.activeTransfers.get(fileId)
    if (!transfer) return

    const device = discoveryManager
      .getDiscoveredDevices()
      .find((d) => d.deviceId === transfer.deviceId)
    if (!device) return

    const message: NetworkMessage = {
      type: 'FILE_REJECT',
      deviceId: getDeviceInfo().deviceId,
      payload: { fileId },
      id: uuidv4(),
      timestamp: Date.now()
    }

    await connectionManager.getConnection(device)
    connectionManager.sendMessage(transfer.deviceId, message)

    this.activeTransfers.delete(fileId)
  }

  private async startStreaming(fileId: string, filePath: string, deviceId: string): Promise<void> {
    const transfer = this.activeTransfers.get(fileId)
    if (!transfer) return

    const device = discoveryManager.getDiscoveredDevices().find((d) => d.deviceId === deviceId)
    if (!device) return

    const session = getSession(deviceId)

    if (!session) {
      console.error(`[FileTransfer] No session key for device ${deviceId}`)
      return
    }

    // Open DEDICATED connection for file stream
    const socket = new net.Socket({
      // @ts-expect-error - writableHighWaterMark is missing in some node typings but valid
      writableHighWaterMark: 4 * 1024 * 1024 // 4MB
    })

    socket.connect(device.port, device.address, () => {
      socket.setNoDelay(true)

      // 1. Send header
      socket.write(`FILE_STREAM:${fileId}\n`)

      // 2. Generate and send random 16-byte IV
      const iv = crypto.randomBytes(16)
      socket.write(iv)

      // 3. Setup encryption stream
      const encryptionStream = createEncryptionStream(session.sessionKey, iv)
      const readStream = fs.createReadStream(filePath, { highWaterMark: 256 * 1024 })

      let uploaded = 0
      const startTime = Date.now()

      encryptionStream.pipe(socket)

      readStream.on('data', (chunk) => {
        uploaded += chunk.length
        const now = Date.now()
        const duration = (now - startTime) / 1000
        const speed = duration > 0 ? uploaded / duration : 0
        const progress = uploaded / (transfer.metadata?.size || 1)
        const eta = speed > 0 ? ((transfer.metadata?.size || 0) - uploaded) / speed : 0

        transfer.progress = progress
        transfer.speed = speed
        transfer.eta = eta

        this.mainWindow?.webContents.send('file-transfer-progress', {
          fileId: transfer.fileId,
          deviceId: transfer.deviceId,
          progress: transfer.progress,
          speed: transfer.speed,
          eta: transfer.eta,
          status: transfer.status,
          name: transfer.metadata?.name,
          path: transfer.filePath,
          size: transfer.metadata?.size,
          direction: 'outgoing'
        })
      })

      readStream.pipe(encryptionStream)

      readStream.on('end', () => {
        // No need to call encryptionStream.end() if we just piped it
      })

      socket.on('finish', () => {
        transfer.status = 'completed'
        this.mainWindow?.webContents.send('file-transfer-progress', {
          fileId: transfer.fileId,
          deviceId: transfer.deviceId,
          progress: 1,
          speed: transfer.speed,
          eta: 0,
          status: 'completed',
          name: transfer.metadata?.name,
          path: transfer.filePath,
          size: transfer.metadata?.size,
          direction: 'outgoing'
        })
      })
    })

    socket.on('error', (err) => {
      console.error('File stream socket error:', err)
      transfer.status = 'failed'
      this.mainWindow?.webContents.send('file-transfer-progress', {
        fileId: transfer.fileId,
        deviceId: transfer.deviceId,
        progress: transfer.progress,
        speed: transfer.speed,
        eta: transfer.eta,
        status: 'failed',
        name: transfer.metadata?.name,
        path: transfer.filePath,
        size: transfer.metadata?.size,
        direction: 'outgoing'
      })
    })
  }
}

export const fileTransferManager = new FileTransferManager()
