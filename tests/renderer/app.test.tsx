// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/renderer/src/App'
import { useFenbaoStore } from '../../src/renderer/src/store'
import type {
  AppSettings,
  DownloadTask,
  FenbaoApi,
  QueueSnapshot
} from '../../src/shared/contracts'

const emptySnapshot: QueueSnapshot = {
  tasks: [],
  history: [],
  resolvingCount: 0
}

const defaultSettings: AppSettings = {
  quality: 'medium',
  concurrency: 2,
  downloadRoot: 'D:\\粉包学习记\\downloads',
  openFolderOnComplete: false
}

const defaultUiSettings: AppSettings = {
  quality: 'medium',
  concurrency: 2,
  downloadRoot: '',
  openFolderOnComplete: false
}

function createHistoryTask(
  index: number,
  status: DownloadTask['status'] = 'completed'
): DownloadTask {
  return {
    taskId: `history-${index}`,
    status,
    quality: 'medium',
    metadata: {
      sourceUrl: `https://example.test/history/${index}`,
      id: `history-video-${index}`,
      platform: '抖音',
      author: '粉包老师',
      title: `历史视频 ${index}`
    },
    createdAt: '2026-07-23T08:00:00.000Z',
    updatedAt: '2026-07-23T08:01:00.000Z',
    ...(status === 'completed'
      ? { outputPath: `D:\\downloads\\history-${index}.mp4` }
      : {}),
    ...(status === 'failed'
      ? { error: { code: 'DOWNLOAD_FAILED', message: '网络异常' } }
      : {})
  }
}

function createHistorySnapshot(): QueueSnapshot {
  return {
    tasks: [],
    history: [
      ...Array.from({ length: 8 }, (_, index) => createHistoryTask(index + 1)),
      createHistoryTask(9, 'failed'),
      createHistoryTask(10, 'cancelled')
    ],
    resolvingCount: 0
  }
}

const historyTaskChanges: Array<{
  field: string
  change: (task: DownloadTask) => DownloadTask
}> = [
  {
    field: 'updatedAt',
    change: (task) => ({
      ...task,
      updatedAt: '2026-07-23T09:00:00.000Z'
    })
  },
  {
    field: 'title',
    change: (task) => ({
      ...task,
      metadata: { ...task.metadata, title: '更新后的标题' }
    })
  },
  {
    field: 'status',
    change: (task) => ({ ...task, status: 'cancelled' })
  }
]

function createApi(snapshot: QueueSnapshot = emptySnapshot): FenbaoApi {
  return {
    getSnapshot: vi.fn().mockResolvedValue(snapshot),
    addInput: vi
      .fn()
      .mockResolvedValue({ added: 1, duplicates: 0, failed: 0 }),
    cancelTask: vi.fn().mockResolvedValue(undefined),
    retryTask: vi.fn().mockResolvedValue(undefined),
    resumeTask: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue(defaultSettings),
    updateSettings: vi.fn().mockImplementation(async (patch) => ({
      ...defaultSettings,
      ...patch
    })),
    chooseDownloadRoot: vi.fn().mockResolvedValue(defaultSettings),
    openTaskFolder: vi.fn().mockResolvedValue(undefined),
    onSnapshot: vi.fn().mockReturnValue(() => undefined)
  }
}

beforeEach(() => {
  useFenbaoStore.setState({
    mainView: 'queue',
    settingsOpen: false,
    input: '',
    submitting: false,
    notice: undefined,
    error: undefined,
    snapshot: emptySnapshot,
    settings: defaultUiSettings
  })
  Object.defineProperty(window, 'fenbao', {
    configurable: true,
    value: createApi()
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('粉包学习记 renderer', () => {
  it('renders the product identity and primary promise', async () => {
    render(<App />)

    expect(screen.getByText('粉包学习记')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '把链接交给我' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('登录仅保存在本机独立浏览器')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('仅保存公开视频 · 不读取浏览器账号')
    ).not.toBeInTheDocument()
    await waitFor(() => expect(window.fenbao.getSnapshot).toHaveBeenCalled())
  })

  it('passes the pasted share text to the main process unchanged', async () => {
    render(<App />)
    const shareText =
      '复制打开抖音，看看【粉包老师的视频】 https://v.douyin.com/example/'
    fireEvent.change(screen.getByLabelText('视频链接或分享文案'), {
      target: { value: shareText }
    })

    fireEvent.click(screen.getByRole('button', { name: '开始下载' }))

    await waitFor(() =>
      expect(window.fenbao.addInput).toHaveBeenCalledWith(shareText)
    )
  })

  it('distinguishes a recognized link that cannot be resolved', async () => {
    const api = createApi()
    api.addInput = vi
      .fn()
      .mockResolvedValue({
        added: 0,
        duplicates: 0,
        failed: 1,
        errorMessage: '抖音暂时拒绝连接，请稍后重新点击下载'
      })
    Object.defineProperty(window, 'fenbao', {
      configurable: true,
      value: api
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('视频链接或分享文案'), {
      target: { value: 'https://v.douyin.com/expired/' }
    })
    fireEvent.click(screen.getByRole('button', { name: '开始下载' }))

    expect(
      await screen.findByText('抖音暂时拒绝连接，请稍后重新点击下载')
    ).toBeInTheDocument()
  })

  it('shows translated task status and progress', async () => {
    const snapshot: QueueSnapshot = {
      resolvingCount: 0,
      history: [],
      tasks: [
        {
          taskId: 'task-progress',
          status: 'downloading',
          quality: 'medium',
          metadata: {
            sourceUrl: 'https://example.test/video',
            id: 'video-1',
            platform: '抖音',
            author: '粉包老师',
            title: '用三步整理学习笔记'
          },
          createdAt: '2026-07-23T08:00:00.000Z',
          updatedAt: '2026-07-23T08:01:00.000Z',
          progress: {
            downloadedBytes: 42,
            totalBytes: 100,
            percent: 42
          }
        }
      ]
    }
    Object.defineProperty(window, 'fenbao', {
      configurable: true,
      value: createApi(snapshot)
    })

    render(<App />)

    expect(await screen.findByText('用三步整理学习笔记')).toBeInTheDocument()
    expect(screen.getByText('下载中 · 42%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '42'
    )
  })

  it('opens settings from the lower-left control and changes quality', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '打开设置' }))

    expect(
      screen.getByRole('dialog', { name: '下载设置' })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: '1080p 高清' }))

    await waitFor(() =>
      expect(window.fenbao.updateSettings).toHaveBeenCalledWith({
        quality: 'high'
      })
    )
  })

  it('switches the active sidebar item between queue and history', async () => {
    render(<App />)
    const queue = screen.getByRole('button', { name: /下载队列/u })
    const history = screen.getByRole('button', { name: /历史记录/u })
    expect(queue).toHaveAttribute('aria-current', 'page')
    expect(queue).toHaveClass('is-active')
    expect(history).not.toHaveAttribute('aria-current')
    expect(history).not.toHaveClass('is-active')
    fireEvent.click(history)
    expect(history).toHaveAttribute('aria-current', 'page')
    expect(history).toHaveClass('is-active')
    expect(queue).not.toHaveAttribute('aria-current')
    expect(queue).not.toHaveClass('is-active')
    fireEvent.click(queue)
    expect(queue).toHaveAttribute('aria-current', 'page')
    expect(queue).toHaveClass('is-active')
    expect(history).not.toHaveClass('is-active')
  })

  it('reuses equivalent history while applying incoming task progress', () => {
    const initialSnapshot = createHistorySnapshot()
    useFenbaoStore.getState().setSnapshot(initialSnapshot)
    const currentHistory = useFenbaoStore.getState().snapshot.history
    const incomingTasks = [createHistoryTask(11, 'downloading')]
    const equivalentHistory = initialSnapshot.history.map((task) => ({
      ...task,
      metadata: { ...task.metadata },
      error: task.error ? { ...task.error } : undefined
    }))

    useFenbaoStore.getState().setSnapshot({
      tasks: incomingTasks,
      history: equivalentHistory,
      resolvingCount: 1
    })

    const nextSnapshot = useFenbaoStore.getState().snapshot
    expect(nextSnapshot.history).toBe(currentHistory)
    expect(nextSnapshot.tasks).toBe(incomingTasks)
    expect(nextSnapshot.resolvingCount).toBe(1)
  })

  it.each(historyTaskChanges)(
    'replaces the history reference when $field changes',
    ({ change }) => {
      const initialSnapshot = createHistorySnapshot()
      useFenbaoStore.getState().setSnapshot(initialSnapshot)
      const currentHistory = useFenbaoStore.getState().snapshot.history
      const changedHistory = initialSnapshot.history.map((task, index) =>
        index === 0 ? change(task) : task
      )

      useFenbaoStore.getState().setSnapshot({
        ...initialSnapshot,
        history: changedHistory
      })

      expect(useFenbaoStore.getState().snapshot.history).toBe(changedHistory)
      expect(useFenbaoStore.getState().snapshot.history).not.toBe(currentHistory)
    }
  )

  it('shows all history records only on the history page', async () => {
    Object.defineProperty(window, 'fenbao', {
      configurable: true,
      value: createApi(createHistorySnapshot())
    })
    render(<App />)

    expect(await screen.findByText('历史视频 8')).toBeInTheDocument()
    expect(screen.queryByText('历史视频 9')).not.toBeInTheDocument()
    expect(screen.queryByText('历史视频 10')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /历史记录/u }))

    expect(
      screen.getByRole('heading', { name: '全部历史记录' })
    ).toBeInTheDocument()
    expect(screen.getByText('历史视频 8')).toBeInTheDocument()
    expect(screen.getByText('历史视频 9')).toBeInTheDocument()
    expect(screen.getByText('历史视频 10')).toBeInTheDocument()
    expect(screen.getByText('下载失败')).toBeInTheDocument()
    expect(screen.getByText('已取消')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: '重试 历史视频 9' })
    )
    fireEvent.click(
      screen.getByRole('button', { name: '打开 历史视频 1 的文件夹' })
    )
    expect(window.fenbao.retryTask).toHaveBeenCalledWith('history-9')
    expect(window.fenbao.openTaskFolder).toHaveBeenCalledWith('history-1')
    expect(
      screen.queryByLabelText('视频链接或分享文案')
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /下载队列/u }))

    expect(screen.getByLabelText('视频链接或分享文案')).toBeInTheDocument()
  })

  it('shows an explicit empty state on the history page', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /历史记录/u }))

    expect(
      await screen.findByRole('heading', { name: '全部历史记录' })
    ).toBeInTheDocument()
    expect(screen.getByText('还没有历史记录')).toBeInTheDocument()
    expect(screen.getByText('0 条记录')).toBeInTheDocument()
  })
})
