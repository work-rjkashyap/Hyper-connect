'use client'

import { cn } from '@/lib/cn'

interface ShimmerButtonProps {
  children: React.ReactNode
  className?: string
  shimmerColor?: string
  shimmerSize?: string
  borderRadius?: string
  shimmerDuration?: string
  background?: string
  onClick?: () => void
  href?: string
}

export function ShimmerButton({
  children,
  className,
  shimmerColor = '#ffffff',
  shimmerSize = '0.05em',
  borderRadius = '0.5rem',
  shimmerDuration = '3s',
  background = 'rgba(0, 0, 0, 1)',
  onClick,
  href
}: ShimmerButtonProps): React.ReactElement {
  const Component = href ? 'a' : 'button'

  return (
    <Component
      style={
        {
          '--shimmer-color': shimmerColor,
          '--shimmer-size': shimmerSize,
          '--border-radius': borderRadius,
          '--shimmer-duration': shimmerDuration,
          '--background': background
        } as React.CSSProperties
      }
      className={cn(
        'group relative inline-flex items-center justify-center overflow-hidden rounded-lg px-6 py-3 font-medium transition-all',
        'bg-(--background) text-white',
        'before:absolute before:inset-0 before:bg-linear-to-r before:from-transparent before:via-white/20 before:to-transparent',
        'before:translate-x-[-200%] before:animate-shimmer',
        'hover:scale-105 active:scale-95',
        className
      )}
      onClick={onClick}
      {...(href ? { href } : {})}
    >
      {children}
    </Component>
  )
}
