// TypeScript types matching Rust backend (refactored)

// ============================================================================
// Message Status
// ============================================================================

/**
 * Mirrors the Rust `MessageStatus` enum (serialised lowercase).
 *
 * - `queued`    – message is waiting to be sent (peer was offline).
 * - `sent`      – message was transmitted by the sender to the network.
 * - `delivered` – message was received and stored on the recipient device.
 * - `read`      – the recipient opened the conversation and saw the message.
 */
export type MessageStatus = "queued" | "sent" | "delivered" | "read";

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
// Group Chat Types
// ============================================================================

export type GroupRole = "host" | "member";

export interface GroupChat {
	id: string;
	name: string;
	creator_device_id: string;
	host_device_id: string;
	created_at: number;
	updated_at: number;
}

export interface GroupMember {
	group_id: string;
	device_id: string;
	role: GroupRole;
	joined_at: number;
}

export interface GroupMessage {
	id: string;
	group_id: string;
	from_device_id: string;
	msg_type: string;
	content: string;
	reply_to: string | null;
	timestamp: number;
}

export interface GroupSummary {
	group: GroupChat;
	members: GroupMember[];
	last_message: GroupMessage | null;
	unread_count: number;
}

export interface GroupMemberInfo {
	device_id: string;
	role: GroupRole;
}

export type GroupControlAction =
	| "create"
	| "member_added"
	| "member_removed"
	| "host_changed"
	| "disband";

export interface GroupControlPayload {
	type: string;
	action: GroupControlAction;
	group_id: string;
	group_name: string;
	from_device_id: string;
	target_device_id: string | null;
	host_device_id: string;
	members: GroupMemberInfo[];
	timestamp: number;
}

export interface GroupMessagePayload {
	type: string;
	id: string;
	group_id: string;
	from_device_id: string;
	msg_content_type: string;
	content: string;
	reply_to: string | null;
	timestamp: number;
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
	AwaitingAcceptance = "AwaitingAcceptance",
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
	/** Compression algorithm used (e.g. "zstd"), or null if uncompressed. */
	compression: string | null;
	/** Compression ratio: original_size / compressed_bytes_sent. e.g. 2.0 = 50% reduction. */
	compression_ratio: number | null;
	/** Number of parallel TCP streams used for this transfer. 1 = single-stream, >1 = parallel. */
	parallel_streams: number;
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

// The Rust backend emits the FileTransfer struct directly as the event payload
// (not wrapped in { transfer: ... }).
export type FileRequestReceivedEvent = FileTransfer;

export interface TransferProgressEvent {
	transfer_id: string;
	transferred: number;
	total: number;
	speed_bps: number;
	eta_seconds: number | null;
	/** Compression ratio for this transfer (if compression is active). */
	compression_ratio: number | null;
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

export interface TransferResumedEvent {
	transfer_id: string;
	resume_offset: number;
}

// ============================================================================
// Full-Text Search Types (Feature #18)
// ============================================================================

export interface MessageSearchResult {
	id: string;
	conversation_key: string;
	from_device_id: string;
	to_device_id: string;
	msg_type: string;
	content: string;
	timestamp: number;
	/** FTS5 snippet with search term highlighted (wrapped in <b>…</b>) */
	snippet: string;
	/** FTS5 rank score (lower = more relevant) */
	rank: number;
}

export interface GroupMessageSearchResult {
	id: string;
	group_id: string;
	from_device_id: string;
	msg_type: string;
	content: string;
	timestamp: number;
	snippet: string;
	rank: number;
}

export interface FileSearchResult {
	id: string;
	filename: string;
	from_device_id: string;
	to_device_id: string;
	status: string;
	size: number;
	created_at: number;
	snippet: string;
	rank: number;
}

/** Discriminated union of search results — use `kind` to distinguish. */
export type SearchResult =
	| ({ kind: "message" } & MessageSearchResult)
	| ({ kind: "group_message" } & GroupMessageSearchResult)
	| ({ kind: "file" } & FileSearchResult);

export interface SearchResponse {
	query: string;
	results: SearchResult[];
	message_count: number;
	group_message_count: number;
	file_count: number;
	total_count: number;
}

export interface SecurityErrorEvent {
	device_id: string;
	error: string;
}

/** Result of a flush_message_queue IPC call. */
export interface FlushResult {
	device_id: string;
	flushed: number;
	remaining: number;
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

// ============================================================================
// Secure Handshake / SAS Verification Types
// ============================================================================

/**
 * The current state of the SAS verification process for a specific peer.
 * Mirrors Rust's `VerificationState` enum (serialised snake_case).
 */
export type VerificationState =
	| "none"
	| "pending_confirmation"
	| "local_confirmed"
	| "verified"
	| "rejected"
	| { failed: string };

/**
 * Snapshot of a single peer's verification status, returned by
 * `get_verification_status` IPC command.
 */
export interface VerificationStatus {
	device_id: string;
	display_name: string;
	state: VerificationState;
	verification_code: string | null;
	initiated_at: number | null;
}

/**
 * Event payload emitted when a verification code is ready for the user
 * to compare with the peer's display.
 */
export interface VerificationCodeReadyEvent {
	device_id: string;
	display_name: string;
	verification_code: string;
	initiated_by_us: boolean;
}

/**
 * Event payload emitted when both sides confirmed and the session is verified.
 */
export interface HandshakeVerifiedEvent {
	device_id: string;
	display_name: string;
	verification_code: string;
}

/**
 * Event payload emitted when either side rejects the verification code.
 */
export interface HandshakeRejectedEvent {
	device_id: string;
	display_name: string;
	rejected_by: "local" | "remote";
	reason: string | null;
}

/**
 * Event payload emitted when the remote side has confirmed but the
 * local user hasn't yet.
 */
export interface VerificationRemoteConfirmedEvent {
	device_id: string;
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
// Group Chat Event Types
// ============================================================================

export interface GroupCreatedEvent {
	group: GroupChat;
}

export interface GroupMemberAddedEvent {
	group_id: string;
	device_id: string;
}

export interface GroupMemberRemovedEvent {
	group_id: string;
	device_id: string;
}

export interface GroupHostChangedEvent {
	group_id: string;
	host_device_id: string;
}

export interface GroupDisbandedEvent {
	group_id: string;
}

// ============================================================================
// Screen Share Types
// ============================================================================

export type StreamQuality = "low" | "medium" | "high";

export type ScreenShareState =
	| "idle"
	| "offering"
	| "awaiting_acceptance"
	| "streaming"
	| "stopping";

export interface ScreenShareSession {
	session_id: string;
	broadcaster_id: string;
	broadcaster_name: string;
	viewer_id: string;
	viewer_name: string;
	state: ScreenShareState;
	quality: StreamQuality;
	stream_port: number;
	display_index: number;
	screen_width: number;
	screen_height: number;
	created_at: number;
	updated_at: number;
}

export interface ScreenShareOfferEvent {
	session_id: string;
	from_device_id: string;
	from_display_name: string;
	quality: StreamQuality;
	screen_width: number;
	screen_height: number;
}

export interface ScreenShareAnswerEvent {
	session_id: string;
	from_device_id: string;
	accepted: boolean;
	reason: string | null;
}

export interface ScreenShareStoppedEvent {
	session_id: string;
	from_device_id: string;
	reason: string | null;
}

export interface ScreenShareStatsEvent {
	session_id: string;
	/** Current frames per second */
	fps: number;
	/** Average frame size in bytes */
	avg_frame_size: number;
	/** Total bytes transferred in this session */
	total_bytes: number;
	/** Estimated latency in milliseconds */
	latency_ms: number;
	/** Number of dropped/lost frames */
	dropped_frames: number;
}

export interface ScreenShareStateChangedEvent {
	session_id: string;
	state: ScreenShareState;
	/** "broadcaster" or "viewer" */
	role: "broadcaster" | "viewer";
	peer_device_id: string;
	peer_display_name: string;
}

export interface ScreenShareFrameEvent {
	session_id: string;
	frame_seq: number;
	width: number;
	height: number;
	/** Base64-encoded JPEG data */
	jpeg_base64: string;
}

// ============================================================================
// Mesh Routing Types
// ============================================================================

export interface MeshRoute {
	device_id: string;
	device_name: string;
	hop_count: number;
	is_direct: boolean;
	next_hop_id: string;
	latency_ms: number | null;
	is_active: boolean;
}

export interface MeshRoutingUpdatedEvent {
	total_destinations: number;
	direct_peers: number;
	relayed_destinations: number;
	routes: MeshRoute[];
}

export interface MeshMessageRelayedEvent {
	relay_id: string;
	origin_device_id: string;
	final_destination_id: string;
	hop_count: number;
	ttl: number;
}

export interface MeshMessageDeliveredEvent {
	relay_id: string;
	origin_device_id: string;
	origin_display_name: string;
	hop_count: number;
}

// ============================================================================
// AI Types (Google Gemini Integration)
// ============================================================================

export type AiModel =
	| "gemini-2.5-flash"
	| "gemini-2.0-flash"
	| "gemini-2.5-pro";

export type AiAction =
	| "summarize"
	| "smart_reply"
	| "ask"
	| "smart_search"
	| "analyze";

export type AiServiceStatus =
	| "not_configured"
	| "ready"
	| "processing"
	| "error";

export type AiChatRole = "user" | "assistant" | "system";

export interface AiStatus {
	status: AiServiceStatus;
	model: AiModel;
	has_api_key: boolean;
	request_count: number;
	total_tokens_used: number;
	last_error: string | null;
}

export interface AiChatMessage {
	id: string;
	role: AiChatRole;
	content: string;
	timestamp: number;
	action: AiAction | null;
	tokens_used: number | null;
}

export interface SummarizeResponse {
	summary: string;
	message_count: number;
	tokens_used: number;
	model: string;
}

export interface SmartReplyResponse {
	suggestions: string[];
	tokens_used: number;
	model: string;
}

export interface AskResponse {
	answer: string;
	tokens_used: number;
	model: string;
}

export interface SmartSearchResult {
	content: string;
	conversation_id: string;
	is_group: boolean;
	from_device_id: string;
	timestamp: number;
	relevance: string;
}

export interface SmartSearchResponse {
	results: SmartSearchResult[];
	query: string;
	tokens_used: number;
	model: string;
}

export interface AnalyzeResponse {
	tone: string;
	topics: string[];
	activity: string;
	insights: string[];
	tokens_used: number;
	model: string;
}

// AI Events

export interface AiProcessingEvent {
	action: AiAction;
	conversation_id: string | null;
}

export interface AiCompletedEvent {
	action: AiAction;
	conversation_id: string | null;
	tokens_used: number;
	success: boolean;
	error: string | null;
}

export interface AiStatusChangedEvent {
	status: AiServiceStatus;
	has_api_key: boolean;
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

// ============================================================================
// Verification Helpers
// ============================================================================

/**
 * Check whether a verification state represents a successfully verified session.
 */
export function isVerified(state: VerificationState): boolean {
	return state === "verified";
}

/**
 * Check whether verification is still in progress (waiting for confirmation).
 */
export function isVerificationPending(state: VerificationState): boolean {
	return state === "pending_confirmation" || state === "local_confirmed";
}

/**
 * Get a human-readable label for a verification state.
 */
export function getVerificationLabel(state: VerificationState): string {
	if (typeof state === "object" && "failed" in state) {
		return `Failed: ${state.failed}`;
	}
	switch (state) {
		case "none":
			return "Not verified";
		case "pending_confirmation":
			return "Awaiting confirmation";
		case "local_confirmed":
			return "Waiting for peer";
		case "verified":
			return "Verified";
		case "rejected":
			return "Rejected";
		default:
			return "Unknown";
	}
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

// Helper to get group display name with member count
export function getGroupDisplayName(
	group: GroupChat,
	memberCount: number,
): string {
	return `${group.name} (${memberCount})`;
}

// Helper to check if a device is the host of a group
export function isGroupHost(group: GroupChat, deviceId: string): boolean {
	return group.host_device_id === deviceId;
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
