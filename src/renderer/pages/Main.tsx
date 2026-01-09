import React, { useState } from 'react'
import { useStore } from '../store/useStore'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent } from '../components/ui/card'
import { Separator } from '../components/ui/separator'
import { Monitor, Send, Paperclip, CheckCircle2, Laptop, FileUp } from 'lucide-react'
import { ThemeToggle } from '../components/ui/theme-toggle'
import { Device } from '../../shared/messageTypes'
import { cn } from '@renderer/lib/utils'

export const Main: React.FC = () => {
  const { discoveredDevices, selectedDeviceId, setSelectedDeviceId, localDevice } = useStore()

  const selectedDevice = discoveredDevices.find((d) => d.deviceId === selectedDeviceId)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r bg-card/50 flex flex-col">
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight bg-linear-to-br from-primary to-primary/60 bg-clip-text text-transparent">
            Hyper-connect
          </h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="p-3 bg-secondary/50 rounded-lg border border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-md">
                <Monitor className="w-4 h-4 text-primary" />
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

        <Separator />

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground px-2 pb-2 uppercase tracking-wider">
            Nearby Devices ({discoveredDevices.filter((d) => d.isOnline).length})
          </p>
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
                onClick={() => setSelectedDeviceId(device.deviceId)}
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
                {device.isOnline && <div className="w-2 h-2 rounded-full bg-green-500" />}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-secondary/20">
        {selectedDevice ? (
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
    </div>
  )
}

const DeviceView: React.FC<{ device: Device }> = ({ device }) => {
  const [tab, setTab] = useState<'chat' | 'files'>('chat')
  const messages = useStore((state) => state.messages[device.deviceId] || [])
  const [input, setInput] = useState('')

  const handleSend = async () => {
    if (!input.trim()) return
    try {
      await window.api.sendMessage(device.deviceId, input)
      setInput('')
    } catch (e) {
      console.error('Send error:', e)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 border-b bg-background/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold truncate leading-tight">{device.displayName}</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" /> Online
            </p>
          </div>
        </div>
        <div className="flex bg-secondary p-1 rounded-lg">
          <button
            onClick={() => setTab('chat')}
            className={cn(
              'px-4 py-1.5 text-sm font-semibold rounded-md transition-all',
              tab === 'chat' ? 'bg-background shadow-sm' : 'hover:text-primary'
            )}
          >
            Chat
          </button>
          <button
            onClick={() => setTab('files')}
            className={cn(
              'px-4 py-1.5 text-sm font-semibold rounded-md transition-all',
              tab === 'files' ? 'bg-background shadow-sm' : 'hover:text-primary'
            )}
          >
            Files
          </button>
        </div>
      </header>

      {tab === 'chat' ? (
        <div className="flex-1 flex flex-col min-h-0 bg-background/30 shadow-inner">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full opacity-30 select-none">
                <p className="text-sm font-medium">No messages yet</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300',
                  msg.deviceId === device.deviceId ? 'items-start' : 'items-end'
                )}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm',
                    msg.deviceId === device.deviceId
                      ? 'bg-secondary text-secondary-foreground rounded-tl-none border border-border/50'
                      : 'bg-primary text-primary-foreground rounded-tr-none'
                  )}
                >
                  {msg.payload}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 px-1">
                  {new Date(msg.timestamp || 0).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            ))}
          </div>
          <div className="p-4 bg-background border-t">
            <div className="flex gap-2 max-w-4xl mx-auto items-end">
              <div className="flex-1 relative">
                <Input
                  placeholder="Type a message..."
                  className="pr-12 resize-none py-3 h-auto"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
              </div>
              <Button
                size="icon"
                className="h-[46px] w-[46px] rounded-xl shadow-lg shadow-primary/20"
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

const TransferView: React.FC<{ device: Device }> = ({ device }) => {
  const transfers = useStore((state) =>
    Object.values(state.transfers).filter((t) => t.deviceId === device.deviceId)
  )

  const handleSelectFile = async () => {
    // We'll need a custom dialog or file input
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = async (e: any) => {
      const path = e.target.files[0].path
      if (path) {
        await window.api.sendFile(device.deviceId, path)
      }
    }
    input.click()
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-background/50">
      <div
        onClick={handleSelectFile}
        className="group border-2 border-dashed border-border/60 rounded-2xl p-12 text-center space-y-4 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
      >
        <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
          <FileUp className="w-8 h-8 text-primary/40 group-hover:text-primary transition-colors" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold">Drop files here to send</p>
          <p className="text-sm text-muted-foreground">
            Select a file from your computer to transfer instantly.
          </p>
        </div>
        <Button variant="outline" className="mt-2 font-semibold">
          Choose File
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 px-2 flex items-center gap-2">
          <Separator className="flex-1 opacity-20" /> Recent Transfers{' '}
          <Separator className="flex-1 opacity-20" />
        </h3>
        {transfers.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground/60">
            <p className="text-sm italic">No active transfers</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {[...transfers].reverse().map((transfer) => (
              <Card key={transfer.fileId} className="bg-card/50 overflow-hidden group">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                    <Paperclip className="w-5 h-5 text-primary/60" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-bold truncate">
                        {(transfer as any).name || 'File'}
                      </p>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase bg-secondary px-2 py-0.5 rounded-full">
                        {transfer.status}
                      </span>
                    </div>
                    {transfer.status === 'active' && (
                      <div className="space-y-1.5 animate-in fade-in duration-500">
                        <div className="flex justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                          <span>
                            {(transfer.progress * 100).toFixed(0)}% •{' '}
                            {(transfer.speed / 1024 / 1024).toFixed(1)} MB/s
                          </span>
                          <span>{Math.ceil(transfer.eta)}s left</span>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${transfer.progress * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
