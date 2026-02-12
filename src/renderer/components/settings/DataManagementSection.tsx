import React from 'react'
import { Database, Settings } from 'lucide-react'
import { Card, CardContent } from '@/renderer/components/ui/card'
import { Button } from '@/renderer/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/renderer/components/ui/alert-dialog'

interface DataManagementSectionProps {
  clearingCache: boolean
  clearMessages: () => void
  clearTransfers: () => void
  handleClearCache: () => Promise<void>
}

export const DataManagementSection: React.FC<DataManagementSectionProps> = ({
  clearingCache,
  clearMessages,
  clearTransfers,
  handleClearCache
}) => {
  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardContent className="p-0 space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <Database className="w-4 h-4" />
            Cleanup Operations
          </div>

          <div className="grid gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border bg-secondary/10 border-border/50 transition-all hover:bg-secondary/20 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Message History</p>
                <p className="text-xs text-muted-foreground">
                  Delete all chat logs and session messages.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-destructive/20 hover:bg-destructive/10 hover:text-destructive w-full sm:w-auto"
                  >
                    Clear Messages
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Chat History?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all chat messages from this device.
                      <span className="block mt-2 font-bold text-destructive">
                        This action cannot be undone.
                      </span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearMessages()}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Delete Permanently
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border bg-secondary/10 border-border/50 transition-all hover:bg-secondary/20 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Transfer Logs</p>
                <p className="text-xs text-muted-foreground">
                  Clear history of sent and received files.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-destructive/20 hover:bg-destructive/10 hover:text-destructive w-full sm:w-auto"
                  >
                    Clear Logs
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Transfer History?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the log of all file transfers. The files themselves will
                      remain safely in your downloads folder.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearTransfers()}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Clear Logs
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-destructive/5 border border-destructive/10 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-destructive uppercase tracking-widest">
            <Settings className="w-4 h-4" />
            Danger Zone
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Application Cache</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Resetting the cache will clear all temporary data and restart the app. Useful if you
                encounter discovery or connection issues.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="h-10 px-6 shrink-0 shadow-lg shadow-destructive/20 w-full md:w-auto"
                  disabled={clearingCache}
                >
                  {clearingCache ? 'Clearing...' : 'Reset Cache'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-destructive/20">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive">
                    Reset Application Cache?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    The application will restart and all temporary session data will be wiped. No
                    files or settings will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Go Back</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearCache}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Confirm Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
