import { cn } from '@/lib/utils'
import X from 'lucide-react/dist/esm/icons/x'

export interface ToastProps {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    title?: string
    description?: string
    variant?: 'default' | 'destructive'
    action?: React.ReactElement
}

export function Toast({
    open = true,
    onOpenChange,
    title,
    description,
    variant = 'default',
    action,
}: ToastProps) {
    if (!open) return null

    return (
        <div
            className={cn(
                'group pointer-events-auto relative flex w-full sm:w-80 items-center justify-between space-x-4 overflow-hidden rounded-xl border p-4 pr-8 shadow-lg transition-all duration-300',
                'animate-in fade-in slide-in-from-bottom-4',
                variant === 'default' && 'border-border bg-card text-card-foreground backdrop-blur-sm',
                variant === 'destructive' &&
                'border-destructive/50 bg-destructive/90 text-destructive-foreground'
            )}
            data-state={open ? 'open' : 'closed'}
        >
            <div className="grid gap-1 flex-1 min-w-0">
                {title && <div className="text-sm font-semibold truncate">{title}</div>}
                {description && (
                    <div className="text-sm opacity-90 line-clamp-2">{description}</div>
                )}
            </div>
            {action}
            <button
                onClick={() => onOpenChange?.(false)}
                className={cn(
                    'absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity hover:opacity-100',
                    'hover:bg-accent focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring',
                    'group-hover:opacity-70'
                )}
            >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
            </button>
        </div>
    )
}
