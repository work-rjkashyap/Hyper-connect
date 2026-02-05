import React from 'react'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import Info from 'lucide-react/dist/esm/icons/info'
import X from 'lucide-react/dist/esm/icons/x'
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
  success: 'bg-success/10 border-success/20 text-success',
  error: 'bg-destructive/10 border-destructive/20 text-destructive',
  info: 'bg-info/10 border-info/20 text-info'
}

const ICON_BG_MAP = {
  success: 'bg-success/20 ring-success/30',
  error: 'bg-destructive/20 ring-destructive/30',
  info: 'bg-info/20 ring-info/30'
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
        <h4 className="font-semibold text-sm text-foreground leading-tight">{message}</h4>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
        )}
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
