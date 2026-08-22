import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import {
  YtDlpProcessAdapter,
  type ProcessLike,
  type SpawnProcess
} from '../../src/main/downloads/yt-dlp'

type FakeProcess = EventEmitter &
  ProcessLike & {
  stdout: PassThrough
  stderr: PassThrough
  killed: boolean
}

function completedProcess(
  stdoutText: string,
  stderrText = '',
  exitCode = 0
): FakeProcess {
  const process = new EventEmitter() as unknown as FakeProcess
  process.stdout = new PassThrough()
  process.stderr = new PassThrough()
  process.killed = false
  process.kill = vi.fn(() => {
    process.killed = true
    return true
  })

  queueMicrotask(() => {
    process.stdout.end(stdoutText)
    process.stderr.end(stderrText)
    process.emit('close', exitCode, null)
  })
  return process
}

describe('YtDlpProcessAdapter', () => {
  it('resolves metadata with a fixed executable and URL as the final argument', async () => {
    const calls: Parameters<SpawnProcess>[] = []
    const spawnProcess: SpawnProcess = (file, args, options) => {
      calls.push([file, args, options])
      return completedProcess(
        JSON.stringify({
          id: '7539001',
          extractor_key: 'Douyin',
          uploader: '粉包老师',
          title: '如何学习',
          upload_date: '20260722',
          duration: 61,
          filesize_approx: 12_345,
          webpage_url: 'https://www.douyin.com/video/7539001'
        })
      )
    }
    const adapter = new YtDlpProcessAdapter({
      executable: 'D:\\app\\resources\\bin\\yt-dlp.exe',
      ffmpegDir: 'D:\\app\\resources\\bin',
      spawnProcess
    })

    await expect(
      adapter.resolve('https://v.douyin.com/demo/')
    ).resolves.toEqual([
      {
        sourceUrl: 'https://www.douyin.com/video/7539001',
        id: '7539001',
        platform: 'Douyin',
        author: '粉包老师',
        title: '如何学习',
        uploadDate: '20260722',
        durationSeconds: 61,
        expectedBytes: 12_345
      }
    ])

    expect(calls).toHaveLength(1)
    const [file, args, options] = calls[0]
    expect(file).toBe('D:\\app\\resources\\bin\\yt-dlp.exe')
    expect(args).toContain('--ignore-config')
    expect(args).toContain('--dump-single-json')
    expect(args.at(-1)).toBe('https://v.douyin.com/demo/')
    expect(options).toMatchObject({ shell: false, windowsHide: true })
  })

  it('downloads with quality, ffmpeg, output and progress arguments', async () => {
    const calls: Parameters<SpawnProcess>[] = []
    const spawnProcess: SpawnProcess = (file, args, options) => {
      calls.push([file, args, options])
      return completedProcess(
        'FENBAO:{"status":"downloading","downloaded":50,"total":100,"speed":10,"eta":5}\n'
      )
    }
    const adapter = new YtDlpProcessAdapter({
      executable: 'D:\\app\\resources\\bin\\yt-dlp.exe',
      ffmpegDir: 'D:\\app\\resources\\bin',
      spawnProcess
    })
    const onProgress = vi.fn()

    await adapter.download(
      {
        sourceUrl: 'https://example.test/video',
        outputTemplate: 'D:\\视频\\示例\\示例.%(ext)s',
        quality: 'medium'
      },
      onProgress,
      new AbortController().signal
    )

    const [, args, options] = calls[0]
    expect(args).toContain('--ignore-config')
    expect(args).toEqual(
      expect.arrayContaining([
        '--ffmpeg-location',
        'D:\\app\\resources\\bin',
        '-S',
        'res:720',
        '--merge-output-format',
        'mp4',
        '--recode-video',
        'mp4',
        '--output',
        'D:\\视频\\示例\\示例.%(ext)s',
        '--progress-template'
      ])
    )
    expect(args.at(-1)).toBe('https://example.test/video')
    expect(options.shell).toBe(false)
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'downloading', percent: 50 })
    )
  })

  it('adds Douyin referer and browser headers for a captured CDN URL', async () => {
    const calls: Parameters<SpawnProcess>[] = []
    const adapter = new YtDlpProcessAdapter({
      executable: 'yt-dlp.exe',
      ffmpegDir: '.',
      spawnProcess: (file, args, options) => {
        calls.push([file, args, options])
        return completedProcess('')
      }
    })

    await adapter.download(
      {
        sourceUrl:
          'https://v3-web.douyinvod.com/video/tos/demo.mp4?mime_type=video_mp4',
        outputTemplate: 'video.%(ext)s',
        quality: 'medium'
      },
      vi.fn(),
      new AbortController().signal
    )

    const [, args] = calls[0]
    expect(args).toEqual(
      expect.arrayContaining([
        '--add-header',
        'Referer:https://www.douyin.com/',
        '--user-agent'
      ])
    )
  })

  it('adds Douyin headers for an unknown CDN when the source platform is trusted', async () => {
    const calls: Parameters<SpawnProcess>[] = []
    const adapter = new YtDlpProcessAdapter({
      executable: 'yt-dlp.exe',
      ffmpegDir: '.',
      spawnProcess: (file, args, options) => {
        calls.push([file, args, options])
        return completedProcess('')
      }
    })

    await adapter.download(
      {
        sourceUrl: 'https://media-new.example/chunk/1',
        sourcePlatform: '抖音',
        outputTemplate: 'video.%(ext)s',
        quality: 'medium'
      },
      vi.fn(),
      new AbortController().signal
    )

    const [, args] = calls[0]
    expect(args).toEqual(
      expect.arrayContaining([
        '--add-header',
        'Referer:https://www.douyin.com/',
        '--user-agent'
      ])
    )
    const userAgentIndex = args.indexOf('--user-agent')
    expect(args[userAgentIndex + 1]).toContain('Chrome/138.0.0.0')
  })

  it('does not add Douyin headers for an unknown CDN from another platform', async () => {
    const calls: Parameters<SpawnProcess>[] = []
    const adapter = new YtDlpProcessAdapter({
      executable: 'yt-dlp.exe',
      ffmpegDir: '.',
      spawnProcess: (file, args, options) => {
        calls.push([file, args, options])
        return completedProcess('')
      }
    })

    await adapter.download(
      {
        sourceUrl: 'https://media-new.example/chunk/1',
        sourcePlatform: '其他平台',
        outputTemplate: 'video.%(ext)s',
        quality: 'medium'
      },
      vi.fn(),
      new AbortController().signal
    )

    const [, args] = calls[0]
    expect(args).not.toContain('Referer:https://www.douyin.com/')
    expect(args).not.toContain('--user-agent')
  })

  it('merges captured Douyin split video and audio tracks with ffmpeg', async () => {
    const calls: Parameters<SpawnProcess>[] = []
    const adapter = new YtDlpProcessAdapter({
      executable: 'D:\\app\\resources\\bin\\yt-dlp.exe',
      ffmpegDir: 'D:\\app\\resources\\bin',
      spawnProcess: (file, args, options) => {
        calls.push([file, args, options])
        return completedProcess('')
      }
    })
    const videoUrl =
      'https://v3-dy-o.zjcdn.com/video/media-video-avc1/?mime_type=video_mp4'
    const audioUrl =
      'https://v3-dy-o.zjcdn.com/video/media-audio-und-mp4a/?mime_type=video_mp4'
    const onProgress = vi.fn()

    await adapter.download(
      {
        sourceUrl: videoUrl,
        audioUrl,
        outputTemplate: 'D:\\视频\\示例\\示例.%(ext)s',
        quality: 'medium'
      } as Parameters<YtDlpProcessAdapter['download']>[0] & {
        audioUrl: string
      },
      onProgress,
      new AbortController().signal
    )

    const [file, args, options] = calls[0]
    expect(file).toBe('D:\\app\\resources\\bin\\ffmpeg.exe')
    expect(args).toEqual(
      expect.arrayContaining([
        '-i',
        videoUrl,
        '-i',
        audioUrl,
        '-map',
        '0:v:0',
        '-map',
        '1:a:0',
        '-c',
        'copy',
        'D:\\视频\\示例\\示例.mp4'
      ])
    )
    expect(options).toMatchObject({ shell: false, windowsHide: true })
    expect(onProgress).toHaveBeenCalledWith({ status: 'merging' })
  })

  it('terminates the child process when the request is aborted', async () => {
    const process = new EventEmitter() as unknown as FakeProcess
    process.stdout = new PassThrough()
    process.stderr = new PassThrough()
    process.killed = false
    process.kill = vi.fn(() => {
      process.killed = true
      queueMicrotask(() => process.emit('close', null, 'SIGTERM'))
      return true
    })
    const adapter = new YtDlpProcessAdapter({
      executable: 'yt-dlp.exe',
      ffmpegDir: '.',
      spawnProcess: () => process
    })
    const controller = new AbortController()

    const download = adapter.download(
      {
        sourceUrl: 'https://example.test/video',
        outputTemplate: 'video.%(ext)s',
        quality: 'low'
      },
      vi.fn(),
      controller.signal
    )
    controller.abort()

    await expect(download).rejects.toMatchObject({ name: 'AbortError' })
    expect(process.kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('returns a redacted and bounded process error', async () => {
    const adapter = new YtDlpProcessAdapter({
      executable: 'yt-dlp.exe',
      ffmpegDir: '.',
      spawnProcess: () =>
        completedProcess(
          '',
          `ERROR cookie=secret-value --username private@example.com ${'x'.repeat(2500)}`,
          1
        )
    })

    await expect(adapter.resolve('https://example.test/video')).rejects.toMatchObject(
      {
        message: expect.not.stringContaining('secret-value')
      }
    )
    await expect(adapter.resolve('https://example.test/video')).rejects.toMatchObject(
      {
        message: expect.not.stringContaining('private@example.com')
      }
    )
  })
})
