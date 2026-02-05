import { memo } from 'react'
import X from 'lucide-react/dist/esm/icons/x'
import { Button } from '../ui/button'
import type { NetworkMessage, Device, FileMetadata } from '@/shared/messageTypes'

export interface ReplyPreviewProps {
  replyingTo: NetworkMessage
  device: Device
  localDeviceId?: string
  onCancel: () => void
}

/**
 * ReplyPreview - Shows preview of message being replied to
 * Displayed above the chat input when replying
 */
export const ReplyPreview = memo(
  ({ replyingTo, device, localDeviceId, onCancel }: ReplyPreviewProps) => {
    return (
      <div className="max-w-4xl mx-auto mb-2 flex items-center gap-3 bg-secondary/50 p-2.5 rounded-xl border border-border/50 animate-in slide-in-from-bottom-2 duration-200">
        <div className="w-1 bg-primary self-stretch rounded-full opacity-50" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-primary uppercase tracking-wide mb-0.5 leading-none">
            Replying to {replyingTo.deviceId === localDeviceId ? 'you' : device.displayName}
          </p>
          <p className="text-sm text-muted-foreground truncate leading-snug">
            {replyingTo.type === 'FILE_META'
              ? `📎 ${(replyingTo.payload as FileMetadata).name}`
              : (replyingTo.payload as string)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full hover:bg-secondary"
          onClick={onCancel}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    )
  }
)

ReplyPreview.displayName = 'ReplyPreview'
