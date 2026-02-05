import React, { useState, useEffect, useCallback } from 'react'
import User from 'lucide-react/dist/esm/icons/user'
import Camera from 'lucide-react/dist/esm/icons/camera'
import Check from 'lucide-react/dist/esm/icons/check'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { useStore } from '../store/useStore'
import { Field, FieldGroup, FieldLabel } from '../components/ui/field'
import { processProfileImage } from '../lib/image'
export const Onboarding: React.FC = () => {
  const [name, setName] = useState('')
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setOnboardingComplete = useStore((state) => state.setOnboardingComplete)
  const setLocalDevice = useStore((state) => state.setLocalDevice)
  useEffect(() => {
    const loadDefaultName = async (): Promise<void> => {
      try {
        const info = await window.api.getDeviceInfo()
        if (info?.displayName) {
          setName(info.displayName)
        }
      } catch (error) {
        console.error('Failed to load default device name:', error)
      }
    }
    loadDefaultName()
  }, [])
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setError(null)
      const base64 = await processProfileImage(file)
      setProfileImage(base64)
    } catch (error) {
      console.error('Image processing failed:', error)
      setError(error instanceof Error ? error.message : 'Failed to process image')
    }
  }
  const handleContinue = async (): Promise<void> => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Please enter a display name')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const deviceInfo = await window.api.updateProfile(trimmedName, profileImage || undefined)
      setLocalDevice(deviceInfo)
      setOnboardingComplete(true)
    } catch (e) {
      console.error('Failed to update profile:', e)
      setError(e instanceof Error ? e.message : 'Failed to update profile')
      setIsLoading(false)
    }
  }
  const handleAvatarClick = useCallback((): void => {
    document.getElementById('avatar-input')?.click()
  }, [])
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && name.trim()) {
      handleContinue()
    }
  }
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 relative overflow-hidden">
      {/* Modern gradient background with animated blobs */}
      <div
        className="absolute top-[-20%] left-[-10%] w-125 h-125 bg-primary/15 rounded-full blur-[120px] animate-pulse"
        style={{ animationDuration: '8s' }}
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] w-125 h-125 bg-accent/10 rounded-full blur-[120px] animate-pulse"
        style={{ animationDuration: '10s', animationDelay: '2s' }}
        aria-hidden="true"
      />
      <Card className="w-full max-w-md border border-border/50 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-500 relative z-20 bg-card/95">
        <CardHeader className="text-center space-y-6 pb-6">
          <div className="mx-auto flex flex-col items-center space-y-8">
            {/* Avatar Section */}
            <button
              onClick={handleAvatarClick}
              className="group relative w-28 h-28 rounded-full transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
              aria-label="Upload profile picture"
            >
              <div className="w-full h-full rounded-full border-2 border-primary/30 p-1 group-hover:border-primary/70 group-focus-visible:border-primary/70 transition-colors bg-background/50 flex items-center justify-center overflow-hidden backdrop-blur-sm">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Your profile picture"
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <User className="w-14 h-14 text-muted-foreground transition-colors group-hover:text-foreground" />
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Camera className="w-7 h-7 text-white" aria-hidden="true" />
                </div>
              </div>
              <input
                id="avatar-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
                aria-label="Select image file"
              />
            </button>
            {/* Header Text */}
            <div className="space-y-3">
              <CardTitle className="text-4xl font-bold tracking-tight bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                Hyper Connect
              </CardTitle>
              <CardDescription className="text-base leading-relaxed text-muted-foreground">
                Set up your profile so others can discover you on the network.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 px-6">
          {/* Error Message */}
          {error && (
            <div
              className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-3"
              role="alert"
            >
              <div
                className="mt-0.5 w-4 h-4 rounded-full bg-destructive shrink-0"
                aria-hidden="true"
              />
              <p>{error}</p>
            </div>
          )}
          {/* Display Name Field */}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="display-name" className="text-sm font-semibold text-foreground">
                Display Name
                <span className="text-destructive ml-1" aria-label="required">
                  *
                </span>
              </FieldLabel>
              <Input
                id="display-name"
                placeholder="e.g., My MacBook Pro…"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError(null)
                }}
                onKeyDown={handleKeyDown}
                className="mt-2 h-10 px-3 py-2 rounded-lg border border-input/50 bg-background/50 backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent transition-all"
                disabled={isLoading}
                maxLength={50}
                spellCheck="false"
                autoFocus
                autoComplete="off"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">{name.length}/50 characters</p>
            </Field>
          </FieldGroup>
          {/* Profile Preview */}
          {profileImage && (
            <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-primary/5 border border-primary/20">
              <Check className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <span className="text-sm text-foreground">Profile picture selected</span>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 px-6 pb-6">
          <Button
            onClick={handleContinue}
            disabled={!name.trim() || isLoading}
            className="w-full h-11 bg-linear-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 active:scale-95 transition-all duration-200 font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={isLoading ? 'Setting up your profile…' : 'Get started with Hyper Connect'}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-background/30 border-t-background animate-spin" />
                Setting up…
              </span>
            ) : (
              'Get Started'
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            You can change your profile anytime in settings.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
