'use client'

import { cn } from '@/lib/cn'

export function BackgroundBeams({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="beam-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(147, 51, 234)" stopOpacity="0" />
            <stop offset="50%" stopColor="rgb(147, 51, 234)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(147, 51, 234)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="animate-beam">
          <rect
            width="2"
            height="100%"
            x="10%"
            fill="url(#beam-gradient)"
            className="animate-beam-1"
          />
          <rect
            width="2"
            height="100%"
            x="30%"
            fill="url(#beam-gradient)"
            className="animate-beam-2"
          />
          <rect
            width="2"
            height="100%"
            x="50%"
            fill="url(#beam-gradient)"
            className="animate-beam-3"
          />
          <rect
            width="2"
            height="100%"
            x="70%"
            fill="url(#beam-gradient)"
            className="animate-beam-4"
          />
          <rect
            width="2"
            height="100%"
            x="90%"
            fill="url(#beam-gradient)"
            className="animate-beam-5"
          />
        </g>
      </svg>
    </div>
  )
}
