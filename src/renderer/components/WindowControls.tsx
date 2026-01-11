import React from 'react'
import { Minus, Square, X } from 'lucide-react'
import { cn } from '../lib/utils'

export const WindowControls: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn('flex items-center h-8', className)}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <button
        onClick={() => window.api.minimizeWindow()}
        className="h-8 w-12 flex items-center justify-center hover:bg-white/10 transition-colors focus:outline-hidden active:bg-white/20"
        title="Minimize"
      >
        <Minus className="w-4 h-4 opacity-70" />
      </button>
      <button
        onClick={() => window.api.maximizeWindow()}
        className="h-8 w-12 flex items-center justify-center hover:bg-white/10 transition-colors focus:outline-hidden active:bg-white/20"
        title="Maximize"
      >
        <Square className="w-3.5 h-3.5 opacity-70" />
      </button>
      <button
        onClick={() => window.api.closeWindow()}
        className="h-8 w-12 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors focus:outline-hidden active:bg-red-600 group"
        title="Close"
      >
        <X className="w-4 h-4 opacity-70 group-hover:opacity-100" />
      </button>
    </div>
  )
}
