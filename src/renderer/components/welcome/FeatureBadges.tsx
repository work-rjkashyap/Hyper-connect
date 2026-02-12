import React from 'react'
import { Shield, Zap, Wifi, LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  label: string
}

const features: Feature[] = [
  { icon: Shield, label: 'Secure' },
  { icon: Zap, label: 'Fast' },
  { icon: Wifi, label: 'Local Only' }
]

export const FeatureBadges: React.FC = () => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-4 text-sm text-muted-foreground">
      {features.map((feature) => {
        const Icon = feature.icon
        return (
          <div key={feature.label} className="flex items-center gap-2">
            <Icon className="w-4 h-4" />
            <span>{feature.label}</span>
          </div>
        )
      })}
    </div>
  )
}
