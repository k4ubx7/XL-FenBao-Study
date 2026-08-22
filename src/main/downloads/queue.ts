import { mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import type {
  AppSettings,
  DownloadTask,
  PersistedState,
  ProgressEvent,
  QueueSnapshot,
  ResolveResult,
  TaskStatus,
  VideoMetadata
} from '../../shared/contracts'
import { extractUrls } from '../input/extract-urls'
import { buildTargetPaths } from '../naming/file-names'
import { createDefaultState } from '../state/schema'
import type { AtomicStateStore } from '../state/store'
import type { YtDlpAdapter } from './yt-dlp'
import { ensureOutputReady } from '../errors/output-checks'
import { withNetworkRetry } from '../errors/retry'
import { toUserFacingError } from '../errors/user-errors'

interface DownloadQueueOptions {
  adapter: YtDlpAdapter
  store: AtomicStateStore
  settings: () => AppSettings
  paths: { downloads: string }
  retryDelays?: readonly number[]
  sleep?: (delay: number, signal?: AbortSignal) => Promise<void>
  openFolder?: (path: string) => Promise<void>
}

const HISTORY_LIMIT = 500
const PROGRESS_SAVE_INTERVAL_MS = 1_000
const SAFE_RESOLVER_MESSAGES = new Set([
  '抖音链接已失效或不是视频页面',
  '抖音暂时拒绝连接，请稍后重新点击下载',
  '系统未找到可用的 Edge 或 Chrome 浏览器',
  '抖音暂时没有返回视频流，请稍后重新点击下载',
  '抖音视频解析失败，请稍后重新点击下载',
  '登录未完成，请重新点击下载后在弹出的窗口登录'
])

function duplicateKey(metadata: VideoMetadata): string {
  return `${metadata.platform.trim().toLocaleLowerCase()}::${metadata.id.trim()}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function resolverFailureMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  if (SAFE_RESOLVER_MESSAGES.has(raw)) return raw
  return toUserFacingError(error).message
}

export class DownloadQueue {
  private state: PersistedState
  private resolvingCount = 0
  private runningCount = 0
  private readonly listeners = new Set<(snapshot: QueueSnapshot) => void>()
  private readonly controllers = new Map<string, AbortController>()
  private readonly lastProgressSave = new Map<string, number>()
  private mutation: Promise<void> = Promise.resolve()

  constructor(private readonly options: DownloadQueueOptions) {
    const settings = options.settings()
    this.state = {
      ...createDefaultState(settings.downloadRoot || options.paths.downloads),
      settings
    }
  }

  async initialize(): Promise<void> {
    await this.serialize(async () => {
      this.state = await this.options.store.load(this.state)
      this.notify()
    })
  }

  subscribe(listener: (snapshot: QueueSnapshot) => void): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => this.listeners.delete(listener)
  }

  async addInput(text: string): Promise<ResolveResult> {
    const urls = extractUrls(text)
    if (urls.length === 0) {
      return { added: 0, duplicates: 0, failed: 0 }
    }

    const result = await this.serialize(async () => {
      const outcome: ResolveResult = { added: 0, duplicates: 0, failed: 0 }
      const known = new Set(
        [...this.state.tasks, ...this.state.history].map((task) =>
          duplicateKey(task.metadata)
        )
      )
      this.resolvingCount += urls.length
      this.notify()

      for (const url of urls) {
        try {
          const metadataItems = await this.options.adapter.resolve(url)
          for (const metadata of metadataItems) {
            const key = duplicateKey(metadata)
            if (known.has(key)) {
              outcome.duplicates += 1
              continue
            }

            known.add(key)
            const timestamp = nowIso()
            const settings = this.state.settings
            const target = buildTargetPaths(
              settings.downloadRoot,
              metadata,
              new Date()
            )
            this.state.tasks.push({
              taskId: randomUUID(),
              status: 'queued',
              quality: settings.quality,
              metadata,
              createdAt: timestamp,
              updatedAt: timestamp,
              directory: target.directory,
              outputPath: target.video,
              temporaryTemplate: target.temporaryTemplate,
              attempts: 0
            })
            outcome.added += 1
          }
        } catch (error) {
          outcome.failed += 1
          if (!outcome.errorMessage) {
            outcome.errorMessage = resolverFailureMessage(error)
          }
        } finally {
          this.resolvingCount -= 1
          this.notify()
        }
      }

      await this.persist()
      return outcome
    })

    this.pump()
    return result
  }

  async cancel(taskId: string): Promise<void> {
    await this.serialize(async () => {
      const task = this.state.tasks.find((candidate) => candidate.taskId === taskId)
      if (!task) return

      const controller = this.controllers.get(taskId)
      if (controller) {
        controller.abort()
        return
      }

      this.finishTask(taskId, 'cancelled')
      await this.persist()
      this.notify()
    })
    this.pump()
  }

  async retry(taskId: string): Promise<void> {
    await this.serialize(async () => {
      const index = this.state.history.findIndex(
        (candidate) => candidate.taskId === taskId && candidate.status === 'failed'
      )
      if (index === -1) return

      const [task] = this.state.history.splice(index, 1)
      this.state.tasks.push({
        ...task,
        status: 'queued',
        updatedAt: nowIso(),
        progress: undefined,
        error: undefined,
        attempts: (task.attempts ?? 0) + 1
      })
      await this.persist()
      this.notify()
    })
    this.pump()
  }

  async resume(taskId: string): Promise<void> {
    await this.serialize(async () => {
      const task = this.state.tasks.find(
        (candidate) =>
          candidate.taskId === taskId && candidate.status === 'paused'
      )
      if (!task) return

      task.status = 'queued'
      task.updatedAt = nowIso()
      task.error = undefined
      await this.persist()
      this.notify()
    })
    this.pump()
  }

  async removeFromHistory(taskId: string): Promise<void> {
    await this.serialize(async () => {
      this.state.history = this.state.history.filter(
        (task) => task.taskId !== taskId
      )
      await this.persist()
      this.notify()
    })
  }

  snapshot(): QueueSnapshot {
    return structuredClone({
      tasks: this.state.tasks,
      history: this.state.history,
      resolvingCount: this.resolvingCount
    })
  }

  getSettings(): AppSettings {
    return structuredClone(this.state.settings)
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const settings = await this.serialize(async () => {
      this.state.settings = { ...this.state.settings, ...patch }
      await this.persist()
      this.notify()
      return this.getSettings()
    })
    this.pump()
    return settings
  }

  private serialize<T>(operation: () => Promise<T> | T): Promise<T> {
    const result = this.mutation.then(operation, operation)
    this.mutation = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  private notify(): void {
    const snapshot = this.snapshot()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }

  private async persist(): Promise<void> {
    await this.options.store.save(this.state)
  }

  private pump(): void {
    void this.serialize(async () => {
      const capacity = this.state.settings.concurrency - this.runningCount
      if (capacity <= 0) return [] as DownloadTask[]

      const selected = this.state.tasks
        .filter((task) => task.status === 'queued')
        .slice(0, capacity)

      for (const task of selected) {
        task.status = 'downloading'
        task.updatedAt = nowIso()
        this.runningCount += 1
        this.controllers.set(task.taskId, new AbortController())
      }

      if (selected.length > 0) {
        await this.persist()
        this.notify()
      }
      return selected.map((task) => structuredClone(task))
    }).then((selected) => {
      for (const task of selected) {
        void this.execute(task)
      }
    })
  }

  private async execute(taskSnapshot: DownloadTask): Promise<void> {
    const controller = this.controllers.get(taskSnapshot.taskId)
    if (!controller) return

    try {
      const target =
        taskSnapshot.directory &&
        taskSnapshot.outputPath &&
        taskSnapshot.temporaryTemplate
          ? {
              directory: taskSnapshot.directory,
              video: taskSnapshot.outputPath,
              temporaryTemplate: taskSnapshot.temporaryTemplate
            }
          : buildTargetPaths(
              this.state.settings.downloadRoot,
              taskSnapshot.metadata,
              new Date()
            )

      await ensureOutputReady(
        this.state.settings.downloadRoot,
        taskSnapshot.metadata.expectedBytes
      )
      await mkdir(target.directory, { recursive: true })
      await withNetworkRetry(
        () =>
          this.options.adapter.download(
            {
              sourceUrl: taskSnapshot.metadata.sourceUrl,
              audioUrl: taskSnapshot.metadata.audioUrl,
              sourcePlatform: taskSnapshot.metadata.platform,
              outputTemplate: target.temporaryTemplate,
              quality: taskSnapshot.quality
            },
            (event) => this.onProgress(taskSnapshot.taskId, event),
            controller.signal
          ),
        {
          delays: this.options.retryDelays,
          sleep: this.options.sleep,
          signal: controller.signal
        }
      )

      await this.serialize(async () => {
        const task = this.state.tasks.find(
          (candidate) => candidate.taskId === taskSnapshot.taskId
        )
        if (task) {
          task.directory = target.directory
          task.outputPath = target.video
          task.temporaryTemplate = target.temporaryTemplate
        }
        this.finishTask(taskSnapshot.taskId, 'completed')
        await this.persist()
        if (
          this.state.settings.openFolderOnComplete &&
          this.options.openFolder
        ) {
          await this.options.openFolder(target.directory).catch(() => undefined)
        }
        this.notify()
      })
    } catch (error) {
      await this.serialize(async () => {
        const status: TaskStatus =
          (error as Error).name === 'AbortError' || controller.signal.aborted
            ? 'cancelled'
            : 'failed'
        this.finishTask(taskSnapshot.taskId, status, error as Error)
        await this.persist()
        this.notify()
      })
    } finally {
      await this.serialize(() => {
        this.runningCount = Math.max(0, this.runningCount - 1)
        this.controllers.delete(taskSnapshot.taskId)
        this.lastProgressSave.delete(taskSnapshot.taskId)
      })
      this.pump()
    }
  }

  private onProgress(taskId: string, event: ProgressEvent): void {
    void this.serialize(async () => {
      const task = this.state.tasks.find((candidate) => candidate.taskId === taskId)
      if (!task) return

      const statusChanged = task.status !== event.status
      task.status = event.status
      task.updatedAt = nowIso()
      task.progress = {
        downloadedBytes: event.downloadedBytes,
        totalBytes: event.totalBytes,
        speedBytesPerSecond: event.speedBytesPerSecond,
        etaSeconds: event.etaSeconds,
        percent: event.percent
      }
      this.notify()

      const now = Date.now()
      const lastSaved = this.lastProgressSave.get(taskId) ?? 0
      if (statusChanged || now - lastSaved >= PROGRESS_SAVE_INTERVAL_MS) {
        this.lastProgressSave.set(taskId, now)
        await this.persist()
      }
    })
  }

  private finishTask(
    taskId: string,
    status: 'completed' | 'cancelled' | 'failed',
    error?: Error
  ): void {
    const index = this.state.tasks.findIndex((task) => task.taskId === taskId)
    if (index === -1) return

    const [task] = this.state.tasks.splice(index, 1)
    const userError = error ? toUserFacingError(error) : undefined
    const finished: DownloadTask = {
      ...task,
      status,
      updatedAt: nowIso(),
      ...(status === 'failed'
        ? {
            error: {
              code: userError?.code ?? 'PROCESS_FAILED',
              message: userError?.message ?? '下载失败'
            }
          }
        : { error: undefined }),
      ...(status === 'completed'
        ? { progress: { ...task.progress, percent: 100 } }
        : {})
    }
    this.state.history.unshift(finished)
    this.state.history = this.state.history.slice(0, HISTORY_LIMIT)
  }
}
