import React, { useEffect, useRef } from 'react'
import { useStore } from './store/useStore'
import { Onboarding } from './pages/Onboarding'
import { Main } from './pages/Main'
import { Toaster } from './components/ui/sonner'
import { toast } from 'sonner'

export const App: React.FC = () => {
  const {
    onboardingComplete,
    setLocalDevice,
    addDiscoveredDevice,
    removeDiscoveredDevice,
    addMessage,
    updateTransfer
  } = useStore()

  // Track notified devices to avoid spam
  const notifiedDevices = useRef<Set<string>>(new Set())

  useEffect(() => {
    const init = async () => {
      const info = await window.api.getDeviceInfo()
      console.log('[App] Local device info:', info)
      setLocalDevice(info)
    }

    init()

    // Listen for events
    window.api.onDeviceDiscovered((device) => {
      console.log('[App] Device discovered:', device)
      addDiscoveredDevice(device)

      // Show toast notification for new devices
      if (!notifiedDevices.current.has(device.deviceId)) {
        notifiedDevices.current.add(device.deviceId)
        toast.success(`${device.displayName} connected`, {
          description: `${device.platform} • ${device.address}`,
          duration: 3000
        })
      }
    })

    window.api.onDeviceLost((deviceId) => {
      console.log('[App] Device lost:', deviceId)
      removeDiscoveredDevice(deviceId)
      notifiedDevices.current.delete(deviceId)
    })

    window.api.onMessageReceived((message) => {
      console.log('[App] Message received:', message)
      addMessage(message.deviceId, message)
    })

    window.api.onFileReceived((message) => {
      console.log('[App] File received:', message)
      addMessage(message.deviceId, message) // Show in chat too
    })

    window.api.onFileTransferProgress((progress) => updateTransfer(progress))
  }, [])

  console.log('[App] Rendering - onboardingComplete:', onboardingComplete)

  return (
    <>
      {onboardingComplete ? <Main /> : <Onboarding />}
      <Toaster position="top-right" />
    </>
  )
}

export default App
