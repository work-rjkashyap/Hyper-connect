import React, { useState, useEffect, useCallback } from 'react'
import Info from 'lucide-react/dist/esm/icons/info'
import Settings from 'lucide-react/dist/esm/icons/settings'
import User from 'lucide-react/dist/esm/icons/user'
import Save from 'lucide-react/dist/esm/icons/save'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Database from 'lucide-react/dist/esm/icons/database'
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open'
import Camera from 'lucide-react/dist/esm/icons/camera'
import Network from 'lucide-react/dist/esm/icons/network'
import Server from 'lucide-react/dist/esm/icons/server'
import Wifi from 'lucide-react/dist/esm/icons/wifi'
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
import type { NetworkInfo } from '@/preload/index.d'
export const SettingsPage: React.FC = () => {
  const { localDevice, setLocalDevice, clearMessages, clearTransfers } = useStore()
  const [name, setName] = useState(localDevice?.displayName || '')
  const [saving, setSaving] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)
  const [downloadPath, setDownloadPath] = useState<string>('')
  const [loadingPath, setLoadingPath] = useState(true)
  const [autoAccept, setAutoAccept] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(localDevice?.profileImage || null)
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null)
  const [appVersion, setAppVersion] = useState<string>('')
  // Consolidated update state
  const [updateState, setUpdateState] = useState<{
    status:
      | 'idle'
      | 'checking'
      | 'available'
      | 'not-available'
      | 'downloading'
      | 'downloaded'
      | 'error'
    info: { version: string } | null
    progress: { percent: number } | null
    error: string | null
  }>({
    status: 'idle',
    info: null,
    progress: null,
    error: null
  })
  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        const [path, auto, netInfo] = await Promise.all([
          window.api.getDownloadPath(),
          window.api.getAutoAccept(),
          window.api.getNetworkInfo()
        ])
        setDownloadPath(path)
        setAutoAccept(auto)
        setNetworkInfo(netInfo)
      } finally {
        setLoadingPath(false)
      }
    }
    loadSettings()
  }, [])
  useEffect(() => {
    // Load app version
    window.api.getAppVersion().then(setAppVersion)
    // Set up update event listeners
    const cleanupChecking = window.api.onUpdateChecking(() => {
      setUpdateState((prev) => ({ ...prev, status: 'checking', error: null }))
    })
    const cleanupAvailable = window.api.onUpdateAvailable((info: { version: string }) => {
      setUpdateState((prev) => ({ ...prev, status: 'available', info }))
    })
    const cleanupNotAvailable = window.api.onUpdateNotAvailable(() => {
      setUpdateState((prev) => ({ ...prev, status: 'not-available' }))
      setTimeout(() => setUpdateState((prev) => ({ ...prev, status: 'idle' })), 3000)
    })
    const cleanupProgress = window.api.onUpdateDownloadProgress((progress: { percent: number }) => {
      setUpdateState((prev) => ({ ...prev, status: 'downloading', progress }))
    })
    const cleanupDownloaded = window.api.onUpdateDownloaded((info: { version: string }) => {
      setUpdateState((prev) => ({ ...prev, status: 'downloaded', info, progress: null }))
    })
    const cleanupError = window.api.onUpdateError((error: string) => {
      setUpdateState((prev) => ({ ...prev, status: 'error', error }))
    })
    return () => {
      cleanupChecking()
      cleanupAvailable()
      cleanupNotAvailable()
      cleanupProgress()
      cleanupDownloaded()
      cleanupError()
    }
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
  const handleCheckForUpdates = async (): Promise<void> => {
    try {
      await window.api.checkForUpdates()
    } catch (error) {
      console.error('Failed to check for updates:', error)
      setUpdateState((prev) => ({
        ...prev,
        status: 'error',
        error: 'Failed to check for updates'
      }))
    }
  }
  const handleDownloadUpdate = async (): Promise<void> => {
    try {
      await window.api.downloadUpdate()
    } catch (error) {
      console.error('Failed to download update:', error)
      setUpdateState((prev) => ({
        ...prev,
        status: 'error',
        error: 'Failed to download update'
      }))
    }
  }
  const handleInstallUpdate = async (): Promise<void> => {
    try {
      await window.api.quitAndInstall()
    } catch (error) {
      console.error('Failed to install update:', error)
    }
  }
  const handleAvatarClick = useCallback((): void => {
    document.getElementById('settings-avatar-input')?.click()
  }, [])
  const handleClearMessages = useCallback((): void => {
    clearMessages()
  }, [clearMessages])
  const handleClearTransfers = useCallback((): void => {
    clearTransfers()
  }, [clearTransfers])
  return (
    <div className="flex-1 overflow-y-auto w-full">
      <div className="max-w-3xl mx-auto space-y-8 p-8">
        {/* Header */}
        <div className="space-y-2 pt-2">
          <h2 className="text-3xl font-bold tracking-tight leading-tight">Settings</h2>
          <p className="prose prose-base dark:prose-invert text-muted-foreground">
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
            <CardDescription className="prose prose-sm dark:prose-invert">
              Update your display name visible to other devices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
              <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
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
            <CardDescription className="prose prose-sm dark:prose-invert">
              Customize your application settings
            </CardDescription>
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
              <p className="text-sm text-muted-foreground leading-relaxed">
                Choose where received files will be saved
              </p>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Auto-accept Files</Label>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Automatically download incoming files without permission
                </p>
              </div>
              <Switch checked={autoAccept} onCheckedChange={handleToggleAutoAccept} />
            </div>
          </CardContent>
        </Card>
        {/* Network Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5" />
              <CardTitle>Network</CardTitle>
            </div>
            <CardDescription className="prose prose-sm dark:prose-invert">
              TCP server details and network configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {networkInfo ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground leading-snug">
                      <Server className="w-4 h-4" />
                      <span>TCP Server Port</span>
                    </div>
                    <p className="text-2xl font-bold font-mono leading-tight">{networkInfo.port}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground leading-snug">
                      <Wifi className="w-4 h-4" />
                      <span>Active Connections</span>
                    </div>
                    <p className="text-2xl font-bold leading-tight">
                      {networkInfo.activeConnections}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground leading-snug">
                    Local IP Addresses
                  </Label>
                  <div className="space-y-1">
                    {networkInfo.addresses.length > 0 ? (
                      networkInfo.addresses.map((addr) => (
                        <div
                          key={addr}
                          className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md font-mono text-sm"
                        >
                          <div className="w-2 h-2 rounded-full bg-success" />
                          {addr}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        No network interfaces detected
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                Loading network information...
              </p>
            )}
          </CardContent>
        </Card>
        {/* Data Management Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              <CardTitle>Data Management</CardTitle>
            </div>
            <CardDescription className="prose prose-sm dark:prose-invert">
              Clear application data and manage your privacy
            </CardDescription>
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
                  <AlertDialogDescription className="prose prose-sm dark:prose-invert">
                    This will permanently delete all chat messages from this device. This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearMessages}
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
                  <AlertDialogDescription className="prose prose-sm dark:prose-invert">
                    This will remove the log of all file transfers. The files themselves will remain
                    in your downloads folder.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearTransfers}
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
                  className="flex-1 justify-center text-warning hover:text-warning/90 hover:bg-warning/10"
                >
                  <Settings className="w-4 h-4" />
                  {clearingCache ? '...' : 'Cache'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Application Cache?</AlertDialogTitle>
                  <AlertDialogDescription className="prose prose-sm dark:prose-invert">
                    This will clear all session data, temporary files, and reload the application.
                    You may need to re-discover devices.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearCache}
                    className="bg-warning hover:bg-warning/90 text-warning-foreground"
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
            <CardDescription className="prose prose-sm dark:prose-invert">
              Application version and updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Current Version</Label>
                <p className="text-sm text-muted-foreground font-mono leading-snug">
                  {appVersion || 'Loading...'}
                </p>
              </div>
              <Button
                onClick={handleCheckForUpdates}
                disabled={updateState.status === 'checking' || updateState.status === 'downloading'}
                variant="outline"
                size="default"
              >
                {updateState.status === 'checking' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Checking...
                  </>
                ) : updateState.status === 'downloading' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Downloading...
                  </>
                ) : (
                  'Check for Updates'
                )}
              </Button>
            </div>
            {updateState.status === 'available' && updateState.info && (
              <div className="p-4 bg-info/10 border border-info/20 rounded-md space-y-2">
                <p className="text-sm font-medium text-info">
                  New version available: {updateState.info.version}
                </p>
                <Button
                  onClick={handleDownloadUpdate}
                  variant="default"
                  size="sm"
                  className="w-full"
                >
                  Download Update
                </Button>
              </div>
            )}
            {updateState.status === 'downloading' && updateState.progress && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Downloading update...</span>
                  <span>{updateState.progress.percent.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${updateState.progress.percent}%` }}
                  />
                </div>
              </div>
            )}
            {updateState.status === 'downloaded' && updateState.info && (
              <div className="p-4 bg-success/10 border border-success/20 rounded-md space-y-2">
                <p className="text-sm font-medium text-success">
                  Update ready to install: {updateState.info.version}
                </p>
                <Button
                  onClick={handleInstallUpdate}
                  variant="default"
                  size="sm"
                  className="w-full"
                >
                  Restart and Install
                </Button>
              </div>
            )}
            {updateState.status === 'not-available' && (
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  You&apos;re running the latest version
                </p>
              </div>
            )}
            {updateState.status === 'error' && updateState.error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{updateState.error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
