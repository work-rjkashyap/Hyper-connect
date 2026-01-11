import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import {
  FileUp,
  Paperclip,
  Send,
  User,
  Check,
  CheckCheck,
  Copy,
  Trash2,
  Reply,
  Forward,
  X
} from 'lucide-react'
import { ForwardDialog } from '../components/ForwardDialog'
import { toast } from 'sonner'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator
} from '../components/ui/context-menu'
import { useStore } from '../store/useStore'
import { cn, formatFileSize, formatChatDate } from '../lib/utils'
import { NetworkMessage, Device } from '../../shared/messageTypes'
import { Button } from '../components/ui/button'
import { Separator } from '../components/ui/separator'
import { ThemeToggle } from '../components/ui/theme-toggle'
import { Card, CardContent } from '../components/ui/card'
import { FileChatBubble } from '../components/FileChatBubble'
import { Textarea } from '../components/ui/textarea'
const EMPTY_MESSAGES: NetworkMessage[] = []
const REMOTE_DELETE_LIMIT = 15 * 60 * 1000 // 15 minutes
export const DevicePage: React.FC = () => {
  const { deviceId } = useParams()
  const {
    discoveredDevices,
    addMessage,
    localDevice,
    setSelectedDeviceId,
    clearUnreadCount,
    deleteMessage
  } = useStore(
    useShallow((state) => ({
      discoveredDevices: state.discoveredDevices,
      addMessage: state.addMessage,
      localDevice: state.localDevice,
      setSelectedDeviceId: state.setSelectedDeviceId,
      clearUnreadCount: state.clearUnreadCount,
      deleteMessage: state.deleteMessage
    }))
  )
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set())
  const [replyingTo, setReplyingTo] = useState<NetworkMessage | null>(null)
  const [forwardingMessage, setForwardingMessage] = useState<NetworkMessage | null>(null)
  const device = discoveredDevices.find((d) => d.deviceId === deviceId)
  useEffect(() => {
    if (deviceId) {
      setSelectedDeviceId(deviceId)
      clearUnreadCount(deviceId)
    }
    return () => {
      setSelectedDeviceId(null)
    }
  }, [deviceId, setSelectedDeviceId, clearUnreadCount])
  const [tab, setTab] = useState<'chat' | 'files'>('chat')
  const messages = useStore((state) =>
    deviceId ? state.messages[deviceId] || EMPTY_MESSAGES : EMPTY_MESSAGES
  )
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollToBottom = useCallback((): void => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [])
  useEffect(() => {
    if (tab === 'chat') {
      scrollToBottom()
      // Mark visible unread messages as read
      if (!device) return
      const unreadIncoming = messages.filter(
        (m) => m.deviceId !== localDevice?.deviceId && m.status !== 'read'
      )
      unreadIncoming.forEach((msg) => {
        if (msg.id) window.api.markAsRead(device.deviceId, msg.id)
      })
    }
  }, [messages, tab, device, localDevice?.deviceId, scrollToBottom])
  const handleSend = async (): Promise<void> => {
    if (!input.trim() || !device) return
    try {
      const sentMsg = await window.api.sendMessage(device.deviceId, input)
      if (replyingTo) {
        sentMsg.replyTo = replyingTo.id
      }
      addMessage(device.deviceId, sentMsg)
      setInput('')
      setReplyingTo(null)
    } catch (e) {
      console.error('[DevicePage] Send error:', e)
    }
  }

  const handleForward = async (targetDeviceId: string): Promise<void> => {
    if (!forwardingMessage) return
    try {
      const payload = forwardingMessage.payload as string
      const sentMsg = await window.api.sendMessage(targetDeviceId, payload)
      addMessage(targetDeviceId, sentMsg)
      setForwardingMessage(null)
      toast.success('Message forwarded')
    } catch (e) {
      console.error('[DevicePage] Forward error:', e)
      toast.error('Failed to forward message')
    }
  }
  const handleFileSelect = async (): Promise<void> => {
    if (!device) return
    const path = await window.api.selectFile()
    if (path) {
      const sentMsg = await window.api.sendFile(device.deviceId, path)
      addMessage(device.deviceId, sentMsg)
    }
  }
  const handleCopy = (text: string): void => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }
  const executeDelete = useCallback(
    async (msg: NetworkMessage): Promise<void> => {
      if (!deviceId || !msg.id) return
      // Final store delete
      deleteMessage(deviceId, msg.id)
      setPendingDeletes((prev) => {
        const next = new Set(prev)
        next.delete(msg.id!)
        return next
      })
      // Remote delete logic
      const isLocal = msg.deviceId === localDevice?.deviceId
      const isWithinTime = Date.now() - (msg.timestamp || 0) < REMOTE_DELETE_LIMIT
      if (isLocal && isWithinTime) {
        try {
          await window.api.deleteRemoteMessage(deviceId, msg.id)
        } catch (e) {
          console.error('[DevicePage] Remote delete failed:', e)
        }
      }
    },
    [deviceId, deleteMessage, localDevice?.deviceId]
  )
  const handleDelete = useCallback(
    (msg: NetworkMessage): void => {
      if (!deviceId || !msg.id) return
      const msgId = msg.id
      setPendingDeletes((prev) => new Set(prev).add(msgId))
      let isUndone = false
      toast.message('Message deleted', {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: () => {
            isUndone = true
            setPendingDeletes((prev) => {
              const next = new Set(prev)
              next.delete(msgId)
              return next
            })
          }
        },
        onAutoClose: () => {
          if (!isUndone) {
            executeDelete(msg)
          }
        }
      })
    },
    [deviceId, executeDelete]
  )
  if (!device) {
    return <Navigate to="/" replace />
  }
  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300">
      <header className="h-16 border-b bg-background/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full border border-border/10 overflow-hidden bg-secondary flex items-center justify-center shrink-0 shadow-sm">
            {device.profileImage ? (
              <img
                src={device.profileImage}
                alt={device.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
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
                tab === 'chat'
                  ? 'bg-background shadow-sm text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Messages
            </button>
            <button
              onClick={() => setTab('files')}
              className={cn(
                'px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all',
                tab === 'files'
                  ? 'bg-background shadow-sm text-primary'
                  : 'text-muted-foreground hover:text-foreground'
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
              <div className="flex-1 flex flex-col items-center justify-center opacity-40 space-y-3 h-full">
                <div className="p-4 bg-muted rounded-full">
                  <Send className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No messages yet. Say hello!</p>
              </div>
            ) : (
              messages
                .filter((m) => !pendingDeletes.has(m.id!))
                .map((msg, i, filtered) => {
                  const isLocal = msg.deviceId === localDevice?.deviceId
                  const isFile = msg.type === 'FILE_META'
                  // Date separator logic
                  const currentDate = formatChatDate(msg.timestamp)
                  const prevDate = i > 0 ? formatChatDate(filtered[i - 1].timestamp) : null
                  const showSeparator = currentDate !== prevDate
                  return (
                    <React.Fragment key={msg.id || i}>
                      {showSeparator && (
                        <div className="flex items-center gap-4 py-4">
                          <Separator className="flex-1 opacity-10" />
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 whitespace-nowrap">
                            {currentDate}
                          </span>
                          <Separator className="flex-1 opacity-10" />
                        </div>
                      )}
                      <div className={cn('flex flex-col', isLocal ? 'items-end' : 'items-start')}>
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              className={cn(
                                'max-w-[85%] rounded-2xl px-4 py-3 shadow-sm cursor-default',
                                isLocal
                                  ? 'bg-primary text-primary-foreground rounded-tr-none'
                                  : 'bg-card border border-border/50 rounded-tl-none'
                              )}
                            >
                              {!isFile ? (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words select-text">
                                  {typeof msg.payload === 'string'
                                    ? msg.payload
                                    : JSON.stringify(msg.payload)}
                                </p>
                              ) : (
                                <FileChatBubble msg={msg} isLocal={isLocal} />
                              )}
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-48">
                            <ContextMenuItem
                              onClick={() => setReplyingTo(msg)}
                              className="flex items-center gap-2"
                            >
                              <Reply className="w-4 h-4" />
                              <span>Reply</span>
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => setForwardingMessage(msg)}
                              className="flex items-center gap-2"
                            >
                              <Forward className="w-4 h-4" />
                              <span>Forward</span>
                            </ContextMenuItem>
                            {!isFile && (
                              <ContextMenuItem
                                onClick={() => handleCopy(msg.payload as string)}
                                className="flex items-center gap-2"
                              >
                                <Copy className="w-4 h-4" />
                                <span>Copy Text</span>
                              </ContextMenuItem>
                            )}
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onClick={() => handleDelete(msg)}
                              className="text-destructive focus:text-destructive flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Delete Message</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                        <div className="flex items-center gap-1.5 mt-1 px-1">
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {new Date(msg.timestamp || 0).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {isLocal && (
                            <div className="flex items-center">
                              {msg.status === 'sent' && (
                                <Check className="w-3 h-3 text-muted-foreground/50" />
                              )}
                              {msg.status === 'delivered' && (
                                <CheckCheck className="w-3 h-3 text-muted-foreground/50" />
                              )}
                              {msg.status === 'read' && (
                                <CheckCheck className="w-3 h-3 text-blue-500" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  )
                })
            )}
          </div>
          <div className="p-4 bg-background border-t shrink-0 relative z-20">
            {replyingTo && (
              <div className="max-w-4xl mx-auto mb-2 flex items-center gap-3 bg-secondary/50 p-2.5 rounded-xl border border-border/50 animate-in slide-in-from-bottom-2 duration-200">
                <div className="w-1 bg-primary self-stretch rounded-full opacity-50" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">
                    Replying to{' '}
                    {replyingTo.deviceId === localDevice?.deviceId ? 'you' : device.displayName}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {replyingTo.payload as string}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full hover:bg-secondary"
                  onClick={() => setReplyingTo(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            <div className="flex gap-2 max-w-4xl mx-auto items-center">
              <button
                type="button"
                onClick={handleFileSelect}
                className="p-2.5 hover:bg-secondary rounded-xl text-muted-foreground hover:text-primary transition-all hover:scale-105 active:scale-95"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <div className="flex-1 relative">
                <Textarea
                  autoFocus
                  placeholder="Type a message..."
                  className="py-3 px-4 min-h-11 max-h-32 rounded-xl text-md shadow-xs resize-none overflow-y-auto"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  rows={1}
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
      <ForwardDialog
        isOpen={!!forwardingMessage}
        onOpenChange={(open) => !open && setForwardingMessage(null)}
        onForward={handleForward}
      />
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
            <p className="text-xs text-muted-foreground truncate wrap-break-word max-w-60 mx-auto leading-relaxed">
              Drag and drop your files here or{' '}
              <span className="text-primary font-bold">browse</span> to share
            </p>
          </div>
          <Button
            variant="secondary"
            className="mt-2 font-bold uppercase tracking-wider text-[11px] px-10 h-10 rounded-xl shadow-sm"
          >
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
                    remainsCompleted &&
                      'cursor-pointer hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg active:scale-[0.98]'
                  )}
                >
                  <CardContent className="p-5 flex items-center gap-5">
                    <div
                      className={cn(
                        'p-3.5 rounded-2xl border transition-colors',
                        remainsCompleted
                          ? 'bg-green-500/10 border-green-500/20 text-green-600'
                          : 'bg-muted/10 border-border/50 text-muted-foreground/50'
                      )}
                    >
                      {remainsCompleted ? (
                        <FileUp className="w-6 h-6" />
                      ) : (
                        <Paperclip className="w-6 h-6" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate max-w-60">
                        {transfer.name || 'Unknown File'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          {transfer.status}
                        </span>
                        {transfer.status === 'active' && (
                          <span className="text-xs text-primary font-bold">
                            {(transfer.progress * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-muted-foreground/50 bg-secondary/50 px-2 py-1 rounded-md">
                        {formatFileSize(transfer.size)}
                      </p>
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
