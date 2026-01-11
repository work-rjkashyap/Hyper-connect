import { ElectronAPI } from '@electron-toolkit/preload'
import { Device, NetworkMessage, FileTransferProgress, DeviceInfo } from '@shared/messageTypes'

export interface IApi {
  getDeviceInfo: () => Promise<DeviceInfo>
  updateDisplayName: (name: string) => Promise<DeviceInfo>
  getDiscoveredDevices: () => Promise<Device[]>
  sendMessage: (deviceId: string, payload: string, replyTo?: string) => Promise<NetworkMessage>
  sendFile: (deviceId: string, filePath: string, replyTo?: string) => Promise<NetworkMessage>
  acceptFile: (fileId: string) => Promise<void>
  rejectFile: (fileId: string) => Promise<void>
  selectFile: () => Promise<string | null>
  openFileLocation: (filePath: string) => Promise<void>
  clearCache: () => Promise<boolean>
  rescanDevices: () => Promise<void>
  getDownloadPath: () => Promise<string>
  selectDownloadDirectory: () => Promise<string | null>
  setDownloadPath: (path: string) => Promise<string>
  getAutoAccept: () => Promise<boolean>
  setAutoAccept: (autoAccept: boolean) => Promise<boolean>
  markAsRead: (deviceId: string, messageId: string) => Promise<void>
  deleteRemoteMessage: (deviceId: string, messageId: string) => Promise<void>
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void

  onDeviceDiscovered: (callback: (device: Device) => void) => void
  onDeviceLost: (callback: (deviceId: string) => void) => void
  onMessageReceived: (callback: (message: NetworkMessage) => void) => void
  onFileReceived: (callback: (message: NetworkMessage) => void) => void
  onFileTransferProgress: (callback: (progress: FileTransferProgress) => void) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: IApi
  }
}
