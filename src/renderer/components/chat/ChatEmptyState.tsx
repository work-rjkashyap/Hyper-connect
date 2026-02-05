import { memo } from 'react'
import Send from 'lucide-react/dist/esm/icons/send'

/**
 * ChatEmptyState - Empty state shown when no messages exist
 * Encourages user to start conversation
 */
export const ChatEmptyState = memo(() => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center opacity-40 space-y-3 h-full">
      <div className="p-4 bg-muted rounded-full">
        <Send className="w-8 h-8 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium leading-relaxed">No messages yet. Say hello!</p>
    </div>
  )
})

ChatEmptyState.displayName = 'ChatEmptyState'
