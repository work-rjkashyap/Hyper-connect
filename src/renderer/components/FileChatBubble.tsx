import React from 'react'
import { CheckCircle2, FileText } from 'lucide-react'
import { FileMetadata, NetworkMessage } from '../../shared/messageTypes'
import { useStore } from '../store/useStore'
import { cn, formatFileSize, getFileType } from '../lib/utils'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogTrigger } from './ui/dialog'

const isImage = (name: string): boolean => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)
const isVideo = (name: string): boolean => /\.(mp4|webm|mov|ogg)$/i.test(name)

const AcceptRejectButtons: React.FC<{ fileId: string }> = ({ fileId }) => {
  const { updateTransfer } = useStore()
  const transfer = useStore((state) => state.transfers[fileId])
  const status = transfer?.status || 'pending'

  if (status !== 'pending') return null

  const handleAccept = async (): Promise<void> => {
    await window.api.acceptFile(fileId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateTransfer({ fileId, status: 'active' } as any)
  }

  const handleReject = async (): Promise<void> => {
    await window.api.rejectFile(fileId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export const FileChatBubble: React.FC<{ msg: NetworkMessage; isLocal: boolean }> = ({
  msg,
  isLocal
}) => {
  const metadata: FileMetadata = msg.payload as FileMetadata
  const transfers = useStore((state) => state.transfers)
  const transfer = transfers[metadata.fileId]
  const status = transfer?.status || (isLocal ? 'active' : 'pending')
  const isCompleted = status === 'completed'
  const isActive = status === 'active'

  const filePath = transfer?.path || (isLocal ? metadata.path : undefined)
  const canPreview = filePath && (isImage(metadata.name) || isVideo(metadata.name))
  const isReady = isLocal || isCompleted

  if (canPreview && isReady) {
    const fileUrl = `file://${filePath}`

    if (isImage(metadata.name)) {
      return (
        <Dialog>
          <DialogTrigger asChild>
            <div
              className={cn(
                'rounded-xl overflow-hidden cursor-pointer border transition-all hover:opacity-90',
                isLocal ? 'border-primary-foreground/20' : 'border-border'
              )}
            >
              <img
                src={fileUrl}
                alt={metadata.name}
                className="rounded w-auto max-h-75 object-contain"
                loading="lazy"
              />
            </div>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-transparent border-none shadow-none">
            <img src={fileUrl} alt={metadata.name} className="w-full h-full object-contain" />
          </DialogContent>
        </Dialog>
      )
    }

    if (isVideo(metadata.name)) {
      return (
        <div
          className={cn(
            'rounded-xl overflow-hidden border',
            isLocal ? 'border-primary-foreground/20' : 'border-border'
          )}
        >
          <video src={fileUrl} controls className="max-w-full max-h-[300px]" />
        </div>
      )
    }
  }

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
          className={cn('p-2 rounded-lg', isLocal ? 'bg-primary-foreground/20' : 'bg-primary/10')}
        >
          {isCompleted ? (
            <CheckCircle2
              className={cn('w-5 h-5', isLocal ? 'text-primary-foreground' : 'text-green-500')}
            />
          ) : (
            <FileText
              className={cn('w-5 h-5', isLocal ? 'text-primary-foreground' : 'text-primary')}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-sm font-medium break-words',
              isLocal ? 'text-primary-foreground' : 'text-foreground'
            )}
          >
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
            <p
              className={cn(
                'text-[9px] font-black uppercase tracking-tighter',
                isLocal ? 'text-primary-foreground' : 'text-primary'
              )}
            >
              {isLocal ? 'Sent' : 'Received'}
            </p>
            {isCompleted && (
              <>
                <span className="w-1 h-1 rounded-full bg-current opacity-30" />
                <p
                  className={cn(
                    'text-[9px] font-black uppercase tracking-tighter',
                    isLocal ? 'text-primary-foreground' : 'text-primary'
                  )}
                >
                  Done
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {isActive && transfer && (
        <div className="px-1 space-y-1.5 animate-in fade-in duration-300">
          <div
            className={cn(
              'flex justify-between text-[9px] font-bold uppercase tracking-tighter',
              isLocal ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}
          >
            <span>{(transfer.progress * 100).toFixed(0)}%</span>
            <span>{formatFileSize(transfer.speed)}/s</span>
          </div>
          <div
            className={cn(
              'h-1 w-full rounded-full overflow-hidden',
              isLocal ? 'bg-primary-foreground/20' : 'bg-primary/10'
            )}
          >
            <div
              className={cn(
                'h-full transition-all duration-300',
                isLocal ? 'bg-primary-foreground' : 'bg-primary'
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
