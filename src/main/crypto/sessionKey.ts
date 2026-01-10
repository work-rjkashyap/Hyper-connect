import { createHash } from 'crypto'

export interface SessionData {
  sessionKey: Buffer
  deviceId: string
}

const activeSessions: Map<string, SessionData> = new Map()

/**
 * Derives a 32-byte (256-bit) AES session key from a shared secret using SHA-256.
 * @param sharedSecret The shared secret Buffer from ECDH.
 * @returns A Buffer containing the derived session key.
 */
export function deriveSessionKey(sharedSecret: Buffer): Buffer {
  return createHash('sha256').update(sharedSecret).digest()
}

/**
 * Stores a session key for a given connection/device.
 */
export function storeSession(socketId: string, data: SessionData): void {
  activeSessions.set(socketId, data)
}

/**
 * Retrieves a session key for a given connection/device.
 */
export function getSession(socketId: string): SessionData | undefined {
  return activeSessions.get(socketId)
}

/**
 * Discards a session key when a connection is closed.
 */
export function discardSession(socketId: string): void {
  activeSessions.delete(socketId)
}
