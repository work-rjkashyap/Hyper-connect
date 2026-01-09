import { ipcMain, BrowserWindow } from 'electron'
import { getDeviceInfo, updateDisplayName } from './identity'
import { discoveryManager } from './discovery'
import { tcpServer } from './tcpServer'
import { connectionManager } from './protocol'
import { NetworkMessage, Device } from '../shared/messageTypes'
import { v4 as uuidv4 } from 'uuid'
import { fileTransferManager } from './fileTransfer'

export function setupIpc(mainWindow: BrowserWindow) {
  fileTransferManager.setup(mainWindow)

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

  // Forward events to renderer
  discoveryManager.on('deviceFound', (device: Device) => {
    mainWindow.webContents.send('device-discovered', device)
  })

  discoveryManager.on('deviceLost', (deviceId: string) => {
    mainWindow.webContents.send('device-lost', deviceId)
  })

  const handleIncomingMessage = (message: NetworkMessage, socket: any) => {
    if (message.type === 'HELLO') {
      connectionManager.registerSocket(message.deviceId, socket)
    } else if (message.type === 'FILE_META') {
      fileTransferManager.handleIncomingMeta(message)
    } else if (message.type === 'FILE_ACCEPT') {
      fileTransferManager.handleAccept(message)
    } else if (message.type === 'FILE_REJECT') {
      fileTransferManager.handleReject(message)
    }

    mainWindow.webContents.send('message-received', message)
  }

  tcpServer.on('message', handleIncomingMessage)
  connectionManager.on('message', handleIncomingMessage)
}
