import { memo, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Laptop from 'lucide-react/dist/esm/icons/laptop'
import Monitor from 'lucide-react/dist/esm/icons/monitor'
import { cn } from '@/renderer/lib/utils'
import type { Device } from '@/shared/messageTypes'

// Hoist static JSX
const LaptopIcon = <Laptop className="w-5 h-5" />
const MonitorIcon = <Monitor className="w-5 h-5" />
const OnlineIndicator = <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
const OfflineIndicator = <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />

export interface DeviceListItemProps {
  device: Device
  isActive: boolean
  unreadCount: number
  onNavigate: (deviceId: string) => void
}

/**
 * DeviceListItem - Renders a single device in the sidebar list
 * Displays device info, online status, and unread message count
 * Memoized to only re-render when device props change
 */
export const DeviceListItem = memo(
  ({ device, isActive, unreadCount, onNavigate }: DeviceListItemProps) => {
    const handleClick = useCallback(() => {
      onNavigate(device.deviceId)
    }, [device.deviceId, onNavigate])

    // Calculate derived state during rendering
    const deviceIcon = useMemo(() => {
      if (device.profileImage) {
        return (
          <img
            src={device.profileImage}
            alt={device.displayName}
            className="w-full h-full object-cover"
          />
        )
      }
      return device.platform === 'darwin' ? LaptopIcon : MonitorIcon
    }, [device.profileImage, device.displayName, device.platform])

    return (
      <Link
        to={`/device/${device.deviceId}`}
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-3 p-2.5 rounded-lg transition-all border border-transparent',
          isActive
            ? 'bg-primary text-primary-foreground shadow-md'
            : 'hover:bg-secondary border-border/50',
          !device.isOnline && 'opacity-50 grayscale'
        )}
      >
        <div
          className={cn(
            'p-0 rounded-full overflow-hidden w-9 h-9 flex items-center justify-center border border-border/10',
            isActive ? 'bg-white/20' : 'bg-primary/5'
          )}
        >
          {deviceIcon}
        </div>
        <div className="text-left flex-1 min-w-0">
          <p className="text-sm font-semibold truncate leading-tight">{device.displayName}</p>
          <p
            className={cn(
              'text-xs truncate',
              isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
            )}
          >
            {device.address}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {unreadCount > 0 ? (
            <div className="min-w-4.5 h-4.5 rounded-full bg-destructive text-xs font-bold text-destructive-foreground flex items-center justify-center px-1 animate-in zoom-in duration-300 leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          ) : null}
          {device.isOnline ? OnlineIndicator : OfflineIndicator}
        </div>
      </Link>
    )
  }
)

DeviceListItem.displayName = 'DeviceListItem'
