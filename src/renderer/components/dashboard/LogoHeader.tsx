import React, { memo } from 'react'
import { ThemeToggle } from '../ui/theme-toggle'
import logoLight from '@/renderer/assets/logo_light.png'
import logoDark from '@/renderer/assets/logo_dark.png'

// Hoist static JSX
const OnlineIndicator = <div className="w-2 h-2 rounded-full bg-success animate-pulse" />

/**
 * LogoHeader - Displays the app logo, title, and controls
 * Memoized to prevent unnecessary re-renders
 */
export const LogoHeader = memo(() => {
  return (
    <div
      className="p-6 mt-2 flex items-center justify-between"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full overflow-hidden border border-border/50 flex items-center justify-center">
          <img src={logoLight} alt="Logo" className="w-full h-full object-contain dark:hidden" />
          <img
            src={logoDark}
            alt="Logo"
            className="w-full h-full object-contain hidden dark:block"
          />
        </div>
        <h1 className="text-lg font-bold tracking-tight bg-linear-to-br from-primary to-primary/60 bg-clip-text text-transparent">
          Hyper Connect
        </h1>
      </div>
      <div
        className="flex items-center gap-3"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <ThemeToggle />
        {OnlineIndicator}
      </div>
    </div>
  )
})

LogoHeader.displayName = 'LogoHeader'
