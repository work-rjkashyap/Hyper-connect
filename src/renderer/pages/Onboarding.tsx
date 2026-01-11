import React, { useState, useEffect } from 'react'
import { User, Camera } from 'lucide-react'
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
import { ThemeToggle } from '../components/ui/theme-toggle'
import { Field, FieldGroup, FieldLabel } from '../components/ui/field'
export const Onboarding: React.FC = () => {
  const [name, setName] = useState('')
  const [profileImage, setProfileImage] = useState<string | null>(null)
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
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 256
        const MAX_HEIGHT = 256
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height
            height = MAX_HEIGHT
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        const base64 = canvas.toDataURL('image/jpeg', 0.8)
        setProfileImage(base64)
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleContinue = async (): Promise<void> => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    try {
      const deviceInfo = await window.api.updateProfile(trimmedName, profileImage || undefined)
      setLocalDevice(deviceInfo)
      setOnboardingComplete(true)
    } catch (e) {
      console.error('Failed to update profile:', e)
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
          <div className="mx-auto flex flex-col items-center space-y-6">
            <div
              className="w-24 h-24 relative group cursor-pointer"
              onClick={() => document.getElementById('avatar-input')?.click()}
            >
              <div className="w-full h-full rounded-full border-2 border-primary/20 p-1 group-hover:border-primary/50 transition-colors bg-background flex items-center justify-center overflow-hidden">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <User className="w-12 h-12 text-muted-foreground" />
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>
              <input
                id="avatar-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl font-bold tracking-tight bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                Hyper Connect
              </CardTitle>
              <CardDescription className="text-base">
                Set a display name and avatar so others can find you on the network.
              </CardDescription>
            </div>
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
