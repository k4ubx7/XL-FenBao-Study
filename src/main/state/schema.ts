import { z } from 'zod'
import type { PersistedState } from '../../shared/contracts'

const qualityPresetSchema = z.enum(['low', 'medium', 'high', 'best'])
const taskStatusSchema = z.enum([
  'resolving',
  'queued',
  'downloading',
  'merging',
  'transcoding',
  'paused',
  'completed',
  'cancelled',
  'failed'
])

const settingsSchema = z.object({
  quality: qualityPresetSchema,
  concurrency: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  downloadRoot: z.string().min(1),
  openFolderOnComplete: z.boolean()
})

const metadataSchema = z.object({
  sourceUrl: z.url(),
  audioUrl: z.url().optional(),
  id: z.string().min(1),
  platform: z.string().min(1),
  author: z.string().min(1),
  title: z.string().min(1),
  uploadDate: z.string().optional(),
  durationSeconds: z.number().nonnegative().optional(),
  expectedBytes: z.number().nonnegative().optional()
})

const progressSchema = z.object({
  downloadedBytes: z.number().nonnegative().optional(),
  totalBytes: z.number().nonnegative().optional(),
  speedBytesPerSecond: z.number().nonnegative().optional(),
  etaSeconds: z.number().nonnegative().optional(),
  percent: z.number().min(0).max(100).optional()
})

export const downloadTaskSchema = z.object({
  taskId: z.string().min(1),
  status: taskStatusSchema,
  quality: qualityPresetSchema,
  metadata: metadataSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  directory: z.string().optional(),
  outputPath: z.string().optional(),
  temporaryTemplate: z.string().optional(),
  progress: progressSchema.optional(),
  error: z
    .object({
      code: z.string().min(1),
      message: z.string().min(1)
    })
    .optional(),
  attempts: z.number().int().nonnegative().optional()
})

export const persistedStateSchema = z.object({
  version: z.literal(1),
  settings: settingsSchema,
  tasks: z.array(downloadTaskSchema),
  history: z.array(downloadTaskSchema)
})

export function createDefaultState(downloadRoot: string): PersistedState {
  return {
    version: 1,
    settings: {
      quality: 'medium',
      concurrency: 2,
      downloadRoot,
      openFolderOnComplete: false
    },
    tasks: [],
    history: []
  }
}
