import { posix, win32 } from 'node:path'
import { homedir } from 'node:os'

export function executableName(name: string, platform = process.platform): string {
  return platform === 'win32' ? `${name}.exe` : name
}

export interface AppPaths {
  root: string
  data: string
  logs: string
  downloads: string
  ytDlp: string
  ffmpegDir: string
}

interface ResolveAppPathsOptions {
  packaged: boolean
  executablePath: string
  projectRoot: string
  environment?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  resourcesPath?: string
  userDataPath?: string
  downloadsPath?: string
}

export function resolveAppPaths({
  packaged,
  executablePath,
  projectRoot,
  environment = process.env,
  platform = process.platform,
  resourcesPath,
  userDataPath,
  downloadsPath
}: ResolveAppPathsOptions): AppPaths {
  const { dirname, join, resolve } = platform === 'win32' ? win32 : posix
  const root = packaged ? dirname(executablePath) : resolve(projectRoot)
  const macPackaged = packaged && platform === 'darwin'
  const data =
    environment.FENBAO_DATA_ROOT ||
    (macPackaged
      ? userDataPath || join(homedir(), 'Library', 'Application Support', '粉包学习记')
      : packaged ? join(root, 'data') : join(root, '.dev-data'))
  const downloads =
    environment.FENBAO_DOWNLOAD_ROOT ||
    (macPackaged
      ? join(downloadsPath || join(homedir(), 'Downloads'), '粉包学习记')
      : join(root, 'downloads'))
  const ffmpegDir = packaged
    ? join(resourcesPath || (macPackaged ? join(root, '..', 'Resources') : join(root, 'resources')), 'bin')
    : join(root, 'vendor', 'bin')

  return {
    root,
    data,
    logs: join(data, 'logs'),
    downloads,
    ytDlp: join(ffmpegDir, executableName('yt-dlp', platform)),
    ffmpegDir
  }
}
