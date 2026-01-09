import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

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

  // Event Listeners
  onDeviceDiscovered: (callback: any) =>
    ipcRenderer.on('device-discovered', (_, device) => callback(device)),
  onDeviceLost: (callback: any) =>
    ipcRenderer.on('device-lost', (_, deviceId) => callback(deviceId)),
  onMessageReceived: (callback: any) =>
    ipcRenderer.on('message-received', (_, message) => callback(message)),
  onFileReceived: (callback: any) =>
    ipcRenderer.on('file-received', (_, message) => callback(message)),
  onFileTransferProgress: (callback: any) =>
    ipcRenderer.on('file-transfer-progress', (_, progress) => callback(progress))
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
