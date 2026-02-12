import React from 'react'
import { Sparkles, ArrowRight, X, RefreshCw, Download } from 'lucide-react'
import { useStore } from '@/renderer/store/useStore'
import { Button } from './button'
import { Progress } from './progress'

export const UpdateBanner: React.FC = () => {
  const { updateStatus, updateInfo, downloadProgress, setUpdateStatus } = useStore()

  if (updateStatus === 'idle' || updateStatus === 'not-available' || updateStatus === 'checking') {
    return null
  }

  const handleDownload = async (): Promise<void> => {
    try {
      await window.api.downloadUpdate()
    } catch (error) {
      console.error('Failed to download update:', error)
    }
  }

  const handleInstall = async (): Promise<void> => {
    try {
      await window.api.quitAndInstall()
    } catch (error) {
      console.error('Failed to install update:', error)
    }
  }

  const dismiss = (): void => {
    setUpdateStatus('idle')
  }

  if (updateStatus === 'available' && updateInfo) {
    return (
      <div className="bg-primary px-4 py-2 text-primary-foreground flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
        <div className="flex items-center gap-3 overflow-hidden">
          <Sparkles className="w-4 h-4 shrink-0" />
          <p className="text-sm font-medium truncate">
            New version available: v{updateInfo.version}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs px-3"
            onClick={handleDownload}
          >
            <Download className="w-3 h-3 mr-1.5" />
            Download
          </Button>
          <button
            onClick={dismiss}
            className="p-1 hover:bg-primary-foreground/10 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  if (updateStatus === 'downloading' && downloadProgress) {
    return (
      <div className="bg-secondary/10 px-4 py-2 border-b flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-4 h-4 text-primary animate-spin" />
            <p className="text-sm font-medium">Downloading update...</p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {Math.round(downloadProgress.percent)}%
          </span>
        </div>
        <Progress value={downloadProgress.percent} className="h-1" />
      </div>
    )
  }

  if (updateStatus === 'downloaded' && updateInfo) {
    return (
      <div className="bg-green-600 px-4 py-2 text-white flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
        <div className="flex items-center gap-3 overflow-hidden">
          <Sparkles className="w-4 h-4 shrink-0" />
          <p className="text-sm font-medium truncate">
            Hyper Connect v{updateInfo.version} is ready to install!
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs px-3 bg-white text-green-700 hover:bg-white/90"
            onClick={handleInstall}
          >
            <ArrowRight className="w-3 h-3 mr-1.5" />
            Restart & Install
          </Button>
          <button
            onClick={dismiss}
            className="p-1 hover:bg-black/10 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return null
}
