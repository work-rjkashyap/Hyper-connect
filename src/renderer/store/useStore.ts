import { create } from 'zustand'
import { Device, NetworkMessage, FileTransferProgress, DeviceInfo } from '../../shared/messageTypes'

interface AppState {
  localDevice: DeviceInfo | null
  discoveredDevices: Device[]
  messages: Record<string, NetworkMessage[]> // deviceId -> messages
  transfers: Record<string, FileTransferProgress> // fileId -> progress
  selectedDeviceId: string | null
  onboardingComplete: boolean

  setLocalDevice: (device: DeviceInfo) => void
  addDiscoveredDevice: (device: Device) => void
  removeDiscoveredDevice: (deviceId: string) => void
  addMessage: (deviceId: string, message: NetworkMessage) => void
  updateTransfer: (progress: FileTransferProgress) => void
  setSelectedDeviceId: (deviceId: string | null) => void
  setOnboardingComplete: (complete: boolean) => void
}

export const useStore = create<AppState>((set) => ({
  localDevice: null,
  discoveredDevices: [],
  messages: {},
  transfers: {},
  selectedDeviceId: null,
  onboardingComplete: false,

  setLocalDevice: (device) => set({ localDevice: device }),

  addDiscoveredDevice: (device) =>
    set((state) => {
      const exists = state.discoveredDevices.some((d) => d.deviceId === device.deviceId)
      if (exists) {
        return {
          discoveredDevices: state.discoveredDevices.map((d) =>
            d.deviceId === device.deviceId ? device : d
          )
        }
      }
      return { discoveredDevices: [...state.discoveredDevices, device] }
    }),

  removeDiscoveredDevice: (deviceId) =>
    set((state) => ({
      discoveredDevices: state.discoveredDevices.map((d) =>
        d.deviceId === deviceId ? { ...d, isOnline: false } : d
      )
    })),

  addMessage: (deviceId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [deviceId]: [...(state.messages[deviceId] || []), message]
      }
    })),

  updateTransfer: (progress) =>
    set((state) => ({
      transfers: {
        ...state.transfers,
        [progress.fileId]: progress
      }
    })),

  setSelectedDeviceId: (deviceId) => set({ selectedDeviceId: deviceId }),

  setOnboardingComplete: (complete) => set({ onboardingComplete: complete })
}))
