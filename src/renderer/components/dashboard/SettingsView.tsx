import { memo } from 'react'
import Laptop from 'lucide-react/dist/esm/icons/laptop'

// Hoist static JSX
const LaptopIcon = <Laptop className="w-4 h-4" />

export interface SettingsViewProps {
  onNavigateHome: () => void
}

/**
 * SettingsView - Sidebar content when in settings mode
 * Provides navigation back to the device list
 * Memoized to prevent re-renders
 */
export const SettingsView = memo(({ onNavigateHome }: SettingsViewProps) => {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
      <p className="text-xs font-semibold text-muted-foreground px-2 uppercase tracking-wider leading-none">
        Settings
      </p>
      <button
        onClick={onNavigateHome}
        className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary text-secondary-foreground shadow-sm active:scale-[0.98] transition-transform"
      >
        <div className="p-2 bg-primary/10 rounded-md text-primary">{LaptopIcon}</div>
        <span className="text-sm font-semibold leading-tight">Back to Devices</span>
      </button>
    </div>
  )
})

SettingsView.displayName = 'SettingsView'
