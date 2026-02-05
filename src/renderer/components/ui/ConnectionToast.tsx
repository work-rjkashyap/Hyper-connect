import React from 'react'
import Wifi from 'lucide-react/dist/esm/icons/wifi'
import WifiOff from 'lucide-react/dist/esm/icons/wifi-off'
import Smartphone from 'lucide-react/dist/esm/icons/smartphone'
import Monitor from 'lucide-react/dist/esm/icons/monitor'
import Globe from 'lucide-react/dist/esm/icons/globe'
import { cn } from '../../lib/utils'

interface ConnectionToastProps {
  device: {
    displayName: string
    platform?: string
    address?: string
    deviceId: string
  }
  type: 'connected' | 'disconnected'
  onDismiss?: () => void
}
const getDeviceIcon = (platform?: string): React.ElementType => {
  const p = platform?.toLowerCase() || ''
  if (p.includes('ios') || p.includes('android') || p.includes('phone')) return Smartphone
  if (p.includes('mac') || p.includes('win') || p.includes('desktop')) return Monitor
  return Globe
}

export const ConnectionToast: React.FC<ConnectionToastProps> = ({ device, type }) => {
  const isConnected = type === 'connected'
  const StatusIcon = isConnected ? Wifi : WifiOff

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-300 min-w-75',
        isConnected
          ? 'bg-success/10 border-success/20 text-success'
          : 'bg-destructive/10 border-destructive/20 text-destructive',
        'hover:scale-[1.02] active:scale-[0.98] cursor-default'
      )}
    >
      <div
        className={cn(
          'p-2 rounded-full ring-1 shadow-sm flex items-center justify-center',
          isConnected ? 'bg-success/20 ring-success/30' : 'bg-destructive/20 ring-destructive/30'
        )}
      >
        <StatusIcon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm truncate flex items-center gap-1.5 text-foreground leading-tight">
          {device.displayName}
          {React.createElement(getDeviceIcon(device.platform), {
            className: 'w-3 h-3 opacity-50'
          })}
        </h4>
        <p className="text-xs text-muted-foreground truncate leading-snug">
          {isConnected ? 'Device connected' : 'Device disconnected'}
          {device.address && <span className="opacity-50 mx-1">•</span>}
          {device.address && (
            <span className="opacity-70 font-mono text-xs leading-none">{device.address}</span>
          )}
        </p>
      </div>
    </div>
  )
}
