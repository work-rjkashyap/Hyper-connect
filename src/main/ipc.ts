import { ipcMain, BrowserWindow } from 'electron'
import net from 'net'
import { getDeviceInfo, updateProfile } from './identity'
import { discoveryManager } from './discovery'
import { tcpServer } from './tcpServer'
import { connectionManager } from './protocol'
import { permissionManager, PermissionType } from './permissions'

import { NetworkMessage, Device } from '@shared/messageTypes'
import { v4 as uuidv4 } from 'uuid'
import { fileTransferManager } from './fileTransfer'
import { isSensitiveMessageType } from './crypto/messageCrypto'
import { NotificationManager } from './notifications'

export function setupIpc(mainWindow: BrowserWindow): void {
  const notificationManager = new NotificationManager(mainWindow)
  fileTransferManager.setup(mainWindow)

  // Safe message sending helper - checks if window is destroyed before sending
  const sendToRenderer = (channel: string, ...args: unknown[]): void => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, ...args)
    }
  }

  // Permissions
  ipcMain.handle('check-permission', (_, type: PermissionType) =>
    permissionManager.checkPermission(type)
  )
  ipcMain.handle('request-permission', (_, type: PermissionType) =>
    permissionManager.requestPermission(type)
  )

  // Device Info
  ipcMain.handle('get-device-info', () => getDeviceInfo())
  ipcMain.handle('update-display-name', (_, name: string) => {
    updateProfile(name)
    return getDeviceInfo()
  })
  ipcMain.handle('update-profile', (_, name?: string, image?: string) => {
    updateProfile(name, image)
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

  // Download Directory Management
  ipcMain.handle('get-download-path', async () => {
    const { app } = await import('electron')
    const Store = (await import('electron-store')).default
    const store = new Store()
    const customPath = store.get('downloadPath') as string | undefined
    return customPath || app.getPath('downloads')
  })

  ipcMain.handle('select-download-directory', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Download Directory'
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })

  ipcMain.handle('set-download-path', async (_, path: string) => {
    const Store = (await import('electron-store')).default
    const store = new Store()
    store.set('downloadPath', path)
    return path
  })

  // Auto-accept Preference
  ipcMain.handle('get-auto-accept', async () => {
    const Store = (await import('electron-store')).default
    const store = new Store()
    return store.get('autoAccept', false) as boolean
  })

  ipcMain.handle('set-auto-accept', async (_, autoAccept: boolean) => {
    const Store = (await import('electron-store')).default
    const store = new Store()
    store.set('autoAccept', autoAccept)
    return autoAccept
  })

  // Network Info
  ipcMain.handle('get-network-info', async () => {
    const os = await import('os')
    const networkInterfaces = os.networkInterfaces()
    const addresses: string[] = []

    for (const iface of Object.values(networkInterfaces)) {
      if (!iface) continue
      for (const addr of iface) {
        // IPv4, not loopback
        if (addr.family === 'IPv4' && !addr.internal) {
          addresses.push(addr.address)
        }
      }
    }

    return {
      port: tcpServer.port,
      addresses,
      activeConnections: tcpServer['connections'].size
    }
  })

  // Auto-Update Handlers
  ipcMain.handle('check-for-updates', async () => {
    const { checkForUpdates } = await import('./autoUpdater')
    await checkForUpdates()
  })

  ipcMain.handle('download-update', async () => {
    const { downloadUpdate } = await import('./autoUpdater')
    await downloadUpdate()
  })

  ipcMain.handle('quit-and-install', async () => {
    const { quitAndInstall } = await import('./autoUpdater')
    quitAndInstall()
  })

  ipcMain.handle('get-app-version', async () => {
    const { app } = await import('electron')
    return app.getVersion()
  })

  // Discovery
  ipcMain.handle('get-discovered-devices', () => discoveryManager.getDiscoveredDevices())
  ipcMain.handle('rescan-devices', () => discoveryManager.rescan())

  // Messaging
  ipcMain.handle('send-message', async (_, deviceId: string, payload: string, replyTo?: string) => {
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
      timestamp: Date.now(),
      replyTo
    }

    try {
      console.log(
        `[IPC] Connecting to ${target.displayName} at ${target.address}:${target.port}...`
      )
      await connectionManager.getConnection(target)
      console.log(`[IPC] Connection established, sending payload`)
      connectionManager.sendMessage(deviceId, message)
      return message
    } catch {
      console.error(`[IPC] Failed to reach ${target.address}:${target.port}`)
      throw new Error(`Failed to reach ${target.address}:${target.port}`)
    }
  })

  ipcMain.handle('mark-as-read', async (_, deviceId: string, messageId: string) => {
    const ack: NetworkMessage = {
      type: 'MESSAGE_READ',
      deviceId: getDeviceInfo().deviceId,
      ackId: messageId,
      timestamp: Date.now(),
      status: 'read'
    }
    connectionManager.sendMessage(deviceId, ack)
  })

  ipcMain.handle('delete-remote-message', async (_, deviceId: string, messageId: string) => {
    const message: NetworkMessage = {
      type: 'MESSAGE_DELETE',
      deviceId: getDeviceInfo().deviceId,
      ackId: messageId,
      timestamp: Date.now()
    }
    connectionManager.sendMessage(deviceId, message)
  })

  // Forward events to renderer with safe sending
  const onDeviceFound = (device: Device): void => {
    console.log('[IPC] Device found, sending to renderer:', device)
    sendToRenderer('device-discovered', device)
    notificationManager.showNewDeviceNotification(device)
    console.log('[IPC] Device-discovered event sent')
  }

  const onDeviceLost = (deviceId: string): void => {
    sendToRenderer('device-lost', deviceId)
  }

  const handleIncomingMessage = (
    message: NetworkMessage,
    socket: net.Socket,
    isEncrypted?: boolean
  ): void => {
    // Mark device as online whenever we receive any traffic from it
    discoveryManager.markDeviceOnline(message.deviceId)

    // Security check: reject sensitive messages if not encrypted
    if (isSensitiveMessageType(message.type) && !isEncrypted) {
      console.error(
        `[IPC] Rejecting unencrypted sensitive message ${message.type} from ${message.deviceId}`
      )
      return
    }

    if (message.type === 'HELLO') {
      connectionManager.registerSocket(message.deviceId, socket)
    } else if (message.type === 'PING') {
      const pong: NetworkMessage = {
        type: 'PONG',
        deviceId: getDeviceInfo().deviceId,
        id: 'pong',
        timestamp: Date.now()
      }
      tcpServer.sendMessage(socket, pong)
      return // Don't forward to renderer
    } else if (message.type === 'PONG') {
      return // Don't forward to renderer
    } else if (message.type === 'FILE_META') {
      fileTransferManager.handleIncomingMeta(message)
    } else if (message.type === 'FILE_ACCEPT') {
      fileTransferManager.handleAccept(message)
    } else if (message.type === 'FILE_REJECT') {
      fileTransferManager.handleReject(message)
    } else if (message.type === 'MESSAGE_DELIVERED' || message.type === 'MESSAGE_READ') {
      sendToRenderer('message-status-updated', {
        deviceId: message.deviceId,
        messageId: message.ackId,
        status: message.type === 'MESSAGE_DELIVERED' ? 'delivered' : 'read'
      })
      return
    } else if (message.type === 'MESSAGE_DELETE') {
      sendToRenderer('remote-message-deleted', {
        deviceId: message.deviceId,
        messageId: message.ackId
      })
      return
    }

    if (message.type === 'MESSAGE') {
      // Send delivery ack
      const ack: NetworkMessage = {
        type: 'MESSAGE_DELIVERED',
        deviceId: getDeviceInfo().deviceId,
        ackId: message.id,
        timestamp: Date.now(),
        status: 'delivered'
      }
      connectionManager.sendMessage(message.deviceId, ack)
    }

    sendToRenderer('message-received', message)
    notificationManager.showNewMessageNotification(message)
  }

  discoveryManager.on('deviceFound', onDeviceFound)
  discoveryManager.on('deviceLost', onDeviceLost)
  tcpServer.on('message', handleIncomingMessage)
  connectionManager.on('message', handleIncomingMessage)

  // Window Controls
  ipcMain.on('window-minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize()
    }
  })

  ipcMain.on('window-maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow.maximize()
      }
    }
  })

  ipcMain.on('window-close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close()
    }
  })

  // Cleanup event listeners when window is destroyed
  mainWindow.on('closed', () => {
    discoveryManager.removeListener('deviceFound', onDeviceFound)
    discoveryManager.removeListener('deviceLost', onDeviceLost)
    tcpServer.removeListener('message', handleIncomingMessage)
    connectionManager.removeListener('message', handleIncomingMessage)
  })
}
