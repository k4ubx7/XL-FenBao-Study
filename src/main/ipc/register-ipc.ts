import { existsSync, statSync } from 'node:fs'
import { z } from 'zod'
import type { Dialog, IpcMain, Shell } from 'electron'
import type { DownloadQueue } from '../downloads/queue'

export const IPC_MUTATION_CHANNELS = [
  'queue:addInput',
  'queue:cancel',
  'queue:retry',
  'queue:resume',
  'settings:update',
  'dialog:chooseDownloadRoot',
  'shell:openTaskFolder'
] as const

export const IPC_INVOKE_CHANNELS = [
  'queue:getSnapshot',
  ...IPC_MUTATION_CHANNELS.slice(0, 4),
  'settings:get',
  ...IPC_MUTATION_CHANNELS.slice(4)
] as const

export const IPC_EVENT_CHANNELS = ['queue:snapshot'] as const

export const taskIdSchema = z
  .object({
    taskId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/iu)
  })
  .strict()

export const addInputSchema = z
  .object({
    text: z.string().trim().min(1).max(200_000)
  })
  .strict()

function existingDirectory(value: string): boolean {
  try {
    return existsSync(value) && statSync(value).isDirectory()
  } catch {
    return false
  }
}

export const settingsPatchSchema = z
  .object({
    quality: z.enum(['low', 'medium', 'high', 'best']).optional(),
    concurrency: z
      .union([z.literal(1), z.literal(2), z.literal(3)])
      .optional(),
    downloadRoot: z
      .string()
      .min(1)
      .refine(existingDirectory, '下载目录不存在')
      .optional(),
    openFolderOnComplete: z.boolean().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, '至少修改一项设置')

interface RegisterIpcOptions {
  ipcMain: IpcMain
  dialog: Dialog
  shell: Shell
  queue: DownloadQueue
}

export function registerIpcHandlers({
  ipcMain,
  dialog,
  shell,
  queue
}: RegisterIpcOptions): void {
  ipcMain.handle('queue:getSnapshot', () => queue.snapshot())
  ipcMain.handle('queue:addInput', (_event, input: unknown) => {
    const { text } = addInputSchema.parse(input)
    return queue.addInput(text)
  })
  ipcMain.handle('queue:cancel', (_event, input: unknown) => {
    const { taskId } = taskIdSchema.parse(input)
    return queue.cancel(taskId)
  })
  ipcMain.handle('queue:retry', (_event, input: unknown) => {
    const { taskId } = taskIdSchema.parse(input)
    return queue.retry(taskId)
  })
  ipcMain.handle('queue:resume', (_event, input: unknown) => {
    const { taskId } = taskIdSchema.parse(input)
    return queue.resume(taskId)
  })
  ipcMain.handle('settings:get', () => queue.getSettings())
  ipcMain.handle('settings:update', (_event, input: unknown) => {
    const patch = settingsPatchSchema.parse(input)
    return queue.updateSettings(patch)
  })
  ipcMain.handle('dialog:chooseDownloadRoot', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择视频保存文件夹',
      defaultPath: queue.getSettings().downloadRoot,
      properties: ['openDirectory', 'createDirectory']
    })
    const downloadRoot = result.filePaths[0]
    if (result.canceled || !downloadRoot) {
      return queue.getSettings()
    }
    const patch = settingsPatchSchema.parse({ downloadRoot })
    return queue.updateSettings(patch)
  })
  ipcMain.handle('shell:openTaskFolder', async (_event, input: unknown) => {
    const { taskId } = taskIdSchema.parse(input)
    const task = [...queue.snapshot().tasks, ...queue.snapshot().history].find(
      (candidate) => candidate.taskId === taskId
    )
    if (!task?.directory) {
      throw new Error('找不到该任务的保存文件夹')
    }
    const error = await shell.openPath(task.directory)
    if (error) {
      throw new Error(error)
    }
  })
}
