import React from 'react'
import { FolderOpen, ShieldCheck, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/renderer/components/ui/card'
import { Label } from '@/renderer/components/ui/label'
import { Switch } from '@/renderer/components/ui/switch'
import { Input } from '@/renderer/components/ui/input'
import { Button } from '@/renderer/components/ui/button'
import { Separator } from '@/renderer/components/ui/separator'
import { Badge } from '@/renderer/components/ui/badge'

interface PreferencesSectionProps {
  downloadPath: string
  loadingPath: boolean
  autoAccept: boolean
  handleSelectDownloadDirectory: () => Promise<void>
  handleToggleAutoAccept: (checked: boolean) => Promise<void>
}

export const PreferencesSection: React.FC<PreferencesSectionProps> = ({
  downloadPath,
  loadingPath,
  autoAccept,
  handleSelectDownloadDirectory,
  handleToggleAutoAccept
}) => {
  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardContent className="p-0 space-y-10">
        {/* Storage Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <FolderOpen className="w-4 h-4" />
            Storage & Downloads
          </div>
          <div className="space-y-3">
            <Label
              htmlFor="download-path"
              className="text-xs text-muted-foreground uppercase tracking-wider font-bold"
            >
              Download Directory
            </Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                id="download-path"
                value={loadingPath ? 'Determining path...' : downloadPath}
                readOnly
                className="flex-1 bg-secondary/30 border-none h-10 font-mono text-[10px] sm:text-xs truncate"
              />
              <Button
                onClick={handleSelectDownloadDirectory}
                variant="outline"
                className="h-10 hover:bg-secondary transition-colors border-dashed w-full sm:w-auto shrink-0"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Change Path
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground italic">
              All incoming files will be stored in this location.
            </p>
          </div>
        </div>

        <Separator className="bg-secondary/50" />

        {/* Transfer Behavior */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Sparkles className="w-4 h-4" />
            Transfer Behavior
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl border bg-secondary/10 border-border/50">
            <div className="space-y-1 pr-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Auto-accept Files</Label>
                {autoAccept && (
                  <Badge
                    variant="secondary"
                    className="h-4 text-[9px] px-1 bg-primary/10 text-primary border-none uppercase"
                  >
                    Enabled
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Automatically download incoming files without showing a confirmation prompt.
                <span className="text-destructive/80 ml-1 font-medium italic underline decoration-dotted">
                  Use with caution on public networks.
                </span>
              </p>
            </div>
            <Switch
              checked={autoAccept}
              onCheckedChange={handleToggleAutoAccept}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        </div>

        {/* Future Settings Placeholder - Aesthetic padding */}
        <div className="pt-2">
          <div className="rounded-lg border border-dashed border-border/50 p-6 flex flex-col items-center justify-center text-center space-y-2 opacity-50">
            <ShieldCheck className="w-8 h-8 text-muted-foreground" />
            <p className="text-xs font-medium">Advanced Encryption Settings</p>
            <p className="text-[10px] text-muted-foreground">Managed by system policy</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
