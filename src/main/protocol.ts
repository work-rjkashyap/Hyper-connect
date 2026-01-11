import net from 'net'
import { NetworkMessage, Device } from '@shared/messageTypes'
import EventEmitter from 'events'
import { generateKeyPair, computeSharedSecret } from './crypto/ecdh'
import { deriveSessionKey, storeSession, discardSession, getSession } from './crypto/sessionKey'
import {
  encryptMessage,
  decryptMessage,
  isEncryptedMessage,
  isSensitiveMessageType
} from './crypto/messageCrypto'

export class ConnectionManager extends EventEmitter {
  private activeConnections: Map<string, net.Socket> = new Map()

  async getConnection(device: Device): Promise<net.Socket> {
    if (this.activeConnections.has(device.deviceId)) {
      const socket = this.activeConnections.get(device.deviceId)!
      if (!socket.destroyed && socket.writable) return socket
      this.activeConnections.delete(device.deviceId)
      discardSession(device.deviceId)
    }

    const { getDeviceInfo } = await import('./identity')

    return new Promise((resolve, reject) => {
      console.log(`[Protocol] Attempting to connect to ${device.address}:${device.port}...`)

      let connected = false
      const socket = net.connect(device.port, device.address, () => {
        connected = true
        console.log(`[Protocol] Successfully connected to ${device.address}:${device.port}`)
        socket.setNoDelay(true)
        socket.setKeepAlive(true, 1000)

        // 1. Generate ephemeral key pair for this session
        const { publicKey, privateKey } = generateKeyPair()

        // 2. Send HELLO_SECURE with public key
        const deviceInfo = getDeviceInfo()
        const helloSecure: NetworkMessage = {
          type: 'HELLO_SECURE',
          deviceId: deviceInfo.deviceId,
          id: 'hello-secure',
          timestamp: Date.now(),
          payload: {
            publicKey,
            displayName: deviceInfo.displayName,
            platform: deviceInfo.platform,
            profileImage: deviceInfo.profileImage
          }
        }

        socket.write(JSON.stringify(helloSecure) + '\n')

        // Internal handler for the handshake response
        const onHandshakeData = (data: Buffer): void => {
          try {
            const line = data.toString().split('\n')[0]
            if (!line) return
            const message: NetworkMessage = JSON.parse(line)

            if (
              message.type === 'HELLO_SECURE' &&
              (message.payload as { publicKey: string })?.publicKey
            ) {
              const payload = message.payload as {
                publicKey: string
                displayName?: string
                profileImage?: string
              }
              // 3. Compute shared secret and derive session key
              const sharedSecret = computeSharedSecret(privateKey, payload.publicKey)
              const sessionKey = deriveSessionKey(sharedSecret)

              storeSession(device.deviceId, { sessionKey, deviceId: device.deviceId })
              this.activeConnections.set(device.deviceId, socket)

              // Update device info with received profile image
              if (payload.profileImage) {
                device.profileImage = payload.profileImage
              }
              if (payload.displayName) {
                device.displayName = payload.displayName
              }

              console.log(`[Protocol] Secure session established with ${device.deviceId}`)

              socket.removeListener('data', onHandshakeData)
              this.setupDataListener(socket, device.deviceId)

              this.emit('connected', device.deviceId, socket, device)
              resolve(socket)
            } else {
              reject(new Error('Invalid handshake response'))
              socket.destroy()
            }
          } catch (e) {
            console.error('[Protocol] Handshake failed:', e)
            reject(e)
            socket.destroy()
          }
        }

        socket.once('data', onHandshakeData)
      })

      // Set a 5-second connection timeout
      socket.setTimeout(5000)
      socket.on('timeout', () => {
        if (!connected) {
          console.error(`[Protocol] Connection timeout to ${device.address}:${device.port}`)
          socket.destroy()
          reject(new Error('Connection timed out'))
        }
      })

      socket.on('error', (err) => {
        console.error(
          `[Protocol] Connection error to ${device.address}:${device.port}:`,
          err.message
        )
        this.activeConnections.delete(device.deviceId)
        discardSession(device.deviceId)
        reject(err)
      })

      socket.on('close', () => {
        console.log(`[Protocol] Connection closed for device ${device.deviceId}`)
        this.activeConnections.delete(device.deviceId)
        discardSession(device.deviceId)
        this.emit('disconnected', device.deviceId)
      })
    })
  }

  private setupDataListener(socket: net.Socket, deviceId: string): void {
    let buffer = ''
    socket.on('data', (data) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const rawMessage = JSON.parse(line)

          if (isEncryptedMessage(rawMessage)) {
            const session = getSession(deviceId)
            if (session) {
              const decrypted = decryptMessage(rawMessage, session.sessionKey)
              this.emit('message', decrypted, socket, true)
            } else {
              console.error(`[Protocol] No session key for device ${deviceId}`)
            }
          } else {
            // Unencrypted message
            this.emit('message', rawMessage, socket, false)
          }
        } catch (e) {
          console.error('Failed to parse incoming message:', e)
        }
      }
    })
  }

  sendMessage(deviceId: string, message: NetworkMessage): void {
    const socket = this.activeConnections.get(deviceId)
    if (socket && !socket.destroyed && socket.writable) {
      const session = getSession(deviceId)
      const isSensitive = isSensitiveMessageType(message.type)

      if (session) {
        console.log(`[Protocol] Sending encrypted ${message.type} to ${deviceId}`)
        const encrypted = encryptMessage(message, session.sessionKey)
        socket.write(JSON.stringify(encrypted) + '\n')
      } else if (isSensitive) {
        console.error(
          `[Protocol] Refusing to send sensitive message ${message.type} without encryption to ${deviceId}`
        )
      } else {
        console.warn(`[Protocol] Sending unencrypted ${message.type} (no session for ${deviceId})`)
        socket.write(JSON.stringify(message) + '\n')
      }
    } else {
      console.warn(`[Protocol] No active connection for device ${deviceId}`)
    }
  }

  async ping(device: Device): Promise<void> {
    try {
      await this.getConnection(device)
      const pingMsg: NetworkMessage = {
        type: 'PING',
        deviceId: (await import('./identity')).getDeviceInfo().deviceId,
        id: 'ping',
        timestamp: Date.now()
      }
      this.sendMessage(device.deviceId, pingMsg)
    } catch (e) {
      console.error(`[Protocol] Failed to ping ${device.deviceId}:`, e)
      throw e
    }
  }

  registerSocket(deviceId: string, socket: net.Socket): void {
    this.activeConnections.set(deviceId, socket)
  }
}

export const connectionManager = new ConnectionManager()
