export interface DeviceInfo {
  deviceId: string
  displayName: string
  platform: string
  appVersion: string
}

export interface Device {
  deviceId: string
  displayName: string
  platform: string
  appVersion: string
  address: string
  port: number
  lastSeen: number
  isOnline: boolean
}

export interface NetworkMessage {
  type:
    | 'HELLO'
    | 'MESSAGE'
    | 'FILE_META'
    | 'FILE_ACCEPT'
    | 'FILE_REJECT'
    | 'FILE_PROGRESS'
    | 'FILE_COMPLETE'
  deviceId: string
  payload?: any
  id?: string
  timestamp?: number
}

export interface FileMetadata {
  fileId: string
  name: string
  size: number
  path?: string
}

export interface FileTransferProgress {
  fileId: string
  deviceId: string
  progress: number
  speed: number
  eta: number
  status: 'pending' | 'active' | 'completed' | 'failed' | 'rejected'
  path?: string
}
