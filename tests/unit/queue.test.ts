import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DownloadQueue } from '../../src/main/downloads/queue'
import { createDefaultState } from '../../src/main/state/schema'
import { AtomicStateStore } from '../../src/main/state/store'
import type {
  AppSettings,
  DownloadRequest,
  ProgressEvent,
  VideoMetadata
} from '../../src/shared/contracts'
import type { YtDlpAdapter } from '../../src/main/downloads/yt-dlp'

interface PendingDownload {
  request: DownloadRequest
  progress: (event: ProgressEvent) => void
  complete(): void
  fail(message?: string): void
}

class DeferredAdapter implements YtDlpAdapter {
  readonly pending: PendingDownload[] = []
  active = 0
  maxActive = 0
  failNewDownloads = false
  networkFailuresRemaining = 0
  duplicateId: string | undefined
  expectedBytes: number | undefined
  audioUrl: string | undefined

  async resolve(url: string): Promise<VideoMetadata[]> {
    const slug = new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? 'video'
    return [
      {
        sourceUrl: url,
        id: this.duplicateId ?? slug,
        platform: '测试平台',
        author: '测试作者',
        title: `测试视频 ${slug}`,
        uploadDate: '20260723',
        ...(this.expectedBytes === undefined
          ? {}
          : { expectedBytes: this.expectedBytes }),
        ...(this.audioUrl === undefined ? {} : { audioUrl: this.audioUrl })
      }
    ]
  }

  download(
    request: DownloadRequest,
    progress: (event: ProgressEvent) => void,
    signal: AbortSignal
  ): Promise<void> {
    this.active += 1
    this.maxActive = Math.max(this.maxActive, this.active)

    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (result: 'complete' | 'fail' | 'abort', message?: string) => {
        if (settled) return
        settled = true
        this.active -= 1
        if (result === 'complete') {
          resolve()
        } else {
          const error = new Error(message ?? 'network failed')
          if (result === 'abort') error.name = 'AbortError'
          reject(error)
        }
      }

      signal.addEventListener('abort', () => finish('abort'), { once: true })
      const pending: PendingDownload = {
        request,
        progress,
        complete: () => finish('complete'),
        fail: (message) => finish('fail', message)
      }
      this.pending.push(pending)

      if (this.networkFailuresRemaining > 0) {
        this.networkFailuresRemaining -= 1
        queueMicrotask(() => pending.fail('network connection failed'))
      } else if (this.failNewDownloads) {
        queueMicrotask(() => pending.fail('process failed'))
      }
    })
  }
}

interface Harness {
  root: string
  adapter: DeferredAdapter
  store: AtomicStateStore
  settings: AppSettings
  queue: DownloadQueue
}

const temporaryDirectories: string[] = []

async function createHarness(concurrency: 1 | 2 | 3 = 2): Promise<Harness> {
  const root = await mkdtemp(join(tmpdir(), 'fenbao-queue-'))
  temporaryDirectories.push(root)
  const adapter = new DeferredAdapter()
  const store = new AtomicStateStore(
    join(root, 'data', 'state.json'),
    join(root, 'data', 'corrupt')
  )
  const settings: AppSettings = {
    quality: 'medium',
    concurrency,
    downloadRoot: join(root, 'downloads'),
    openFolderOnComplete: false
  }
  const queue = new DownloadQueue({
    adapter,
    store,
    settings: () => settings,
    paths: { downloads: settings.downloadRoot }
  })
  await queue.initialize()
  return { root, adapter, store, settings, queue }
}

async function waitForStatus(
  queue: DownloadQueue,
  status: string,
  count = 1
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${count} ${status} task(s)`)),
      5_000
    )
    let unsubscribe = (): void => {}
    unsubscribe = queue.subscribe((snapshot) => {
      const all = [...snapshot.tasks, ...snapshot.history]
      if (all.filter((task) => task.status === status).length === count) {
        clearTimeout(timeout)
        queueMicrotask(unsubscribe)
        resolve()
      }
    })
  })
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe('DownloadQueue', () => {
  it('runs no more than the configured concurrency', async () => {
    const { queue, adapter } = await createHarness(2)

    await queue.addInput(
      [
        'https://example.test/one',
        'https://example.test/two',
        'https://example.test/three'
      ].join('\n')
    )
    await vi.waitFor(() => expect(adapter.active).toBe(2))
    expect(adapter.maxActive).toBe(2)

    adapter.pending[0].complete()
    await vi.waitFor(() => expect(adapter.pending).toHaveLength(3))
    expect(adapter.maxActive).toBe(2)

    const completed = waitForStatus(queue, 'completed', 3)
    adapter.pending[1].complete()
    adapter.pending[2].complete()
    await completed
  })

  it('deduplicates platform and video ID across different input URLs', async () => {
    const { queue, adapter } = await createHarness(1)
    adapter.duplicateId = 'same-video'

    const result = await queue.addInput(
      'https://example.test/short\nhttps://example.test/canonical'
    )

    expect(result).toEqual({ added: 1, duplicates: 1, failed: 0 })
    expect(queue.snapshot().tasks).toHaveLength(1)
    await vi.waitFor(() => expect(adapter.pending).toHaveLength(1))
    const completed = waitForStatus(queue, 'completed')
    adapter.pending[0].complete()
    await completed
  })

  it('returns the safe resolver reason when a recognized URL fails', async () => {
    const { queue, adapter } = await createHarness(1)
    vi.spyOn(adapter, 'resolve').mockRejectedValueOnce(
      new Error('抖音暂时拒绝连接，请稍后重新点击下载')
    )

    await expect(
      queue.addInput('https://v.douyin.com/example/')
    ).resolves.toEqual({
      added: 0,
      duplicates: 0,
      failed: 1,
      errorMessage: '抖音暂时拒绝连接，请稍后重新点击下载'
    })
  })

  it('does not expose raw resolver diagnostics in the interface', async () => {
    const { queue, adapter } = await createHarness(1)
    vi.spyOn(adapter, 'resolve').mockRejectedValueOnce(
      new Error('spawn C:\\secret\\private-tool.exe ENOENT --token=private')
    )

    const result = await queue.addInput('https://example.test/private-error')

    expect(result.errorMessage).toBe(
      '下载工具未能完成任务，请检查链接后重试。'
    )
    expect(result.errorMessage).not.toContain('secret')
    expect(result.errorMessage).not.toContain('private')
  })

  it('returns the local login instruction when interactive login times out', async () => {
    const { queue, adapter } = await createHarness(1)
    vi.spyOn(adapter, 'resolve').mockRejectedValueOnce(
      new Error('登录未完成，请重新点击下载后在弹出的窗口登录')
    )

    const result = await queue.addInput('https://v.douyin.com/login-needed/')

    expect(result.errorMessage).toBe(
      '登录未完成，请重新点击下载后在弹出的窗口登录'
    )
  })

  it('publishes progress updates to subscribers', async () => {
    const { queue, adapter } = await createHarness(1)
    const snapshots = vi.fn()
    queue.subscribe(snapshots)
    await queue.addInput('https://example.test/progress')
    await vi.waitFor(() => expect(adapter.pending).toHaveLength(1))

    adapter.pending[0].progress({
      status: 'downloading',
      downloadedBytes: 50,
      totalBytes: 100,
      percent: 50
    })

    await vi.waitFor(() =>
      expect(queue.snapshot().tasks[0].progress?.percent).toBe(50)
    )
    expect(snapshots).toHaveBeenCalled()
    const completed = waitForStatus(queue, 'completed')
    adapter.pending[0].complete()
    await completed
  })

  it('passes a captured split audio track to the downloader', async () => {
    const { queue, adapter } = await createHarness(1)
    adapter.audioUrl =
      'https://v3-dy-o.zjcdn.com/video/media-audio-und-mp4a/?mime_type=video_mp4'

    await queue.addInput('https://example.test/split-media')
    await vi.waitFor(() => expect(adapter.pending).toHaveLength(1))

    expect(
      (
        adapter.pending[0].request as DownloadRequest & {
          audioUrl?: string
        }
      ).audioUrl
    ).toBe(adapter.audioUrl)

    const completed = waitForStatus(queue, 'completed')
    adapter.pending[0].complete()
    await completed
  })

  it('passes the resolved platform to the downloader as trusted source context', async () => {
    const { queue, adapter } = await createHarness(1)
    vi.spyOn(adapter, 'resolve').mockResolvedValueOnce([
      {
        sourceUrl: 'https://media-new.example/chunk/1',
        id: '7647483788033843429',
        platform: '抖音',
        author: '粉包课堂',
        title: '动态 CDN 视频'
      }
    ])

    await queue.addInput('https://www.douyin.com/video/7647483788033843429')
    await vi.waitFor(() => expect(adapter.pending).toHaveLength(1))

    expect(adapter.pending[0].request.sourcePlatform).toBe('抖音')

    const completed = waitForStatus(queue, 'completed')
    adapter.pending[0].complete()
    await completed
  })

  it('cancels a running task through its abort signal', async () => {
    const { queue, adapter } = await createHarness(1)
    await queue.addInput('https://example.test/cancel-me')
    await vi.waitFor(() => expect(adapter.active).toBe(1))
    const taskId = queue.snapshot().tasks[0].taskId

    const cancelled = waitForStatus(queue, 'cancelled')
    await queue.cancel(taskId)
    await cancelled
    expect(adapter.active).toBe(0)
  })

  it('retries a failed task and completes it', async () => {
    const { queue, adapter } = await createHarness(1)
    adapter.failNewDownloads = true
    const failed = waitForStatus(queue, 'failed')
    await queue.addInput('https://example.test/retry-me')
    await failed
    const taskId = queue.snapshot().history[0].taskId

    adapter.failNewDownloads = false
    await queue.retry(taskId)
    await vi.waitFor(() => expect(adapter.pending).toHaveLength(2))
    const completed = waitForStatus(queue, 'completed')
    adapter.pending[1].complete()
    await completed
  })

  it('restores interrupted work as paused and can resume it', async () => {
    const first = await createHarness(1)
    const state = {
      ...createDefaultState(first.settings.downloadRoot),
      settings: first.settings,
      tasks: [
        {
          taskId: 'restored-task',
          status: 'downloading' as const,
          quality: 'medium' as const,
          metadata: {
            sourceUrl: 'https://example.test/restored',
            id: 'restored',
            platform: '测试平台',
            author: '测试作者',
            title: '恢复下载'
          },
          createdAt: '2026-07-23T08:00:00.000Z',
          updatedAt: '2026-07-23T08:00:00.000Z'
        }
      ]
    }
    await first.store.save(state)

    const queue = new DownloadQueue({
      adapter: first.adapter,
      store: first.store,
      settings: () => first.settings,
      paths: { downloads: first.settings.downloadRoot }
    })
    await queue.initialize()
    expect(queue.snapshot().tasks[0].status).toBe('paused')

    await queue.resume('restored-task')
    await vi.waitFor(() => expect(first.adapter.active).toBe(1))
    const completed = waitForStatus(queue, 'completed')
    first.adapter.pending[0].complete()
    await completed
  })

  it('updates settings atomically and restores them on the next launch', async () => {
    const first = await createHarness(1)

    await first.queue.updateSettings({
      quality: 'high',
      concurrency: 3
    })
    expect(first.queue.getSettings()).toMatchObject({
      quality: 'high',
      concurrency: 3
    })
    await first.queue.addInput('https://example.test/after-settings')
    await vi.waitFor(() => expect(first.adapter.pending).toHaveLength(1))
    expect(first.adapter.pending[0].request.quality).toBe('high')
    const completed = waitForStatus(first.queue, 'completed')
    first.adapter.pending[0].complete()
    await completed

    const restored = new DownloadQueue({
      adapter: first.adapter,
      store: first.store,
      settings: () => first.settings,
      paths: { downloads: first.settings.downloadRoot }
    })
    await restored.initialize()

    expect(restored.getSettings()).toMatchObject({
      quality: 'high',
      concurrency: 3
    })
  })

  it('checks free space before launching the child process', async () => {
    const { queue, adapter } = await createHarness(1)
    adapter.expectedBytes = Number.MAX_SAFE_INTEGER
    const failed = waitForStatus(queue, 'failed')

    await queue.addInput('https://example.test/too-large')
    await failed

    expect(adapter.pending).toHaveLength(0)
    expect(queue.snapshot().history[0].error?.code).toBe('DISK_FULL')
  })

  it('retries a network failure before marking the task failed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fenbao-queue-'))
    temporaryDirectories.push(root)
    const adapter = new DeferredAdapter()
    adapter.networkFailuresRemaining = 1
    const store = new AtomicStateStore(
      join(root, 'data', 'state.json'),
      join(root, 'data', 'corrupt')
    )
    const settings: AppSettings = {
      quality: 'medium',
      concurrency: 1,
      downloadRoot: join(root, 'downloads'),
      openFolderOnComplete: false
    }
    const queue = new DownloadQueue({
      adapter,
      store,
      settings: () => settings,
      paths: { downloads: settings.downloadRoot },
      retryDelays: [0],
      sleep: async () => undefined
    })
    await queue.initialize()

    await queue.addInput('https://example.test/flaky')
    await vi.waitFor(() => expect(adapter.pending).toHaveLength(2))
    const completed = waitForStatus(queue, 'completed')
    adapter.pending[1].complete()
    await completed

    expect(queue.snapshot().history[0].status).toBe('completed')
  })

  it('opens the task folder after completion when the setting is enabled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fenbao-queue-'))
    temporaryDirectories.push(root)
    const adapter = new DeferredAdapter()
    const store = new AtomicStateStore(
      join(root, 'data', 'state.json'),
      join(root, 'data', 'corrupt')
    )
    const settings: AppSettings = {
      quality: 'medium',
      concurrency: 1,
      downloadRoot: join(root, 'downloads'),
      openFolderOnComplete: true
    }
    const openFolder = vi.fn().mockResolvedValue(undefined)
    const queue = new DownloadQueue({
      adapter,
      store,
      settings: () => settings,
      paths: { downloads: settings.downloadRoot },
      openFolder
    })
    await queue.initialize()

    await queue.addInput('https://example.test/open-folder')
    await vi.waitFor(() => expect(adapter.pending).toHaveLength(1))
    const directory = queue.snapshot().tasks[0].directory
    const completed = waitForStatus(queue, 'completed')
    adapter.pending[0].complete()
    await completed

    expect(openFolder).toHaveBeenCalledWith(directory)
  })
})
