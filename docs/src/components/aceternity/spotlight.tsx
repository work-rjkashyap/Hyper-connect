'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

export function Spotlight({
  className,
  fill = 'white'
}: {
  className?: string
  fill?: string
}): React.ReactElement {
  return (
    <motion.div
      className={cn('pointer-events-none absolute', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      <svg
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1000 1000"
        fill="none"
      >
        <g filter="url(#spotlight-filter)">
          <ellipse cx="500" cy="500" rx="400" ry="300" fill={fill} fillOpacity="0.15" />
        </g>
        <defs>
          <filter id="spotlight-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="100" />
          </filter>
        </defs>
      </svg>
    </motion.div>
  )
}
