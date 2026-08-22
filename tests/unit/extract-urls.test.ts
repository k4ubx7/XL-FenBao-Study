import { describe, expect, it } from 'vitest'
import { extractUrls } from '../../src/main/input/extract-urls'

describe('extractUrls', () => {
  it('extracts a pure URL', () => {
    expect(extractUrls('https://v.douyin.com/abc123/')).toEqual([
      'https://v.douyin.com/abc123/'
    ])
  })

  it('extracts links from Chinese share text and removes punctuation', () => {
    expect(
      extractUrls('复制打开抖音 https://v.douyin.com/abc123/，看看视频。')
    ).toEqual(['https://v.douyin.com/abc123/'])
  })

  it('extracts several links in stable order', () => {
    expect(
      extractUrls(
        '第一条：https://www.bilibili.com/video/BV1x；第二条 https://youtu.be/demo123。'
      )
    ).toEqual([
      'https://www.bilibili.com/video/BV1x',
      'https://youtu.be/demo123'
    ])
  })

  it('deduplicates links and rejects non-http protocols', () => {
    expect(
      extractUrls(
        'https://a.test/v\nhttps://a.test/v\nfile:///c:/secret\njavascript:alert(1)'
      )
    ).toEqual(['https://a.test/v'])
  })

  it('returns an empty list for text without a link', () => {
    expect(extractUrls('这里只是一段普通文字')).toEqual([])
  })
})
