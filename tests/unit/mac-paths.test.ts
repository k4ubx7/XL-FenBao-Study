import { describe, expect, it } from 'vitest'
import { executableName, resolveAppPaths } from '../../src/main/paths'

const options = {
  packaged: true,
  platform: 'darwin' as const,
  executablePath: '/Applications/粉包学习记.app/Contents/MacOS/粉包学习记',
  projectRoot: '/Applications/粉包学习记.app/Contents/Resources/app.asar',
  userDataPath: '/Users/student/Library/Application Support/粉包学习记',
  downloadsPath: '/Users/student/Downloads',
  environment: {}
}

describe('macOS application paths', () => {
  it('keeps writable data outside the application bundle', () => {
    const paths = resolveAppPaths(options)
    expect(paths.data).toBe('/Users/student/Library/Application Support/粉包学习记')
    expect(paths.logs).toBe(`${paths.data}/logs`)
    expect(paths.downloads).toBe('/Users/student/Downloads/粉包学习记')
    expect(paths.ytDlp).toBe('/Applications/粉包学习记.app/Contents/Resources/bin/yt-dlp')
  })

  it('finds resources when launched from a read-only disk image', () => {
    const paths = resolveAppPaths({
      ...options,
      executablePath: '/Volumes/粉包学习记/粉包学习记.app/Contents/MacOS/粉包学习记',
      resourcesPath: '/Volumes/粉包学习记/粉包学习记.app/Contents/Resources'
    })
    expect(paths.ffmpegDir).toBe('/Volumes/粉包学习记/粉包学习记.app/Contents/Resources/bin')
    expect(paths.data).toBe(options.userDataPath)
    expect(paths.downloads).toBe('/Users/student/Downloads/粉包学习记')
  })

  it('honors isolated data and download overrides', () => {
    const paths = resolveAppPaths({
      ...options,
      environment: { FENBAO_DATA_ROOT: '/tmp/data', FENBAO_DOWNLOAD_ROOT: '/tmp/videos' }
    })
    expect(paths.data).toBe('/tmp/data')
    expect(paths.downloads).toBe('/tmp/videos')
  })

  it('keeps development files local to the project', () => {
    const paths = resolveAppPaths({ ...options, packaged: false, projectRoot: '/work/fenbao' })
    expect(paths.data).toBe('/work/fenbao/.dev-data')
    expect(paths.downloads).toBe('/work/fenbao/downloads')
    expect(paths.ytDlp).toBe('/work/fenbao/vendor/bin/yt-dlp')
  })

  it('uses native executable names for each platform', () => {
    expect(executableName('ffmpeg', 'darwin')).toBe('ffmpeg')
    expect(executableName('yt-dlp', 'darwin')).toBe('yt-dlp')
    expect(executableName('ffmpeg', 'win32')).toBe('ffmpeg.exe')
  })
})
