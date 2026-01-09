import { Bonjour, Browser, Service } from 'bonjour-service'
import { Device, DeviceInfo } from '../shared/messageTypes'
import EventEmitter from 'events'

export class DiscoveryManager extends EventEmitter {
  private bonjour: Bonjour
  private service?: Service
  private browser?: Browser
  private discoveredDevices: Map<string, Device> = new Map()

  constructor() {
    super()
    this.bonjour = new Bonjour()
  }

  startDiscovery(deviceInfo: DeviceInfo, port: number): void {
    console.log(`Starting discovery for ${deviceInfo.displayName} on port ${port}...`)
    // 1. Advertise this device
    this.service = this.bonjour.publish({
      name: deviceInfo.displayName,
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
      console.log(`Discovery service published: ${deviceInfo.displayName} (_hyperconnect._tcp)`)
    })

    this.service.on('error', (err) => {
      console.error('Discovery service error:', err)
    })

    // 2. Discover other devices
    this.browser = this.bonjour.find({ type: 'hyperconnect', protocol: 'tcp' })

    this.browser.on('up', (service: Service) => {
      const deviceId = service.txt?.deviceId
      if (!deviceId || deviceId === deviceInfo.deviceId) return

      console.log(`Found peer: ${service.name} (${service.addresses?.[0]})`)

      const device: Device = {
        deviceId,
        displayName: service.txt?.displayName || service.name,
        platform: service.txt?.platform || 'unknown',
        appVersion: service.txt?.appVersion || '0.0.0',
        address: service.addresses?.[0] || '',
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
