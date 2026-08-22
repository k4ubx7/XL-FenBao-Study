import { describe, expect, it, vi } from 'vitest'
import {
  SiteAwareDownloadAdapter,
  isDouyinPageUrl,
  type DouyinResolver
} from '../../src/main/downloads/site-aware-adapter'
import type { YtDlpAdapter } from '../../src/main/downloads/yt-dlp'
import type {
  DownloadRequest,
  ProgressEvent,
  VideoMetadata
} from '../../src/shared/contracts'

const capturedMetadata: VideoMetadata = {
  sourceUrl:
    'https://v3-web.douyinvod.com/video/tos/cn/tos-cn-ve-15/o.mp4?mime_type=video_mp4',
  id: '7647483788033843429',
  platform: '抖音',
  author: '前端学习',
  title: '前端开发5个顶级动画库'
}

function createPrimaryAdapter(): YtDlpAdapter {
  return {
    resolve: vi.fn().mockResolvedValue([
      {
        ...capturedMetadata,
        platform: '普通网站',
        sourceUrl: 'https://example.test/video'
      }
    ]),
    download: vi.fn().mockResolvedValue(undefined)
  }
}

describe('SiteAwareDownloadAdapter', () => {
  it('recognizes Douyin share and canonical video URLs only', () => {
    expect(isDouyinPageUrl('https://v.douyin.com/sUudVS_T6WY/')).toBe(true)
    expect(
      isDouyinPageUrl(
        'https://www.douyin.com/video/7647483788033843429'
      )
    ).toBe(true)
    expect(isDouyinPageUrl('https://notdouyin.com/video/1')).toBe(false)
    expect(isDouyinPageUrl('not a URL')).toBe(false)
  })

  it('uses browser request capture for Douyin instead of yt-dlp metadata', async () => {
    const primary = createPrimaryAdapter()
    const douyin: DouyinResolver = {
      resolve: vi.fn().mockResolvedValue(capturedMetadata)
    }
    const adapter = new SiteAwareDownloadAdapter(primary, douyin)

    await expect(
      adapter.resolve('https://v.douyin.com/sUudVS_T6WY/')
    ).resolves.toEqual([capturedMetadata])
    expect(douyin.resolve).toHaveBeenCalledWith(
      'https://v.douyin.com/sUudVS_T6WY/',
      undefined
    )
    expect(primary.resolve).not.toHaveBeenCalled()
  })

  it('keeps yt-dlp metadata resolution for non-Douyin links', async () => {
    const primary = createPrimaryAdapter()
    const douyin: DouyinResolver = {
      resolve: vi.fn().mockResolvedValue(capturedMetadata)
    }
    const adapter = new SiteAwareDownloadAdapter(primary, douyin)

    await adapter.resolve('https://www.youtube.com/watch?v=demo')
    await adapter.resolve('https://www.bilibili.com/video/BV1demo')

    expect(primary.resolve).toHaveBeenNthCalledWith(
      1,
      'https://www.youtube.com/watch?v=demo',
      undefined
    )
    expect(primary.resolve).toHaveBeenNthCalledWith(
      2,
      'https://www.bilibili.com/video/BV1demo',
      undefined
    )
    expect(primary.resolve).toHaveBeenCalledTimes(2)
    expect(douyin.resolve).not.toHaveBeenCalled()
  })

  it('delegates the captured CDN download to the primary adapter', async () => {
    const primary = createPrimaryAdapter()
    const douyin: DouyinResolver = {
      resolve: vi.fn().mockResolvedValue(capturedMetadata)
    }
    const adapter = new SiteAwareDownloadAdapter(primary, douyin)
    const request: DownloadRequest = {
      sourceUrl: capturedMetadata.sourceUrl,
      outputTemplate: 'D:\\视频\\动画库\\动画库.%(ext)s',
      quality: 'medium'
    }
    const progress = vi.fn<(event: ProgressEvent) => void>()
    const signal = new AbortController().signal

    await adapter.download(request, progress, signal)

    expect(primary.download).toHaveBeenCalledWith(request, progress, signal)
  })
})
