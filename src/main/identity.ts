import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { DeviceInfo } from '../shared/messageTypes'

const CONFIG_PATH = path.join(app.getPath('userData'), 'device-config.json')

export function getDeviceInfo(): DeviceInfo {
  let config: any = {}

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    } catch (e) {
      console.error('Failed to parse device config:', e)
    }
  }

  if (!config.deviceId) {
    config.deviceId = uuidv4()
    saveConfig(config)
  }

  if (!config.displayName) {
    config.displayName = os.hostname() || 'Unknown Device'
    saveConfig(config)
  }

  return {
    deviceId: config.deviceId,
    displayName: config.displayName,
    platform: process.platform,
    appVersion: app.getVersion()
  }
}

export function updateDisplayName(name: string): void {
  const config = loadConfig()
  config.displayName = name
  saveConfig(config)
}

function loadConfig(): any {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    } catch (e) {
      console.error('Failed to load config:', e)
    }
  }
  return {}
}

function saveConfig(config: any): void {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
  } catch (e) {
    console.error('Failed to save config:', e)
  }
}
