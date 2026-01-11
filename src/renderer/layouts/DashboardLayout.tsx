import React, { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { Laptop, Monitor, RotateCw, Settings, User } from 'lucide-react'
import { useStore } from '../store/useStore'
import { ThemeToggle } from '../components/ui/theme-toggle'
import { cn } from '../lib/utils'
import logoLight from '../assets/logo_light.png'
import logoDark from '../assets/logo_dark.png'
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
  const isSettings = location.pathname === '/settings'
  // basic check for device route
  const activeDeviceId = location.pathname.startsWith('/device/')
    ? location.pathname.split('/device/')[1]
    : null
  const handleRescan = async (): Promise<void> => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      await window.api.rescanDevices()
      setTimeout(() => setIsRefreshing(false), 1000)
    } catch (e) {
      console.error('[Dashboard] Refresh error:', e)
      setIsRefreshing(false)
    }
  }
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-[260px] border-r bg-card/50 flex flex-col shrink-0">
        <div
          className="p-6 mt-5 flex items-center justify-between"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="flex items-center gap-4">
            <div className="w-8 h-8  bg-white dark:bg-slate-950 rounded-lg p-1 shadow-sm overflow-hidden border border-border/10 flex items-center justify-center">
              <img
                src={logoLight}
                alt="Logo"
                className="w-full h-full object-contain dark:hidden"
              />
              <img
                src={logoDark}
                alt="Logo"
                className="w-full h-full object-contain hidden dark:block"
              />
            </div>
            <h1 className="text-sm font-semibold tracking-tight bg-linear-to-br from-primary to-primary/60 bg-clip-text text-transparent">
              Hyper Connect
            </h1>
          </div>
          <div
            className="flex items-center gap-3"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <ThemeToggle />
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          {!isSettings ? (
            <>
              <div className="px-4 pb-4">
                <div className="p-3 bg-secondary/50 rounded-lg border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="p-0.5 rounded-full shadow-sm w-9 h-9 overflow-hidden flex items-center justify-center bg-secondary border border-border/10">
                      {localDevice?.profileImage ? (
                        <img
                          src={localDevice.profileImage}
                          alt="My Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        My Device
                      </p>
                      <p className="text-sm font-semibold truncate">{localDevice?.displayName}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <div className="flex items-center justify-between px-2 pb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Nearby Devices ({discoveredDevices.filter((d) => d.isOnline).length})
                  </p>
                  <button
                    onClick={handleRescan}
                    disabled={isRefreshing}
                    className="p-1 hover:bg-secondary rounded-md text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                    title="Rescan Devices"
                  >
                    <RotateCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
                  </button>
                </div>
                {discoveredDevices.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <div className="inline-block p-3 bg-secondary rounded-full">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="text-sm text-muted-foreground">Searching for peers...</p>
                  </div>
                ) : (
                  discoveredDevices.map((device) => (
                    <Link
                      key={device.deviceId}
                      to={`/device/${device.deviceId}`}
                      onClick={() => clearUnreadCount(device.deviceId)}
                      className={cn(
                        'w-full flex items-center gap-3 p-2.5 rounded-lg transition-all border border-transparent',
                        activeDeviceId === device.deviceId
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'hover:bg-secondary border-border/50',
                        !device.isOnline && 'opacity-50 grayscale'
                      )}
                    >
                      <div
                        className={cn(
                          'p-0 rounded-full overflow-hidden w-9 h-9 flex items-center justify-center border border-border/10',
                          activeDeviceId === device.deviceId ? 'bg-white/20' : 'bg-primary/5'
                        )}
                      >
                        {device.profileImage ? (
                          <img src={device.profileImage} alt={device.displayName} className="w-full h-full object-cover" />
                        ) : (
                          device.platform === 'darwin' ? (
                            <Laptop className="w-5 h-5" />
                          ) : (
                            <Monitor className="w-5 h-5" />
                          )
                        )}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{device.displayName}</p>
                        <p
                          className={cn(
                            'text-xs truncate',
                            activeDeviceId === device.deviceId
                              ? 'text-primary-foreground/80'
                              : 'text-muted-foreground'
                          )}
                        >
                          {device.address}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {unreadCounts[device.deviceId] > 0 && (
                          <div className="min-w-4.5 h-4.5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center px-1 animate-in zoom-in duration-300">
                            {unreadCounts[device.deviceId] > 99
                              ? '99+'
                              : unreadCounts[device.deviceId]}
                          </div>
                        )}
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            device.isOnline
                              ? 'bg-green-500 animate-pulse'
                              : 'bg-muted-foreground/30'
                          )}
                        />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground px-2 uppercase tracking-wider">
                Settings
              </p>
              <button
                onClick={() => navigate('/')}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary text-secondary-foreground shadow-sm active:scale-[0.98]"
              >
                <div className="p-2 bg-primary/10 rounded-md text-primary">
                  <Laptop className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold">Back to Devices</span>
              </button>
            </div>
          )}
        </div>
        <div className="p-4 border-t">
          <Link
            to={isSettings ? '/' : '/settings'}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-lg transition-all border group',
              isSettings
                ? 'bg-primary text-primary-foreground shadow-lg border-primary'
                : 'bg-card border-border/50 hover:bg-secondary hover:border-border'
            )}
          >
            <div
              className={cn(
                ' rounded-lg transition-colors',
                isSettings ? 'bg-primary-foreground/20' : 'bg-secondary group-hover:bg-primary/10'
              )}
            >
              <Settings
                className={cn(
                  'w-4 h-4',
                  isSettings
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground group-hover:text-primary'
                )}
              />
            </div>
            <span className="text-sm font-bold uppercase tracking-wider">
              {isSettings ? 'Close Settings' : 'Settings'}
            </span>
          </Link>
        </div>
      </div>
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-secondary/20">
        <Outlet />
      </div>
    </div>
  )
}
