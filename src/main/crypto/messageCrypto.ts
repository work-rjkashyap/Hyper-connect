import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'

export interface EncryptedMessage {
  type: 'ENCRYPTED_MESSAGE'
  iv: string // Base64
  tag: string // Base64
  payload: string // Base64 (of the encrypted buffer)
}

/**
 * Encrypts a JSON-serializable object using AES-256-GCM.
 */
export function encryptMessage(data: unknown, sessionKey: Buffer): EncryptedMessage {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', sessionKey, iv)

  const json = JSON.stringify(data)
  const ciphertext = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    type: 'ENCRYPTED_MESSAGE',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    payload: ciphertext.toString('base64')
  }
}

/**
 * Decrypts an encrypted message using AES-256-GCM.
 * Throws an error if decryption or parsing fails.
 */
export function decryptMessage(msg: EncryptedMessage, sessionKey: Buffer): unknown {
  try {
    const iv = Buffer.from(msg.iv, 'base64')
    const tag = Buffer.from(msg.tag, 'base64')
    const ciphertext = Buffer.from(msg.payload, 'base64')

    const decipher = createDecipheriv('aes-256-gcm', sessionKey, iv)
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return JSON.parse(decrypted.toString('utf8'))
  } catch (e) {
    console.error('[Crypto] Decryption failed:', e)
    throw new Error('Failed to decrypt message: potentially invalid session key or corrupted data')
  }
}

/**
 * Type guard for EncryptedMessage
 */
export function isEncryptedMessage(msg: unknown): msg is EncryptedMessage {
  if (typeof msg !== 'object' || msg === null) return false
  const m = msg as Record<string, unknown>
  return m.type === 'ENCRYPTED_MESSAGE' && !!m.iv && !!m.tag && !!m.payload
}

/**
 * Checks if a message type contains sensitive user data that MUST be encrypted.
 */
export function isSensitiveMessageType(type: string): boolean {
  const sensitiveTypes = ['MESSAGE', 'FILE_META', 'FILE_ACCEPT', 'FILE_REJECT', 'MESSAGE_DELETE']
  return sensitiveTypes.includes(type)
}
