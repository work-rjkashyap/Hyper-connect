import React, { useEffect, useRef } from 'react'
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import { Onboarding } from './pages/Onboarding'
import { Toaster } from './components/ui/sonner'
import { toast } from 'sonner'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NetworkMessage, FileMetadata } from '../shared/messageTypes'
import { DashboardLayout } from './layouts/DashboardLayout'
import { DevicePage } from './pages/DevicePage'
import { SettingsPage } from './pages/SettingsPage'
import { WelcomePage } from './pages/WelcomePage'
import { ConnectionToast } from './components/ui/ConnectionToast'
import { MessageToast } from './components/ui/MessageToast'

const AppContent: React.FC = () => {
  const {
    onboardingComplete,
    setLocalDevice,
    addDiscoveredDevice,
    removeDiscoveredDevice,
    addMessage,
    updateTransfer,
    setDiscoveredDevices,
    updateMessageStatus,
    setOnboardingComplete
  } = useStore()
  const navigate = useNavigate()
  const notifiedDevices = useRef<Set<string>>(new Set())

  // Initialization and Event Listeners
  useEffect(() => {
    const init = async (): Promise<void> => {
      console.log('[App] Initializing...')
      const info = await window.api.getDeviceInfo()
      setLocalDevice(info)

      // If device info exists with a display name, mark onboarding as complete
      // This handles cases where the persisted state got out of sync
      if (info && info.displayName && !onboardingComplete) {
        console.log('[App] Device already configured, completing onboarding')
        setOnboardingComplete(true)
      }

      const initialDevices = await window.api.getDiscoveredDevices()
      setDiscoveredDevices(initialDevices)
    }
    init()

    const unsubDiscovered = window.api.onDeviceDiscovered((device) => {
      addDiscoveredDevice(device)
      if (!notifiedDevices.current.has(device.deviceId)) {
        notifiedDevices.current.add(device.deviceId)
        toast.custom(() => <ConnectionToast device={device} type="connected" />, { duration: 3000 })
      }
    })

    const unsubLost = window.api.onDeviceLost((deviceId) => {
      const device = useStore.getState().discoveredDevices.find((d) => d.deviceId === deviceId)
      removeDiscoveredDevice(deviceId)
      if (device) {
        notifiedDevices.current.delete(deviceId)
        toast.custom(() => <ConnectionToast device={device} type="disconnected" />, {
          duration: 3000
        })
      }
    })

    const unsubMessage = window.api.onMessageReceived((message: NetworkMessage) => {
      const state = useStore.getState()
      if (message.type === 'MESSAGE' || message.type === 'FILE_META') {
        addMessage(message.deviceId, message)
      }
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

        toast.custom(
          () => (
            <MessageToast
              title={title}
              description={description}
              isFile={isFile}
              onClick={() => {
                navigate(`/device/${message.deviceId}`)
                state.setSelectedDeviceId(message.deviceId)
                state.clearUnreadCount(message.deviceId)
              }}
            />
          ),
          { duration: 4000 }
        )
      }
    })

    const unsubFile = window.api.onFileReceived(() => {
      // Logic handled in onMessageReceived
    })

    const unsubProgress = window.api.onFileTransferProgress((progress) => updateTransfer(progress))

    const unsubNavigate = window.api.onNavigateToDevice((deviceId) => {
      const state = useStore.getState()
      navigate(`/device/${deviceId}`)
      state.setSelectedDeviceId(deviceId)
      state.clearUnreadCount(deviceId)
    })

    const unsubStatus = window.api.onMessageStatusUpdated((data) => {
      updateMessageStatus(data.deviceId, data.messageId, data.status)
    })

    const unsubDelete = window.api.onRemoteMessageDeleted((data) => {
      useStore.getState().deleteMessage(data.deviceId, data.messageId)
    })

    return () => {
      unsubDiscovered()
      unsubLost()
      unsubMessage()
      unsubFile()
      unsubProgress()
      unsubNavigate()
      unsubStatus()
      unsubDelete()
    }
  }, [
    setLocalDevice,
    setDiscoveredDevices,
    addDiscoveredDevice,
    removeDiscoveredDevice,
    addMessage,
    updateTransfer,
    updateMessageStatus,
    setOnboardingComplete,
    onboardingComplete,
    navigate
  ])

  if (!onboardingComplete) {
    return <Onboarding />
  }

  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/device/:deviceId" element={<DevicePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AppContent />
        <Toaster position="top-right" />
      </HashRouter>
    </ErrorBoundary>
  )
}

export default App
