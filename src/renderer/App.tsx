import React, { useEffect, useRef } from 'react'
import { useStore } from './store/useStore'
import { Onboarding } from './pages/Onboarding'
import { Main } from './pages/Main'
import { Toaster } from './components/ui/sonner'
import { toast } from 'sonner'
import { ErrorBoundary } from './components/ErrorBoundary'

export const App: React.FC = () => {
  const {
    onboardingComplete,
    setLocalDevice,
    addDiscoveredDevice,
    removeDiscoveredDevice,
    addMessage,
    updateTransfer,
    setDiscoveredDevices
  } = useStore()

  // Track notified devices to avoid spam
  const notifiedDevices = useRef<Set<string>>(new Set())

  useEffect(() => {
    const init = async (): Promise<void> => {
      console.log('[App] Initializing...')
      const info = await window.api.getDeviceInfo()
      setLocalDevice(info)

      // Fetch already discovered devices (fix for race condition)
      const initialDevices = await window.api.getDiscoveredDevices()
      setDiscoveredDevices(initialDevices)
    }

    init()

    // Listen for events
    window.api.onDeviceDiscovered((device) => {
      addDiscoveredDevice(device)
      if (!notifiedDevices.current.has(device.deviceId)) {
        notifiedDevices.current.add(device.deviceId)
        toast.success(`${device.displayName} connected`, {
          description: `${device.platform} • ${device.address}`,
          duration: 3000
        })
      }
    })

    window.api.onDeviceLost((deviceId) => {
      const device = useStore.getState().discoveredDevices.find((d) => d.deviceId === deviceId)
      removeDiscoveredDevice(deviceId)
      if (device) {
        toast.error(`${device.displayName} went offline`, {
          duration: 3000
        })
      }
      notifiedDevices.current.delete(deviceId)
    })

    window.api.onMessageReceived((message) => {
      const state = useStore.getState()
      addMessage(message.deviceId, message)

      // If it's a chat message and not from the currently selected device, increment unread count
      if (message.type === 'MESSAGE' && message.deviceId !== state.selectedDeviceId) {
        state.incrementUnreadCount(message.deviceId)

        const device = state.discoveredDevices.find((d) => d.deviceId === message.deviceId)
        toast(`New message from ${device?.displayName || 'Unknown'}`, {
          description: message.payload as string,
          action: {
            label: 'View',
            onClick: () => {
              state.setSelectedDeviceId(message.deviceId)
              state.clearUnreadCount(message.deviceId)
            }
          }
        })
      }
    })

    window.api.onFileReceived((message) => {
      addMessage(message.deviceId, message)
    })

    window.api.onFileTransferProgress((progress) => updateTransfer(progress))
  }, [
    setLocalDevice,
    setDiscoveredDevices,
    addDiscoveredDevice,
    removeDiscoveredDevice,
    addMessage,
    updateTransfer
  ])

  console.log('[App] Rendering - onboardingComplete:', onboardingComplete)

  return (
    <ErrorBoundary>
      {onboardingComplete ? <Main /> : <Onboarding />}
      <Toaster position="top-right" />
    </ErrorBoundary>
  )
}

export default App
