import React, { useState, useEffect, useRef } from 'react'
import logoLight from '../assets/logo_light.png'
import logoDark from '../assets/logo_dark.png'
import { useStore } from '../store/useStore'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent } from '../components/ui/card'
import { Separator } from '../components/ui/separator'
import { Send, Laptop, Monitor, Paperclip, FileText, FileUp, CheckCircle2, Settings, Trash2, Info, User, RotateCw } from 'lucide-react'
import { ThemeToggle } from '../components/ui/theme-toggle'
import {
  Device,
  NetworkMessage,
  FileMetadata,
  FileTransferProgress
} from '../../shared/messageTypes'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@renderer/lib/utils'

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const getFileType = (filename?: string): string => {
  if (!filename) return 'Unknown'
  const ext = filename.split('.').pop()
  return ext ? ext.toUpperCase() : 'Unknown'
}

export const Main: React.FC = () => {
  const {
    discoveredDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    localDevice,
    unreadCounts,
    clearUnreadCount
  } = useStore(
    useShallow((state) => ({
      discoveredDevices: state.discoveredDevices,
      selectedDeviceId: state.selectedDeviceId,
      setSelectedDeviceId: state.setSelectedDeviceId,
      localDevice: state.localDevice,
      unreadCounts: state.unreadCounts,
      clearUnreadCount: state.clearUnreadCount
    }))
  )

  const [sidebarView, setSidebarView] = useState<'devices' | 'settings'>('devices')
  const [isRefreshing, setIsRefreshing] = useState(false)
  console.log('[Main] Rendering - selectedDeviceId:', selectedDeviceId)
  const selectedDevice = discoveredDevices.find((d) => d.deviceId === selectedDeviceId)
  console.log('[Main] Selected device found:', !!selectedDevice)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r bg-card/50 flex flex-col">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white dark:bg-slate-950 rounded-lg p-1 shadow-sm overflow-hidden border border-border/10 flex items-center justify-center">
              <img src={logoLight} alt="Logo" className="w-full h-full object-contain dark:hidden" />
              <img src={logoDark} alt="Logo" className="w-full h-full object-contain hidden dark:block" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent">
              Hyper Connect
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {sidebarView === 'devices' ? (
            <>
              <div className="px-4 pb-4">
                <div className="p-3 bg-secondary/50 rounded-lg border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="p-1 rounded-md shadow-sm w-7 h-7 overflow-hidden flex items-center justify-center bg-white dark:bg-slate-900 border border-border/10">
                      <img src={logoLight} alt="My Device" className="w-full h-full object-contain dark:hidden" />
                      <img src={logoDark} alt="My Device" className="w-full h-full object-contain hidden dark:block" />
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
                    onClick={async () => {
                      if (isRefreshing) return
                      setIsRefreshing(true)
                      try {
                        await window.api.rescanDevices()
                        // Ensure animation runs for at least 1s for visual feedback
                        setTimeout(() => setIsRefreshing(false), 1000)
                      } catch (e) {
                        console.error('[Main] Refresh error:', e)
                        setIsRefreshing(false)
                      }
                    }}
                    disabled={isRefreshing}
                    className="p-1 hover:bg-secondary rounded-md text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                    title="Rescan Devices"
                  >
                    <RotateCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
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
                    <button
                      key={device.deviceId}
                      onClick={() => {
                        setSelectedDeviceId(device.deviceId)
                        clearUnreadCount(device.deviceId)
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg transition-all border border-transparent',
                        selectedDeviceId === device.deviceId
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'hover:bg-secondary border-border/50',
                        !device.isOnline && 'opacity-50 grayscale'
                      )}
                    >
                      <div
                        className={cn(
                          'p-2 rounded-md',
                          selectedDeviceId === device.deviceId ? 'bg-white/10' : 'bg-primary/5'
                        )}
                      >
                        {device.platform === 'darwin' ? (
                          <Laptop className="w-4 h-4" />
                        ) : (
                          <Monitor className="w-4 h-4" />
                        )}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{device.displayName}</p>
                        <p
                          className={cn(
                            'text-xs truncate',
                            selectedDeviceId === device.deviceId
                              ? 'text-primary-foreground/80'
                              : 'text-muted-foreground'
                          )}
                        >
                          {device.address}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {unreadCounts[device.deviceId] > 0 && (
                          <div className="min-w-[18px] h-[18px] rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center px-1 animate-in zoom-in duration-300">
                            {unreadCounts[device.deviceId] > 99 ? '99+' : unreadCounts[device.deviceId]}
                          </div>
                        )}
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            device.isOnline ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'
                          )}
                        />
                      </div>
                    </button>
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
                onClick={() => setSidebarView('devices')}
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
          <button
            onClick={() => {
              setSidebarView(sidebarView === 'settings' ? 'devices' : 'settings')
              if (sidebarView === 'devices') setSelectedDeviceId(null)
            }}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-xl transition-all border group',
              sidebarView === 'settings'
                ? 'bg-primary text-primary-foreground shadow-lg border-primary'
                : 'bg-card border-border/50 hover:bg-secondary hover:border-border'
            )}
          >
            <div
              className={cn(
                'p-2 rounded-lg transition-colors',
                sidebarView === 'settings' ? 'bg-primary-foreground/20' : 'bg-secondary group-hover:bg-primary/10'
              )}
            >
              <Settings
                className={cn(
                  'w-4 h-4',
                  sidebarView === 'settings' ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-primary'
                )}
              />
            </div>
            <span className="text-sm font-bold uppercase tracking-wider">
              {sidebarView === 'settings' ? 'Close Settings' : 'Settings'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-secondary/20">
        {sidebarView === 'settings' ? (
          <SettingsView />
        ) : selectedDevice ? (
          <DeviceView device={selectedDevice} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-20 h-20 bg-primary/5 rounded-3xl flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-primary/20" />
            </div>
            <div className="max-w-xs space-y-2">
              <h2 className="text-2xl font-bold">Ready to Connect</h2>
              <p className="text-muted-foreground">
                Select a device from the sidebar to start sharing files and messages instantly.
              </p>
            </div>
          </div>
        )}
      </div>
    </div >
  )
}

const SettingsView: React.FC = () => {
  const { localDevice, setLocalDevice, clearMessages, clearTransfers } = useStore()
  const [name, setName] = useState(localDevice?.displayName || '')
  const [saving, setSaving] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)

  const handleUpdateName = async () => {
    if (!name.trim() || name === localDevice?.displayName) return
    setSaving(true)
    try {
      const updated = await window.api.updateDisplayName(name)
      setLocalDevice(updated)
    } finally {
      setSaving(false)
    }
  }

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear the application cache? This will clear session data and reload the app.')) return
    setClearingCache(true)
    try {
      await window.api.clearCache()
      window.location.reload()
    } finally {
      setClearingCache(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-12 max-w-4xl mx-auto w-full space-y-12">
      <div className="flex items-center gap-6">
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary">
          <Settings className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">Manage your profile and application data.</p>
        </div>
      </div>

      <div className="grid gap-8">
        {/* Profile Section */}
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm rounded-3xl overflow-hidden">
          <CardContent className="p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <User className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold">Your Profile</h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                  Display Name
                </label>
                <div className="flex gap-3">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="h-12 rounded-xl text-md font-medium px-4"
                  />
                  <Button
                    onClick={handleUpdateName}
                    disabled={saving || name === localDevice?.displayName}
                    className="h-12 px-8 rounded-xl font-bold shadow-lg shadow-primary/20"
                  >
                    {saving ? 'Saving...' : 'Update'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Management Section */}
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm rounded-3xl overflow-hidden">
          <CardContent className="p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-xl text-red-500">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold">Data & Privacy</h3>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Button
                variant="secondary"
                onClick={() => confirm('Clear all chat messages?') && clearMessages()}
                className="h-16 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all border border-transparent"
              >
                <span className="font-bold">Clear Chat History</span>
                <span className="text-[10px] opacity-60 font-medium">Reset all conversations</span>
              </Button>

              <Button
                variant="secondary"
                onClick={() => confirm('Clear transfer history?') && clearTransfers()}
                className="h-16 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all border border-transparent"
              >
                <span className="font-bold">Clear Transfer History</span>
                <span className="text-[10px] opacity-60 font-medium">Wipe recent activities</span>
              </Button>

              <Button
                variant="secondary"
                onClick={handleClearCache}
                disabled={clearingCache}
                className="h-16 rounded-2xl sm:col-span-2 flex flex-col items-center justify-center gap-1 hover:bg-orange-500/10 hover:text-orange-500 hover:border-orange-500/20 transition-all border border-transparent"
              >
                <span className="font-bold">{clearingCache ? 'Clearing...' : 'Clear Application Cache'}</span>
                <span className="text-[10px] opacity-60 font-medium">Frees up space and reloads session</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Section */}
        <div className="flex justify-center gap-8 py-4 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
            <Info className="w-4 h-4" />
            Version 1.0.0
          </div>
        </div>
      </div>
    </div>
  )
}

const EMPTY_MESSAGES: NetworkMessage[] = []

const DeviceView: React.FC<{ device: Device }> = ({ device }) => {
  const { addMessage, localDevice } = useStore(
    useShallow((state) => ({
      addMessage: state.addMessage,
      localDevice: state.localDevice
    }))
  )
  const [tab, setTab] = useState<'chat' | 'files'>('chat')
  const messages = useStore((state) => state.messages[device.deviceId] || EMPTY_MESSAGES)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = (): void => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  useEffect(() => {
    if (tab === 'chat') {
      scrollToBottom()
    }
  }, [messages, tab])

  const handleSend = async (): Promise<void> => {
    if (!input.trim()) return
    try {
      const sentMsg = await window.api.sendMessage(device.deviceId, input)
      addMessage(device.deviceId, sentMsg)
      setInput('')
    } catch (e) {
      console.error('[DeviceView] Send error:', e)
    }
  }

  const handleFileSelect = async (): Promise<void> => {
    const path = await window.api.selectFile()
    if (path) {
      const sentMsg = await window.api.sendFile(device.deviceId, path)
      addMessage(device.deviceId, sentMsg)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 border-b bg-background/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold truncate leading-tight">{device.displayName}</h2>
            <p
              className={cn(
                'text-xs flex items-center gap-1.5 font-medium',
                device.isOnline ? 'text-green-500' : 'text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  device.isOnline ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'
                )}
              />
              {device.isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-secondary p-1 rounded-xl">
            <button
              onClick={() => setTab('chat')}
              className={cn(
                'px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all',
                tab === 'chat' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Messages
            </button>
            <button
              onClick={() => setTab('files')}
              className={cn(
                'px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all',
                tab === 'files' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Files
            </button>
          </div>
          <Separator orientation="vertical" className="h-6" />
          <ThemeToggle />
        </div>
      </header>

      {tab === 'chat' ? (
        <div className="flex-1 flex flex-col min-h-0 bg-background/40">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center opacity-40 space-y-3">
                <div className="p-4 bg-muted rounded-full">
                  <Send className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No messages yet. Say hello!</p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isLocal = msg.deviceId === localDevice?.deviceId
                const isFile = msg.type === 'FILE_META'

                return (
                  <div
                    key={msg.id || i}
                    className={cn('flex flex-col', isLocal ? 'items-end' : 'items-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-4 py-3 shadow-sm',
                        isLocal
                          ? 'bg-primary text-primary-foreground rounded-tr-none'
                          : 'bg-card border border-border/50 rounded-tl-none'
                      )}
                    >
                      {!isFile ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload)}
                        </p>
                      ) : (
                        <FileChatBubble
                          msg={msg}
                          isLocal={isLocal}
                        />
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1.5 px-1 font-medium">
                      {new Date(msg.timestamp || 0).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                )
              })
            )}
          </div>
          <div className="p-4 bg-background border-t shrink-0 relative z-20">
            <div className="flex gap-2 max-w-4xl mx-auto items-center">
              <button
                type="button"
                onClick={handleFileSelect}
                className="p-2.5 hover:bg-secondary rounded-xl text-muted-foreground hover:text-primary transition-all hover:scale-105 active:scale-95"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <div className="flex-1 relative">
                <Input
                  placeholder="Type a message..."
                  className="py-3 px-4 h-11 rounded-xl text-md shadow-xs"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
              </div>
              <Button
                size="icon"
                className="h-11 w-11 rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                onClick={handleSend}
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <TransferView device={device} />
      )}
    </div>
  )
}

const AcceptRejectButtons: React.FC<{ fileId: string }> = ({ fileId }) => {
  const { updateTransfer } = useStore()
  const transfer = useStore((state) => state.transfers[fileId])
  const status = transfer?.status || 'pending'

  if (status !== 'pending') return null

  const handleAccept = async () => {
    await window.api.acceptFile(fileId)
    updateTransfer({ fileId, status: 'active' } as any)
  }

  const handleReject = async () => {
    await window.api.rejectFile(fileId)
    updateTransfer({ fileId, status: 'rejected' } as any)
  }

  return (
    <div className="flex gap-2 pt-2 animate-in slide-in-from-top-2 duration-300">
      <Button
        size="sm"
        className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold uppercase tracking-wider text-[10px] h-8 rounded-lg shadow-sm"
        onClick={handleAccept}
      >
        Accept
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className="flex-1 font-bold uppercase tracking-wider text-[10px] h-8 rounded-lg"
        onClick={handleReject}
      >
        Reject
      </Button>
    </div>
  )
}

const FileChatBubble: React.FC<{ msg: NetworkMessage; isLocal: boolean }> = ({ msg, isLocal }) => {
  const metadata: FileMetadata = msg.payload
  const transfers = useStore((state) => state.transfers)
  const transfer = transfers[metadata.fileId]
  const status = transfer?.status || (isLocal ? 'active' : 'pending')
  const isCompleted = status === 'completed'
  const isActive = status === 'active'

  return (
    <div className="space-y-3">
      <div
        onClick={() => {
          if (isCompleted && (transfer?.path || (isLocal && metadata.path))) {
            window.api.openFileLocation(transfer?.path || metadata.path!)
          }
        }}
        className={cn(
          'flex items-center gap-3 p-3 rounded-xl border transition-all',
          isLocal
            ? 'bg-primary-foreground/10 border-primary-foreground/20'
            : 'bg-muted/50 border-border',
          isCompleted && 'cursor-pointer hover:bg-black/5 active:scale-[0.98]'
        )}
      >
        <div
          className={cn(
            'p-2 rounded-lg',
            isLocal ? 'bg-primary-foreground/20' : 'bg-primary/10'
          )}
        >
          {isCompleted ? (
            <CheckCircle2 className={cn('w-5 h-5', isLocal ? 'text-primary-foreground' : 'text-green-500')} />
          ) : (
            <FileText className={cn('w-5 h-5', isLocal ? 'text-primary-foreground' : 'text-primary')} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-medium wrap-break-word",
            isLocal ? "text-primary-foreground" : "text-foreground"
          )}>
            {metadata.name || 'File'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p
              className={cn(
                'text-[10px] uppercase font-black tracking-widest opacity-70',
                isLocal ? 'text-primary-foreground' : 'text-muted-foreground'
              )}
            >
              {getFileType(metadata.name)}
            </p>
            <span className="w-1 h-1 rounded-full bg-current opacity-30" />
            <p
              className={cn(
                'text-[10px] font-bold opacity-70',
                isLocal ? 'text-primary-foreground' : 'text-muted-foreground'
              )}
            >
              {formatFileSize(metadata.size)}
            </p>
            <span className="w-1 h-1 rounded-full bg-current opacity-30" />
            <p className={cn('text-[9px] font-black uppercase tracking-tighter', isLocal ? 'text-primary-foreground' : 'text-primary')}>
              {isLocal ? 'Sent' : 'Received'}
            </p>
            {isCompleted && (
              <>
                <span className="w-1 h-1 rounded-full bg-current opacity-30" />
                <p className={cn('text-[9px] font-black uppercase tracking-tighter', isLocal ? 'text-primary-foreground' : 'text-primary')}>
                  Done
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {isActive && transfer && (
        <div className="px-1 space-y-1.5 animate-in fade-in duration-300">
          <div className={cn(
            "flex justify-between text-[9px] font-bold uppercase tracking-tighter",
            isLocal ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            <span>{(transfer.progress * 100).toFixed(0)}%</span>
            <span>{formatFileSize(transfer.speed)}/s</span>
          </div>
          <div className={cn(
            "h-1 w-full rounded-full overflow-hidden",
            isLocal ? "bg-primary-foreground/20" : "bg-primary/10"
          )}>
            <div
              className={cn(
                "h-full transition-all duration-300",
                isLocal ? "bg-primary-foreground" : "bg-primary"
              )}
              style={{ width: `${transfer.progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {!isLocal && status === 'pending' && <AcceptRejectButtons fileId={metadata.fileId} />}
    </div>
  )
}

const TransferView: React.FC<{ device: Device }> = ({ device }) => {
  const { addMessage } = useStore()
  const transfers = useStore(
    useShallow((state) =>
      Object.values(state.transfers).filter((t) => t.deviceId === device.deviceId)
    )
  )

  const handleSelectFile = async (): Promise<void> => {
    const path = await window.api.selectFile()
    if (path) {
      const sentMsg = await window.api.sendFile(device.deviceId, path)
      addMessage(device.deviceId, sentMsg)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-background/50">
      <div
        onClick={handleSelectFile}
        className="relative group border-2 border-dashed border-border/60 rounded-[2.5rem] p-16 text-center space-y-6 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer overflow-hidden"
      >
        <div className="relative z-10 space-y-4">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-500">
            <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30">
              <FileUp className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight">Send Files</h3>
            <p className="text-sm text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
              Drag and drop your files here or <span className="text-primary font-bold">browse</span> to share
            </p>
          </div>
          <Button variant="secondary" className="mt-2 font-bold uppercase tracking-wider text-[11px] px-10 h-10 rounded-xl shadow-sm">
            Browse Files
          </Button>
        </div>

        {/* Decorative corner element */}
        <div className="absolute -top-12 -right-12 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/50 whitespace-nowrap">
            Transfer History
          </h3>
          <Separator className="flex-1 opacity-10" />
        </div>

        {transfers.length === 0 ? (
          <div className="text-center py-20 bg-muted/5 rounded-3xl border border-dashed border-border/40">
            <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Paperclip className="w-6 h-6 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground/60">No recent activity</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {[...transfers].reverse().map((transfer) => {
              const remainsCompleted = transfer.status === 'completed'

              return (
                <Card
                  key={transfer.fileId}
                  onClick={() => {
                    if (remainsCompleted && transfer.path) {
                      window.api.openFileLocation(transfer.path)
                    }
                  }}
                  className={cn(
                    'bg-card/40 border-border/40 overflow-hidden group transition-all rounded-2xl',
                    remainsCompleted && 'cursor-pointer hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg active:scale-[0.98]'
                  )}
                >
                  <CardContent className="p-5 flex items-center gap-5">
                    <div
                      className={cn(
                        'p-3.5 rounded-2xl border transition-colors',
                        remainsCompleted
                          ? 'bg-green-500/10 border-green-500/20 text-green-600'
                          : 'bg-primary/5 border-primary/10 text-primary/70'
                      )}
                    >
                      {remainsCompleted ? <Paperclip className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                    </div>
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">
                            {(transfer as FileTransferProgress & { name?: string }).name || 'File'}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                              {getFileType((transfer as any).name)} • {formatFileSize((transfer as any).size)}
                            </p>
                            <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                              {transfer.direction === 'outgoing' ? 'Outgoing' : 'Incoming'}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            'text-[10px] font-black uppercase tracking-tighter px-3 py-1 rounded-full border',
                            transfer.status === 'completed' ? 'bg-green-500/20 text-green-600 border-green-500/20' :
                              transfer.status === 'active' ? 'bg-primary/20 text-primary border-primary/20 animate-pulse' :
                                transfer.status === 'rejected' ? 'bg-muted text-muted-foreground border-border' :
                                  'bg-yellow-500/20 text-yellow-600 border-yellow-500/20'
                          )}
                        >
                          {transfer.status}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
