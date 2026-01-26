'use client'

import { cn } from '@/lib/cn'

export function DotPattern({
  className,
  dotSize = 1,
  dotColor = 'rgba(100, 100, 100, 0.3)',
  backgroundColor = 'transparent'
}: {
  className?: string
  dotSize?: number
  dotColor?: string
  backgroundColor?: string
}): React.ReactElement {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage: `radial-gradient(circle, ${dotColor} ${dotSize}px, ${backgroundColor} ${dotSize}px)`,
        backgroundSize: '24px 24px'
      }}
    />
  )
}
