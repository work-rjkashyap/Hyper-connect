import net from 'net'
import { NetworkMessage, Device } from '../shared/messageTypes'
import EventEmitter from 'events'

export class ConnectionManager extends EventEmitter {
  private activeConnections: Map<string, net.Socket> = new Map()

  async getConnection(device: Device): Promise<net.Socket> {
    if (this.activeConnections.has(device.deviceId)) {
      const socket = this.activeConnections.get(device.deviceId)!
      if (!socket.destroyed && socket.writable) return socket
      this.activeConnections.delete(device.deviceId)
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
        this.activeConnections.set(device.deviceId, socket)

        // Initial handshake to let the peer know who we are
        const hello: NetworkMessage = {
          type: 'HELLO',
          deviceId: getDeviceInfo().deviceId,
          id: 'hello',
          timestamp: Date.now()
        }
        socket.write(JSON.stringify(hello) + '\n')

        this.emit('connected', device.deviceId, socket)
        resolve(socket)
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
        reject(err)
      })

      socket.on('close', () => {
        console.log(`[Protocol] Connection closed for device ${device.deviceId}`)
        this.activeConnections.delete(device.deviceId)
        this.emit('disconnected', device.deviceId)
      })

      // Setup data handling
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
    if (socket && !socket.destroyed && socket.writable) {
      socket.write(JSON.stringify(message) + '\n')
    } else {
      console.warn(`No active connection for device ${deviceId}`)
    }
  }

  async ping(device: Device): Promise<void> {
    const socket = await this.getConnection(device)
    const pingMsg: NetworkMessage = {
      type: 'PING',
      deviceId: device.deviceId, // This should actually be our own deviceId, but since we are sending it to them
      id: 'ping',
      timestamp: Date.now()
    }
    socket.write(JSON.stringify(pingMsg) + '\n')
  }

  registerSocket(deviceId: string, socket: net.Socket): void {
    this.activeConnections.set(deviceId, socket)
  }
}

export const connectionManager = new ConnectionManager()
