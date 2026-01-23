import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { Device, NetworkMessage, FileTransferProgress, DeviceInfo } from '@shared/messageTypes'

export type PermissionType = 'notification' | 'camera' | 'microphone' | 'screen'
export type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'unknown'

console.log('[Preload] Script loading...')

const api = {
  getDeviceInfo: (): Promise<DeviceInfo> => ipcRenderer.invoke('get-device-info'),
  updateDisplayName: (name: string): Promise<DeviceInfo> =>
    ipcRenderer.invoke('update-display-name', name),
  updateProfile: (name?: string, image?: string): Promise<DeviceInfo> =>
    ipcRenderer.invoke('update-profile', name, image),
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
  getDiscoveredDevices: (): Promise<Device[]> => ipcRenderer.invoke('get-discovered-devices'),
  checkPermission: (type: PermissionType): Promise<PermissionStatus> =>
    ipcRenderer.invoke('check-permission', type),
  requestPermission: (type: PermissionType): Promise<boolean> =>
    ipcRenderer.invoke('request-permission', type),
  sendMessage: (deviceId: string, payload: string, replyTo?: string): Promise<NetworkMessage> =>
    ipcRenderer.invoke('send-message', deviceId, payload, replyTo),

  sendFile: (deviceId: string, filePath: string, replyTo?: string): Promise<NetworkMessage> =>
    ipcRenderer.invoke('send-file', deviceId, filePath, replyTo),
  acceptFile: (fileId: string): Promise<void> => ipcRenderer.invoke('accept-file', fileId),
  rejectFile: (fileId: string): Promise<void> => ipcRenderer.invoke('reject-file', fileId),
  selectFile: (): Promise<string | null> => ipcRenderer.invoke('select-file'),
  openFileLocation: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('open-file-location', filePath),
  clearCache: (): Promise<boolean> => ipcRenderer.invoke('clear-cache'),
  rescanDevices: (): Promise<void> => ipcRenderer.invoke('rescan-devices'),
  getDownloadPath: (): Promise<string> => ipcRenderer.invoke('get-download-path'),
  selectDownloadDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke('select-download-directory'),
  setDownloadPath: (path: string): Promise<string> => ipcRenderer.invoke('set-download-path', path),
  getAutoAccept: (): Promise<boolean> => ipcRenderer.invoke('get-auto-accept'),
  setAutoAccept: (autoAccept: boolean): Promise<boolean> =>
    ipcRenderer.invoke('set-auto-accept', autoAccept),
  markAsRead: (deviceId: string, messageId: string): Promise<void> =>
    ipcRenderer.invoke('mark-as-read', deviceId, messageId),
  deleteRemoteMessage: (deviceId: string, messageId: string): Promise<void> =>
    ipcRenderer.invoke('delete-remote-message', deviceId, messageId),

  // Auto-Update
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (): Promise<void> => ipcRenderer.invoke('download-update'),
  quitAndInstall: (): Promise<void> => ipcRenderer.invoke('quit-and-install'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),

  // Window Controls
  minimizeWindow: (): void => ipcRenderer.send('window-minimize'),
  maximizeWindow: (): void => ipcRenderer.send('window-maximize'),
  closeWindow: (): void => ipcRenderer.send('window-close'),

  // Event Listeners
  onDeviceDiscovered: (callback: (device: Device) => void): (() => void) => {
    console.log('[Preload] Registering onDeviceDiscovered listener')
    const listener = (_: unknown, device: unknown): void => {
      console.log('[Preload] device-discovered event received:', device)
      callback(device as Device)
    }
    ipcRenderer.on('device-discovered', listener)
    return (): void => {
      ipcRenderer.removeListener('device-discovered', listener)
    }
  },
  onDeviceLost: (callback: (deviceId: string) => void): (() => void) => {
    console.log('[Preload] Registering onDeviceLost listener')
    const listener = (_: unknown, deviceId: unknown): void => {
      console.log('[Preload] device-lost event received:', deviceId)
      callback(deviceId as string)
    }
    ipcRenderer.on('device-lost', listener)
    return (): void => {
      ipcRenderer.removeListener('device-lost', listener)
    }
  },
  onMessageReceived: (callback: (message: NetworkMessage) => void): (() => void) => {
    const listener = (_: unknown, message: unknown): void => callback(message as NetworkMessage)
    ipcRenderer.on('message-received', listener)
    return (): void => {
      ipcRenderer.removeListener('message-received', listener)
    }
  },
  onFileReceived: (callback: (message: NetworkMessage) => void): (() => void) => {
    const listener = (_: unknown, message: unknown): void => callback(message as NetworkMessage)
    ipcRenderer.on('file-received', listener)
    return (): void => {
      ipcRenderer.removeListener('file-received', listener)
    }
  },
  onFileTransferProgress: (callback: (progress: FileTransferProgress) => void): (() => void) => {
    const listener = (_: unknown, progress: unknown): void =>
      callback(progress as FileTransferProgress)
    ipcRenderer.on('file-transfer-progress', listener)
    return (): void => {
      ipcRenderer.removeListener('file-transfer-progress', listener)
    }
  },
  onNavigateToDevice: (callback: (deviceId: string) => void): (() => void) => {
    const listener = (_: unknown, deviceId: unknown): void => callback(deviceId as string)
    ipcRenderer.on('navigate-to-device', listener)
    return (): void => {
      ipcRenderer.removeListener('navigate-to-device', listener)
    }
  },
  onMessageStatusUpdated: (
    callback: (data: { deviceId: string; messageId: string; status: 'delivered' | 'read' }) => void
  ): (() => void) => {
    const listener = (
      _: unknown,
      data: { deviceId: string; messageId: string; status: 'delivered' | 'read' }
    ): void => callback(data)
    ipcRenderer.on('message-status-updated', listener)
    return (): void => {
      ipcRenderer.removeListener('message-status-updated', listener)
    }
  },
  onRemoteMessageDeleted: (
    callback: (data: { deviceId: string; messageId: string }) => void
  ): (() => void) => {
    const listener = (_: unknown, data: { deviceId: string; messageId: string }): void =>
      callback(data)
    ipcRenderer.on('remote-message-deleted', listener)
    return (): void => {
      ipcRenderer.removeListener('remote-message-deleted', listener)
    }
  },

  // Auto-Update Event Listeners
  onUpdateChecking: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('update-checking', listener)
    return (): void => {
      ipcRenderer.removeListener('update-checking', listener)
    }
  },
  onUpdateAvailable: (callback: (info: unknown) => void): (() => void) => {
    const listener = (_: unknown, info: unknown): void => callback(info)
    ipcRenderer.on('update-available', listener)
    return (): void => {
      ipcRenderer.removeListener('update-available', listener)
    }
  },
  onUpdateNotAvailable: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('update-not-available', listener)
    return (): void => {
      ipcRenderer.removeListener('update-not-available', listener)
    }
  },
  onUpdateDownloadProgress: (callback: (progress: unknown) => void): (() => void) => {
    const listener = (_: unknown, progress: unknown): void => callback(progress)
    ipcRenderer.on('update-download-progress', listener)
    return (): void => {
      ipcRenderer.removeListener('update-download-progress', listener)
    }
  },
  onUpdateDownloaded: (callback: (info: unknown) => void): (() => void) => {
    const listener = (_: unknown, info: unknown): void => callback(info)
    ipcRenderer.on('update-downloaded', listener)
    return (): void => {
      ipcRenderer.removeListener('update-downloaded', listener)
    }
  },
  onUpdateError: (callback: (error: string) => void): (() => void) => {
    const listener = (_: unknown, error: string): void => callback(error)
    ipcRenderer.on('update-error', listener)
    return (): void => {
      ipcRenderer.removeListener('update-error', listener)
    }
  }
}

console.log('[Preload] API object created:', Object.keys(api))

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    console.log('[Preload] Context bridge exposed successfully')
  } catch (error) {
    console.error('[Preload] Context bridge error:', error)
  }
} else {
  // @ts-ignore (fallback for non-isolated context)
  window.electron = electronAPI
  // @ts-ignore (fallback for non-isolated context)
  window.api = api
  console.log('[Preload] Direct window assignment (no context isolation)')
}
