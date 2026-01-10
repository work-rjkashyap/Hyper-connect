import * as crypto from 'node:crypto'

export interface KeyPair {
  publicKey: string
  privateKey: Buffer
}

/**
 * Generates an ephemeral X25519 key pair for ECDH.
 */
export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519')
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' })
  }
}

/**
 * Computes a shared secret using a local private key and a remote public key.
 */
export function computeSharedSecret(privateKeyDer: Buffer, remotePublicKeyBase64: string): Buffer {
  const privateKey = crypto.createPrivateKey({
    key: privateKeyDer,
    format: 'der',
    type: 'pkcs8'
  })

  const remotePublicKey = crypto.createPublicKey({
    key: Buffer.from(remotePublicKeyBase64, 'base64'),
    format: 'der',
    type: 'spki'
  })

  return crypto.diffieHellman({
    privateKey,
    publicKey: remotePublicKey
  })
}
