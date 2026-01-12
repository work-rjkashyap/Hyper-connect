import { systemPreferences, Notification } from 'electron'

export type PermissionType = 'notification' | 'camera' | 'microphone' | 'screen'
export type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'unknown'

class PermissionManager {
  async checkPermission(type: PermissionType): Promise<PermissionStatus> {
    if (process.platform !== 'darwin') {
      // For non-macOS platforms, we might generally assume 'granted' or 'unknown'
      // effectively letting the OS/browser handle it at point of use.
      // Notifications usually have a distinct check.
      if (type === 'notification') {
        return Notification.isSupported() ? 'granted' : 'denied'
      }
      return 'granted'
    }

    try {
      switch (type) {
        case 'camera':
          return systemPreferences.getMediaAccessStatus('camera') as PermissionStatus
        case 'microphone':
          return systemPreferences.getMediaAccessStatus('microphone') as PermissionStatus
        case 'screen':
          return systemPreferences.getMediaAccessStatus('screen') as PermissionStatus
        case 'notification':
          // Electron doesn't have a direct 'getAccessStatus' for notifications in systemPreferences
          // strictly like media, but usually it's handled via the Notification API.
          // However, on macOS, systemPreferences.getMediaAccessStatus doesn't cover notifications.
          // We'll rely on the renderer to check Notification.permission,
          // but for consistency we can return 'granted' if we can't check it here easily separately.
          // Or better, we just act as a pass-through or assume it's managed by the OS.
          return 'unknown'
        default:
          return 'unknown'
      }
    } catch (error) {
      console.error(`Failed to check permission for ${type}:`, error)
      return 'unknown'
    }
  }

  async requestPermission(type: PermissionType): Promise<boolean> {
    if (process.platform !== 'darwin') {
      return true
    }

    try {
      switch (type) {
        case 'camera':
          return await systemPreferences.askForMediaAccess('camera')
        case 'microphone':
          return await systemPreferences.askForMediaAccess('microphone')
        case 'screen':
          // Screen recording permission cannot be requested programmatically in the same way
          // to trigger a prompt if it was previously denied/closed, but we can try prompting
          // via a dummy Stream check or just opening settings.
          // Often just checking status communicates intent.
          // For now, we rely on the check.
          return (await this.checkPermission('screen')) === 'granted'
        default:
          return true
      }
    } catch (error) {
      console.error(`Failed to request permission for ${type}:`, error)
      return false
    }
  }
}

export const permissionManager = new PermissionManager()
