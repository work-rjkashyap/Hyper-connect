'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface BentoGridProps {
  children: ReactNode
  className?: string
}

interface BentoCardProps {
  children: ReactNode
  className?: string
  colSpan?: number
}

export function BentoGrid({ children, className }: BentoGridProps): React.ReactElement {
  return (
    <div
      className={cn(
        'grid auto-rows-[minmax(200px,auto)] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {children}
    </div>
  )
}

export function BentoCard({
  children,
  className,
  colSpan = 1
}: BentoCardProps): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      whileHover={{ scale: 1.02, y: -5 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800',
        'bg-white dark:bg-gray-900 p-8',
        'hover:border-gray-300 dark:hover:border-gray-700 transition-all',
        'hover:shadow-lg dark:hover:shadow-purple-500/10',
        colSpan === 2 && 'md:col-span-2',
        className
      )}
    >
      {children}
    </motion.div>
  )
}
