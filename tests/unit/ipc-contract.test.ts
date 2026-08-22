import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  IPC_INVOKE_CHANNELS,
  IPC_MUTATION_CHANNELS,
  settingsPatchSchema,
  taskIdSchema
} from '../../src/main/ipc/register-ipc'
import { resolveAppPaths } from '../../src/main/paths'
import { createWindowOptions } from '../../src/main/window-options'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe('IPC contract', () => {
  it('limits renderer mutations to the approved command list', () => {
    expect(IPC_MUTATION_CHANNELS).toEqual([
      'queue:addInput',
      'queue:cancel',
      'queue:retry',
      'queue:resume',
      'settings:update',
      'dialog:chooseDownloadRoot',
      'shell:openTaskFolder'
    ])
    expect(IPC_INVOKE_CHANNELS).toContain('queue:getSnapshot')
    expect(IPC_INVOKE_CHANNELS).toContain('settings:get')
  })

  it('rejects invalid task IDs and quality values', () => {
    expect(taskIdSchema.safeParse({ taskId: '../escape' }).success).toBe(false)
    expect(
      settingsPatchSchema.safeParse({ quality: 'ultra-16k' }).success
    ).toBe(false)
  })

  it('rejects non-existent output folders before settings code runs', async () => {
    const root = join(
      tmpdir(),
      `fenbao-ipc-${Date.now()}-${Math.random().toString(16).slice(2)}`
    )
    temporaryDirectories.push(root)
    const existing = join(root, 'existing')
    await mkdir(existing, { recursive: true })

    expect(
      settingsPatchSchema.safeParse({ downloadRoot: existing }).success
    ).toBe(true)
    expect(
      settingsPatchSchema.safeParse({
        downloadRoot: join(root, 'does-not-exist')
      }).success
    ).toBe(false)
  })
})

describe('resolveAppPaths', () => {
  it('uses sibling data/downloads and resources/bin in packaged mode', () => {
    const paths = resolveAppPaths({
      packaged: true,
      executablePath: 'D:\\粉包学习记\\粉包学习记.exe',
      projectRoot: 'C:\\source'
    })

    expect(paths).toEqual({
      root: 'D:\\粉包学习记',
      data: 'D:\\粉包学习记\\data',
      logs: 'D:\\粉包学习记\\data\\logs',
      downloads: 'D:\\粉包学习记\\downloads',
      ytDlp: 'D:\\粉包学习记\\resources\\bin\\yt-dlp.exe',
      ffmpegDir: 'D:\\粉包学习记\\resources\\bin'
    })
  })

  it('uses project-local vendor and isolated development data', () => {
    const paths = resolveAppPaths({
      packaged: false,
      executablePath: 'C:\\electron\\electron.exe',
      projectRoot: 'D:\\source\\fenbao-study'
    })

    expect(paths.data).toBe('D:\\source\\fenbao-study\\.dev-data')
    expect(paths.downloads).toBe('D:\\source\\fenbao-study\\downloads')
    expect(paths.ytDlp).toBe(
      'D:\\source\\fenbao-study\\vendor\\bin\\yt-dlp.exe'
    )
  })
})

describe('secure BrowserWindow options', () => {
  it('isolates the renderer from Node and enables the sandbox', () => {
    const options = createWindowOptions('D:\\app\\out\\preload\\index.js')

    expect(options.webPreferences).toMatchObject({
      preload: 'D:\\app\\out\\preload\\index.js',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    })
  })
})
