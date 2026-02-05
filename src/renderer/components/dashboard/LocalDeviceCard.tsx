import { memo } from 'react'
import User from 'lucide-react/dist/esm/icons/user'

// Hoist static JSX
const UserIcon = <User className="w-5 h-5 text-muted-foreground" />

export interface LocalDeviceCardProps {
  displayName?: string
  profileImage?: string | null
}

/**
 * LocalDeviceCard - Displays current device information
 * Shows the user's profile image and device name
 * Memoized to prevent re-renders when other parts of the dashboard update
 */
export const LocalDeviceCard = memo(({ displayName, profileImage }: LocalDeviceCardProps) => {
  return (
    <div className="px-4 pb-4">
      <div className="p-3 bg-secondary/50 rounded-lg border border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-0.5 rounded-full shadow-sm w-9 h-9 overflow-hidden flex items-center justify-center bg-secondary border border-border/10">
            {profileImage ? (
              <img src={profileImage} alt="My Profile" className="w-full h-full object-cover" />
            ) : (
              UserIcon
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider leading-none">
              My Device
            </p>
            <p className="text-sm font-semibold truncate leading-tight">{displayName}</p>
          </div>
        </div>
      </div>
    </div>
  )
})

LocalDeviceCard.displayName = 'LocalDeviceCard'
