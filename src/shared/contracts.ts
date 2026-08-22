export type QualityPreset = 'low' | 'medium' | 'high' | 'best'

export type TaskStatus =
  | 'resolving'
  | 'queued'
  | 'downloading'
  | 'merging'
  | 'transcoding'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed'

export interface AppSettings {
  quality: QualityPreset
  concurrency: 1 | 2 | 3
  downloadRoot: string
  openFolderOnComplete: boolean
}

export interface VideoMetadata {
  sourceUrl: string
  audioUrl?: string
  id: string
  platform: string
  author: string
  title: string
  uploadDate?: string
  durationSeconds?: number
  expectedBytes?: number
}

export interface DownloadProgress {
  downloadedBytes?: number
  totalBytes?: number
  speedBytesPerSecond?: number
  etaSeconds?: number
  percent?: number
}

export interface ProgressEvent extends DownloadProgress {
  status: 'downloading' | 'merging' | 'transcoding'
}

export interface DownloadRequest {
  sourceUrl: string
  audioUrl?: string
  sourcePlatform?: string
  outputTemplate: string
  quality: QualityPreset
}

export interface TaskError {
  code: string
  message: string
}

export interface DownloadTask {
  taskId: string
  status: TaskStatus
  quality: QualityPreset
  metadata: VideoMetadata
  createdAt: string
  updatedAt: string
  directory?: string
  outputPath?: string
  temporaryTemplate?: string
  progress?: DownloadProgress
  error?: TaskError
  attempts?: number
}

export interface PersistedState {
  version: 1
  settings: AppSettings
  tasks: DownloadTask[]
  history: DownloadTask[]
}

export interface QueueSnapshot {
  tasks: DownloadTask[]
  history: DownloadTask[]
  resolvingCount: number
}

export interface ResolveResult {
  added: number
  duplicates: number
  failed: number
  errorMessage?: string
}

export interface FenbaoApi {
  getSnapshot(): Promise<QueueSnapshot>
  addInput(text: string): Promise<ResolveResult>
  cancelTask(taskId: string): Promise<void>
  retryTask(taskId: string): Promise<void>
  resumeTask(taskId: string): Promise<void>
  getSettings(): Promise<AppSettings>
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  chooseDownloadRoot(): Promise<AppSettings>
  openTaskFolder(taskId: string): Promise<void>
  onSnapshot(listener: (snapshot: QueueSnapshot) => void): () => void
}
