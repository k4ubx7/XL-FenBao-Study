import { spawn } from 'node:child_process'
import { join } from 'node:path'
import type { Readable } from 'node:stream'
import type {
  DownloadRequest,
  ProgressEvent,
  VideoMetadata
} from '../../shared/contracts'
import { downloadOutputArgs, qualityArgs } from './quality'
import { parseProgressLine } from './progress'

const MAX_METADATA_BYTES = 20 * 1024 * 1024
const MAX_ERROR_CHARACTERS = 2_000
const DOUYIN_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export interface ProcessLike {
  stdout: Readable
  stderr: Readable
  once(event: 'error', listener: (error: Error) => void): this
  once(
    event: 'close',
    listener: (code: number | null, signal: NodeJS.Signals | null) => void
  ): this
  kill(signal?: NodeJS.Signals): boolean
}

export interface SpawnOptions {
  shell: false
  windowsHide: true
}

export type SpawnProcess = (
  file: string,
  args: readonly string[],
  options: SpawnOptions
) => ProcessLike

export interface YtDlpAdapter {
  resolve(url: string, signal?: AbortSignal): Promise<VideoMetadata[]>
  download(
    request: DownloadRequest,
    onProgress: (event: ProgressEvent) => void,
    signal: AbortSignal
  ): Promise<void>
}

interface AdapterOptions {
  executable: string
  ffmpegDir: string
  spawnProcess?: SpawnProcess
}

interface ProcessResult {
  stdout: string
  stderr: string
}

function abortError(): Error {
  const error = new Error('操作已取消')
  error.name = 'AbortError'
  return error
}

function safeProcessMessage(stderr: string): string {
  const redacted = stderr
    .replace(
      /\b(cookie(?:file)?|token|authorization)\s*[=:]\s*\S+/giu,
      '$1=[已隐藏]'
    )
    .replace(
      /(--cookies(?:-from-browser)?|--username|--password)\s+\S+/giu,
      '$1 [已隐藏]'
    )
    .trim()

  return (redacted || '下载工具返回了未知错误').slice(0, MAX_ERROR_CHARACTERS)
}

function emitLines(stream: Readable, listener: (line: string) => void): void {
  let buffered = ''
  stream.setEncoding('utf8')
  stream.on('data', (chunk: string) => {
    buffered += chunk
    const lines = buffered.split(/\r?\n/gu)
    buffered = lines.pop() ?? ''
    for (const line of lines) {
      listener(line)
    }
  })
  stream.on('end', () => {
    if (buffered) {
      listener(buffered)
    }
  })
}

function sourceHeaderArgs(
  sourceUrl: string,
  sourcePlatform?: string
): string[] {
  if (sourcePlatform === '抖音') {
    return [
      '--add-header',
      'Referer:https://www.douyin.com/',
      '--user-agent',
      DOUYIN_USER_AGENT
    ]
  }
  try {
    const hostname = new URL(sourceUrl).hostname.toLowerCase()
    if (
      hostname === 'douyinvod.com' ||
      hostname.endsWith('.douyinvod.com') ||
      hostname === 'zjcdn.com' ||
      hostname.endsWith('.zjcdn.com')
    ) {
      return [
        '--add-header',
        'Referer:https://www.douyin.com/',
        '--user-agent',
        DOUYIN_USER_AGENT
      ]
    }
  } catch {
    // URL validation happens before the adapter is called.
  }
  return []
}

function metadataFromJson(
  raw: Record<string, unknown>,
  fallbackUrl: string
): VideoMetadata {
  const id = String(raw.id ?? '').trim()
  const title = String(raw.title ?? '').trim()
  if (!id || !title) {
    throw new Error('视频信息缺少标题或 ID')
  }

  const expectedBytes =
    typeof raw.filesize === 'number'
      ? raw.filesize
      : typeof raw.filesize_approx === 'number'
        ? raw.filesize_approx
        : undefined

  return {
    sourceUrl:
      typeof raw.webpage_url === 'string' ? raw.webpage_url : fallbackUrl,
    id,
    platform: String(raw.extractor_key ?? raw.extractor ?? '未知平台'),
    author: String(
      raw.uploader ?? raw.channel ?? raw.creator ?? raw.artist ?? '未知作者'
    ),
    title,
    ...(typeof raw.upload_date === 'string'
      ? { uploadDate: raw.upload_date }
      : {}),
    ...(typeof raw.duration === 'number'
      ? { durationSeconds: raw.duration }
      : {}),
    ...(expectedBytes === undefined ? {} : { expectedBytes })
  }
}

export class YtDlpProcessAdapter implements YtDlpAdapter {
  private readonly spawnProcess: SpawnProcess

  constructor(private readonly options: AdapterOptions) {
    this.spawnProcess =
      options.spawnProcess ??
      ((file, args, spawnOptions) =>
        spawn(file, [...args], spawnOptions) as ProcessLike)
  }

  async resolve(url: string, signal?: AbortSignal): Promise<VideoMetadata[]> {
    const result = await this.run(
      ['--dump-single-json', '--no-warnings', '--', url],
      signal
    )

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(result.stdout) as Record<string, unknown>
    } catch {
      throw new Error('无法解析视频信息')
    }

    const entries = Array.isArray(parsed.entries)
      ? parsed.entries.filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === 'object' && entry !== null
        )
      : [parsed]

    return entries.map((entry) => metadataFromJson(entry, url))
  }

  async download(
    request: DownloadRequest,
    onProgress: (event: ProgressEvent) => void,
    signal: AbortSignal
  ): Promise<void> {
    if (request.audioUrl) {
      onProgress({ status: 'merging' })
      const headers =
        `Referer: https://www.douyin.com/\r\n` +
        `User-Agent: ${DOUYIN_USER_AGENT}\r\n`
      const outputPath = request.outputTemplate.replace(
        /%\(ext\)s/gu,
        'mp4'
      )
      await this.runBinary(
        join(this.options.ffmpegDir, 'ffmpeg.exe'),
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-headers',
          headers,
          '-i',
          request.sourceUrl,
          '-headers',
          headers,
          '-i',
          request.audioUrl,
          '-map',
          '0:v:0',
          '-map',
          '1:a:0',
          '-c',
          'copy',
          '-movflags',
          '+faststart',
          outputPath
        ],
        signal
      )
      return
    }

    const progressTemplate =
      'download:FENBAO:{"status":"downloading","downloaded":"%(progress.downloaded_bytes)s","total":"%(progress.total_bytes,progress.total_bytes_estimate)s","speed":"%(progress.speed)s","eta":"%(progress.eta)s"}'

    await this.run(
      [
        '--ffmpeg-location',
        this.options.ffmpegDir,
        ...sourceHeaderArgs(request.sourceUrl, request.sourcePlatform),
        ...qualityArgs(request.quality),
        ...downloadOutputArgs(),
        '--progress-template',
        progressTemplate,
        '--output',
        request.outputTemplate,
        '--',
        request.sourceUrl
      ],
      signal,
      (line) => {
        const event = parseProgressLine(line)
        if (event) {
          onProgress(event)
        }
      }
    )
  }

  private run(
    args: readonly string[],
    signal?: AbortSignal,
    onLine?: (line: string) => void
  ): Promise<ProcessResult> {
    return this.runBinary(
      this.options.executable,
      ['--ignore-config', ...args],
      signal,
      onLine
    )
  }

  private runBinary(
    executable: string,
    args: readonly string[],
    signal?: AbortSignal,
    onLine?: (line: string) => void
  ): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(abortError())
        return
      }

      const child = this.spawnProcess(
        executable,
        args,
        {
          shell: false,
          windowsHide: true
        }
      )
      let stdout = ''
      let stderr = ''
      let stdoutBytes = 0
      let settled = false

      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        stdoutBytes += Buffer.byteLength(chunk)
        if (stdoutBytes <= MAX_METADATA_BYTES) {
          stdout += chunk
        } else if (!settled) {
          child.kill('SIGTERM')
          settled = true
          reject(new Error('视频信息超过安全大小限制'))
        }
      })

      child.stderr.setEncoding('utf8')
      child.stderr.on('data', (chunk: string) => {
        if (stderr.length < MAX_METADATA_BYTES) {
          stderr += chunk
        }
      })

      if (onLine) {
        emitLines(child.stdout, onLine)
        emitLines(child.stderr, onLine)
      }

      const handleAbort = (): void => {
        child.kill('SIGTERM')
      }
      signal?.addEventListener('abort', handleAbort, { once: true })

      child.once('error', (error) => {
        if (!settled) {
          settled = true
          signal?.removeEventListener('abort', handleAbort)
          reject(error)
        }
      })

      child.once('close', (code) => {
        if (settled) {
          return
        }
        settled = true
        signal?.removeEventListener('abort', handleAbort)

        if (signal?.aborted) {
          reject(abortError())
        } else if (code === 0) {
          resolve({ stdout, stderr })
        } else {
          reject(new Error(safeProcessMessage(stderr)))
        }
      })
    })
  }
}
