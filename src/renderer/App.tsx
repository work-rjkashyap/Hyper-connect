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
            removeDiscoveredDevice(deviceId)
            notifiedDevices.current.delete(deviceId)
        })

        window.api.onMessageReceived((message) => {
            addMessage(message.deviceId, message)
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
