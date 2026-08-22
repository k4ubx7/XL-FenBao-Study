import { expect, test, _electron as electron } from '@playwright/test'
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'

const douyinUrl = process.env.FENBAO_DOUYIN_URL

test.skip(!douyinUrl, 'Set FENBAO_DOUYIN_URL to run the live Douyin check')
test.setTimeout(90_000)

async function waitForOutcome(
  page: Awaited<
    ReturnType<
      Awaited<ReturnType<typeof electron.launch>>['firstWindow']
    >
  >,
  timeout: number
): Promise<'completed' | 'failed' | 'timeout'> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (
      await page
        .getByText('已完成', { exact: false })
        .isVisible()
        .catch(() => false)
    ) {
      return 'completed'
    }
    if (
      await page
        .locator('.inline-message.is-error')
        .isVisible()
        .catch(() => false)
    ) {
      return 'failed'
    }
    await page.waitForTimeout(250)
  }
  return 'timeout'
}

test('downloads a real public Douyin video through browser capture', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fenbao-douyin-live-'))
  const downloads = join(root, 'downloads')
  const data = join(root, 'data')
  let application: Awaited<ReturnType<typeof electron.launch>> | undefined
  const diagnostics: string[] = []

  try {
    application = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        FENBAO_DATA_ROOT: data,
        FENBAO_DOWNLOAD_ROOT: downloads,
        FENBAO_DISABLE_AUTO_OPEN: '1'
      }
    })
    application.process().stderr?.on('data', (chunk) => {
      diagnostics.push(String(chunk))
    })
    const page = await application.firstWindow()
    await page.getByLabel('视频链接或分享文案').fill(douyinUrl!)
    await page.getByRole('button', { name: '开始下载' }).click()
    const outcome = await waitForOutcome(page, 60_000)

    if (outcome !== 'completed') {
      throw new Error(
        `Douyin capture ${outcome}: ${
          diagnostics.join('').trim() || 'no diagnostics'
        }`
      )
    }

    const folders = (
      await readdir(downloads, { withFileTypes: true })
    ).filter((entry) => entry.isDirectory())
    expect(folders).toHaveLength(1)
    const files = await readdir(join(downloads, folders[0].name))
    expect(files).toHaveLength(1)
    expect(extname(files[0]).toLowerCase()).toBe('.mp4')
    expect(basename(files[0], '.mp4')).toBe(folders[0].name)
    expect((await stat(join(downloads, folders[0].name, files[0]))).size).toBeGreaterThan(
      1_000_000
    )
  } finally {
    await application?.close().catch(() => undefined)
    await rm(root, { recursive: true, force: true })
  }
})
