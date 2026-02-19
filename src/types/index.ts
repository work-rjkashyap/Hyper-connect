// TypeScript types matching Rust backend (refactored)

// ============================================================================
// Message Status
// ============================================================================

/**
 * Mirrors the Rust `MessageStatus` enum (serialised lowercase).
 *
 * - `sent`      – message was transmitted by the sender to the network.
 * - `delivered` – message was received and stored on the recipient device.
 * - `read`      – the recipient opened the conversation and saw the message.
 */
export type MessageStatus = "sent" | "delivered" | "read";

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
	/** Delivery / read status – replaces the old `read: boolean` field. */
	status: MessageStatus;
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

export interface ConnectionStatusEvent {
	device_id: string;
	connected: boolean;
	latency_ms?: number;
	error?: string;
}

/** Emitted by the Rust backend when the recipient's device acknowledges delivery. */
export interface MessageDeliveredEvent {
	/** Discriminant – always "MESSAGE_DELIVERED" */
	type: string;
	conversation_key: string;
	/** The specific message that was delivered */
	message_id: string;
	/** The device that received the message (ACK sender) */
	from_device_id: string;
	/** The device that originally sent the message (ACK target) */
	to_device_id: string;
}

/** Emitted by the Rust backend when the recipient opens the conversation. */
export interface MessageReadEvent {
	/** Discriminant – always "MESSAGE_READ" */
	type: string;
	conversation_key: string;
	/** Not present for conversation-level read receipts */
	message_id?: string;
	/** The device that read the messages */
	from_device_id: string;
	/** The device whose outgoing messages are now marked read */
	to_device_id: string;
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

// ============================================================================
// System Message Constants (Privacy Layer)
// ============================================================================

/** Prefix used to identify system messages that should not be displayed in chat. */
export const SYSTEM_MESSAGE_PREFIX = "__SYS:";

/** System message content sent when the receiver accepts a chat request. */
export const SYS_CHAT_ACCEPTED = "__SYS:CHAT_ACCEPTED__";

/** System message content sent when the receiver declines a chat request. */
export const SYS_CHAT_DECLINED = "__SYS:CHAT_DECLINED__";

/**
 * Check whether a message is a system message (chat accepted/declined).
 * System messages are transmitted via the existing text message pipeline
 * but should be intercepted by the frontend and never shown in the chat UI.
 */
export function isSystemMessage(message: Message): boolean {
	if (message.message_type.type !== "Text") return false;
	return message.message_type.content.startsWith(SYSTEM_MESSAGE_PREFIX);
}

/**
 * Extract the system message type from a Message.
 * Returns null if the message is not a system message.
 */
export function getSystemMessageType(
	message: Message,
): "CHAT_ACCEPTED" | "CHAT_DECLINED" | null {
	if (!isSystemMessage(message)) return null;
	const content = (message.message_type as { type: "Text"; content: string })
		.content;
	if (content === SYS_CHAT_ACCEPTED) return "CHAT_ACCEPTED";
	if (content === SYS_CHAT_DECLINED) return "CHAT_DECLINED";
	return null;
}
