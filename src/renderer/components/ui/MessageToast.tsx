import React from 'react'
import { MessageSquare, FileText, ArrowRight } from 'lucide-react'
import { cn } from '../../lib/utils'

interface MessageToastProps {
  title: string
  description: string
  isFile?: boolean
  onClick?: () => void
}

export const MessageToast: React.FC<MessageToastProps> = ({
  title,
  description,
  isFile,
  onClick
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-300 min-w-[320px] max-w-[400px]',
        'bg-background/80 border-border/50 hover:bg-accent/5',
        'hover:scale-[1.02] active:scale-[0.98] cursor-pointer group'
      )}
    >
      <div className="p-2 rounded-full bg-primary/10 ring-1 ring-primary/20 text-primary mt-0.5">
        {isFile ? <FileText className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm flex items-center justify-between text-foreground mb-1">
          {title}
          <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-primary" />
        </h4>
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
