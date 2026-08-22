import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildBaseName,
  buildTargetPaths,
  sanitizeSegment
} from '../../src/main/naming/file-names'
import type { VideoMetadata } from '../../src/shared/contracts'

const metadata: VideoMetadata = {
  sourceUrl: 'https://v.douyin.com/demo/',
  id: '7539001',
  platform: '抖音',
  author: '粉包老师',
  title: '如何学习',
  uploadDate: '20260722'
}

describe('sanitizeSegment', () => {
  it('replaces Windows-invalid characters and collapses separators', () => {
    expect(sanitizeSegment('A<B>:C?')).toBe('A-B-C-')
  })

  it('protects reserved Windows device names', () => {
    expect(sanitizeSegment('CON')).toBe('_CON')
    expect(sanitizeSegment('com1.txt')).toBe('_com1.txt')
  })

  it('removes trailing spaces and dots', () => {
    expect(sanitizeSegment(' 学习笔记...  ')).toBe('学习笔记')
  })
})

describe('video target naming', () => {
  const now = new Date('2026-07-23T12:00:00+08:00')
  const expectedBase = '2026-07-22_抖音_粉包老师_如何学习_7539001'

  it('uses upload date and the unified naming order', () => {
    expect(buildBaseName(metadata, now)).toBe(expectedBase)
  })

  it('falls back to download date when upload date is missing', () => {
    expect(buildBaseName({ ...metadata, uploadDate: undefined }, now)).toBe(
      '2026-07-23_抖音_粉包老师_如何学习_7539001'
    )
  })

  it('places each video in its own same-named folder', () => {
    const root = join('D:\\', '视频下载')
    const target = buildTargetPaths(root, metadata, now)

    expect(target.directory).toBe(join(root, expectedBase))
    expect(target.video).toBe(
      join(root, expectedBase, `${expectedBase}.mp4`)
    )
    expect(target.temporaryTemplate).toBe(
      join(root, expectedBase, `${expectedBase}.%(ext)s`)
    )
  })

  it('adds a suffix instead of overwriting an existing target', () => {
    const root = join('D:\\', '视频下载')
    const firstDirectory = join(root, expectedBase)
    const target = buildTargetPaths(
      root,
      metadata,
      now,
      (candidate) => candidate === firstDirectory
    )

    expect(target.directory).toBe(join(root, `${expectedBase}_2`))
    expect(target.video).toBe(
      join(root, `${expectedBase}_2`, `${expectedBase}_2.mp4`)
    )
  })

  it('truncates only the title to keep the full video path manageable', () => {
    const root = join('D:\\', '视频下载', '课程归档')
    const target = buildTargetPaths(
      root,
      { ...metadata, title: '很长的标题'.repeat(80) },
      now
    )

    expect(target.video.length).toBeLessThanOrEqual(220)
    expect(target.video).toContain('_抖音_粉包老师_')
    expect(target.video).toContain('_7539001.mp4')
  })
})
