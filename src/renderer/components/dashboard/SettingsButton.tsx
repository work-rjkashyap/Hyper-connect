import { memo } from 'react'
import { Link } from 'react-router-dom'
import Settings from 'lucide-react/dist/esm/icons/settings'
import { cn } from '@/renderer/lib/utils'

export interface SettingsButtonProps {
  isSettings: boolean
}

/**
 * SettingsButton - Toggle button for settings view
 * Appears at the bottom of the sidebar
 * Memoized to prevent re-renders when other state changes
 */
export const SettingsButton = memo(({ isSettings }: SettingsButtonProps) => {
  return (
    <div className="p-4 border-t">
      <Link
        to={isSettings ? '/' : '/settings'}
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-lg transition-all border group',
          isSettings
            ? 'bg-primary text-primary-foreground shadow-lg border-primary'
            : 'bg-card border-border/50 hover:bg-secondary hover:border-border'
        )}
      >
        <div
          className={cn(
            'rounded-lg transition-colors',
            isSettings ? 'bg-primary-foreground/20' : 'bg-secondary group-hover:bg-primary/10'
          )}
        >
          <Settings
            className={cn(
              'w-4 h-4',
              isSettings
                ? 'text-primary-foreground'
                : 'text-muted-foreground group-hover:text-primary'
            )}
          />
        </div>
        <span className="text-sm font-bold uppercase tracking-wider leading-none">
          {isSettings ? 'Close Settings' : 'Settings'}
        </span>
      </Link>
    </div>
  )
})

SettingsButton.displayName = 'SettingsButton'
