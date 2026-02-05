import { memo, useCallback, useMemo } from 'react'
import RotateCw from 'lucide-react/dist/esm/icons/rotate-cw'
import { cn } from '@/renderer/lib/utils'
import type { Device } from '@/shared/messageTypes'
import { DeviceListItem } from './DeviceListItem'

export interface DeviceListProps {
  devices: Device[]
  activeDeviceId: string | null
  unreadCounts: Record<string, number>
  isRefreshing: boolean
  onRescan: () => void
  onClearUnread: (deviceId: string) => void
}

/**
 * DeviceList - Displays the list of discovered devices
 * Includes search functionality and refresh capability
 * Memoized to prevent re-renders when unrelated state changes
 */
export const DeviceList = memo(
  ({
    devices,
    activeDeviceId,
    unreadCounts,
    isRefreshing,
    onRescan,
    onClearUnread
  }: DeviceListProps) => {
    // Calculate derived state during rendering
    const onlineCount = useMemo(() => devices.filter((d) => d.isOnline).length, [devices])

    const handleNavigate = useCallback(
      (deviceId: string) => {
        onClearUnread(deviceId)
      },
      [onClearUnread]
    )

    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <div className="flex items-center justify-between px-2 pb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-none">
            Nearby Devices ({onlineCount})
          </p>
          <button
            onClick={onRescan}
            disabled={isRefreshing}
            className="p-1 hover:bg-secondary rounded-md text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
            title="Rescan Devices"
            aria-label="Rescan for devices"
          >
            <RotateCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
          </button>
        </div>

        {devices.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <div className="inline-block p-3 bg-secondary rounded-full">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">Searching for peers...</p>
          </div>
        ) : (
          devices.map((device) => (
            <DeviceListItem
              key={device.deviceId}
              device={device}
              isActive={activeDeviceId === device.deviceId}
              unreadCount={unreadCounts[device.deviceId] || 0}
              onNavigate={handleNavigate}
            />
          ))
        )}
      </div>
    )
  }
)

DeviceList.displayName = 'DeviceList'
