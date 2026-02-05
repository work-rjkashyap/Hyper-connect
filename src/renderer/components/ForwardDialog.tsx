import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { useStore } from '../store/useStore'
import User from 'lucide-react/dist/esm/icons/user'
import Send from 'lucide-react/dist/esm/icons/send'
import { Button } from './ui/button'

interface ForwardDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onForward: (deviceId: string) => void
}

export const ForwardDialog: React.FC<ForwardDialogProps> = ({
  isOpen,
  onOpenChange,
  onForward
}) => {
  const discoveredDevices = useStore((state) => state.discoveredDevices)
  const onlineDevices = discoveredDevices.filter((d) => d.isOnline)

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Forward Message</DialogTitle>
          <DialogDescription className="prose prose-sm dark:prose-invert">
            Select a device to forward this message to.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
          {onlineDevices.length === 0 ? (
            <div className="text-center py-8 prose prose-sm dark:prose-invert text-muted-foreground">
              No online devices found
            </div>
          ) : (
            onlineDevices.map((device) => (
              <div
                key={device.deviceId}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-secondary transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={device.profileImage}
                      alt={device.displayName}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-primary/10">
                      <User className="w-5 h-5 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm leading-tight">{device.displayName}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{device.platform}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onForward(device.deviceId)}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
