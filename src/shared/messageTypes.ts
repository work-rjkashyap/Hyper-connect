export interface DeviceInfo {
  deviceId: string
  displayName: string
  platform: string
  appVersion: string
  profileImage?: string
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
  profileImage?: string
}

export interface NetworkMessage {
  type:
    | 'HELLO'
    | 'HELLO_SECURE'
    | 'ENCRYPTED_MESSAGE'
    | 'MESSAGE'
    | 'MESSAGE_DELIVERED'
    | 'MESSAGE_READ'
    | 'FILE_META'
    | 'FILE_ACCEPT'
    | 'FILE_REJECT'
    | 'FILE_PROGRESS'
    | 'FILE_COMPLETE'
    | 'PING'
    | 'PONG'
  deviceId: string
  payload?: unknown
  id?: string
  ackId?: string
  timestamp?: number
  status?: 'sending' | 'sent' | 'delivered' | 'read'
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
  name?: string
  size?: number
  direction?: 'incoming' | 'outgoing'
}
