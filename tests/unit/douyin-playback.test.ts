// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { triggerPrimaryPlayback } from '../../src/main/downloads/playwright-douyin-capture'

type Rect = Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left' | 'width' | 'height'>

function addVideo(rect: Rect): { element: HTMLVideoElement; play: ReturnType<typeof vi.fn> } {
  const element = document.createElement('video')
  const play = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(element, 'play', { value: play })
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => ({ x: rect.left, y: rect.top, ...rect, toJSON: () => ({}) })
  })
  document.body.append(element)
  return { element, play }
}

function playbackPage(): {
  page: Parameters<typeof triggerPrimaryPlayback>[0]
  click: ReturnType<typeof vi.fn>
} {
  Object.defineProperties(window, {
    innerWidth: { configurable: true, value: 1280 },
    innerHeight: { configurable: true, value: 720 }
  })
  const click = vi.fn().mockResolvedValue(undefined)
  return {
    page: {
      evaluate: vi.fn((fn: () => unknown) => Promise.resolve(fn())),
      viewportSize: vi.fn(() => ({ width: 1280, height: 720 })),
      mouse: { click }
    } as unknown as Parameters<typeof triggerPrimaryPlayback>[0],
    click
  }
}

describe('triggerPrimaryPlayback', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('plays only the largest visible video and clicks the viewport center', async () => {
    const small = addVideo({ top: 50, left: 50, right: 150, bottom: 150, width: 100, height: 100 })
    const large = addVideo({ top: 100, left: 100, right: 700, bottom: 500, width: 600, height: 400 })
    const { page, click } = playbackPage()

    await triggerPrimaryPlayback(page)

    expect(large.play).toHaveBeenCalledOnce()
    expect(large.element.muted).toBe(true)
    expect(small.play).not.toHaveBeenCalled()
    expect(click).toHaveBeenCalledWith(640, 360)
  })

  it('ignores a larger video that is completely outside the viewport', async () => {
    const outside = addVideo({ top: 800, left: 0, right: 2000, bottom: 1800, width: 2000, height: 1000 })
    const visible = addVideo({ top: 100, left: 100, right: 500, bottom: 400, width: 400, height: 300 })
    const { page } = playbackPage()

    await triggerPrimaryPlayback(page)

    expect(visible.play).toHaveBeenCalledOnce()
    expect(outside.play).not.toHaveBeenCalled()
  })

  it('ignores a huge video completely outside the viewport to the upper left', async () => {
    const outside = addVideo({
      top: -11_000,
      left: -11_000,
      right: -1_000,
      bottom: -1_000,
      width: 10_000,
      height: 10_000
    })
    const primary = addVideo({
      top: 100,
      left: 100,
      right: 500,
      bottom: 400,
      width: 400,
      height: 300
    })
    const { page } = playbackPage()

    await triggerPrimaryPlayback(page)

    expect(primary.play).toHaveBeenCalledOnce()
    expect(outside.play).not.toHaveBeenCalled()
  })

  it('prefers the greatest visible intersection over a huge video showing one pixel', async () => {
    const onePixel = addVideo({
      top: 719,
      left: 0,
      right: 2000,
      bottom: 1719,
      width: 2000,
      height: 1000
    })
    const primary = addVideo({
      top: 100,
      left: 100,
      right: 500,
      bottom: 400,
      width: 400,
      height: 300
    })
    const { page } = playbackPage()

    await triggerPrimaryPlayback(page)

    expect(primary.play).toHaveBeenCalledOnce()
    expect(onePixel.play).not.toHaveBeenCalled()
  })

  it('ignores videos hidden by display, visibility or zero opacity', async () => {
    const displayNone = addVideo({
      top: 0,
      left: 0,
      right: 1200,
      bottom: 700,
      width: 1200,
      height: 700
    })
    displayNone.element.style.display = 'none'
    const visibilityHidden = addVideo({
      top: 0,
      left: 0,
      right: 1100,
      bottom: 650,
      width: 1100,
      height: 650
    })
    visibilityHidden.element.style.visibility = 'hidden'
    const transparent = addVideo({
      top: 0,
      left: 0,
      right: 1000,
      bottom: 600,
      width: 1000,
      height: 600
    })
    transparent.element.style.opacity = '0'
    const primary = addVideo({
      top: 100,
      left: 100,
      right: 500,
      bottom: 400,
      width: 400,
      height: 300
    })
    const { page } = playbackPage()

    await triggerPrimaryPlayback(page)

    expect(primary.play).toHaveBeenCalledOnce()
    expect(displayNone.play).not.toHaveBeenCalled()
    expect(visibilityHidden.play).not.toHaveBeenCalled()
    expect(transparent.play).not.toHaveBeenCalled()
  })

  it('ignores videos with zero width or height', async () => {
    const zeroWidth = addVideo({ top: 0, left: 0, right: 0, bottom: 100, width: 0, height: 100 })
    const zeroHeight = addVideo({ top: 0, left: 0, right: 100, bottom: 0, width: 100, height: 0 })
    const { page } = playbackPage()

    await triggerPrimaryPlayback(page)

    expect(zeroWidth.play).not.toHaveBeenCalled()
    expect(zeroHeight.play).not.toHaveBeenCalled()
  })

  it('keeps the center click when there is no visible video', async () => {
    addVideo({ top: -100, left: -100, right: -50, bottom: -50, width: 50, height: 50 })
    const { page, click } = playbackPage()

    await expect(triggerPrimaryPlayback(page)).resolves.toBeUndefined()
    expect(click).toHaveBeenCalledWith(640, 360)
  })
})
