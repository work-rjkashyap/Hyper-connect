import net from 'net'
import EventEmitter from 'events'
import { NetworkMessage } from '../shared/messageTypes'

export class TCPServer extends EventEmitter {
  private server: net.Server
  private connections: Map<string, net.Socket> = new Map()
  public port: number = 0

  constructor() {
    super()
    this.server = net.createServer((socket) => this.handleConnection(socket))
  }

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server.listen(0, '0.0.0.0', () => {
        const address = this.server.address() as net.AddressInfo
        this.port = address.port
        console.log(`TCP Server listening on port ${this.port}`)
        resolve(this.port)
      })

      this.server.on('error', (err) => {
        console.error('TCP Server error:', err)
        reject(err)
      })
    })
  }

  private handleConnection(socket: net.Socket) {
    socket.setNoDelay(true)
    socket.setKeepAlive(true, 1000)

    let isRawStream = false
    let buffer = Buffer.alloc(0)

    socket.on('data', (data) => {
      if (isRawStream) {
        this.emit('raw-data', socket, data)
        return
      }

      buffer = Buffer.concat([buffer, data])

      // Check for raw stream header: "FILE_STREAM:"
      if (buffer.length >= 12 && buffer.toString('utf8', 0, 12) === 'FILE_STREAM:') {
        isRawStream = true
        this.emit('raw-connection', socket, buffer)
        buffer = Buffer.alloc(0)
        return
      }

      // NDJSON / Multi-line JSON support
      let str = buffer.toString()
      const lines = str.split('\n')

      if (lines.length > 1) {
        buffer = Buffer.from(lines.pop() || '')
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const message: NetworkMessage = JSON.parse(line)
            this.emit('message', message, socket)
          } catch (e) {
            console.error('Failed to parse incoming message:', e)
          }
        }
      }
    })

    socket.on('close', () => {
      // Handle cleanup
      for (const [deviceId, conn] of this.connections.entries()) {
        if (conn === socket) {
          this.connections.delete(deviceId)
          this.emit('connectionClosed', deviceId)
          break
        }
      }
    })

    socket.on('error', (err) => {
      console.error('Socket error:', err)
    })
  }

  registerConnection(deviceId: string, socket: net.Socket) {
    this.connections.set(deviceId, socket)
  }

  sendMessage(socket: net.Socket, message: NetworkMessage) {
    socket.write(JSON.stringify(message) + '\n')
  }

  stop() {
    this.server.close()
    for (const socket of this.connections.values()) {
      socket.destroy()
    }
    this.connections.clear()
  }
}

export const tcpServer = new TCPServer()
