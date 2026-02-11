import React from 'react'
import { Zap, Shield, Wifi } from 'lucide-react'

export const WelcomePage: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md space-y-6">
        {/* Icon */}
        <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto">
          <Zap className="w-10 h-10 text-blue-600 dark:text-blue-400" />
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Welcome to Hyper Connect</h1>
          <p className="text-muted-foreground">
            Share files and messages instantly across devices on your local network
          </p>
        </div>

        {/* Features */}
        <div className="flex items-center justify-center gap-6 pt-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span>Secure</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span>Fast</span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4" />
            <span>Local Only</span>
          </div>
        </div>

        {/* Get Started */}
        <div className="pt-6">
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm">Select a device from the sidebar to start sharing</p>
          </div>
        </div>
      </div>
    </div>
  )
}
