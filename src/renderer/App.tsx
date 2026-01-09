import React, { useEffect } from 'react'
import { useStore } from './store/useStore'
import { Onboarding } from './pages/Onboarding'
import { Main } from './pages/Main'

export const App: React.FC = () => {
  const {
    onboardingComplete,
    setLocalDevice,
    addDiscoveredDevice,
    removeDiscoveredDevice,
    addMessage,
    updateTransfer
  } = useStore()

  useEffect(() => {
    const init = async () => {
      const info = await window.api.getDeviceInfo()
      setLocalDevice(info)
    }

    init()

    // Listen for events
    window.api.onDeviceDiscovered((device) => addDiscoveredDevice(device))
    window.api.onDeviceLost((deviceId) => removeDiscoveredDevice(deviceId))
    window.api.onMessageReceived((message) => addMessage(message.deviceId, message))
    window.api.onFileReceived((message) => {
      addMessage(message.deviceId, message) // Show in chat too
    })
    window.api.onFileTransferProgress((progress) => updateTransfer(progress))
  }, [])

  return onboardingComplete ? <Main /> : <Onboarding />
}

export default App
