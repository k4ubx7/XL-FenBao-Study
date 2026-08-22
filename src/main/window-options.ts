import type { BrowserWindowConstructorOptions } from 'electron'

export function createWindowOptions(
  preloadPath: string
): BrowserWindowConstructorOptions {
  return {
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: '#0b1020',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0b1020',
      symbolColor: '#c7d7ec',
      height: 42
    },
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false
    }
  }
}
