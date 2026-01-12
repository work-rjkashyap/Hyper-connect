import React from 'react'
import { Wifi, WifiOff, Smartphone, Monitor, Globe } from 'lucide-react'
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

    // eslint-disable-next-line react/no-unstable-nested-components
    const DeviceIcon = getDeviceIcon(device.platform)
    const StatusIcon = isConnected ? Wifi : WifiOff

    return (
        <div
            className={cn(
                'flex items-center gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-300 min-w-75',
                isConnected
                    ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
                'hover:scale-[1.02] active:scale-[0.98] cursor-default'
            )}
        >
            <div
                className={cn(
                    'p-2 rounded-full ring-1 shadow-sm flex items-center justify-center',
                    isConnected ? 'bg-green-500/20 ring-green-500/30' : 'bg-red-500/20 ring-red-500/30'
                )}
            >
                <StatusIcon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm truncate flex items-center gap-1.5 text-foreground">
                    {device.displayName}
                    <DeviceIcon className="w-3 h-3 opacity-50" />
                </h4>
                <p className="text-xs text-muted-foreground truncate">
                    {isConnected ? 'Device connected' : 'Device disconnected'}
                    {device.address && <span className="opacity-50 mx-1">•</span>}
                    {device.address && (
                        <span className="opacity-70 font-mono text-[10px]">{device.address}</span>
                    )}
                </p>
            </div>
        </div>
    )
}
