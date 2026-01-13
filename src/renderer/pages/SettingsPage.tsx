import React, { useState, useEffect } from 'react'
import {
    Info,
    Settings,
    User,
    Save,
    MessageSquare,
    FileText,
    Database,
    FolderOpen,
    Camera,
    Shield
} from 'lucide-react'

import { useStore } from '@/renderer/store/useStore'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/renderer/components/ui/card'
import { Input } from '@/renderer/components/ui/input'
import { Button } from '@/renderer/components/ui/button'
import { Label } from '@/renderer/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/renderer/components/ui/avatar'
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
import { Separator } from '@/renderer/components/ui/separator'
import { Switch } from '@/renderer/components/ui/switch'
import { processProfileImage } from '../lib/image'








export const SettingsPage: React.FC = () => {
    const { localDevice, setLocalDevice, clearMessages, clearTransfers } = useStore()
    const [name, setName] = useState(localDevice?.displayName || '')
    const [saving, setSaving] = useState(false)
    const [clearingCache, setClearingCache] = useState(false)
    const [downloadPath, setDownloadPath] = useState<string>('')
    const [loadingPath, setLoadingPath] = useState(true)
    const [autoAccept, setAutoAccept] = useState(false)
    const [profileImage, setProfileImage] = useState<string | null>(localDevice?.profileImage || null)




    useEffect(() => {
        const loadSettings = async (): Promise<void> => {
            try {
                const [path, auto] = await Promise.all([
                    window.api.getDownloadPath(),
                    window.api.getAutoAccept()
                ])
                setDownloadPath(path)
                setAutoAccept(auto)
            } finally {
                setLoadingPath(false)
            }
        }
        loadSettings()
    }, [])

    const handleUpdateProfile = async (): Promise<void> => {
        if (
            (!name.trim() || name === localDevice?.displayName) &&
            profileImage === localDevice?.profileImage
        )
            return
        setSaving(true)
        try {
            const updated = await window.api.updateProfile(name, profileImage || undefined)
            setLocalDevice(updated)
        } finally {
            setSaving(false)
        }
    }

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            const base64 = await processProfileImage(file)
            setProfileImage(base64)
        } catch (error) {
            console.error('Image processing failed:', error)
            alert(error instanceof Error ? error.message : 'Failed to process image')
        }
    }

    const handleSelectDownloadDirectory = async (): Promise<void> => {
        try {
            const selectedPath = await window.api.selectDownloadDirectory()
            if (selectedPath) {
                await window.api.setDownloadPath(selectedPath)
                setDownloadPath(selectedPath)
            }
        } catch (error) {
            console.error('Failed to select download directory:', error)
        }
    }

    const handleClearCache = async (): Promise<void> => {
        setClearingCache(true)
        try {
            await window.api.clearCache()
            window.location.reload()
        } finally {
            setClearingCache(false)
        }
    }

    const handleToggleAutoAccept = async (checked: boolean): Promise<void> => {
        // Optimistic update
        const previous = autoAccept
        setAutoAccept(checked)
        try {
            await window.api.setAutoAccept(checked)
        } catch (error) {
            console.error('Failed to update auto-accept setting:', error)
            setAutoAccept(previous) // Rollback on error
        }
    }



    return (
        <div className="flex-1 overflow-y-auto w-full">
            <div className="max-w-3xl mx-auto space-y-8 p-8">
                {/* Header */}
                <div className="space-y-2 pt-2">
                    <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
                    <p className="text-muted-foreground text-base">
                        Manage your device preferences and application data
                    </p>
                </div>
                <Separator />

                {/* Profile Section */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <User className="w-5 h-5" />
                            <CardTitle>Profile</CardTitle>
                        </div>
                        <CardDescription>Update your display name visible to other devices</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
                            <div
                                className="relative group cursor-pointer"
                                onClick={() => document.getElementById('settings-avatar-input')?.click()}
                            >
                                <Avatar className="w-20 h-20 border border-border/50">
                                    <AvatarImage
                                        src={profileImage || undefined}
                                        alt="Profile"
                                        className="object-cover"
                                    />
                                    <AvatarFallback className="bg-secondary">
                                        <User className="w-10 h-10 text-muted-foreground" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full pointer-events-none">
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

                            <div className="flex-1 w-full space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="display-name">Display Name</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="display-name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Enter your name"
                                            className="flex-1"
                                        />
                                        <Button
                                            onClick={handleUpdateProfile}
                                            disabled={
                                                saving ||
                                                (name === localDevice?.displayName &&
                                                    profileImage === localDevice?.profileImage)
                                            }
                                            variant="default"
                                            size="default"
                                        >
                                            <Save className="w-4 h-4" />
                                            {saving ? 'Saving...' : 'Save'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Preferences Section */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            <CardTitle>Preferences</CardTitle>
                        </div>
                        <CardDescription>Customize your application settings</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="download-path">Download Directory</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="download-path"
                                    value={loadingPath ? 'Loading...' : downloadPath}
                                    readOnly
                                    className="flex-1 bg-muted"
                                />
                                <Button onClick={handleSelectDownloadDirectory} variant="default" size="default">
                                    <FolderOpen className="w-4 h-4" />
                                    Browse
                                </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Choose where received files will be saved
                            </p>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Auto-accept Files</Label>
                                <p className="text-sm text-muted-foreground">
                                    Automatically download incoming files without permission
                                </p>
                            </div>
                            <Switch checked={autoAccept} onCheckedChange={handleToggleAutoAccept} />
                        </div>
                    </CardContent>
                </Card>

                {/* Permissions Section */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Shield className="w-5 h-5" />
                            <CardTitle>Permissions</CardTitle>
                        </div>
                        <CardDescription>Manage system permissions required for features</CardDescription>
                    </CardHeader>

                </Card>

                {/* Data Management Section */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Database className="w-5 h-5" />
                            <CardTitle>Data Management</CardTitle>
                        </div>
                        <CardDescription>Clear application data and manage your privacy</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-2">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="flex-1 justify-center text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    Chat
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Clear Chat History?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete all chat messages from this device. This action
                                        cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => clearMessages()}
                                        className="bg-destructive hover:bg-destructive/90"
                                    >
                                        Clear History
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="flex-1 justify-center text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                    <FileText className="w-4 h-4" />
                                    Transfers
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Clear Transfer History?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will remove the log of all file transfers. The files themselves will remain
                                        in your downloads folder.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => clearTransfers()}
                                        className="bg-destructive hover:bg-destructive/90"
                                    >
                                        Clear History
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    disabled={clearingCache}
                                    className="flex-1 justify-center text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
                                >
                                    <Settings className="w-4 h-4" />
                                    {clearingCache ? '...' : 'Cache'}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Clear Application Cache?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will clear all session data, temporary files, and reload the application.
                                        You may need to re-discover devices.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={handleClearCache}
                                        className="bg-orange-500 hover:bg-orange-600"
                                    >
                                        Clear Cache
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>
                {/* About Section */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Info className="w-5 h-5" />
                            <CardTitle>About</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Version 1.0.0</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
