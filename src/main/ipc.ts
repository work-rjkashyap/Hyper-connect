import { ipcMain, BrowserWindow } from 'electron'
import { getDeviceInfo, updateDisplayName } from './identity'
import { discoveryManager } from './discovery'
import { tcpServer } from './tcpServer'
import { connectionManager } from './protocol'
import { NetworkMessage, Device } from '../shared/messageTypes'
import { v4 as uuidv4 } from 'uuid'
import { fileTransferManager } from './fileTransfer'

export function setupIpc(mainWindow: BrowserWindow): void {
  fileTransferManager.setup(mainWindow)

  // Safe message sending helper - checks if window is destroyed before sending
  const sendToRenderer = (channel: string, ...args: unknown[]): void => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, ...args)
    }
  }

  // Device Info
  ipcMain.handle('get-device-info', () => getDeviceInfo())
  ipcMain.handle('update-display-name', (_, name: string) => {
    updateDisplayName(name)
    return getDeviceInfo()
  })

  ipcMain.handle('clear-cache', async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const session = mainWindow.webContents.session
      await session.clearCache()
      await session.clearStorageData()
      return true
    }
    return false
  })

  // Discovery
  ipcMain.handle('get-discovered-devices', () => discoveryManager.getDiscoveredDevices())
  ipcMain.handle('rescan-devices', () => discoveryManager.rescan())

  // Messaging
  ipcMain.handle('send-message', async (_, deviceId: string, payload: string) => {
    const devices = discoveryManager.getDiscoveredDevices()
    console.log(
      `[IPC] Sending message to ${deviceId}. Available devices:`,
      devices.map((d) => `${d.displayName} (${d.address}:${d.port})`)
    )
    const target = devices.find((d) => d.deviceId === deviceId)
    if (!target) {
      console.error(`[IPC] Target device ${deviceId} not found in discovery list`)
      throw new Error('Device not found')
    }

    const message: NetworkMessage = {
      type: 'MESSAGE',
      deviceId: getDeviceInfo().deviceId,
      id: uuidv4(),
      payload,
      timestamp: Date.now()
    }

    try {
      console.log(
        `[IPC] Connecting to ${target.displayName} at ${target.address}:${target.port}...`
      )
      await connectionManager.getConnection(target)
      console.log(`[IPC] Connection established, sending payload`)
      connectionManager.sendMessage(deviceId, message)
      return message
    } catch (e) {
      console.error(`[IPC] Failed to reach ${target.address}:${target.port}:`, e)
      throw e
    }
  })

  // Forward events to renderer with safe sending
  const onDeviceFound = (device: Device): void => {
    console.log('[IPC] Device found, sending to renderer:', device)
    sendToRenderer('device-discovered', device)
    console.log('[IPC] Device-discovered event sent')
  }

  const onDeviceLost = (deviceId: string): void => {
    sendToRenderer('device-lost', deviceId)
  }

  const handleIncomingMessage = (message: NetworkMessage, socket: any): void => {
    // Mark device as online whenever we receive any traffic from it
    discoveryManager.markDeviceOnline(message.deviceId)

    if (message.type === 'HELLO') {
      connectionManager.registerSocket(message.deviceId, socket)
    } else if (message.type === 'PING') {
      const pong: NetworkMessage = {
        type: 'PONG',
        deviceId: getDeviceInfo().deviceId,
        id: 'pong',
        timestamp: Date.now()
      }
      socket.write(JSON.stringify(pong) + '\n')
      return // Don't forward to renderer
    } else if (message.type === 'PONG') {
      return // Don't forward to renderer
    } else if (message.type === 'FILE_META') {
      fileTransferManager.handleIncomingMeta(message)
    } else if (message.type === 'FILE_ACCEPT') {
      fileTransferManager.handleAccept(message)
    } else if (message.type === 'FILE_REJECT') {
      fileTransferManager.handleReject(message)
    }

    sendToRenderer('message-received', message)
  }

  discoveryManager.on('deviceFound', onDeviceFound)
  discoveryManager.on('deviceLost', onDeviceLost)
  tcpServer.on('message', handleIncomingMessage)
  connectionManager.on('message', handleIncomingMessage)

  // Cleanup event listeners when window is destroyed
  mainWindow.on('closed', () => {
    discoveryManager.removeListener('deviceFound', onDeviceFound)
    discoveryManager.removeListener('deviceLost', onDeviceLost)
    tcpServer.removeListener('message', handleIncomingMessage)
    connectionManager.removeListener('message', handleIncomingMessage)
  })
}
