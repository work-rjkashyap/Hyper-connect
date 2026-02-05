import { memo, useCallback } from 'react'
import User from 'lucide-react/dist/esm/icons/user'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { TabsList, TabsTrigger } from '../ui/tabs'
import { cn } from '@/renderer/lib/utils'
import type { Device } from '@/shared/messageTypes'

export interface ChatHeaderProps {
  device: Device
  currentTab: 'chat' | 'files'
  onTabChange: (tab: 'chat' | 'files') => void
}

/**
 * ChatHeader - Device chat header with avatar, status, and tabs
 * Displays device information and navigation between chat and files
 * Optimized for performance and accessibility following Vercel guidelines
 */
export const ChatHeader = memo(({ device, currentTab, onTabChange }: ChatHeaderProps) => {
  // Memoize tab change handler to prevent unnecessary re-renders
  const handleTabChange = useCallback(
    (value: string) => {
      onTabChange(value as 'chat' | 'files')
    },
    [onTabChange]
  )

  const statusText = device.isOnline ? 'Online' : 'Offline'
  const avatarFallback = device.displayName?.[0]?.toUpperCase() || '?'

  return (
    <header
      className="h-16 border-b bg-background/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0"
      role="banner"
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <Avatar className="w-10 h-10 border border-border/10 shadow-sm shrink-0">
          <AvatarImage
            src={device.profileImage}
            alt={`${device.displayName} profile picture`}
            className="object-cover"
          />
          <AvatarFallback className="bg-secondary text-secondary-foreground font-medium">
            {device.profileImage ? (
              <User className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            ) : (
              <span aria-hidden="true">{avatarFallback}</span>
            )}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0 flex-1">
          <h1 className="text-xl font-bold truncate leading-tight text-wrap-balance">
            {device.displayName || 'Unknown Device'}
          </h1>
          <div
            className={cn(
              'text-xs flex items-center gap-1.5 font-medium',
              device.isOnline ? 'text-success' : 'text-muted-foreground'
            )}
            role="status"
            aria-label={`Device status: ${statusText}`}
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full shrink-0',
                device.isOnline ? 'bg-success motion-safe:animate-pulse' : 'bg-muted-foreground'
              )}
              aria-hidden="true"
            />
            <span className="truncate">{statusText}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <TabsList
          className="bg-secondary p-1 rounded-xl h-auto"
          role="tablist"
          aria-label="Chat sections"
        >
          <TabsTrigger
            value="chat"
            className={cn(
              'px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg',
              'data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm',
              'hover:bg-background/50 hover:text-foreground',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              'transition-[colors,transform] hover:scale-105 active:scale-95'
            )}
            onClick={() => handleTabChange('chat')}
            aria-selected={currentTab === 'chat'}
            role="tab"
          >
            Messages
          </TabsTrigger>
          <TabsTrigger
            value="files"
            className={cn(
              'px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg',
              'data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm',
              'hover:bg-background/50 hover:text-foreground',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              'transition-[colors,transform] hover:scale-105 active:scale-95'
            )}
            onClick={() => handleTabChange('files')}
            aria-selected={currentTab === 'files'}
            role="tab"
          >
            Files
          </TabsTrigger>
        </TabsList>
      </div>
    </header>
  )
})

ChatHeader.displayName = 'ChatHeader'
