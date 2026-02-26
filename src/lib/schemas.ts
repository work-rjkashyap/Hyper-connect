import { z } from "zod";

// ============================================================================
// DEVICE & PEER SCHEMAS
// ============================================================================

export const deviceSchema = z.object({
	device_id: z.string(), // Removed .uuid() for robustness with mDNS names
	display_name: z.string().min(1).max(100),
	hostname: z.string(),
	port: z.number().int().min(1).max(65535),
	addresses: z.array(z.string()), // Robust IP/hostname array
	last_seen: z.number().int(),
	platform: z.string(),
	app_version: z.string(),
});

export const peerSchema = deviceSchema; // Alias for backward compatibility

// ============================================================================
// MESSAGE SCHEMAS
// ============================================================================

export const messageTypeSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("Text"),
		content: z.string().min(1),
	}),
	z.object({
		type: z.literal("Emoji"),
		emoji: z.string(),
	}),
	z.object({
		type: z.literal("Reply"),
		content: z.string().min(1),
		reply_to: z.string().uuid(),
	}),
	z.object({
		type: z.literal("File"),
		file_id: z.string().uuid(),
		filename: z.string(),
		size: z.number().int().positive(),
	}),
]);

export const messageStatusSchema = z.enum([
	"queued",
	"sent",
	"delivered",
	"read",
]);

export const messageSchema = z.object({
	id: z.string().uuid(),
	from_device_id: z.string().uuid(),
	to_device_id: z.string().uuid(),
	message_type: messageTypeSchema,
	timestamp: z.number().int(),
	thread_id: z.string().uuid().optional(),
	/** Delivery / read status – replaces the old `read: boolean` field. */
	status: messageStatusSchema,
});

// ============================================================================
// FILE TRANSFER SCHEMAS
// ============================================================================

export const fileTransferSchema = z.object({
	id: z.string().uuid(),
	filename: z.string().min(1),
	file_path: z.string().optional(),
	size: z.number().int().positive(),
	transferred: z.number().int().min(0),
	status: z.enum([
		"Pending",
		"InProgress",
		"Paused",
		"Completed",
		"Failed",
		"Cancelled",
		"Rejected",
		"AwaitingAcceptance",
	]),
	from_device_id: z.string().uuid(),
	to_device_id: z.string().uuid(),
	checksum: z.string().optional(),
	created_at: z.number().int(),
	updated_at: z.number().int(),
	/** Compression algorithm used (e.g. "zstd"), or null if uncompressed. */
	compression: z.string().nullable().optional(),
	/** Compression ratio: original_size / compressed_bytes_sent. e.g. 2.0 = 50% reduction. */
	compression_ratio: z.number().nullable().optional(),
	/** Number of parallel TCP streams used for this transfer. 1 = single-stream, >1 = parallel. */
	parallel_streams: z.number().int().min(1).default(1),
});

// ============================================================================
// SETTINGS & ONBOARDING SCHEMAS
// ============================================================================

export const settingsSchema = z.object({
	deviceName: z.string().min(1).max(50),
	port: z.number().int().min(1024).max(65535),
	theme: z.enum(["light", "dark"]),
	autoUpdate: z.boolean(),
});

export const onboardingSchema = z.object({
	deviceName: z
		.string()
		.min(1, "Device name is required")
		.max(50, "Device name must be less than 50 characters")
		.regex(/^[a-zA-Z0-9\s'-]+$/, "Device name contains invalid characters"),
});

// ============================================================================
// TYPE EXPORTS (Inferred from Zod)
// ============================================================================

export type Device = z.infer<typeof deviceSchema>;
export type Peer = z.infer<typeof peerSchema>;
export type MessageType = z.infer<typeof messageTypeSchema>;
export type MessageStatus = z.infer<typeof messageStatusSchema>;
export type Message = z.infer<typeof messageSchema>;
export type FileTransfer = z.infer<typeof fileTransferSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type OnboardingForm = z.infer<typeof onboardingSchema>;

// ============================================================================
// SAS VERIFICATION SCHEMAS
// ============================================================================

export const verificationStateSchema = z.union([
	z.literal("none"),
	z.literal("pending_confirmation"),
	z.literal("local_confirmed"),
	z.literal("verified"),
	z.literal("rejected"),
	z.object({ failed: z.string() }),
]);

export const verificationStatusSchema = z.object({
	device_id: z.string(),
	display_name: z.string(),
	state: verificationStateSchema,
	verification_code: z.string().nullable(),
	initiated_at: z.number().nullable(),
});

export const verificationCodeReadyEventSchema = z.object({
	device_id: z.string(),
	display_name: z.string(),
	verification_code: z
		.string()
		.regex(/^\d{3}-\d{3}$/, "Must be formatted as XXX-XXX"),
	initiated_by_us: z.boolean(),
});

export const handshakeVerifiedEventSchema = z.object({
	device_id: z.string(),
	display_name: z.string(),
	verification_code: z.string(),
});

export const handshakeRejectedEventSchema = z.object({
	device_id: z.string(),
	display_name: z.string(),
	rejected_by: z.enum(["local", "remote"]),
	reason: z.string().nullable(),
});

export type VerificationState = z.infer<typeof verificationStateSchema>;
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;
export type VerificationCodeReadyEvent = z.infer<
	typeof verificationCodeReadyEventSchema
>;
export type HandshakeVerifiedEvent = z.infer<
	typeof handshakeVerifiedEventSchema
>;
export type HandshakeRejectedEvent = z.infer<
	typeof handshakeRejectedEventSchema
>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateDevice(data: unknown) {
	return deviceSchema.safeParse(data);
}

export function validatePeer(data: unknown) {
	return peerSchema.safeParse(data);
}

export function validateMessage(data: unknown) {
	return messageSchema.safeParse(data);
}

export function validateFileTransfer(data: unknown) {
	return fileTransferSchema.safeParse(data);
}

export function validateVerificationStatus(data: unknown) {
	return verificationStatusSchema.safeParse(data);
}

export function validateVerificationCodeReady(data: unknown) {
	return verificationCodeReadyEventSchema.safeParse(data);
}
