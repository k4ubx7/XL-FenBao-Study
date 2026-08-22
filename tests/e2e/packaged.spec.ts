import { expect, test, _electron as electron } from '@playwright/test'
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join } from 'node:path'
import { createMediaFixture } from '../fixtures/create-media'
import { startMediaServer, type MediaServer } from '../fixtures/media-server'

const packagedExecutable = process.env.FENBAO_PACKAGED_EXE

test.skip(!packagedExecutable, 'Set FENBAO_PACKAGED_EXE to test a portable build')

let root: string
let downloads: string
let data: string
let server: MediaServer

test.beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'fenbao-packaged-e2e-'))
  downloads = join(root, 'downloads')
  data = join(root, 'data')
  const fixture = join(root, 'fixture.mp4')
  const executableDirectory = dirname(packagedExecutable!)

  const instructions = await readFile(
    join(executableDirectory, '使用说明.txt'),
    'utf8'
  )
  expect(instructions).toContain('建议放在 D 盘等空间充足的位置')

  await createMediaFixture(
    join(executableDirectory, 'resources', 'bin', 'ffmpeg.exe'),
    fixture
  )
  server = await startMediaServer(fixture)
})

test.afterAll(async () => {
  await server?.close()
  await rm(root, { recursive: true, force: true })
})

function launchPortable() {
  return electron.launch({
    executablePath: packagedExecutable!,
    env: {
      ...process.env,
      FENBAO_DATA_ROOT: data,
      FENBAO_DOWNLOAD_ROOT: downloads,
      FENBAO_DISABLE_AUTO_OPEN: '1'
    }
  })
}

test('portable folder downloads cleanly and restores history after relaunch', async () => {
  const firstRun = await launchPortable()
  try {
    const page = await firstRun.firstWindow()
    await page.locator('.workspace').waitFor()
    const layout = await page.evaluate(() => {
      const workspace = document.querySelector<HTMLElement>('.workspace')!
      return {
        bodyOverflowY: getComputedStyle(document.body).overflowY,
        workspaceOverflowY: getComputedStyle(workspace).overflowY,
        workspaceFits:
          workspace.scrollHeight <= workspace.clientHeight
      }
    })
    expect(layout).toEqual({
      bodyOverflowY: 'hidden',
      workspaceOverflowY: 'auto',
      workspaceFits: true
    })

    await page.getByLabel('视频链接或分享文案').fill(server.pageUrl)
    await page.getByRole('button', { name: '开始下载' }).click()
    await expect(page.getByText('已完成', { exact: false })).toBeVisible()
  } finally {
    await firstRun.close()
  }

  const folders = (await readdir(downloads, { withFileTypes: true })).filter(
    (entry) => entry.isDirectory()
  )
  expect(folders).toHaveLength(1)
  const taskDirectory = join(downloads, folders[0].name)
  const files = await readdir(taskDirectory)
  expect(files).toHaveLength(1)
  expect(extname(files[0]).toLowerCase()).toBe('.mp4')
  expect(basename(files[0], '.mp4')).toBe(folders[0].name)
  const videoPath = join(taskDirectory, files[0])
  const beforeRelaunch = await stat(videoPath)

  const secondRun = await launchPortable()
  try {
    const page = await secondRun.firstWindow()
    await expect(
      page.getByRole('heading', { name: /^本地学习视频/u })
    ).toBeVisible()
    await expect(page.getByText('已完成', { exact: false })).toBeVisible()
  } finally {
    await secondRun.close()
  }

  const afterRelaunch = await stat(videoPath)
  expect(afterRelaunch.size).toBe(beforeRelaunch.size)
  expect(afterRelaunch.mtimeMs).toBe(beforeRelaunch.mtimeMs)
})
