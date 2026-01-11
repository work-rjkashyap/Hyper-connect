import { Notification, BrowserWindow } from 'electron'
import { NetworkMessage, Device, FileMetadata } from '../shared/messageTypes'
import { discoveryManager } from './discovery'

export class NotificationManager {
  private mainWindow: BrowserWindow

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  public showNewMessageNotification(message: NetworkMessage): void {
    // Don't show notification if window is focused
    if (this.mainWindow.isFocused()) {
      return
    }

    if (message.type !== 'MESSAGE' && message.type !== 'FILE_META') {
      return
    }

    const device = discoveryManager
      .getDiscoveredDevices()
      .find((d) => d.deviceId === message.deviceId)
    const deviceName = device?.displayName || 'Unknown Device'

    const isFile = message.type === 'FILE_META'
    const title = isFile ? `File from ${deviceName}` : `New message from ${deviceName}`
    const body = isFile ? (message.payload as FileMetadata).name : (message.payload as string)

    const notification = new Notification({
      title,
      body,
      silent: false
    })

    notification.on('click', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore()
        this.mainWindow.show()
        this.mainWindow.focus()

        // We could also send an IPC event to the renderer to navigate to the specific device
        this.mainWindow.webContents.send('navigate-to-device', message.deviceId)
      }
    })

    notification.show()
  }

  public showNewDeviceNotification(device: Device): void {
    // Optional: Only show if window is not focused
    // if (this.mainWindow.isFocused()) return;

    const notification = new Notification({
      title: 'New Device Connected',
      body: `${device.displayName} is now online`,
      silent: true // Connection notifications should be quieter
    })

    notification.on('click', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore()
        this.mainWindow.show()
        this.mainWindow.focus()
      }
    })

    notification.show()
  }
}
