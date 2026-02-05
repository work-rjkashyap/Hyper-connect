import React, { useState, useCallback } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/useStore'
import { cn } from '../lib/utils'
import { WindowControls } from '../components/WindowControls'
import {
  LogoHeader,
  LocalDeviceCard,
  DeviceList,
  SettingsView,
  SettingsButton
} from '../components/dashboard'
/**
 * DashboardLayout - Main layout with sidebar and content area
 * Manages routing between device view and settings
 *
 * Component Organization:
 * - LogoHeader: App branding and theme controls
 * - LocalDeviceCard: Current device information
 * - DeviceList: List of discovered devices
 * - SettingsView: Settings navigation
 * - SettingsButton: Toggle for settings mode
 */
export const DashboardLayout: React.FC = () => {
  const { discoveredDevices, unreadCounts, localDevice, clearUnreadCount } = useStore(
    useShallow((state) => ({
      discoveredDevices: state.discoveredDevices,
      unreadCounts: state.unreadCounts,
      localDevice: state.localDevice,
      clearUnreadCount: state.clearUnreadCount
    }))
  )
  const [isRefreshing, setIsRefreshing] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  // Calculate derived state during rendering
  const isSettings = location.pathname === '/settings'
  const isMac = navigator.userAgent.includes('Mac')
  const activeDeviceId = location.pathname.startsWith('/device/')
    ? location.pathname.split('/device/')[1]
    : null
  // Event handlers with useCallback for stable references
  const handleRescan = useCallback(async (): Promise<void> => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      await window.api.rescanDevices()
      setTimeout(() => {
        setIsRefreshing(false)
      }, 1000)
    } catch (e) {
      console.error('[Dashboard] Refresh error:', e)
      setIsRefreshing(false)
    }
  }, [isRefreshing])
  const handleNavigateHome = useCallback((): void => {
    navigate('/')
  }, [navigate])
  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* Sidebar */}
      <div className="w-65 border-r bg-card/50 flex flex-col shrink-0">
        <LogoHeader />
        <div className="flex-1 flex flex-col min-h-0">
          {isSettings ? (
            <SettingsView onNavigateHome={handleNavigateHome} />
          ) : (
            <>
              <LocalDeviceCard
                displayName={localDevice?.displayName}
                profileImage={localDevice?.profileImage}
              />
              <DeviceList
                devices={discoveredDevices}
                activeDeviceId={activeDeviceId}
                unreadCounts={unreadCounts}
                isRefreshing={isRefreshing}
                onRescan={handleRescan}
                onClearUnread={clearUnreadCount}
              />
            </>
          )}
        </div>
        <SettingsButton isSettings={isSettings} />
      </div>
      {/* Main Content Area */}
      <div
        className={cn('flex-1 flex flex-col min-w-0 bg-secondary/20 relative', !isMac && 'pt-8')}
      >
        {!isMac ? (
          <div
            className="absolute top-0 left-0 right-0 h-8 flex items-center justify-end px-2"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          >
            <WindowControls />
          </div>
        ) : null}
        <Outlet />
      </div>
    </div>
  )
}
