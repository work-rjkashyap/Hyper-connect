import React from 'react'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'

export const WelcomePage: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
      <div className="w-20 h-20 bg-primary/5 rounded-3xl flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-primary/20" />
      </div>
      <div className="max-w-xs space-y-2">
        <h1 className="text-3xl font-bold leading-tight">Ready to Connect</h1>
        <p className="prose prose-base dark:prose-invert text-muted-foreground">
          Select a device from the sidebar to start sharing files and messages instantly.
        </p>
      </div>
    </div>
  )
}
