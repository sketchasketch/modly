import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { existsSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { logger } from './logger'

type WindowGetter = () => BrowserWindow | null

function pendingFilePath(): string {
  return join(app.getPath('userData'), '.last-update-installer')
}

function cleanupLastInstaller(): void {
  const marker = pendingFilePath()
  if (!existsSync(marker)) return
  try {
    const installerPath = readFileSync(marker, 'utf-8').trim()
    if (existsSync(installerPath)) {
      rmSync(installerPath)
      logger.info(`[updater] Cleaned up installer: ${installerPath}`)
    }
    rmSync(marker)
  } catch {}
}

export function initAutoUpdater(getWindow: WindowGetter): void {
  cleanupLastInstaller()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  autoUpdater.logger = logger as any
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.disableWebInstaller = true

  autoUpdater.on('update-available', (info) => {
    const running = app.getVersion()
    const incoming = info.version
    const [rMaj, rMin] = running.split('.').map(Number)
    const [iMaj, iMin] = incoming.split('.').map(Number)
    const isPatch = rMaj === iMaj && rMin === iMin

    if (isPatch) {
      logger.info(`[updater] Patch update ${incoming} available — downloading silently`)
      autoUpdater.downloadUpdate().catch((err: Error) => {
        logger.error(`[updater] Download failed: ${err.message}`)
      })
    } else {
      logger.info(`[updater] Major/minor update ${incoming} available — notifying renderer`)
      getWindow()?.webContents.send('updater:major-minor-available', { version: incoming })
    }
  })

  autoUpdater.on('update-downloaded', (info) => {
    logger.info(`[updater] Patch update ${info.version} downloaded — showing badge`)
    try {
      writeFileSync(pendingFilePath(), info.downloadedFile, 'utf-8')
    } catch {}
    getWindow()?.webContents.send('updater:patch-ready', { version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    logger.info('[updater] App is up to date')
  })

  autoUpdater.on('error', (err: Error) => {
    logger.error(`[updater] Error: ${err.message}`)
  })
}
