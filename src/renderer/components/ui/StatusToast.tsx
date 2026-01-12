import React from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { toast } from 'sonner'

interface StatusToastProps {
  message: string
  description?: string
  type?: 'success' | 'error' | 'info'
  id?: string | number
}
const ICON_MAP = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info
}

const COLOR_MAP = {
  success: 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400',
  error: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
}

const ICON_BG_MAP = {
  success: 'bg-green-500/20 ring-green-500/30',
  error: 'bg-red-500/20 ring-red-500/30',
  info: 'bg-blue-500/20 ring-blue-500/30'
}

export const StatusToast: React.FC<StatusToastProps> = ({
  message,
  description,
  type = 'info',
  id
}) => {
  const Icon = ICON_MAP[type]
  const colors = COLOR_MAP[type]
  const iconBg = ICON_BG_MAP[type]

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-300 min-w-75',
        colors,
        'group relative'
      )}
    >
      <div
        className={cn('p-2 rounded-full ring-1 shadow-sm flex items-center justify-center', iconBg)}
      >
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm text-foreground">{message}</h4>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>

      {id && (
        <button
          onClick={() => toast.dismiss(id)}
          className="absolute top-2 right-2 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-all text-muted-foreground"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
