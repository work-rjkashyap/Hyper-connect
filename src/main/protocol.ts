import net from 'net'
import { NetworkMessage, Device } from '../shared/messageTypes'
import EventEmitter from 'events'

export class ConnectionManager extends EventEmitter {
  private activeConnections: Map<string, net.Socket> = new Map()

  async getConnection(device: Device): Promise<net.Socket> {
    if (this.activeConnections.has(device.deviceId)) {
      const socket = this.activeConnections.get(device.deviceId)!
      if (!socket.destroyed) return socket
    }

    return new Promise((resolve, reject) => {
      const socket = net.connect(device.port, device.address, () => {
        socket.setNoDelay(true)
        socket.setKeepAlive(true, 1000)
        this.activeConnections.set(device.deviceId, socket)

        // Initial handshake
        this.emit('connected', device.deviceId, socket)
        resolve(socket)
      })

      socket.on('error', (err) => {
        this.activeConnections.delete(device.deviceId)
        reject(err)
      })

      socket.on('close', () => {
        this.activeConnections.delete(device.deviceId)
        this.emit('disconnected', device.deviceId)
      })

      // Setup data handling for client-initiated connections too
      let buffer = ''
      socket.on('data', (data) => {
        buffer += data.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const message: NetworkMessage = JSON.parse(line)
            this.emit('message', message, socket)
          } catch (e) {
            console.error('Failed to parse incoming message:', e)
          }
        }
      })
    })
  }

  sendMessage(deviceId: string, message: NetworkMessage): void {
    const socket = this.activeConnections.get(deviceId)
    if (socket && !socket.destroyed) {
      socket.write(JSON.stringify(message) + '\n')
    } else {
      console.warn(`No active connection for device ${deviceId}`)
    }
  }

  registerSocket(deviceId: string, socket: net.Socket): void {
    this.activeConnections.set(deviceId, socket)
  }
}

export const connectionManager = new ConnectionManager()
