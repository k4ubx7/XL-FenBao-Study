import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureWithLoginFallback,
  DouyinCaptureFailure,
  type DouyinCaptureMode,
  type SessionMarker
} from '../../src/main/downloads/douyin-login-session'
import { FileSessionMarker } from '../../src/main/downloads/file-session-marker'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'fenbao-login-session-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

function createMarker(ready: boolean): SessionMarker {
  return {
    isReady: vi.fn().mockResolvedValue(ready),
    markReady: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined)
  }
}

describe('Douyin login fallback', () => {
  it('opens interactive mode first when no usable session is recorded', async () => {
    const marker = createMarker(false)
    const attempt = vi.fn(async (mode: DouyinCaptureMode) => mode)

    await expect(
      captureWithLoginFallback(attempt, marker)
    ).resolves.toBe('interactive')
    expect(attempt).toHaveBeenCalledWith('interactive', undefined)
    expect(marker.markReady).toHaveBeenCalledOnce()
  })

  it('uses background mode while the recorded session remains usable', async () => {
    const marker = createMarker(true)
    const attempt = vi.fn(async (mode: DouyinCaptureMode) => mode)

    await expect(
      captureWithLoginFallback(attempt, marker)
    ).resolves.toBe('background')
    expect(attempt).toHaveBeenCalledOnce()
    expect(marker.clear).not.toHaveBeenCalled()
    expect(marker.markReady).not.toHaveBeenCalled()
  })

  it('falls back from a stale background session to interactive login', async () => {
    const marker = createMarker(true)
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(
        new DouyinCaptureFailure('login-required', '登录已失效')
      )
      .mockResolvedValueOnce('captured')

    await expect(
      captureWithLoginFallback(attempt, marker)
    ).resolves.toBe('captured')
    expect(attempt.mock.calls.map(([mode]) => mode)).toEqual([
      'background',
      'interactive'
    ])
    expect(marker.clear).toHaveBeenCalledOnce()
    expect(marker.markReady).toHaveBeenCalledOnce()
  })

  it('falls back from a background connection failure to interactive login', async () => {
    const marker = createMarker(true)
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(
        new DouyinCaptureFailure('connection', '抖音暂时拒绝连接')
      )
      .mockResolvedValueOnce('captured')

    await expect(captureWithLoginFallback(attempt, marker)).resolves.toBe(
      'captured'
    )
    expect(attempt.mock.calls.map(([mode]) => mode)).toEqual([
      'background',
      'interactive'
    ])
    expect(marker.clear).toHaveBeenCalledOnce()
  })

  it('does not request login for an invalid link', async () => {
    const marker = createMarker(true)
    const failure = new DouyinCaptureFailure(
      'link-invalid',
      '抖音链接已失效或不是视频页面'
    )
    const attempt = vi.fn().mockRejectedValue(failure)

    await expect(
      captureWithLoginFallback(attempt, marker)
    ).rejects.toBe(failure)
    expect(attempt).toHaveBeenCalledOnce()
    expect(marker.clear).not.toHaveBeenCalled()
  })

  it('does not fall back to interactive login when media recognition fails', async () => {
    const marker = createMarker(true)
    const failure = new DouyinCaptureFailure(
      'stream-unrecognized',
      '页面已登录，但未识别到可下载媒体，请稍后重试'
    )
    const attempt = vi.fn().mockRejectedValue(failure)

    await expect(captureWithLoginFallback(attempt, marker)).rejects.toBe(
      failure
    )
    expect(attempt).toHaveBeenCalledOnce()
    expect(marker.clear).not.toHaveBeenCalled()
  })

  it('stores only a readiness token in the marker file', async () => {
    const markerPath = join(root, '.fenbao-session-ready')
    const marker = new FileSessionMarker(markerPath)

    expect(await marker.isReady()).toBe(false)
    await marker.markReady()
    expect(await marker.isReady()).toBe(true)
    expect(await readFile(markerPath, 'utf8')).toBe('ready\n')
    await marker.clear()
    expect(await marker.isReady()).toBe(false)
  })
})
