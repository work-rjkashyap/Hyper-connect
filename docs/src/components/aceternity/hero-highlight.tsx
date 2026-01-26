'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

export function HeroHighlight({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}): React.ReactElement {
  return (
    <motion.span
      initial={{ backgroundSize: '0% 100%' }}
      whileInView={{ backgroundSize: '100% 100%' }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
      viewport={{ once: true }}
      className={cn(
        'bg-gradient-to-r from-purple-500/30 via-blue-500/30 to-orange-500/30',
        'bg-no-repeat bg-left-bottom',
        className
      )}
    >
      {children}
    </motion.span>
  )
}
