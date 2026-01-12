import net from 'net'
import EventEmitter from 'events'
import { NetworkMessage } from '@shared/messageTypes'
import { generateKeyPair, computeSharedSecret } from './crypto/ecdh'
import { deriveSessionKey, storeSession, discardSession, getSession } from './crypto/sessionKey'
import {
  encryptMessage,
  decryptMessage,
  isEncryptedMessage,
  isSensitiveMessageType
} from './crypto/messageCrypto'
import { getDeviceInfo } from './identity'

export class TCPServer extends EventEmitter {
  private server: net.Server
  private connections: Map<string, net.Socket> = new Map()
  public port: number = 0

  constructor() {
    super()
    this.server = net.createServer((socket) => this.handleConnection(socket))
  }

  async start(preferredPort: number = 52900): Promise<number> {
    return new Promise((resolve) => {
      const tryListen = (currentPort: number): void => {
        this.server.listen(currentPort, '0.0.0.0', () => {
          const address = this.server.address() as net.AddressInfo
          this.port = address.port
          this.server.removeAllListeners('error')
          console.log(`TCP Server listening on port ${this.port}`)
          resolve(this.port)
        })

        this.server.once('error', (err: { code: string }) => {
          if (err.code === 'EADDRINUSE' && currentPort !== 0) {
            console.log(`Port ${currentPort} in use, trying dynamic port...`)
            tryListen(0)
          } else {
            console.error('TCP Server error:', err)
          }
        })
      }

      tryListen(preferredPort)
    })
  }

  private handleConnection(socket: net.Socket): void {
    socket.setNoDelay(true)
    socket.setKeepAlive(true, 1000)

    // Performance optimization for high-speed transfers
    // Note: highWaterMark is read-only on the socket itself, usually set at server level

    let isRawStream = false
    let buffer = Buffer.alloc(0)
    let authenticatedDeviceId: string | null = null

    socket.on('data', (chunk) => {
      if (isRawStream) {
        this.emit('raw-data', socket, chunk)
        return
      }

      buffer = Buffer.concat([buffer, chunk])

      // Check for raw stream header: "FILE_STREAM:"
      if (buffer.length >= 12 && buffer.toString('utf8', 0, 12) === 'FILE_STREAM:') {
        isRawStream = true
        this.emit('raw-connection', socket, buffer)
        buffer = Buffer.alloc(0)
        return
      }

      // NDJSON / Multi-line JSON support
      let offset: number
      while ((offset = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, offset).toString().trim()
        buffer = buffer.slice(offset + 1)

        if (!line) continue

        try {
          const rawMessage = JSON.parse(line)

          // Handle Handshake
          if (rawMessage.type === 'HELLO_SECURE') {
            this.handleSecureHandshake(socket, rawMessage).then((deviceId) => {
              authenticatedDeviceId = deviceId
            })
            continue
          }

          // Handle Encrypted Messages
          if (isEncryptedMessage(rawMessage)) {
            if (authenticatedDeviceId) {
              const session = getSession(authenticatedDeviceId)
              if (session) {
                const decrypted = decryptMessage(rawMessage, session.sessionKey)
                this.emit('message', decrypted, socket, true)
              } else {
                console.error(
                  `[Server] No session key for authenticated device ${authenticatedDeviceId}`
                )
              }
            } else {
              console.warn('[Server] Received encrypted message before authentication')
            }
          } else {
            this.emit('message', rawMessage, socket, false)
          }
        } catch (e) {
          console.error('Failed to parse incoming message:', e)
        }
      }
    })

    socket.on('close', () => {
      if (authenticatedDeviceId) {
        this.connections.delete(authenticatedDeviceId)
        discardSession(authenticatedDeviceId)
        this.emit('connectionClosed', authenticatedDeviceId)
      }
    })

    socket.on('error', (err) => {
      console.error('Socket error:', err)
    })
  }

  private async handleSecureHandshake(
    socket: net.Socket,
    message: NetworkMessage
  ): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const remotePublicKey = (message.payload as any)?.publicKey
    const remoteDeviceId = message.deviceId

    if (!remotePublicKey) {
      throw new Error('Missing public key in HELLO_SECURE')
    }

    console.log(`[Server] Received HELLO_SECURE from ${remoteDeviceId}`)

    // 1. Generate local ephemeral key pair
    const { publicKey, privateKey } = generateKeyPair()

    // 2. Compute shared secret and derive session key
    const sharedSecret = computeSharedSecret(privateKey, remotePublicKey)
    const sessionKey = deriveSessionKey(sharedSecret)

    // 3. Store session
    storeSession(remoteDeviceId, { sessionKey, deviceId: remoteDeviceId })
    this.connections.set(remoteDeviceId, socket)

    // 4. Respond with our HELLO_SECURE
    const deviceInfo = getDeviceInfo()
    const response: NetworkMessage = {
      type: 'HELLO_SECURE',
      deviceId: deviceInfo.deviceId,
      id: 'hello-secure-resp',
      timestamp: Date.now(),
      payload: {
        publicKey,
        displayName: deviceInfo.displayName,
        platform: deviceInfo.platform,
        profileImage: deviceInfo.profileImage
      }
    }

    socket.write(JSON.stringify(response) + '\n')
    console.log(`[Server] Secure session established with ${remoteDeviceId}`)

    return remoteDeviceId
  }

  registerConnection(deviceId: string, socket: net.Socket): void {
    this.connections.set(deviceId, socket)
  }

  sendMessage(socket: net.Socket, message: NetworkMessage): void {
    const deviceId = [...this.connections.entries()].find(([, s]) => s === socket)?.[0]

    if (deviceId) {
      const session = getSession(deviceId)
      const isSensitive = isSensitiveMessageType(message.type)

      if (session) {
        console.log(`[Server] Sending encrypted ${message.type} to ${deviceId}`)
        const encrypted = encryptMessage(message, session.sessionKey)
        socket.write(JSON.stringify(encrypted) + '\n')
        return
      } else if (isSensitive) {
        console.error(
          `[Server] Refusing to send sensitive message ${message.type} without encryption to ${deviceId}`
        )
        return
      }
    }

    // Fallback for non-sensitive messages or before authentication
    console.warn(`[Server] Sending unencrypted ${message.type}`)
    socket.write(JSON.stringify(message) + '\n')
  }

  stop(): void {
    this.server.close()
    for (const socket of this.connections.values()) {
      socket.destroy()
    }
    this.connections.clear()
  }
}

export const tcpServer = new TCPServer()
