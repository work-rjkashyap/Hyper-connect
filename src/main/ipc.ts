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

  // Discovery
  ipcMain.handle('get-discovered-devices', () => discoveryManager.getDiscoveredDevices())

  // Messaging
  ipcMain.handle('send-message', async (_, deviceId: string, payload: string) => {
    const devices = discoveryManager.getDiscoveredDevices()
    const target = devices.find((d) => d.deviceId === deviceId)
    if (!target) throw new Error('Device not found')

    const message: NetworkMessage = {
      type: 'MESSAGE',
      deviceId: getDeviceInfo().deviceId,
      id: uuidv4(),
      payload,
      timestamp: Date.now()
    }

    try {
      await connectionManager.getConnection(target)
      connectionManager.sendMessage(deviceId, message)
      return message
    } catch (e) {
      console.error('Failed to send message:', e)
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
    if (message.type === 'HELLO') {
      connectionManager.registerSocket(message.deviceId, socket)
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
