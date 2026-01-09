import fs from 'fs'
import path from 'path'
import net from 'net'
import { v4 as uuidv4 } from 'uuid'
import { BrowserWindow, ipcMain, dialog, app } from 'electron'
import { connectionManager } from './protocol'
import { discoveryManager } from './discovery'
import { tcpServer } from './tcpServer'
import { FileMetadata, NetworkMessage, FileTransferProgress } from '../shared/messageTypes'
import { getDeviceInfo } from './identity'

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

    ipcMain.handle('send-file', async (_, deviceId: string, filePath: string) => {
      return this.initiateSend(deviceId, filePath)
    })

    ipcMain.handle('accept-file', async (_, fileId: string) => {
      const transfer = this.activeTransfers.get(fileId)
      if (!transfer || !transfer.metadata) return

      // Automatically save to Downloads folder
      const downloadsPath = app.getPath('downloads')
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

          // Process any remaining bytes in initialBuffer after the header
          const headerLength = match[0].length
          if (initialBuffer.length > headerLength) {
            const remainingData = initialBuffer.slice(headerLength)
            transfer.writeStream.write(remainingData)
            receivedBytes += remainingData.length
          }

          socket.on('data', (data) => {
            if (transfer.writeStream) {
              transfer.writeStream.write(data)
              receivedBytes += data.length
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
                name: transfer.metadata?.name
              })
            }
          })

          socket.on('end', () => {
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
                name: transfer.metadata?.name
              })
            }
          })
        }
      }
    })
  }

  async initiateSend(deviceId: string, filePath: string): Promise<string> {
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
      timestamp: Date.now()
    }

    this.activeTransfers.set(fileId, {
      fileId,
      deviceId,
      progress: 0,
      speed: 0,
      eta: 0,
      status: 'pending',
      filePath,
      metadata
    })

    // Notify renderer of new pending transfer
    this.mainWindow?.webContents.send('file-transfer-progress', {
      fileId,
      deviceId,
      progress: 0,
      speed: 0,
      eta: 0,
      status: 'pending',
      name: metadata.name
    })

    await connectionManager.getConnection(device)
    connectionManager.sendMessage(deviceId, message)

    return fileId
  }

  public handleIncomingMeta(message: NetworkMessage): void {
    const metadata: FileMetadata = message.payload
    this.activeTransfers.set(metadata.fileId, {
      fileId: metadata.fileId,
      deviceId: message.deviceId,
      progress: 0,
      speed: 0,
      eta: 0,
      status: 'pending',
      metadata
    })

    // Notify renderer of new incoming file request
    this.mainWindow?.webContents.send('file-transfer-progress', {
      fileId: metadata.fileId,
      deviceId: message.deviceId,
      progress: 0,
      speed: 0,
      eta: 0,
      status: 'pending',
      name: metadata.name
    })

    this.mainWindow?.webContents.send('file-received', message)
  }

  public async handleAccept(message: NetworkMessage): Promise<void> {
    const { fileId } = message.payload
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
      name: transfer.metadata?.name
    })
    this.startStreaming(fileId, transfer.filePath, transfer.deviceId)
  }

  public handleReject(message: NetworkMessage): void {
    const { fileId } = message.payload
    const transfer = this.activeTransfers.get(fileId)
    if (transfer) {
      transfer.status = 'rejected'
      this.mainWindow?.webContents.send('file-transfer-progress', transfer)
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

    // Open DEDICATED connection for file stream
    const socket = net.connect(device.port, device.address, () => {
      socket.setNoDelay(true)

      // Send header
      socket.write(`FILE_STREAM:${fileId}\n`)

      // Stream file manually for progress tracking
      const readStream = fs.createReadStream(filePath, { highWaterMark: 256 * 1024 })

      let uploaded = 0
      const startTime = Date.now()

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

        // Write chunk to socket
        socket.write(chunk)

        this.mainWindow?.webContents.send('file-transfer-progress', {
          fileId: transfer.fileId,
          deviceId: transfer.deviceId,
          progress: transfer.progress,
          speed: transfer.speed,
          eta: transfer.eta,
          status: transfer.status,
          name: transfer.metadata?.name
        })
      })

      readStream.on('end', () => {
        transfer.status = 'completed'
        this.mainWindow?.webContents.send('file-transfer-progress', {
          fileId: transfer.fileId,
          deviceId: transfer.deviceId,
          progress: 1,
          speed: transfer.speed,
          eta: 0,
          status: 'completed',
          name: transfer.metadata?.name
        })
        socket.end()
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
        name: transfer.metadata?.name
      })
    })
  }
}

export const fileTransferManager = new FileTransferManager()
