// TypeScript types matching Rust backend
export interface Device {
  id: string;
  name: string;
  hostname: string;
  port: number;
  addresses: string[];
  last_seen: number;
  os: string;
  service_name: string;
}

export interface MessageType {
  type: 'Text' | 'Emoji' | 'Reply' | 'File';
  content?: string;
  emoji?: string;
  reply_to?: string;
  file_id?: string;
  filename?: string;
  size?: number;
}

export interface Message {
  id: string;
  from_device_id: string;
  to_device_id: string;
  message_type: MessageType;
  timestamp: number;
  thread_id?: string;
  read: boolean;
}

export interface Thread {
  id: string;
  participants: string[];
  last_message_timestamp: number;
  unread_count: number;
}

export enum TransferStatus {
  Pending = 'Pending',
  InProgress = 'InProgress',
  Paused = 'Paused',
  Completed = 'Completed',
  Failed = 'Failed',
  Cancelled = 'Cancelled',
}

export interface FileTransfer {
  id: string;
  filename: string;
  file_path?: string;
  size: number;
  transferred: number;
  status: TransferStatus;
  from_device_id: string;
  to_device_id: string;
  checksum?: string;
  created_at: number;
  updated_at: number;
}
