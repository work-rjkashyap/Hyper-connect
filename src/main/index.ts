import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getDeviceInfo } from './identity'
import { tcpServer } from './tcpServer'
import { discoveryManager } from './discovery'
import { setupIpc } from './ipc'
let mainWindow: BrowserWindow
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    show: false,
    title: 'HyperConnect',
    transparent: true,
    frame: false, // optional: removes window frame
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    backgroundColor: '#00000000', // Fully transparent
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true,
      webSecurity: !is.dev
    }
  })
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron.app')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  createWindow()
  // Initialize services - IMPORTANT: Setup IPC BEFORE starting discovery!
  console.log('Setting up IPC...')
  setupIpc(mainWindow) // Set up IPC listeners first

  try {
    const deviceInfo = getDeviceInfo()
    console.log('Got device info, starting TCP server...')
    const port = await tcpServer.start()
    console.log(`TCP server started on port ${port}, executing startDiscovery...`)

    discoveryManager.startDiscovery(deviceInfo, port) // Now safe to start discovery
    console.log('Discovery started.')

    discoveryManager.startHeartbeat() // Start the presence heartbeat check
    console.log('Heartbeat started.')
  } catch (error) {
    console.error('Failed to start services:', error)
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('will-quit', () => {
  console.log('App quitting, stopping services...')
  discoveryManager.stop()
  tcpServer.stop()
})
// Ensure cleanup on SIGINT/terminal close
process.on('SIGINT', () => {
  app.quit()
})
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
