import React, { useState, useEffect } from 'react'
import logoLight from '../assets/logo_light.png'
import logoDark from '../assets/logo_dark.png'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/renderer/components/ui/card'
import { Input } from '@/renderer/components/ui/input'
import { Button } from '@/renderer/components/ui/button'
import { useStore } from '@/renderer/store/useStore'
import { ThemeToggle } from '@/renderer/components/ui/theme-toggle'
import { Field, FieldGroup, FieldLabel } from '../components/ui/field'
export const Onboarding: React.FC = () => {
  const [name, setName] = useState('')
  const setOnboardingComplete = useStore((state) => state.setOnboardingComplete)
  const setLocalDevice = useStore((state) => state.setLocalDevice)
  useEffect(() => {
    const loadDefaultName = async (): Promise<void> => {
      try {
        const info = await window.api.getDeviceInfo()
        // Only set if we don't have a name yet (though loop only runs once)
        if (info?.displayName) {
          setName(info.displayName)
        }
      } catch (error) {
        console.error('Failed to load default device name:', error)
      }
    }
    loadDefaultName()
  }, [])
  const handleContinue = async (): Promise<void> => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    try {
      const deviceInfo = await window.api.updateDisplayName(trimmedName)
      setLocalDevice(deviceInfo)
      setOnboardingComplete(true)
    } catch (e) {
      console.error('Failed to update name:', e)
    }
  }
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 relative overflow-hidden">
      {/* Background blobs for premium feel */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px]" />
      <div className="absolute top-6 right-6 z-10">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md border border-border/50 shadow-2xl glass animate-in zoom-in-95 duration-500 relative z-20">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-24 h-24 relative">
            {/* Glow effect behind the logo */}
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
            <div className="relative w-full h-full bg-white dark:bg-slate-950 rounded-3xl p-3 shadow-lg flex items-center justify-center border border-border/10 overflow-hidden">
              <img
                src={logoLight}
                alt="Hyper-connect Logo"
                className="w-full h-full object-contain dark:hidden"
              />
              <img
                src={logoDark}
                alt="Hyper-connect Logo"
                className="w-full h-full object-contain hidden dark:block"
              />
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              Hyper Connect
            </CardTitle>
            <CardDescription className="text-base">
              Set a display name for this device so others can find you on the network.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-8">
          <FieldGroup>
            <Field>
              <FieldLabel
                htmlFor="display-name"
                className="text-base font-semibold text-muted-foreground ml-1"
              >
                Display Name
              </FieldLabel>
              <Input
                id="display-name"
                placeholder="e.g. My MacBook Pro"
                value={name}
                onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                onChange={(e) => setName(e.target.value)}
                className="w-full"
              />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="pb-8">
          <Button className="w-full" disabled={!name.trim()} onClick={handleContinue}>
            Get Started
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
