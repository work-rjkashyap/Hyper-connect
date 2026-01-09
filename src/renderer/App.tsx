import React, { useEffect } from 'react'
import { useStore } from './store/useStore'
import { Onboarding } from './pages/Onboarding'
import { Main } from './pages/Main' // Will create this

export const App: React.FC = () => {
    const { onboardingComplete, setOnboardingComplete, setLocalDevice, addDiscoveredDevice, removeDiscoveredDevice, addMessage, updateTransfer } = useStore()

    useEffect(() => {
        const init = async () => {
            const info = await window.api.getDeviceInfo()
            setLocalDevice(info)

            // If display name is not just the hostname, we might consider it onboarded
            // For this implementation, we'll use a local storage flag or check if name is set
            const onboarded = localStorage.getItem('onboarding_complete') === 'true'
            setOnboardingComplete(onboarded)
        }

        init()

        // Listen for events
        window.api.onDeviceDiscovered((device) => addDiscoveredDevice(device))
        window.api.onDeviceLost((deviceId) => removeDiscoveredDevice(deviceId))
        window.api.onMessageReceived((message) => addMessage(message.deviceId, message))
        window.api.onFileReceived((message) => {
            // Auto-open accept dialog via IPC (handled in main)
            // or show in UI? Main handles the save dialog.
            addMessage(message.deviceId, message) // Show in chat too
        })
        window.api.onFileTransferProgress((progress) => updateTransfer(progress))
    }, [])

    useEffect(() => {
        localStorage.setItem('onboarding_complete', onboardingComplete.toString())
    }, [onboardingComplete])

    return onboardingComplete ? <Main /> : <Onboarding />
}

export default App
