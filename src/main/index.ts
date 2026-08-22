import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  session,
  shell
} from 'electron'
import { join } from 'node:path'
import { DownloadQueue } from './downloads/queue'
import {
  BrowserDouyinResolver
} from './downloads/douyin-browser'
import { createDouyinPageCapture } from './downloads/playwright-douyin-capture'
import { SiteAwareDownloadAdapter } from './downloads/site-aware-adapter'
import { YtDlpProcessAdapter } from './downloads/yt-dlp'
import { registerIpcHandlers } from './ipc/register-ipc'
import { resolveAppPaths } from './paths'
import { createDefaultState } from './state/schema'
import { AtomicStateStore } from './state/store'
import { createWindowOptions } from './window-options'

const paths = resolveAppPaths({
  packaged: app.isPackaged,
  executablePath: process.execPath,
  projectRoot: app.getAppPath()
})

app.setPath('userData', paths.data)

function createWindow(): BrowserWindow {
  const window = new BrowserWindow(
    createWindowOptions(join(__dirname, '../preload/index.js'))
  )

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.on('will-attach-webview', (event) => event.preventDefault())
  window.once('ready-to-show', () => window.show())

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (rendererUrl) {
    void window.loadURL(rendererUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

async function bootstrap(): Promise<void> {
  await app.whenReady()

  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  )

  const store = new AtomicStateStore(
    join(paths.data, 'state.json'),
    join(paths.data, 'corrupt')
  )
  const defaults = createDefaultState(paths.downloads).settings
  const primaryAdapter = new YtDlpProcessAdapter({
    executable: paths.ytDlp,
    ffmpegDir: paths.ffmpegDir
  })
  const adapter = new SiteAwareDownloadAdapter(
    primaryAdapter,
    new BrowserDouyinResolver(
      createDouyinPageCapture(join(paths.data, 'douyin-browser'))
    )
  )
  const queue = new DownloadQueue({
    adapter,
    store,
    settings: () => defaults,
    paths,
    openFolder: async (path) => {
      if (process.env.FENBAO_DISABLE_AUTO_OPEN === '1') return
      await shell.openPath(path)
    }
  })
  await queue.initialize()

  registerIpcHandlers({ ipcMain, dialog, shell, queue })
  queue.subscribe((snapshot) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('queue:snapshot', snapshot)
    }
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
}

void bootstrap().catch((error: unknown) => {
  dialog.showErrorBox(
    '粉包学习记启动失败',
    error instanceof Error ? error.message : String(error)
  )
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
