import React from 'react'
import { Network, Server, Wifi } from 'lucide-react'
import { Card, CardContent } from '@/renderer/components/ui/card'
import { Separator } from '@/renderer/components/ui/separator'
import { Badge } from '@/renderer/components/ui/badge'
import { Button } from '@/renderer/components/ui/button'
import type { NetworkInfo } from '@/preload/index.d'

interface NetworkSectionProps {
  networkInfo: NetworkInfo | null
}

export const NetworkSection: React.FC<NetworkSectionProps> = ({ networkInfo }) => {
  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardContent className="p-0 space-y-10">
        {/* Status Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="group p-5 rounded-2xl border bg-secondary/10 border-border/50 space-y-3 transition-all hover:bg-secondary/20 hover:border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Server className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold">TCP Server</span>
              </div>
              <Badge
                variant={networkInfo ? 'default' : 'destructive'}
                className="h-5 text-[10px] uppercase font-bold tracking-wider"
              >
                {networkInfo ? 'Running' : 'Offline'}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold font-mono tracking-tight">
                {networkInfo?.port || '----'}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase font-medium">
                Listening on port
              </p>
            </div>
          </div>

          <div className="group p-5 rounded-2xl border bg-secondary/10 border-border/50 space-y-3 transition-all hover:bg-secondary/20 hover:border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Wifi className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold">Connections</span>
              </div>
              <Badge
                variant="secondary"
                className="h-5 text-[10px] uppercase font-bold tracking-wider"
              >
                Peer-to-Peer
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold tracking-tight">
                {networkInfo?.activeConnections ?? 0}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase font-medium">
                Active sessions
              </p>
            </div>
          </div>
        </div>

        <Separator className="bg-secondary/50" />

        {/* IP Addresses */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Network className="w-4 h-4" />
            Network Interfaces
          </div>
          <div className="grid gap-3">
            {networkInfo?.addresses && networkInfo.addresses.length > 0 ? (
              networkInfo.addresses.map((addr) => (
                <div
                  key={addr}
                  className="flex items-center justify-between p-4 bg-secondary/20 rounded-xl border border-border/50 group transition-all hover:border-primary/30 gap-4"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] shrink-0" />
                    <span className="font-mono text-xs sm:text-sm font-medium tracking-tight truncate">
                      {addr}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => navigator.clipboard.writeText(addr)}
                  >
                    <span className="sr-only">Copy IP</span>
                    <svg
                      viewBox="0 0 24 24"
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </Button>
                </div>
              ))
            ) : (
              <div className="py-12 flex flex-col items-center justify-center border border-dashed rounded-xl opacity-50 space-y-2">
                <Wifi className="w-8 h-8 text-muted-foreground animate-pulse" />
                <p className="text-xs font-medium">Scanning for interfaces...</p>
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground italic leading-relaxed">
            Other devices can find you at any of these addresses. Ensure you are on the same local
            network for discovery to work.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
