import { dirname, join, resolve } from 'node:path'

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
}

export function resolveAppPaths({
  packaged,
  executablePath,
  projectRoot,
  environment = process.env
}: ResolveAppPathsOptions): AppPaths {
  const root = packaged ? dirname(executablePath) : resolve(projectRoot)
  const data =
    environment.FENBAO_DATA_ROOT ||
    (packaged ? join(root, 'data') : join(root, '.dev-data'))
  const downloads =
    environment.FENBAO_DOWNLOAD_ROOT || join(root, 'downloads')
  const ffmpegDir = packaged
    ? join(root, 'resources', 'bin')
    : join(root, 'vendor', 'bin')

  return {
    root,
    data,
    logs: join(data, 'logs'),
    downloads,
    ytDlp: join(ffmpegDir, 'yt-dlp.exe'),
    ffmpegDir
  }
}
