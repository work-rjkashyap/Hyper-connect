import { memo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import FileUp from 'lucide-react/dist/esm/icons/file-up'
import Paperclip from 'lucide-react/dist/esm/icons/paperclip'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import { Card, CardContent } from '../ui/card'
import { cn, formatFileSize } from '@/renderer/lib/utils'
import { useStore } from '@/renderer/store/useStore'
import type { Device } from '@/shared/messageTypes'

export interface TransferViewProps {
  device: Device
}

/**
 * TransferView - File transfer interface and history
 * Shows file upload area and list of past transfers
 */
export const TransferView = memo(({ device }: TransferViewProps) => {
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
        className="relative group border-2 border-dashed border-border/60 rounded-5xl p-16 text-center space-y-6 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer overflow-hidden"
      >
        <div className="relative z-10 space-y-4">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-500">
            <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30">
              <FileUp className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold tracking-tight leading-tight">Send Files</h3>
            <p className="text-sm text-muted-foreground truncate wrap-break-word max-w-60 mx-auto leading-relaxed">
              Drag and drop your files here or{' '}
              <span className="text-primary font-bold">browse</span> to share
            </p>
          </div>
          <Button
            variant="secondary"
            className="mt-2 font-bold uppercase tracking-wider text-xs px-10 h-10 rounded-xl shadow-sm leading-none"
          >
            Browse Files
          </Button>
        </div>
        {/* Decorative corner element */}
        <div className="absolute -top-12 -right-12 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
      </div>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 whitespace-nowrap leading-none">
            Transfer History
          </h3>
          <Separator className="flex-1 opacity-10" />
        </div>
        {transfers.length === 0 ? (
          <div className="text-center py-20 bg-muted/5 rounded-3xl border border-dashed border-border/40">
            <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Paperclip className="w-6 h-6 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground/60 leading-relaxed">
              No recent activity
            </p>
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
                          ? 'bg-success/10 border-success/20 text-success'
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
})

TransferView.displayName = 'TransferView'
