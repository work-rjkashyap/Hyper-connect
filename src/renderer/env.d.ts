import { ElectronAPI } from '@electron-toolkit/preload'
import { Device, NetworkMessage, FileTransferProgress, DeviceInfo } from '../shared/messageTypes'

export interface IApi {
  getDeviceInfo: () => Promise<DeviceInfo>
  updateDisplayName: (name: string) => Promise<DeviceInfo>
  getDiscoveredDevices: () => Promise<Device[]>
  sendMessage: (deviceId: string, payload: string) => Promise<NetworkMessage>
  sendFile: (deviceId: string, filePath: string) => Promise<NetworkMessage>
  acceptFile: (fileId: string) => Promise<void>
  rejectFile: (fileId: string) => Promise<void>
  selectFile: () => Promise<string | null>
  openFileLocation: (filePath: string) => Promise<void>
  clearCache: () => Promise<boolean>

  onDeviceDiscovered: (callback: (device: Device) => void) => () => void
  onDeviceLost: (callback: (deviceId: string) => void) => () => void
  onMessageReceived: (callback: (message: NetworkMessage) => void) => () => void
  onFileReceived: (callback: (message: NetworkMessage) => void) => () => void
  onFileTransferProgress: (callback: (progress: FileTransferProgress) => void) => () => void
  rescanDevices: () => Promise<void>
  onNavigateToDevice: (callback: (deviceId: string) => void) => () => void
  getDownloadPath: () => Promise<string>
  selectDownloadDirectory: () => Promise<string | null>
  setDownloadPath: (path: string) => Promise<string>
  getAutoAccept: () => Promise<boolean>
  setAutoAccept: (autoAccept: boolean) => Promise<boolean>
  updateProfile: (name?: string, image?: string) => Promise<DeviceInfo>
  markAsRead: (deviceId: string, messageId: string) => Promise<void>
  onMessageStatusUpdated: (
    callback: (data: { deviceId: string; messageId: string; status: 'delivered' | 'read' }) => void
  ) => () => void
}

declare module '*.png' {
  const value: string
  export default value
}

declare module '*.jpg' {
  const value: string
  export default value
}

declare module '*.svg' {
  const value: string
  export default value
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: IApi
  }
}
