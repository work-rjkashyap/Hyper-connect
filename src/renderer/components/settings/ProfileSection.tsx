import React from 'react'
import { User, Camera, Save } from 'lucide-react'
import { Card, CardContent } from '@/renderer/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/renderer/components/ui/avatar'
import { Label } from '@/renderer/components/ui/label'
import { Input } from '@/renderer/components/ui/input'
import { Button } from '@/renderer/components/ui/button'
import type { DeviceInfo } from '@shared/messageTypes'
interface ProfileSectionProps {
  name: string
  setName: (name: string) => void
  profileImage: string | null
  saving: boolean
  localDevice: DeviceInfo | null
  handleUpdateProfile: () => Promise<void>
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
}
export const ProfileSection: React.FC<ProfileSectionProps> = ({
  name,
  setName,
  profileImage,
  saving,
  localDevice,
  handleUpdateProfile,
  handleImageChange
}) => {
  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardContent className="p-0 space-y-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div
            className="relative group cursor-pointer self-center sm:self-auto"
            onClick={() => document.getElementById('settings-avatar-input')?.click()}
          >
            <Avatar className="w-24 h-24 border-2 border-border transition-all group-hover:border-primary/50">
              <AvatarImage src={profileImage || undefined} alt="Profile" className="object-cover" />
              <AvatarFallback className="bg-secondary text-2xl font-semibold">
                {name.slice(0, 2).toUpperCase() || <User className="w-10 h-10" />}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </div>

          <input
            id="settings-avatar-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />

          <div className="flex-1 space-y-1">
            <h4 className="text-sm font-medium">Profile Image</h4>
            <p className="text-xs text-muted-foreground">
              Click the avatar to upload a custom image. Recommended size: 400x400px.
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="space-y-2 max-w-md">
            <Label htmlFor="display-name" className="text-sm font-semibold">
              Display Name
            </Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                id="display-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="h-10 bg-secondary/30 border-none focus-visible:ring-1 focus-visible:ring-primary flex-1"
              />
              <Button
                onClick={handleUpdateProfile}
                disabled={
                  saving ||
                  (name === localDevice?.displayName && profileImage === localDevice?.profileImage)
                }
                className="h-10 px-6 font-medium shadow-sm transition-all hover:scale-[1.02] w-full sm:w-auto"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground italic px-0.5">
              This name will be visible to devices on your local network.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
