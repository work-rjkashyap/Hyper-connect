import { z } from 'zod';

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

export const messageTypeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('Text'),
    content: z.string().min(1),
  }),
  z.object({
    type: z.literal('Emoji'),
    emoji: z.string(),
  }),
  z.object({
    type: z.literal('Reply'),
    content: z.string().min(1),
    reply_to: z.string().uuid(),
  }),
  z.object({
    type: z.literal('File'),
    file_id: z.string().uuid(),
    filename: z.string(),
    size: z.number().int().positive(),
  }),
]);

export const messageSchema = z.object({
  id: z.string().uuid(),
  from_device_id: z.string().uuid(),
  to_device_id: z.string().uuid(),
  message_type: messageTypeSchema,
  timestamp: z.number().int(),
  thread_id: z.string().uuid().optional(),
  read: z.boolean(),
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
  status: z.enum(['Pending', 'InProgress', 'Paused', 'Completed', 'Failed', 'Cancelled']),
  from_device_id: z.string().uuid(),
  to_device_id: z.string().uuid(),
  checksum: z.string().optional(),
  created_at: z.number().int(),
  updated_at: z.number().int(),
});

// ============================================================================
// SETTINGS & ONBOARDING SCHEMAS
// ============================================================================

export const settingsSchema = z.object({
  deviceName: z.string().min(1).max(50),
  port: z.number().int().min(1024).max(65535),
  theme: z.enum(['light', 'dark']),
  autoUpdate: z.boolean(),
});

export const onboardingSchema = z.object({
  deviceName: z
    .string()
    .min(1, 'Device name is required')
    .max(50, 'Device name must be less than 50 characters')
    .regex(/^[a-zA-Z0-9\s'-]+$/, 'Device name contains invalid characters'),
});

// ============================================================================
// TYPE EXPORTS (Inferred from Zod)
// ============================================================================

export type Device = z.infer<typeof deviceSchema>;
export type Peer = z.infer<typeof peerSchema>;
export type MessageType = z.infer<typeof messageTypeSchema>;
export type Message = z.infer<typeof messageSchema>;
export type FileTransfer = z.infer<typeof fileTransferSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type OnboardingForm = z.infer<typeof onboardingSchema>;

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
