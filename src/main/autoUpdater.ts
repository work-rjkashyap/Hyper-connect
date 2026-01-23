import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'
import type { UpdateInfo, DownloadProgress } from '@shared/updateTypes'

let mainWindow: BrowserWindow | null = null

// Configure auto-updater
autoUpdater.autoDownload = false // Don't auto-download, let user decide
autoUpdater.autoInstallOnAppQuit = true

export function initAutoUpdater(window: BrowserWindow): void {
  mainWindow = window

  // Set up event handlers
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...')
    mainWindow?.webContents.send('update-checking')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version)
    const updateInfo: UpdateInfo = {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseName: info.releaseName || undefined,
      releaseNotes: info.releaseNotes ? String(info.releaseNotes) : undefined
    }
    mainWindow?.webContents.send('update-available', updateInfo)
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available. Current version:', info.version)
    mainWindow?.webContents.send('update-not-available')
  })

  autoUpdater.on('download-progress', (progressObj) => {
    console.log(
      `Download progress: ${progressObj.percent.toFixed(2)}% (${progressObj.transferred}/${progressObj.total})`
    )
    const progress: DownloadProgress = {
      percent: progressObj.percent,
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total
    }
    mainWindow?.webContents.send('update-download-progress', progress)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version)
    const updateInfo: UpdateInfo = {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseName: info.releaseName || undefined,
      releaseNotes: info.releaseNotes ? String(info.releaseNotes) : undefined
    }
    mainWindow?.webContents.send('update-downloaded', updateInfo)
  })

  autoUpdater.on('error', (err) => {
    console.error('Update error:', err)
    mainWindow?.webContents.send('update-error', err.message)
  })
}

export async function checkForUpdates(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    console.error('Failed to check for updates:', error)
    throw error
  }
}

export async function downloadUpdate(): Promise<void> {
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    console.error('Failed to download update:', error)
    throw error
  }
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall(false, true)
}
