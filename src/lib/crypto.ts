/**
 * End-to-End Encryption utilities using Web Crypto API
 *
 * This module provides ECDH P-256 key exchange and AES-GCM encryption/decryption
 * for secure peer-to-peer messaging.
 *
 * Keys are stored in sessionStorage only (cleared on tab close)
 */

// ============================================================================
// KEY GENERATION & STORAGE
// ============================================================================

/**
 * Generate an ECDH P-256 key pair
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true, // extractable
    ['deriveKey']
  );
}

/**
 * Export public key to base64 string for transmission
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('spki', publicKey);
  return arrayBufferToBase64(exported);
}

/**
 * Import public key from base64 string
 */
export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    'spki',
    keyData,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    []
  );
}

/**
 * Store key pair in sessionStorage
 */
export function storeKeyPair(deviceId: string, keyPair: CryptoKeyPair): void {
  // We can only store the private key; public key will be regenerated
  window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey).then((exported) => {
    const base64 = arrayBufferToBase64(exported);
    sessionStorage.setItem(`crypto_private_${deviceId}`, base64);
  });
}

/**
 * Retrieve key pair from sessionStorage
 * Note: Currently returns null - full implementation requires storing both keys
 */
export async function getStoredKeyPair(deviceId: string): Promise<CryptoKeyPair | null> {
  const privateKeyBase64 = sessionStorage.getItem(`crypto_private_${deviceId}`);
  if (!privateKeyBase64) return null;

  // TODO: Implement full key pair storage and retrieval
  // For now, regenerate key pairs as needed
  return null;
}

// ============================================================================
// KEY DERIVATION
// ============================================================================

/**
 * Derive shared AES-GCM key from ECDH key exchange
 */
export async function deriveSharedKey(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<CryptoKey> {
  return await window.crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: peerPublicKey,
    },
    privateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
}

// ============================================================================
// ENCRYPTION & DECRYPTION
// ============================================================================

/**
 * Encrypt message with AES-GCM
 * Returns base64-encoded ciphertext with IV prepended
 */
export async function encryptMessage(
  message: string,
  sharedKey: CryptoKey
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  // Generate random IV (12 bytes for GCM)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    sharedKey,
    data
  );

  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return arrayBufferToBase64(combined.buffer);
}

/**
 * Decrypt message with AES-GCM
 * Expects base64-encoded ciphertext with IV prepended
 */
export async function decryptMessage(
  encryptedMessage: string,
  sharedKey: CryptoKey
): Promise<string> {
  const combined = base64ToArrayBuffer(encryptedMessage);

  // Extract IV (first 12 bytes) and ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    sharedKey,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Store shared key for a peer in sessionStorage
 */
export async function storeSharedKey(peerId: string, sharedKey: CryptoKey): Promise<void> {
  const exported = await window.crypto.subtle.exportKey('raw', sharedKey);
  const base64 = arrayBufferToBase64(exported);
  sessionStorage.setItem(`shared_key_${peerId}`, base64);
}

/**
 * Get shared key for a peer from sessionStorage
 */
export async function getSharedKey(peerId: string): Promise<CryptoKey | null> {
  const base64 = sessionStorage.getItem(`shared_key_${peerId}`);
  if (!base64) return null;

  const keyData = base64ToArrayBuffer(base64);
  return await window.crypto.subtle.importKey(
    'raw',
    keyData,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Clear all crypto keys from sessionStorage
 */
export function clearAllKeys(): void {
  const keys = Object.keys(sessionStorage);
  keys.forEach((key) => {
    if (key.startsWith('crypto_') || key.startsWith('shared_key_')) {
      sessionStorage.removeItem(key);
    }
  });
}
