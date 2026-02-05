import { memo } from 'react'
import { Separator } from '../ui/separator'

export interface DateSeparatorProps {
  date: string
}

/**
 * DateSeparator - Visual separator showing date between messages
 * Groups messages by day
 */
export const DateSeparator = memo(({ date }: DateSeparatorProps) => {
  return (
    <div className="flex items-center gap-4 py-4">
      <Separator className="flex-1 opacity-10" />
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/40 whitespace-nowrap">
        {date}
      </span>
      <Separator className="flex-1 opacity-10" />
    </div>
  )
})

DateSeparator.displayName = 'DateSeparator'
