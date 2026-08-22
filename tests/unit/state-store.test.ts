import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp } from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { createDefaultState } from '../../src/main/state/schema'
import { AtomicStateStore } from '../../src/main/state/store'
import type { DownloadTask } from '../../src/shared/contracts'

const temporaryDirectories: string[] = []

async function temporaryStatePaths(): Promise<{
  root: string
  stateFile: string
  corruptDir: string
}> {
  const root = await mkdtemp(join(tmpdir(), 'fenbao-state-'))
  temporaryDirectories.push(root)
  return {
    root,
    stateFile: join(root, 'data', 'state.json'),
    corruptDir: join(root, 'data', 'corrupt')
  }
}

function sampleTask(status: DownloadTask['status']): DownloadTask {
  return {
    taskId: 'task-1',
    status,
    quality: 'medium',
    metadata: {
      sourceUrl: 'https://example.test/video',
      id: 'video-1',
      platform: '测试平台',
      author: '作者',
      title: '标题'
    },
    createdAt: '2026-07-23T08:00:00.000Z',
    updatedAt: '2026-07-23T08:00:00.000Z',
    progress: {
      downloadedBytes: 1024,
      totalBytes: 4096,
      percent: 25
    }
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe('createDefaultState', () => {
  it('uses the approved 720p and concurrency defaults', () => {
    const state = createDefaultState('D:\\粉包学习记\\downloads')

    expect(state).toEqual({
      version: 1,
      settings: {
        quality: 'medium',
        concurrency: 2,
        downloadRoot: 'D:\\粉包学习记\\downloads',
        openFolderOnComplete: false
      },
      tasks: [],
      history: []
    })
  })
})

describe('AtomicStateStore', () => {
  it('writes atomically and reloads equivalent state', async () => {
    const paths = await temporaryStatePaths()
    const store = new AtomicStateStore(paths.stateFile, paths.corruptDir)
    const state = {
      ...createDefaultState(join(paths.root, 'downloads')),
      tasks: [sampleTask('queued')]
    }

    await store.save(state)

    await expect(store.load(createDefaultState('fallback'))).resolves.toEqual(
      state
    )
    await expect(readFile(`${paths.stateFile}.tmp`, 'utf8')).rejects.toThrow()
  })

  it('recovers invalid JSON and preserves it in the corrupt directory', async () => {
    const paths = await temporaryStatePaths()
    await mkdir(join(paths.root, 'data'), { recursive: true })
    await writeFile(paths.stateFile, '{ definitely not json', 'utf8')
    const store = new AtomicStateStore(paths.stateFile, paths.corruptDir)
    const defaults = createDefaultState(join(paths.root, 'downloads'))

    await expect(store.load(defaults)).resolves.toEqual(defaults)
    const corruptFiles = await readdir(paths.corruptDir)
    expect(corruptFiles).toHaveLength(1)
    expect(corruptFiles[0]).toMatch(/^state-corrupt-\d{8}T\d{6}\d{3}Z\.json$/u)
  })

  it('returns defaults when no saved state exists', async () => {
    const paths = await temporaryStatePaths()
    const store = new AtomicStateStore(paths.stateFile, paths.corruptDir)
    const defaults = createDefaultState(join(paths.root, 'downloads'))

    await expect(store.load(defaults)).resolves.toEqual(defaults)
  })

  it.each(['resolving', 'downloading', 'merging', 'transcoding'] as const)(
    'restores an interrupted %s task as paused',
    async (status) => {
      const paths = await temporaryStatePaths()
      const state = {
        ...createDefaultState(join(paths.root, 'downloads')),
        tasks: [sampleTask(status)]
      }
      await mkdir(join(paths.root, 'data'), { recursive: true })
      await writeFile(paths.stateFile, JSON.stringify(state), 'utf8')
      const store = new AtomicStateStore(paths.stateFile, paths.corruptDir)

      const restored = await store.load(createDefaultState('fallback'))

      expect(restored.tasks[0].status).toBe('paused')
    }
  )
})
