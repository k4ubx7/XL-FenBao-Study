import { mkdir, open, readFile, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { PersistedState, TaskStatus } from '../../shared/contracts'
import { persistedStateSchema } from './schema'

const INTERRUPTED_STATUSES = new Set<TaskStatus>([
  'resolving',
  'downloading',
  'merging',
  'transcoding'
])

function cloneDefaults(defaultState: PersistedState): PersistedState {
  return structuredClone(defaultState)
}

function corruptFileName(now = new Date()): string {
  const compactTimestamp = now.toISOString().replace(/[-:.]/gu, '')
  return `state-corrupt-${compactTimestamp}.json`
}

export class AtomicStateStore {
  constructor(
    private readonly filePath: string,
    private readonly corruptDir: string
  ) {}

  async load(defaultState: PersistedState): Promise<PersistedState> {
    let raw: string
    try {
      raw = await readFile(this.filePath, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return cloneDefaults(defaultState)
      }
      throw error
    }

    try {
      const state = persistedStateSchema.parse(JSON.parse(raw))
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          INTERRUPTED_STATUSES.has(task.status)
            ? { ...task, status: 'paused' as const }
            : task
        )
      }
    } catch {
      await mkdir(this.corruptDir, { recursive: true })
      await rename(this.filePath, join(this.corruptDir, corruptFileName()))
      return cloneDefaults(defaultState)
    }
  }

  async save(state: PersistedState): Promise<void> {
    const validated = persistedStateSchema.parse(state)
    const temporaryPath = `${this.filePath}.tmp`
    await mkdir(dirname(this.filePath), { recursive: true })

    const file = await open(temporaryPath, 'w')
    try {
      await file.writeFile(`${JSON.stringify(validated, null, 2)}\n`, 'utf8')
      await file.sync()
    } finally {
      await file.close()
    }

    await rename(temporaryPath, this.filePath)
  }
}
