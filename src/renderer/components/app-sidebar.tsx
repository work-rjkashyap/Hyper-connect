import * as React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Settings2 } from 'lucide-react'
import { useStore } from '@/renderer/store/useStore'
import { NavUser } from '@/renderer/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/renderer/components/ui/sidebar'
import { Badge } from '@/renderer/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/renderer/components/ui/avatar'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>): React.ReactElement {
  const navigate = useNavigate()
  const location = useLocation()
  const { discoveredDevices, localDevice, unreadCounts } = useStore()
  const getDeviceInitials = (name: string): string => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              onClick={() => navigate('/')}
              isActive={location.pathname === '/'}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Home className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Hyper Connect</span>
                <span className="truncate text-xs">Local Network</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Discovered Devices</SidebarGroupLabel>
          <SidebarMenu>
            {discoveredDevices.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No devices found
              </div>
            ) : (
              discoveredDevices.map((device) => {
                const unreadCount = unreadCounts[device.deviceId] || 0
                return (
                  <SidebarMenuItem key={device.deviceId}>
                    <SidebarMenuButton
                      onClick={() => navigate(`/device/${device.deviceId}`)}
                      isActive={location.pathname === `/device/${device.deviceId}`}
                      tooltip={device.displayName}
                    >
                      <Avatar className="h-6 w-6 rounded-md">
                        <AvatarImage src={device.profileImage} />
                        <AvatarFallback className="rounded-md text-xs">
                          {getDeviceInitials(device.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">{device.displayName}</span>
                      {unreadCount > 0 && (
                        <Badge variant="default" className="ml-auto h-5 px-1.5 text-xs">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })
            )}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => navigate('/settings')}
                isActive={location.pathname === '/settings'}
              >
                <Settings2 className="size-4" />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: localDevice?.displayName || 'Unknown Device',
            email: localDevice?.platform || 'Unknown Platform',
            avatar: localDevice?.profileImage || ''
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
