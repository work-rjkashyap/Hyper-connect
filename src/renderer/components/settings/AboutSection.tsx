import React from 'react'
import { Card, CardContent } from '@/renderer/components/ui/card'
import { Button } from '@/renderer/components/ui/button'
import { Badge } from '@/renderer/components/ui/badge'
import { Separator } from '../ui/separator'
interface AboutSectionProps {
  appVersion: string
  updateStatus:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error'
  updateInfo: { version: string } | null
  downloadProgress: { percent: number } | null
  updateError: string | null
  handleCheckForUpdates: () => Promise<void>
  handleDownloadUpdate: () => Promise<void>
  handleInstallUpdate: () => Promise<void>
}
export const AboutSection: React.FC<AboutSectionProps> = ({
  appVersion,
  updateStatus,
  updateInfo,
  downloadProgress,
  updateError,
  handleCheckForUpdates,
  handleDownloadUpdate,
  handleInstallUpdate
}) => {
  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardContent className="p-0 space-y-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 rounded-2xl bg-secondary/10 border border-border/50">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">System Update</h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">
                Current: v{appVersion || '0.0.0'}
              </span>
              <Badge
                variant="outline"
                className="h-4 text-[9px] px-1 border-primary/20 text-primary uppercase"
              >
                Stable
              </Badge>
            </div>
          </div>
          <Button
            onClick={handleCheckForUpdates}
            disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
            variant="default"
            className="h-10 px-6 shadow-lg shadow-primary/10 transition-all hover:scale-[1.02] w-full md:w-auto"
          >
            {updateStatus === 'checking' ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Checking...
              </>
            ) : updateStatus === 'downloading' ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Downloading...
              </>
            ) : (
              'Check for Updates'
            )}
          </Button>
        </div>
        {/* Update Notifications */}
        {updateStatus === 'available' && updateInfo && (
          <div className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                Update Available
              </p>
              <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                A newer version (v{updateInfo.version}) is ready for download.
              </p>
            </div>
            <Button
              onClick={handleDownloadUpdate}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
            >
              Download Update
            </Button>
          </div>
        )}
        {updateStatus === 'downloading' && downloadProgress && (
          <div className="p-5 bg-secondary/20 rounded-2xl space-y-3">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-muted-foreground">Downloading...</span>
              <span className="text-primary">{downloadProgress.percent.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(var(--primary),0.4)]"
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
          </div>
        )}
        {updateStatus === 'downloaded' && updateInfo && (
          <div className="p-5 bg-green-500/10 border border-green-500/20 rounded-2xl space-y-4 shadow-sm animate-in zoom-in-95">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                Restart Required
              </p>
              <p className="text-xs text-green-600/70 dark:text-green-400/70 text-balance">
                The update to v{updateInfo.version} has been downloaded and is ready to install.
              </p>
            </div>
            <Button
              onClick={handleInstallUpdate}
              className="w-full bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20"
            >
              Restart and Install
            </Button>
          </div>
        )}
        {updateStatus === 'not-available' && (
          <div className="p-4 bg-secondary/20 border border-transparent rounded-xl text-center">
            <p className="text-xs text-muted-foreground font-medium">
              You are currently running the latest version of Hyper-connect.
            </p>
          </div>
        )}
        {updateStatus === 'error' && updateError && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <p className="text-xs text-destructive font-medium">{updateError}</p>
          </div>
        )}
        <div className="pt-6 flex flex-col gap-4 text-center sm:text-left">
          <Separator className="bg-secondary/50" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-primary uppercase tracking-widest">
                Hyper-connect
              </p>
              <p className="text-[10px] text-muted-foreground">&copy; 2024. All rights reserved.</p>
            </div>
            <div className="flex items-center justify-center sm:justify-end gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                System Ready
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
