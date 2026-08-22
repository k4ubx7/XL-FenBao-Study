import { readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MEBIBYTE,
  ensureOutputReady,
  requiredFreeBytes
} from '../../src/main/errors/output-checks'
import {
  UserFacingError,
  toUserFacingError
} from '../../src/main/errors/user-errors'
import { withNetworkRetry } from '../../src/main/errors/retry'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe('toUserFacingError', () => {
  it.each([
    ['没有找到链接', 'NO_URL'],
    ['Unsupported URL: https://example.test', 'UNSUPPORTED_URL'],
    ['Sign in to confirm you are not a bot. Use cookies', 'AUTH_REQUIRED'],
    ['ENOSPC: no space left on device', 'DISK_FULL'],
    ['EACCES: output folder is not writable', 'OUTPUT_NOT_WRITABLE'],
    ['network timeout while connecting', 'NETWORK_FAILED'],
    ['ffmpeg postprocessing failed', 'POSTPROCESS_FAILED'],
    ['unknown child process failure', 'PROCESS_FAILED']
  ])('maps %s to %s', (message, code) => {
    expect(toUserFacingError(new Error(message)).code).toBe(code)
  })

  it('never exposes cookie, account or command argument values', () => {
    const error = toUserFacingError(
      new Error(
        'Login required cookie=secret-cookie --username private@example.com --password hunter2'
      )
    )

    expect(error.code).toBe('AUTH_REQUIRED')
    expect(error.message).not.toContain('secret-cookie')
    expect(error.message).not.toContain('private@example.com')
    expect(error.message).not.toContain('hunter2')
    expect(error.message).not.toContain('--username')
  })

  it('preserves an already-safe user-facing error', () => {
    const original = new UserFacingError(
      'DISK_FULL',
      '空间不足，请更换保存位置。'
    )

    expect(toUserFacingError(original)).toBe(original)
  })
})

describe('output checks', () => {
  it('requires 2GB when size is unknown and 512MB headroom when known', () => {
    expect(requiredFreeBytes()).toBe(2 * 1024 * MEBIBYTE)
    expect(requiredFreeBytes(900 * MEBIBYTE)).toBe(1412 * MEBIBYTE)
  })

  it('creates and probes a writable output directory without leaving files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fenbao-output-'))
    temporaryDirectories.push(root)
    const output = join(root, 'new-download-root')

    await ensureOutputReady(output, undefined, {
      freeBytes: async () => 10 * 1024 * MEBIBYTE
    })

    expect(await readdir(output)).toEqual([])
  })

  it('reports disk full before launching a download', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fenbao-output-'))
    temporaryDirectories.push(root)

    await expect(
      ensureOutputReady(root, 900 * MEBIBYTE, {
        freeBytes: async () => 1_000 * MEBIBYTE
      })
    ).rejects.toMatchObject({ code: 'DISK_FULL' })
  })
})

describe('withNetworkRetry', () => {
  it('retries network failures after 1s, 3s and 9s', async () => {
    let attempts = 0
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(
      withNetworkRetry(
        async () => {
          attempts += 1
          if (attempts < 4) throw new Error('network connection failed')
          return 'done'
        },
        { sleep }
      )
    ).resolves.toBe('done')

    expect(attempts).toBe(4)
    expect(sleep.mock.calls.map(([delay]) => delay)).toEqual([
      1_000, 3_000, 9_000
    ])
  })

  it('does not retry non-network process failures', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('invalid media'))
    const sleep = vi.fn()

    await expect(
      withNetworkRetry(operation, { sleep })
    ).rejects.toThrow('invalid media')
    expect(operation).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })
})
