// TypeScript types matching Rust backend (refactored)

// ============================================================================
// Identity Types
// ============================================================================

export interface DeviceIdentity {
  device_id: string;
  display_name: string;
  platform: string;
  app_version: string;
}

// ============================================================================
// Discovery Types
// ============================================================================

export interface Device {
  device_id: string;
  display_name: string;
  hostname: string;
  addresses: string[];
  port: number;
  platform: string;
  app_version: string;
  last_seen: number;
}

// ============================================================================
// Messaging Types
// ============================================================================

// Matches Rust's #[serde(tag = "type")] internally-tagged enum
export type MessageType =
  | { type: "Text"; content: string }
  | { type: "Emoji"; emoji: string }
  | { type: "Reply"; content: string; reply_to: string }
  | { type: "File"; file_id: string; filename: string; size: number };

export interface Message {
  id: string;
  from_device_id: string;
  to_device_id: string;
  message_type: MessageType;
  timestamp: number;
  thread_id: string | null;
  read: boolean;
}

export interface Thread {
  id: string;
  participants: string[];
  last_message_timestamp: number;
  unread_count: number;
}

// ============================================================================
// File Transfer Types
// ============================================================================

export enum TransferStatus {
  Pending = "Pending",
  InProgress = "InProgress",
  Paused = "Paused",
  Completed = "Completed",
  Failed = "Failed",
  Cancelled = "Cancelled",
  Rejected = "Rejected",
}

export interface FileTransfer {
  id: string;
  filename: string;
  file_path: string | null;
  size: number;
  transferred: number;
  status: TransferStatus;
  from_device_id: string;
  to_device_id: string;
  checksum: string | null;
  error: string | null;
  created_at: number;
  updated_at: number;
  speed_bps: number;
  eta_seconds: number | null;
}

// ============================================================================
// Event Payloads
// ============================================================================

export interface DeviceDiscoveredEvent {
  device: Device;
}

export interface DeviceRemovedEvent {
  device_id: string;
}

export interface DeviceConnectedEvent {
  device_id: string;
  address: string;
}

export interface DeviceDisconnectedEvent {
  device_id: string;
}

// Network protocol payload (matches Rust TextMessagePayload)
export interface TextMessagePayload {
  id: string;
  from_device_id: string;
  to_device_id: string;
  content: string;
  timestamp: number;
  thread_id: string | null;
}

export interface MessageReceivedEvent {
  message: Message;
  conversation_key: string;
}

export interface MessageSentEvent {
  message: Message;
}

export interface FileRequestReceivedEvent {
  transfer: FileTransfer;
}

export interface TransferProgressEvent {
  transfer_id: string;
  transferred: number;
  total: number;
  speed_bps: number;
  eta_seconds: number | null;
}

export interface TransferCompletedEvent {
  transfer_id: string;
  checksum: string;
}

export interface TransferFailedEvent {
  transfer_id: string;
  error: string;
}

export interface FileCancelledEvent {
  transfer_id: string;
}

export interface FileRejectedEvent {
  transfer_id: string;
}

export interface SecurityErrorEvent {
  device_id: string;
  error: string;
}

// ============================================================================
// Helper Types
// ============================================================================

export interface TransferProgress {
  transferred: number;
  total: number;
  percentage: number;
  speed_bps: number;
  eta_seconds: number | null;
}

// Type guards for MessageType
export function isTextMessage(
  msg: MessageType,
): msg is { type: "Text"; content: string } {
  return msg.type === "Text";
}

export function isEmojiMessage(
  msg: MessageType,
): msg is { type: "Emoji"; emoji: string } {
  return msg.type === "Emoji";
}

export function isReplyMessage(
  msg: MessageType,
): msg is { type: "Reply"; content: string; reply_to: string } {
  return msg.type === "Reply";
}

export function isFileMessage(
  msg: MessageType,
): msg is { type: "File"; file_id: string; filename: string; size: number } {
  return msg.type === "File";
}

// Helper to extract message content
export function getMessageContent(messageType: MessageType): string {
  if (isTextMessage(messageType)) {
    return messageType.content;
  } else if (isEmojiMessage(messageType)) {
    return messageType.emoji;
  } else if (isReplyMessage(messageType)) {
    return messageType.content;
  } else if (isFileMessage(messageType)) {
    return `📎 ${messageType.filename}`;
  }
  return "";
}

// Helper to format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// Helper to format transfer speed
export function formatSpeed(bps: number): string {
  if (bps === 0) return "0 B/s";
  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
  const i = Math.floor(Math.log(bps) / Math.log(k));
  return Math.round((bps / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// Helper to format ETA
export function formatETA(seconds: number | null): string {
  if (seconds === null || seconds === 0) return "Calculating...";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

// Helper to generate conversation key
export function getConversationKey(
  deviceId1: string,
  deviceId2: string,
): string {
  return [deviceId1, deviceId2].sort().join("_");
}
