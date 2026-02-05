import { memo, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Check from 'lucide-react/dist/esm/icons/check'
import CheckCheck from 'lucide-react/dist/esm/icons/check-check'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Reply from 'lucide-react/dist/esm/icons/reply'
import Forward from 'lucide-react/dist/esm/icons/forward'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator
} from '../ui/context-menu'
import { FileChatBubble } from '../FileChatBubble'
import { cn } from '@/renderer/lib/utils'
import type { NetworkMessage, Device, FileMetadata } from '@/shared/messageTypes'

export interface ChatMessageProps {
  message: NetworkMessage
  isLocal: boolean
  device: Device
  localDeviceId?: string
  messages: NetworkMessage[]
  onReply: (msg: NetworkMessage) => void
  onForward: (msg: NetworkMessage) => void
  onCopy: (text: string) => void
  onDelete: (msg: NetworkMessage) => void
}

/**
 * ChatMessage - Modern individual message bubble with enhanced context menu
 * Features contemporary design with enhanced interactions and accessibility
 */
export const ChatMessage = memo(
  ({
    message,
    isLocal,
    device,
    localDeviceId,
    messages,
    onReply,
    onForward,
    onCopy,
    onDelete
  }: ChatMessageProps) => {
    const isFile = message.type === 'FILE_META'

    const handleScrollToReply = useCallback((replyId: string) => {
      const el = document.getElementById(`msg-${replyId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Add a subtle highlight effect
        el.style.transform = 'scale(1.02)'
        setTimeout(() => {
          el.style.transform = ''
        }, 300)
      }
    }, [])

    return (
      <div className={cn('flex flex-col group', isLocal ? 'items-end' : 'items-start')}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              id={message.id ? `msg-${message.id}` : undefined}
              className={cn(
                'relative max-w-[85%] rounded-2xl overflow-hidden cursor-default transition-all duration-200',
                'hover:scale-[1.02] active:scale-[0.98] group-hover:shadow-lg break-words',
                isLocal
                  ? 'bg-linear-to-br from-primary to-primary/95 text-primary-foreground rounded-tr-lg shadow-lg shadow-primary/20'
                  : 'bg-linear-to-br from-card to-card/95 border border-border/30 rounded-tl-lg shadow-lg backdrop-blur-sm'
              )}
              style={{
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                hyphens: 'auto'
              }}
            >
              {/* Modern inner glow effect */}
              <div
                className={cn(
                  'absolute inset-0 opacity-50 pointer-events-none',
                  isLocal
                    ? 'bg-linear-to-t from-white/10 to-transparent'
                    : 'bg-linear-to-t from-primary/5 to-transparent'
                )}
              />

              {/* Content container with compact padding */}
              <div className="relative px-3 py-2">
                {message.replyTo && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      handleScrollToReply(message.replyTo!)
                    }}
                    className={cn(
                      'mb-2 p-2 rounded-lg text-xs border-l-3 overflow-hidden cursor-pointer',
                      'hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 leading-snug',
                      'backdrop-blur-sm shadow-sm',
                      isLocal
                        ? 'bg-black/30 border-primary-foreground/60 text-primary-foreground/90 hover:bg-black/40'
                        : 'bg-muted/80 border-primary/60 text-muted-foreground hover:bg-muted'
                    )}
                    role="button"
                    aria-label="Jump to replied message"
                  >
                    {(() => {
                      const repliedMsg = messages.find((m) => m.id === message.replyTo)
                      if (!repliedMsg) {
                        return (
                          <div className="flex items-center gap-2 opacity-60">
                            <div className="w-2 h-2 rounded-full bg-current opacity-50" />
                            <p className="italic text-xs">Original message not found</p>
                          </div>
                        )
                      }
                      return (
                        <>
                          <p className="font-semibold opacity-80 text-xs mb-0.5">
                            {repliedMsg.deviceId === localDeviceId ? 'You' : device.displayName}
                          </p>
                          <p className="line-clamp-2 text-xs leading-snug">
                            {repliedMsg.type === 'FILE_META' ? (
                              <span className="flex items-center gap-1">
                                <span className="text-sm">📎</span>
                                <span>{(repliedMsg.payload as FileMetadata).name}</span>
                              </span>
                            ) : (
                              (repliedMsg.payload as string)
                            )}
                          </p>
                        </>
                      )
                    })()}
                  </div>
                )}

                {!isFile ? (
                  <div
                    className={cn(
                      'prose prose-sm max-w-none select-text break-words',
                      'prose-p:my-1 prose-p:leading-normal prose-p:break-words',
                      'prose-a:no-underline prose-a:font-medium prose-a:transition-colors prose-a:break-words',
                      'prose-strong:font-semibold prose-em:italic',
                      'prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:break-words',
                      isLocal
                        ? 'prose-invert prose-a:text-primary-foreground/90 hover:prose-a:text-primary-foreground prose-code:bg-black/30'
                        : 'prose-a:text-primary hover:prose-a:text-primary/80 prose-code:bg-muted/50'
                    )}
                    style={{
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word'
                    }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        a: ({ node: _node, children, ...props }) => (
                          <a
                            {...props}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-baseline gap-1 hover:scale-105 transition-all duration-200"
                          >
                            {children}
                            <ExternalLink className="w-3 h-3 self-center opacity-70" />
                          </a>
                        )
                      }}
                    >
                      {typeof message.payload === 'string'
                        ? message.payload
                        : JSON.stringify(message.payload)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <FileChatBubble msg={message} isLocal={isLocal} />
                )}
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-52 bg-background/95 backdrop-blur-xl border border-border/50 shadow-2xl">
            <ContextMenuItem
              onClick={() => onReply(message)}
              className="flex items-center gap-2.5 py-2 hover:bg-primary/10 focus:bg-primary/10 transition-colors group"
            >
              <Reply className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
              <span className="font-medium">Reply</span>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => onForward(message)}
              className="flex items-center gap-2.5 py-2 hover:bg-accent/10 focus:bg-accent/10 transition-colors group"
            >
              <Forward className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
              <span className="font-medium">Forward</span>
            </ContextMenuItem>
            {!isFile && (
              <ContextMenuItem
                onClick={() => onCopy(message.payload as string)}
                className="flex items-center gap-2.5 py-2 hover:bg-info/10 focus:bg-info/10 transition-colors group"
              >
                <Copy className="w-4 h-4 text-info group-hover:scale-110 transition-transform" />
                <span className="font-medium">Copy Text</span>
              </ContextMenuItem>
            )}
            <ContextMenuSeparator className="bg-border/30" />
            <ContextMenuItem
              onClick={() => onDelete(message)}
              className="text-destructive focus:text-destructive hover:bg-destructive/10 focus:bg-destructive/10 flex items-center gap-2.5 py-2 transition-colors group"
            >
              <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Delete Message</span>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {/* Compact message metadata */}
        <div
          className={cn(
            'flex items-center gap-1.5 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-all duration-200',
            isLocal ? 'justify-end' : 'justify-start'
          )}
        >
          <span className="text-xs text-muted-foreground/80 font-medium bg-background/60 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
            {new Date(message.timestamp || 0).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
          {isLocal && (
            <div className="flex items-center bg-background/60 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
              {message.status === 'sent' && (
                <Check className="w-3 h-3 text-warning transition-all duration-200" />
              )}
              {message.status === 'delivered' && (
                <CheckCheck className="w-3 h-3 text-muted-foreground/70 transition-all duration-200" />
              )}
              {message.status === 'read' && (
                <CheckCheck className="w-3 h-3 text-success transition-all duration-200 scale-110" />
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
)

ChatMessage.displayName = 'ChatMessage'
