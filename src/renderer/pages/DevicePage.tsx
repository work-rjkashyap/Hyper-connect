import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import { ForwardDialog } from '../components/ForwardDialog'
import { StatusToast } from '../components/ui/StatusToast'
import { Tabs, TabsContent } from '../components/ui/tabs'
import { ChatHeader, ChatMessage, ChatInput, ReplyPreview, TransferView } from '../components/chat'
import { useStore } from '../store/useStore'
import { formatChatDate } from '../lib/utils'
import type { NetworkMessage } from '../../shared/messageTypes'
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
    deleteMessage,
    theme
  } = useStore(
    useShallow((state) => ({
      discoveredDevices: state.discoveredDevices,
      addMessage: state.addMessage,
      localDevice: state.localDevice,
      setSelectedDeviceId: state.setSelectedDeviceId,
      clearUnreadCount: state.clearUnreadCount,
      deleteMessage: state.deleteMessage,
      theme: state.theme
    }))
  )
  // Memoize device lookup for performance
  const device = useMemo(
    () => discoveredDevices.find((d) => d.deviceId === deviceId),
    [discoveredDevices, deviceId]
  )
  // Memoize messages to prevent unnecessary re-renders
  const messages = useStore(
    useCallback(
      (state) => (deviceId ? state.messages[deviceId] || EMPTY_MESSAGES : EMPTY_MESSAGES),
      [deviceId]
    )
  )
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set())
  const [replyingTo, setReplyingTo] = useState<NetworkMessage | null>(null)
  const [forwardingMessage, setForwardingMessage] = useState<NetworkMessage | null>(null)
  const [tab, setTab] = useState<'chat' | 'files'>('chat')
  const [input, setInput] = useState('')
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Auto-scroll management with user control
  const scrollToBottom = useCallback(
    (force = false): void => {
      if (scrollRef.current && (isScrolledToBottom || force)) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }
    },
    [isScrolledToBottom]
  )
  // Track if user has scrolled away from bottom
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setIsScrolledToBottom(isAtBottom)
  }, [])
  // Device and messages effects
  useEffect(() => {
    if (deviceId) {
      setSelectedDeviceId(deviceId)
      clearUnreadCount(deviceId)
    }
    return () => {
      setSelectedDeviceId(null)
    }
  }, [deviceId, setSelectedDeviceId, clearUnreadCount])
  // Auto-scroll when new messages arrive or switching tabs
  useEffect(() => {
    if (tab === 'chat') {
      scrollToBottom()
    }
  }, [messages, tab, scrollToBottom])
  // Mark unread messages as read when viewing chat
  useEffect(() => {
    if (tab !== 'chat' || !device || !localDevice) return
    const unreadIncoming = messages.filter(
      (m) => m.deviceId !== localDevice.deviceId && m.status !== 'read'
    )
    unreadIncoming.forEach((msg) => {
      if (msg.id) window.api.markAsRead(device.deviceId, msg.id)
    })
  }, [messages, tab, device, localDevice])
  // Optimized send handler with better error handling
  const handleSend = useCallback(async (): Promise<void> => {
    if (!input.trim() || !device) return
    const messageText = input.trim()
    const replyId = replyingTo?.id
    // Optimistic UI update
    setInput('')
    setReplyingTo(null)
    try {
      const sentMsg = await window.api.sendMessage(device.deviceId, messageText, replyId)
      addMessage(device.deviceId, sentMsg)
      scrollToBottom(true)
    } catch (error) {
      console.error('[DevicePage] Send error:', error)
      toast.custom((id) => (
        <StatusToast
          message="Failed to send message"
          description="Please try again"
          type="error"
          id={id}
        />
      ))
      // Restore input on error
      setInput(messageText)
      if (replyId) setReplyingTo(messages.find((m) => m.id === replyId) || null)
    }
  }, [input, device, replyingTo, addMessage, messages, scrollToBottom])
  const handleForward = async (targetDeviceId: string): Promise<void> => {
    if (!forwardingMessage) return
    try {
      const payload = forwardingMessage.payload as string
      const sentMsg = await window.api.sendMessage(targetDeviceId, payload)
      addMessage(targetDeviceId, sentMsg)
      setForwardingMessage(null)
      setForwardingMessage(null)
      toast.custom((id) => <StatusToast message="Message forwarded" type="success" id={id} />)
    } catch (e) {
      console.error('[DevicePage] Forward error:', e)
      toast.custom((id) => <StatusToast message="Failed to forward message" type="error" id={id} />)
    }
  }
  // Enhanced file selection with better UX
  const handleFileSelect = useCallback(async (): Promise<void> => {
    if (!device) return
    try {
      const path = await window.api.selectFile()
      if (path) {
        const replyId = replyingTo?.id
        setReplyingTo(null)
        const sentMsg = await window.api.sendFile(device.deviceId, path, replyId)
        addMessage(device.deviceId, sentMsg)
        scrollToBottom(true)
        toast.custom((id) => (
          <StatusToast message="File sent successfully" type="success" id={id} />
        ))
      }
    } catch (error) {
      console.error('[DevicePage] File select error:', error)
      toast.custom((id) => (
        <StatusToast
          message="Failed to send file"
          description="Please try again"
          type="error"
          id={id}
        />
      ))
    }
  }, [device, replyingTo, addMessage, scrollToBottom])
  // Enhanced tab change with better UX
  const handleTabChange = useCallback(
    (value: string) => {
      const newTab = value as 'chat' | 'files'
      setTab(newTab)
      // Clear reply when switching to files
      if (newTab === 'files' && replyingTo) {
        setReplyingTo(null)
      }
    },
    [replyingTo]
  )
  const handleCopy = useCallback((text: string): void => {
    navigator.clipboard.writeText(text)
    toast.custom((id) => <StatusToast message="Copied to clipboard" type="success" id={id} />)
  }, [])
  const handleReply = useCallback((msg: NetworkMessage): void => {
    setReplyingTo(msg)
    setTab('chat') // Ensure we're on chat tab for replies
  }, [])
  const handleForwardClick = useCallback((msg: NetworkMessage): void => {
    setForwardingMessage(msg)
  }, [])
  const handleCancelReply = useCallback((): void => {
    setReplyingTo(null)
  }, [])
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
      toast.custom((id) => (
        <StatusToast
          message="Message deleted"
          description="The message was removed for everyone"
          type="info"
          id={id}
        />
      ))
      // Execute delete immediately for consistent UX
      executeDelete(msg)
    },
    [deviceId, executeDelete]
  )
  if (!device) {
    return <Navigate to="/" replace aria-live="polite" />
  }
  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      <Tabs
        defaultValue="chat"
        value={tab}
        onValueChange={handleTabChange}
        className="flex-1 flex flex-col overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
        orientation="horizontal"
      >
        <ChatHeader device={device} currentTab={tab} onTabChange={handleTabChange} />
        <TabsContent
          value="chat"
          className="flex-1 flex flex-col min-h-0 bg-linear-to-b from-background to-background/95 mt-0 data-[state=active]:flex focus-visible:outline-none"
          role="tabpanel"
          aria-label="Chat messages"
        >
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-2 scroll-smooth overscroll-behavior-contain"
            onScroll={handleScroll}
            role="log"
            aria-live="polite"
            aria-label="Conversation history"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'hsl(var(--muted)) transparent'
            }}
          >
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 px-6">
                <div className="relative mb-6">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-primary/5">
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-lg">
                      <svg
                        className="w-6 h-6 text-primary-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-success rounded-full border-2 border-background animate-pulse" />
                </div>
                <div className="text-center space-y-2 max-w-sm">
                  <h3 className="text-lg font-semibold text-foreground">Start the conversation</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Send a message to{' '}
                    <span className="font-medium text-foreground">{device.displayName}</span> to
                    begin chatting
                  </p>
                </div>
              </div>
            ) : (
              messages
                .filter((m) => !pendingDeletes.has(m.id!))
                .map((msg, i, filtered) => {
                  const isLocal = msg.deviceId === localDevice?.deviceId
                  const currentDate = formatChatDate(msg.timestamp)
                  const prevDate = i > 0 ? formatChatDate(filtered[i - 1].timestamp) : null
                  const showSeparator = currentDate !== prevDate
                  // Message grouping logic for modern chat
                  const prevMsg = i > 0 ? filtered[i - 1] : null
                  const nextMsg = i < filtered.length - 1 ? filtered[i + 1] : null
                  const isFirstInGroup =
                    !prevMsg || prevMsg.deviceId !== msg.deviceId || showSeparator
                  const isLastInGroup = !nextMsg || nextMsg.deviceId !== msg.deviceId
                  return (
                    <React.Fragment key={msg.id || i}>
                      {showSeparator && (
                        <div className="sticky top-0 z-10 flex items-center gap-3 py-2 my-3">
                          <div className="flex-1 h-px bg-linear-to-r from-transparent via-border to-transparent" />
                          <div className="bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full border border-border/50 shadow-sm">
                            <span className="text-xs font-medium text-muted-foreground">
                              {currentDate}
                            </span>
                          </div>
                          <div className="flex-1 h-px bg-linear-to-r from-border via-transparent to-transparent" />
                        </div>
                      )}
                      <div
                        className={`flex flex-col ${isLocal ? 'items-end' : 'items-start'} mb-0.5`}
                      >
                        <div
                          className={`
                          max-w-[70%] min-w-0 group relative break-words
                          ${isFirstInGroup ? (isLocal ? 'mb-0.5' : 'mb-0.5') : ''}
                          ${isLastInGroup ? 'mb-2' : 'mb-0.5'}
                        `}
                          style={{
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word'
                          }}
                        >
                          <ChatMessage
                            message={msg}
                            isLocal={isLocal}
                            device={device}
                            localDeviceId={localDevice?.deviceId}
                            messages={messages}
                            onReply={handleReply}
                            onForward={handleForwardClick}
                            onCopy={handleCopy}
                            onDelete={handleDelete}
                          />
                        </div>
                      </div>
                    </React.Fragment>
                  )
                })
            )}
          </div>
          {/* Compact scroll to bottom button */}
          {!isScrolledToBottom && (
            <div className="absolute bottom-20 right-3 z-20">
              <button
                onClick={() => scrollToBottom(true)}
                className="
                  bg-background/95 backdrop-blur-md border border-border/50
                  text-foreground rounded-full p-3 shadow-lg hover:shadow-xl
                  transition-all duration-200 hover:scale-110 active:scale-95
                  focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                  group relative overflow-hidden
                "
                aria-label="Scroll to bottom"
                type="button"
              >
                <div className="absolute inset-0 bg-primary/5 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />
                <svg
                  className="w-5 h-5 transition-transform group-hover:translate-y-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </button>
            </div>
          )}
          {/* Modern input area */}
          <div className="relative border-t border-border/50 bg-background/80 backdrop-blur-md">
            <div className="p-3 space-y-2">
              {replyingTo && (
                <div className="animate-in slide-in-from-bottom-2 duration-200">
                  <ReplyPreview
                    replyingTo={replyingTo}
                    device={device}
                    localDeviceId={localDevice?.deviceId}
                    onCancel={handleCancelReply}
                  />
                </div>
              )}
              <div className="relative">
                <ChatInput
                  value={input}
                  theme={theme}
                  onChange={setInput}
                  onSend={handleSend}
                  onFileSelect={handleFileSelect}
                />
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent
          value="files"
          className="mt-0 flex-1 flex flex-col min-h-0 focus-visible:outline-none bg-linear-to-b from-background to-background/95"
          role="tabpanel"
          aria-label="File transfers"
        >
          <TransferView device={device} />
        </TabsContent>
      </Tabs>
      <ForwardDialog
        isOpen={!!forwardingMessage}
        onOpenChange={(open) => !open && setForwardingMessage(null)}
        onForward={handleForward}
      />
    </main>
  )
}
