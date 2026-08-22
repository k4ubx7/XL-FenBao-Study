import { create } from 'zustand'
import type {
  AppSettings,
  DownloadTask,
  QueueSnapshot,
  ResolveResult
} from '../../shared/contracts'

const emptySnapshot: QueueSnapshot = {
  tasks: [],
  history: [],
  resolvingCount: 0
}

const defaultSettings: AppSettings = {
  quality: 'medium',
  concurrency: 2,
  downloadRoot: '',
  openFolderOnComplete: false
}

export type MainView = 'queue' | 'history'

function sameHistoryTask(left: DownloadTask, right: DownloadTask): boolean {
  return (
    left.taskId === right.taskId &&
    left.status === right.status &&
    left.quality === right.quality &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.outputPath === right.outputPath &&
    left.error?.code === right.error?.code &&
    left.error?.message === right.error?.message &&
    left.metadata.sourceUrl === right.metadata.sourceUrl &&
    left.metadata.id === right.metadata.id &&
    left.metadata.platform === right.metadata.platform &&
    left.metadata.author === right.metadata.author &&
    left.metadata.title === right.metadata.title
  )
}

function sameHistory(
  left: DownloadTask[],
  right: DownloadTask[]
): boolean {
  return (
    left.length === right.length &&
    left.every((task, index) => sameHistoryTask(task, right[index]))
  )
}

interface ViewState {
  snapshot: QueueSnapshot
  settings: AppSettings
  settingsOpen: boolean
  mainView: MainView
  input: string
  submitting: boolean
  notice?: string
  error?: string
  setInput(value: string): void
  setSnapshot(value: QueueSnapshot): void
  setSettings(value: AppSettings): void
  setMainView(value: MainView): void
  toggleSettings(force?: boolean): void
  submit(): Promise<void>
  clearMessage(): void
}

function resultNotice(result: ResolveResult): string {
  if (result.added > 0) {
    const duplicate = result.duplicates > 0 ? `，跳过 ${result.duplicates} 条重复` : ''
    const failed = result.failed > 0 ? `，另有 ${result.failed} 条解析失败` : ''
    return `已加入 ${result.added} 个下载${duplicate}${failed}`
  }
  if (result.duplicates > 0) return '这些视频已经在队列或历史记录里了'
  if (result.failed > 0) {
    return (
      result.errorMessage ??
      '链接已识别，但视频解析失败，请确认链接仍然有效'
    )
  }
  return '没有识别到可下载的视频链接'
}

export const useFenbaoStore = create<ViewState>((set, get) => ({
  snapshot: emptySnapshot,
  settings: defaultSettings,
  settingsOpen: false,
  mainView: 'queue',
  input: '',
  submitting: false,
  setInput: (input) => set({ input, notice: undefined, error: undefined }),
  setSnapshot: (incoming) =>
    set((state) => ({
      snapshot: {
        ...incoming,
        history: sameHistory(state.snapshot.history, incoming.history)
          ? state.snapshot.history
          : incoming.history
      }
    })),
  setSettings: (settings) => set({ settings }),
  setMainView: (mainView) => set({ mainView }),
  toggleSettings: (force) =>
    set((state) => ({
      settingsOpen: force ?? !state.settingsOpen
    })),
  submit: async () => {
    const input = get().input
    if (!input.trim() || get().submitting) return

    set({ submitting: true, notice: undefined, error: undefined })
    try {
      const result = await window.fenbao.addInput(input)
      const failedOnly = result.added === 0 && result.failed > 0
      set({
        submitting: false,
        input: result.added > 0 ? '' : input,
        notice: failedOnly ? undefined : resultNotice(result),
        error: failedOnly ? resultNotice(result) : undefined
      })
    } catch (error) {
      set({
        submitting: false,
        error: error instanceof Error ? error.message : '添加下载失败'
      })
    }
  },
  clearMessage: () => set({ notice: undefined, error: undefined })
}))
