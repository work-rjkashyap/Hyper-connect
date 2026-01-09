import React, { useEffect, useRef } from 'react'
import { useStore } from './store/useStore'
import { Onboarding } from './pages/Onboarding'
import { Main } from './pages/Main'
import { Toaster } from './components/ui/sonner'
import { toast } from 'sonner'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NetworkMessage, FileMetadata } from '../shared/messageTypes'

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
                notifiedDevices.current.delete(deviceId)
                toast.error(`${device.displayName} went offline`, {
                    duration: 3000
                })
            }
        })

        window.api.onMessageReceived((message: NetworkMessage) => {
            const state = useStore.getState()

            // Only add messages that should be displayed in the chat UI
            if (message.type === 'MESSAGE' || message.type === 'FILE_META') {
                addMessage(message.deviceId, message)
            }

            // If it's a chat message or file request and not from the currently selected device, increment unread count
            if (
                (message.type === 'MESSAGE' || message.type === 'FILE_META') &&
                message.deviceId !== state.selectedDeviceId
            ) {
                state.incrementUnreadCount(message.deviceId)

                const device = state.discoveredDevices.find((d) => d.deviceId === message.deviceId)
                const isFile = message.type === 'FILE_META'
                const title = isFile
                    ? `File from ${device?.displayName || 'Unknown'}`
                    : `New message from ${device?.displayName || 'Unknown'}`
                const description = isFile
                    ? (message.payload as FileMetadata).name
                    : (message.payload as string)

                toast(title, {
                    description,
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

        window.api.onFileReceived(() => {
            // Message is already added by onMessageReceived
            // We could use this for additional file-specific logic if needed
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

    return (
        <ErrorBoundary>
            {onboardingComplete ? <Main /> : <Onboarding />}
            <Toaster position="top-right" />
        </ErrorBoundary>
    )
}

export default App
