import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
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
  setDiscoveredDevices: (devices: Device[]) => void
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      localDevice: null,
      discoveredDevices: [],
      messages: {},
      transfers: {},
      selectedDeviceId: null,
      onboardingComplete: false,

      setLocalDevice: (device) => set({ localDevice: device }),

      addDiscoveredDevice: (device) =>
        set((state) => {
          console.log('[Store] Adding discovered device:', device)
          console.log('[Store] Current devices before update:', state.discoveredDevices)
          const exists = state.discoveredDevices.some((d) => d.deviceId === device.deviceId)
          if (exists) {
            console.log('[Store] Device already exists, updating')
            const newDevices = state.discoveredDevices.map((d) =>
              d.deviceId === device.deviceId ? { ...device, isOnline: true } : d
            )
            console.log('[Store] Updated devices:', newDevices)
            return { discoveredDevices: newDevices }
          }
          console.log('[Store] Adding new device')
          const newDevices = [...state.discoveredDevices, { ...device, isOnline: true }]
          console.log('[Store] New devices array:', newDevices)
          return { discoveredDevices: newDevices }
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

      setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),
      setDiscoveredDevices: (devices) => {
        console.log('[Store] Setting discovered devices:', devices)
        set({
          discoveredDevices: devices.map((d) => ({ ...d, isOnline: true }))
        })
      }
    }),
    {
      name: 'hyper-connect-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        onboardingComplete: state.onboardingComplete,
        localDevice: state.localDevice,
        messages: state.messages
      })
    }
  )
)
