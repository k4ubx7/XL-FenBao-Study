import { expect, test, _electron as electron } from '@playwright/test'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { createMediaFixture } from '../fixtures/create-media'
import { startMediaServer, type MediaServer } from '../fixtures/media-server'

let root: string
let downloads: string
let data: string
let server: MediaServer

test.beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'fenbao-e2e-'))
  downloads = join(root, 'downloads')
  data = join(root, 'data')
  const fixture = join(root, 'fixture.mp4')
  await createMediaFixture(
    join(process.cwd(), 'vendor', 'bin', 'ffmpeg.exe'),
    fixture
  )
  server = await startMediaServer(fixture)
})

test.afterAll(async () => {
  await server?.close()
  await rm(root, { recursive: true, force: true })
})

test('downloads one local video into a clean same-named folder', async () => {
  const application = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      FENBAO_DATA_ROOT: data,
      FENBAO_DOWNLOAD_ROOT: downloads,
      FENBAO_DISABLE_AUTO_OPEN: '1'
    }
  })

  try {
    const page = await application.firstWindow()
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
    await application.close()
  }

  const folders = await readdir(downloads, { withFileTypes: true })
  expect(folders.filter((entry) => entry.isDirectory())).toHaveLength(1)

  const folderName = folders.find((entry) => entry.isDirectory())!.name
  const taskDirectory = join(downloads, folderName)
  const files = await readdir(taskDirectory)
  expect(files).toHaveLength(1)
  expect(extname(files[0]).toLowerCase()).toBe('.mp4')
  expect(basename(files[0], '.mp4')).toBe(folderName)
  expect(files.some((file) => /\.(part|json|jpe?g|png|webp|srt|vtt)$/iu.test(file))).toBe(
    false
  )
})
