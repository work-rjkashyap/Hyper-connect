import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

console.log('[Preload] Script loading...')

const api = {
  getDeviceInfo: () => ipcRenderer.invoke('get-device-info'),
  updateDisplayName: (name: string) => ipcRenderer.invoke('update-display-name', name),
  getDiscoveredDevices: () => ipcRenderer.invoke('get-discovered-devices'),
  sendMessage: (deviceId: string, payload: string) =>
    ipcRenderer.invoke('send-message', deviceId, payload),
  sendFile: (deviceId: string, filePath: string) =>
    ipcRenderer.invoke('send-file', deviceId, filePath),
  acceptFile: (fileId: string) => ipcRenderer.invoke('accept-file', fileId),
  rejectFile: (fileId: string) => ipcRenderer.invoke('reject-file', fileId),
  selectFile: () => ipcRenderer.invoke('select-file'),
  openFileLocation: (filePath: string) => ipcRenderer.invoke('open-file-location', filePath),

  // Event Listeners
  onDeviceDiscovered: (callback: any) => {
    console.log('[Preload] Registering onDeviceDiscovered listener')
    ipcRenderer.on('device-discovered', (_, device) => {
      console.log('[Preload] device-discovered event received:', device)
      callback(device)
    })
  },
  onDeviceLost: (callback: any) => {
    console.log('[Preload] Registering onDeviceLost listener')
    ipcRenderer.on('device-lost', (_, deviceId) => {
      console.log('[Preload] device-lost event received:', deviceId)
      callback(deviceId)
    })
  },
  onMessageReceived: (callback: any) =>
    ipcRenderer.on('message-received', (_, message) => callback(message)),
  onFileReceived: (callback: any) =>
    ipcRenderer.on('file-received', (_, message) => callback(message)),
  onFileTransferProgress: (callback: any) =>
    ipcRenderer.on('file-transfer-progress', (_, progress) => callback(progress))
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
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
  console.log('[Preload] Direct window assignment (no context isolation)')
}
