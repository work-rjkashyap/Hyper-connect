import { Bonjour, Browser, Service } from 'bonjour-service'
import { Device, DeviceInfo } from '@shared/messageTypes'
import EventEmitter from 'events'

export class DiscoveryManager extends EventEmitter {
  private bonjour: Bonjour
  private service?: Service
  private browser?: Browser
  private discoveredDevices: Map<string, Device> = new Map()
  private localDeviceId?: string

  constructor() {
    super()
    this.bonjour = new Bonjour()
  }

  startDiscovery(deviceInfo: DeviceInfo, port: number): void {
    this.localDeviceId = deviceInfo.deviceId
    console.log(`Starting discovery for ${deviceInfo.displayName} on port ${port}...`)
    // 1. Advertise this device
    const publish = (name: string): void => {
      this.service = this.bonjour.publish({
        name,
        type: 'hyperconnect',
        protocol: 'tcp',
        port: port,
        txt: {
          deviceId: deviceInfo.deviceId,
          displayName: deviceInfo.displayName,
          platform: deviceInfo.platform,
          appVersion: deviceInfo.appVersion
        }
      })

      this.service.on('up', () => {
        console.log(`Discovery service published: ${name} (_hyperconnect._tcp)`)
      })

      this.service.on('error', (err) => {
        console.error('Discovery service error:', err)
        if (err.message.includes('already in use')) {
          const freshName = `${name}-${Math.floor(Math.random() * 1000)}`
          console.log(`Service name conflict, retrying with: ${freshName}`)
          this.service?.stop?.()
          publish(freshName)
        }
      })
    }

    publish(deviceInfo.displayName)

    // 2. Discover other devices
    this.browser = this.bonjour.find({ type: 'hyperconnect', protocol: 'tcp' })
    this.setupBrowserListeners(deviceInfo.deviceId)
  }

  private setupBrowserListeners(localDeviceId: string): void {
    if (!this.browser) return

    this.browser.on('up', (service: Service) => {
      const deviceId = service.txt?.deviceId
      if (!deviceId || deviceId === localDeviceId) return

      console.log(`Found peer: ${service.name} (${service.addresses?.join(', ')})`)

      const address =
        service.addresses?.find((addr) => addr.includes('.') && !addr.startsWith('127.')) ||
        service.addresses?.[0] ||
        ''

      const device: Device = {
        deviceId,
        displayName: service.txt?.displayName || service.name,
        platform: service.txt?.platform || 'unknown',
        appVersion: service.txt?.appVersion || '0.0.0',
        address,
        port: service.port,
        lastSeen: Date.now(),
        isOnline: true
      }

      this.discoveredDevices.set(deviceId, device)
      this.emit('deviceFound', device)
    })

    this.browser.on('down', (service: Service) => {
      const deviceId = service.txt?.deviceId
      if (!deviceId) return

      console.log(`Lost peer: ${service.name}`)

      const device = this.discoveredDevices.get(deviceId)
      if (device) {
        device.isOnline = false
        this.emit('deviceLost', deviceId)
      }
    })
  }

  async startHeartbeat(): Promise<void> {
    const { connectionManager } = await import('./protocol')

    setInterval(async () => {
      for (const [deviceId, device] of this.discoveredDevices) {
        if (!device.isOnline) continue

        try {
          // Attempt to connect briefly to verify presence
          await connectionManager.ping(device)
          // Update lastSeen
          device.lastSeen = Date.now()
          console.log(`[Heartbeat] Device ${device.displayName} is alive`)
        } catch {
          console.log(`[Heartbeat] Device ${device.displayName} is unreachable, marking offline.`)
          device.isOnline = false
          this.emit('deviceLost', deviceId)
        }
      }
    }, 15000) // Every 15 seconds
  }

  markDeviceOnline(deviceId: string): void {
    const device = this.discoveredDevices.get(deviceId)
    if (device) {
      const wasOffline = !device.isOnline
      device.isOnline = true
      device.lastSeen = Date.now()
      if (wasOffline) {
        console.log(`[Discovery] Device ${device.displayName} came back online via message/traffic`)
        this.emit('deviceFound', device)
      }
    }
  }

  rescan(): void {
    console.log('[Discovery] Manual rescan triggered')
    if (this.browser && this.localDeviceId) {
      this.browser.stop()
      // Clearing browser listeners happens automatically on stop usually, but we'll re-init
      this.browser = this.bonjour.find({ type: 'hyperconnect', protocol: 'tcp' })
      this.setupBrowserListeners(this.localDeviceId)

      // Also trigger a heartbeat pulse immediately
      this.triggerHeartbeatOnce()
    }
  }

  private async triggerHeartbeatOnce(): Promise<void> {
    const { connectionManager } = await import('./protocol')
    for (const [deviceId, device] of this.discoveredDevices) {
      try {
        await connectionManager.ping(device)
        this.markDeviceOnline(deviceId)
      } catch {
        // Just fail silently for manual rescan pulse
      }
    }
  }

  getDiscoveredDevices(): Device[] {
    return Array.from(this.discoveredDevices.values())
  }

  stop(): void {
    this.service?.stop?.()
    this.browser?.stop()
    this.bonjour.destroy()
  }
}

export const discoveryManager = new DiscoveryManager()
