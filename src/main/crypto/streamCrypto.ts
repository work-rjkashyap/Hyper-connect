import { createCipheriv, createDecipheriv } from 'crypto'
import { Transform } from 'stream'

/**
 * Creates an encryption transform stream using AES-256-CTR.
 * CTR mode is chosen for high speed and streaming support.
 * The IV must be 16 bytes.
 */
export function createEncryptionStream(sessionKey: Buffer, iv: Buffer): Transform {
  if (iv.length !== 16) throw new Error('IV must be 16 bytes for AES-256-CTR')
  return createCipheriv('aes-256-ctr', sessionKey, iv)
}

/**
 * Creates a decryption transform stream using AES-256-CTR.
 */
export function createDecryptionStream(sessionKey: Buffer, iv: Buffer): Transform {
  if (iv.length !== 16) throw new Error('IV must be 16 bytes for AES-256-CTR')
  return createDecipheriv('aes-256-ctr', sessionKey, iv)
}
