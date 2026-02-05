import React, { memo, useCallback } from 'react'
import Paperclip from 'lucide-react/dist/esm/icons/paperclip'
import Send from 'lucide-react/dist/esm/icons/send'
import Smile from 'lucide-react/dist/esm/icons/smile'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Textarea } from '../ui/textarea'

const EmojiPicker = React.lazy(() => import('emoji-picker-react'))

export interface ChatInputProps {
  value: string
  theme: string
  onChange: (value: string) => void
  onSend: () => void
  onFileSelect: () => void
}

/**
 * ChatInput - Modern message input area with file attachment and emoji picker
 * Features contemporary design with enhanced interactions and accessibility
 */
export const ChatInput = memo(
  ({ value, theme, onChange, onSend, onFileSelect }: ChatInputProps) => {
    const handleEmojiClick = useCallback(
      (emojiData: { emoji: string }) => {
        onChange(value + emojiData.emoji)
      },
      [value, onChange]
    )

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          onSend()
        }
      },
      [onSend]
    )

    const isDisabled = !value.trim()

    return (
      <div className="relative">
        {/* Modern container with gradient background */}
        <div className="relative bg-linear-to-r from-background/95 to-background/90 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl shadow-black/5 overflow-hidden">
          {/* Inner glow effect */}
          <div className="absolute inset-0 bg-linear-to-r from-primary/5 via-transparent to-accent/5 pointer-events-none" />

          {/* Content area */}
          <div className="relative flex gap-3 p-4 items-end max-w-4xl mx-auto">
            {/* File attachment button */}
            <button
              type="button"
              onClick={onFileSelect}
              className="
                                group relative p-3 rounded-xl text-muted-foreground
                                hover:text-primary transition-all duration-200
                                hover:bg-secondary/80 active:scale-95
                                focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                                focus-visible:outline-none
                            "
              aria-label="Attach file"
            >
              <div className="absolute inset-0 rounded-xl bg-primary/5 scale-0 group-hover:scale-100 transition-transform duration-300" />
              <Paperclip className="relative w-5 h-5 transition-transform group-hover:rotate-12" />
            </button>

            {/* Emoji picker */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="
                                        group relative p-3 rounded-xl text-muted-foreground
                                        hover:text-primary transition-all duration-200
                                        hover:bg-secondary/80 active:scale-95
                                        focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                                        focus-visible:outline-none
                                    "
                  aria-label="Open emoji picker"
                >
                  <div className="absolute inset-0 rounded-xl bg-primary/5 scale-0 group-hover:scale-100 transition-transform duration-300" />
                  <Smile className="relative w-5 h-5 transition-transform group-hover:scale-110" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 border-0 shadow-2xl shadow-black/20 overflow-hidden rounded-2xl"
                side="top"
                align="start"
                sideOffset={8}
              >
                <React.Suspense
                  fallback={
                    <div className="w-80 h-96 flex flex-col items-center justify-center p-8 text-muted-foreground bg-linear-to-br from-background to-muted/20 rounded-2xl border border-border/30">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
                        <Smile className="w-6 h-6 text-primary" />
                      </div>
                      <div className="text-sm font-medium">Loading emojis...</div>
                      <div className="text-xs opacity-60 mt-1">Please wait</div>
                    </div>
                  }
                >
                  <div className="bg-background/95 backdrop-blur-xl border border-border/20 rounded-2xl overflow-hidden">
                    <EmojiPicker
                      width={340}
                      height={400}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      theme={theme as any}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      emojiStyle={'native' as any}
                      searchDisabled={false}
                      skinTonesDisabled
                      previewConfig={{
                        showPreview: true
                      }}
                      onEmojiClick={handleEmojiClick}
                    />
                  </div>
                </React.Suspense>
              </PopoverContent>
            </Popover>

            {/* Modern textarea container */}
            <div className="flex-1 relative group">
              <div className="absolute inset-0 rounded-xl bg-linear-to-r from-primary/5 to-accent/5 scale-0 group-focus-within:scale-100 transition-transform duration-300 pointer-events-none" />
              <Textarea
                autoFocus
                placeholder="Type a message..."
                className="
                                    relative py-3 px-4 min-h-12 max-h-32 rounded-xl text-base
                                    border border-border/30 bg-background/60 backdrop-blur-sm
                                    placeholder:text-muted-foreground/60
                                    focus:border-primary/50 focus:bg-background/80
                                    focus-visible:ring-0 focus-visible:ring-offset-0
                                    resize-none overflow-y-auto transition-all duration-200
                                    hover:border-border/50 hover:bg-background/70
                                "
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'hsl(var(--muted)) transparent'
                }}
                aria-label="Message input"
              />
            </div>

            {/* Modern send button */}
            <button
              type="button"
              onClick={onSend}
              disabled={isDisabled}
              className="
                                relative group h-12 w-12 rounded-xl overflow-hidden
                                disabled:opacity-50 disabled:cursor-not-allowed
                                focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                                focus-visible:outline-none transition-all duration-200
                                hover:scale-105 active:scale-95 disabled:hover:scale-100
                            "
              aria-label={isDisabled ? 'Enter a message to send' : 'Send message'}
            >
              {/* Gradient background */}
              <div className="absolute inset-0 bg-linear-to-r from-primary to-primary/90 transition-all duration-200 group-hover:from-primary/90 group-hover:to-primary group-disabled:from-muted group-disabled:to-muted" />

              {/* Shine effect */}
              <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full group-disabled:-translate-x-full transition-transform duration-500" />

              {/* Icon */}
              <div className="relative flex items-center justify-center h-full w-full text-primary-foreground group-disabled:text-muted-foreground">
                <Send className="w-5 h-5 transition-transform group-hover:translate-x-0.5 group-active:scale-90" />
              </div>
            </button>
          </div>
        </div>

        {/* Subtle bottom border for depth */}
        <div className="absolute -bottom-px left-4 right-4 h-px bg-linear-to-r from-transparent via-border/30 to-transparent" />
      </div>
    )
  }
)

ChatInput.displayName = 'ChatInput'
