import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { Device, NetworkMessage, FileTransferProgress, DeviceInfo } from '@shared/messageTypes'

console.log('[Preload] Script loading...')

const api = {
  getDeviceInfo: (): Promise<DeviceInfo> => ipcRenderer.invoke('get-device-info'),
  updateDisplayName: (name: string): Promise<DeviceInfo> =>
    ipcRenderer.invoke('update-display-name', name),
  getDiscoveredDevices: (): Promise<Device[]> => ipcRenderer.invoke('get-discovered-devices'),
  sendMessage: (deviceId: string, payload: string): Promise<NetworkMessage> =>
    ipcRenderer.invoke('send-message', deviceId, payload),
  sendFile: (deviceId: string, filePath: string): Promise<NetworkMessage> =>
    ipcRenderer.invoke('send-file', deviceId, filePath),
  acceptFile: (fileId: string): Promise<void> => ipcRenderer.invoke('accept-file', fileId),
  rejectFile: (fileId: string): Promise<void> => ipcRenderer.invoke('reject-file', fileId),
  selectFile: (): Promise<string | null> => ipcRenderer.invoke('select-file'),
  openFileLocation: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('open-file-location', filePath),
  clearCache: (): Promise<boolean> => ipcRenderer.invoke('clear-cache'),
  rescanDevices: (): Promise<void> => ipcRenderer.invoke('rescan-devices'),

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
