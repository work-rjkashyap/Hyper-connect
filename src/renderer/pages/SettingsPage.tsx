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
  Network,
  Server,
  Wifi
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
  const [updateStatus, setUpdateStatus] = useState<
    'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  >('idle')
  const [updateInfo, setUpdateInfo] = useState<{ version: string } | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<{ percent: number } | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
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
      setUpdateStatus('checking')
      setUpdateError(null)
    })
    const cleanupAvailable = window.api.onUpdateAvailable((info: { version: string }) => {
      setUpdateStatus('available')
      setUpdateInfo(info)
    })
    const cleanupNotAvailable = window.api.onUpdateNotAvailable(() => {
      setUpdateStatus('not-available')
      setTimeout(() => setUpdateStatus('idle'), 3000)
    })
    const cleanupProgress = window.api.onUpdateDownloadProgress((progress: { percent: number }) => {
      setUpdateStatus('downloading')
      setDownloadProgress(progress)
    })
    const cleanupDownloaded = window.api.onUpdateDownloaded((info: { version: string }) => {
      setUpdateStatus('downloaded')
      setUpdateInfo(info)
      setDownloadProgress(null)
    })
    const cleanupError = window.api.onUpdateError((error: string) => {
      setUpdateStatus('error')
      setUpdateError(error)
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
      setUpdateStatus('error')
      setUpdateError('Failed to check for updates')
    }
  }
  const handleDownloadUpdate = async (): Promise<void> => {
    try {
      await window.api.downloadUpdate()
    } catch (error) {
      console.error('Failed to download update:', error)
      setUpdateStatus('error')
      setUpdateError('Failed to download update')
    }
  }
  const handleInstallUpdate = async (): Promise<void> => {
    try {
      await window.api.quitAndInstall()
    } catch (error) {
      console.error('Failed to install update:', error)
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
        {/* Network Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5" />
              <CardTitle>Network</CardTitle>
            </div>
            <CardDescription>TCP server details and network configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {networkInfo ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Server className="w-4 h-4" />
                      <span>TCP Server Port</span>
                    </div>
                    <p className="text-2xl font-bold font-mono">{networkInfo.port}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Wifi className="w-4 h-4" />
                      <span>Active Connections</span>
                    </div>
                    <p className="text-2xl font-bold">{networkInfo.activeConnections}</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Local IP Addresses</Label>
                  <div className="space-y-1">
                    {networkInfo.addresses.length > 0 ? (
                      networkInfo.addresses.map((addr) => (
                        <div
                          key={addr}
                          className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md font-mono text-sm"
                        >
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          {addr}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No network interfaces detected
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading network information...</p>
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
            <CardDescription>Application version and updates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Current Version</Label>
                <p className="text-sm text-muted-foreground font-mono">
                  {appVersion || 'Loading...'}
                </p>
              </div>
              <Button
                onClick={handleCheckForUpdates}
                disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                variant="outline"
                size="default"
              >
                {updateStatus === 'checking' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Checking...
                  </>
                ) : updateStatus === 'downloading' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Downloading...
                  </>
                ) : (
                  'Check for Updates'
                )}
              </Button>
            </div>
            {updateStatus === 'available' && updateInfo && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-md space-y-2">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  New version available: {updateInfo.version}
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
            {updateStatus === 'downloading' && downloadProgress && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Downloading update...</span>
                  <span>{downloadProgress.percent.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress.percent}%` }}
                  />
                </div>
              </div>
            )}
            {updateStatus === 'downloaded' && updateInfo && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-md space-y-2">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  Update ready to install: {updateInfo.version}
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
            {updateStatus === 'not-available' && (
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  You&apos;re running the latest version
                </p>
              </div>
            )}
            {updateStatus === 'error' && updateError && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{updateError}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
