'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

interface AnimatedGradientTextProps {
  children: React.ReactNode
  className?: string
}

export function AnimatedGradientText({
  children,
  className
}: AnimatedGradientTextProps): React.ReactElement {
  return (
    <motion.div
      className={cn(
        'bg-gradient-to-r from-blue-600 via-purple-600 to-orange-500 bg-clip-text text-transparent',
        'bg-[length:200%_auto] animate-gradient',
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
