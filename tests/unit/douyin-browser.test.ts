import { describe, expect, it, vi } from 'vitest'
import {
  addDouyinMediaCandidate,
  buildDouyinMetadata,
  classifyDouyinMediaObservation,
  douyinMediaPairingKey,
  isDouyinMediaComplete,
  isDouyinVideoPageUrl
} from '../../src/main/downloads/douyin-browser'
import type { CompleteDouyinMediaCapture } from '../../src/main/downloads/douyin-browser'
import {
  browserLaunchArgs,
  captureTimeoutForMode,
  classifyDouyinCaptureTimeout,
  classifyDouyinBrowserError,
  bindDouyinNavigationEvents,
  createDouyinPageCapture,
  createDouyinMediaEpochController,
  createDouyinMediaObserver,
  createDouyinNavigationTracker,
  describeDouyinBrowserError,
  hasDouyinLoginCookie,
  prepareSingleCapturePage,
  retainDouyinMediaObservationSummary,
  resolveDouyinCaptureTimeoutFailure,
  summarizeDouyinMediaObservation,
  logDouyinCaptureFailure,
  waitForDouyinPageInformation
} from '../../src/main/downloads/playwright-douyin-capture'
import { DouyinCaptureFailure } from '../../src/main/downloads/douyin-login-session'
import type { SessionMarker } from '../../src/main/downloads/douyin-login-session'

const mainVideoUrl =
  'https://v3-web.douyinvod.com/video/tos/cn/tos-cn-ve-15/o.mp4?mime_type=video_mp4'
const splitVideoUrl =
  'https://v3-dy-o.zjcdn.com/video/tos/cn/demo/media-video-avc1/?mime_type=video_mp4'
const splitAudioUrl =
  'https://v3-dy-o.zjcdn.com/video/tos/cn/demo/media-audio-und-mp4a/?mime_type=video_mp4'
const unknownSplitVideo = {
  url: 'https://media-new.example/video/tos/cn/oA1b2C3d4E5f6G7h/media-video-avc1/?mime_type=video_mp4',
  resourceType: 'media',
  contentType: 'video/mp4'
}
const unknownSplitAudio = {
  url: 'https://media-new.example/video/tos/cn/oA1b2C3d4E5f6G7h/media-audio-und-mp4a/?mime_type=video_mp4',
  resourceType: 'media',
  contentType: 'video/mp4'
}

const splitVideoA = {
  url: 'https://MEDIA-new.example/video/tos/cn/oA1b2C3d4E5f6G7h/media-video-avc1/?token=video-a',
  resourceType: 'media',
  contentType: 'video/mp4'
}
const splitAudioA = {
  url: 'https://media-new.example/video/tos/cn/oA1b2C3d4E5f6G7h/media-audio-und-mp4a/?token=audio-a',
  resourceType: 'media',
  contentType: 'audio/mp4'
}
const splitVideoB = {
  url: 'https://media-new.example/video/tos/cn/oB1b2C3d4E5f6G7h/media-video-avc1/?token=video-b',
  resourceType: 'media',
  contentType: 'video/mp4'
}
const querySplitVideoA = {
  url: 'https://media-new.example/media-video?video_id=A',
  resourceType: 'media',
  contentType: 'video/mp4'
}
const querySplitAudioA = {
  url: 'https://media-new.example/media-audio?video_id=A',
  resourceType: 'media',
  contentType: 'audio/mp4'
}
const querySplitVideoB = {
  url: 'https://media-new.example/media-video?video_id=B',
  resourceType: 'media',
  contentType: 'video/mp4'
}
const genericSplitVideoA = {
  url: 'https://media-new.example/video/tos/media-video?token=A',
  resourceType: 'media',
  contentType: 'video/mp4'
}
const genericSplitVideoB = {
  url: 'https://media-new.example/video/tos/media-video?token=B',
  resourceType: 'media',
  contentType: 'video/mp4'
}
const genericSplitAudioA = {
  url: 'https://media-new.example/video/tos/media-audio?token=A',
  resourceType: 'media',
  contentType: 'audio/mp4'
}

type MediaEpochController = ReturnType<
  typeof createDouyinMediaEpochController
>

function createNavigationHarness(): {
  completed: CompleteDouyinMediaCapture[]
  controller: MediaEpochController
  tracker: {
    documentRequestStarted(request: object): void
    documentRequestSettled(request: object): void
    frameNavigated(url: string): void
  }
} {
  const completed: CompleteDouyinMediaCapture[] = []
  const observer = createDouyinMediaObserver((capture) =>
    completed.push(capture)
  )
  const controller = createDouyinMediaEpochController({
    observe: observer.observe,
    reset: observer.reset
  })
  return {
    completed,
    controller,
    tracker: createDouyinNavigationTracker(controller)
  }
}

describe('Douyin browser capture helpers', () => {
  it('keeps one epoch across same-document query, hash and trailing-slash updates', () => {
    const { completed, controller, tracker } = createNavigationHarness()
    const documentRequest = {}
    tracker.documentRequestStarted(documentRequest)
    tracker.frameNavigated(
      'https://www.douyin.com/video/7647483788033843429'
    )
    const establishedEpoch = controller.currentEpoch()
    controller.observeRequest(splitVideoA)

    tracker.frameNavigated(
      'https://www.douyin.com/video/7647483788033843429/?from=push#comments'
    )
    controller.observeRequest(splitAudioA)

    expect(controller.currentEpoch()).toBe(establishedEpoch)
    expect(completed).toHaveLength(1)
  })

  it('starts a new epoch for a same-document change to another video ID', () => {
    const { completed, controller, tracker } = createNavigationHarness()
    tracker.documentRequestStarted({})
    tracker.frameNavigated(
      'https://www.douyin.com/video/7647483788033843429'
    )
    const firstEpoch = controller.currentEpoch()
    controller.observeRequest(splitVideoA)

    tracker.frameNavigated(
      'https://www.douyin.com/video/7647483788033843430'
    )
    controller.observeRequest(splitAudioA)

    expect(controller.currentEpoch()).not.toBe(firstEpoch)
    expect(completed).toHaveLength(0)
  })

  it('starts a new epoch when a document request reloads the same video ID', () => {
    const { completed, controller, tracker } = createNavigationHarness()
    tracker.documentRequestStarted({})
    tracker.frameNavigated(
      'https://www.douyin.com/video/7647483788033843429'
    )
    const firstEpoch = controller.currentEpoch()
    controller.observeRequest(splitVideoA)

    tracker.documentRequestStarted({})
    tracker.frameNavigated(
      'https://www.douyin.com/video/7647483788033843429'
    )
    controller.observeRequest(splitAudioA)

    expect(controller.currentEpoch()).not.toBe(firstEpoch)
    expect(completed).toHaveLength(0)
  })

  it('does not mistake a same-document update for a failed document request', () => {
    const { completed, controller, tracker } = createNavigationHarness()
    tracker.documentRequestStarted({})
    tracker.frameNavigated(
      'https://www.douyin.com/video/7647483788033843429'
    )
    const establishedEpoch = controller.currentEpoch()
    controller.observeRequest(splitVideoA)
    const failedRequest = {}

    tracker.documentRequestStarted(failedRequest)
    tracker.documentRequestSettled(failedRequest)
    tracker.frameNavigated(
      'https://www.douyin.com/video/7647483788033843429?from=push#comments'
    )
    controller.observeRequest(splitAudioA)

    expect(controller.currentEpoch()).toBe(establishedEpoch)
    expect(completed).toHaveLength(1)
  })

  it('clears redirect requests after a successful hop and failed final hop', () => {
    const { completed, controller, tracker } = createNavigationHarness()
    tracker.documentRequestStarted({})
    tracker.frameNavigated(
      'https://www.douyin.com/video/7647483788033843429'
    )
    const establishedEpoch = controller.currentEpoch()
    controller.observeRequest(splitVideoA)
    const firstHop = {}
    const finalHop = {}

    tracker.documentRequestStarted(firstHop)
    tracker.documentRequestSettled(firstHop)
    tracker.documentRequestStarted(finalHop)
    tracker.documentRequestSettled(finalHop)
    tracker.frameNavigated(
      'https://www.douyin.com/video/7647483788033843429?from=push#comments'
    )
    controller.observeRequest(splitAudioA)

    expect(controller.currentEpoch()).toBe(establishedEpoch)
    expect(completed).toHaveLength(1)
  })

  it('settles main-frame document requests after finish or failure', () => {
    const listeners = new Map<string, (value: unknown) => void>()
    const mainFrame = {}
    const page = {
      mainFrame: () => mainFrame,
      on: vi.fn((event: string, listener: (value: unknown) => void) => {
        listeners.set(event, listener)
      })
    }
    const tracker = {
      documentRequestStarted: vi.fn(),
      documentRequestSettled: vi.fn(),
      frameNavigated: vi.fn()
    }
    const finishedRequest = {
      isNavigationRequest: () => true,
      frame: () => mainFrame
    }
    const failedRequest = {
      isNavigationRequest: () => true,
      frame: () => mainFrame
    }

    bindDouyinNavigationEvents(
      page as unknown as Parameters<typeof bindDouyinNavigationEvents>[0],
      tracker
    )
    listeners.get('request')?.(finishedRequest)
    listeners.get('requestfinished')?.(finishedRequest)
    listeners.get('request')?.(failedRequest)
    listeners.get('requestfailed')?.(failedRequest)

    expect(tracker.documentRequestStarted).toHaveBeenCalledTimes(2)
    expect(tracker.documentRequestSettled).toHaveBeenNthCalledWith(
      1,
      finishedRequest
    )
    expect(tracker.documentRequestSettled).toHaveBeenNthCalledWith(
      2,
      failedRequest
    )
  })

  it('derives the same stable split pairing key without query parameters', () => {
    expect(douyinMediaPairingKey(splitVideoA)).toBe(
      'https://media-new.example/video/tos/cn/oA1b2C3d4E5f6G7h/:track/'
    )
    expect(douyinMediaPairingKey(splitAudioA)).toBe(
      douyinMediaPairingKey(splitVideoA)
    )
    expect(douyinMediaPairingKey(splitVideoB)).not.toBe(
      douyinMediaPairingKey(splitVideoA)
    )
  })

  it('completes the right split group when stable query IDs share one path', () => {
    const completed: CompleteDouyinMediaCapture[] = []
    const observer = createDouyinMediaObserver((capture) =>
      completed.push(capture)
    )

    observer.observe(querySplitVideoA)
    observer.observe(querySplitVideoB)
    observer.observe(querySplitAudioA)

    expect(completed).toEqual([
      expect.objectContaining({
        directUrl: querySplitVideoA.url,
        audioUrl: querySplitAudioA.url,
        delivery: 'split'
      })
    ])
  })

  it('normalizes stable query names in fixed order and ignores token changes', () => {
    const video = {
      ...querySplitVideoA,
      url: 'https://MEDIA-new.example/media-video?VID=Clip-A&token=one&VIDEO_ID=A'
    }
    const audio = {
      ...querySplitAudioA,
      url: 'https://media-new.example/media-audio?video_id=A&signature=two&vid=Clip-A'
    }

    expect(douyinMediaPairingKey(video)).toBe(
      'https://media-new.example/:track?video_id=A&vid=Clip-A'
    )
    expect(douyinMediaPairingKey(audio)).toBe(
      douyinMediaPairingKey(video)
    )
  })

  it('fails closed when a split URL has no path or controlled query identity', () => {
    expect(
      douyinMediaPairingKey({
        url: 'https://media-new.example/media-video?token=one&signature=two',
        resourceType: 'media',
        contentType: 'video/mp4'
      })
    ).toBeUndefined()
  })

  it('fails closed for a generic structural path without a stable identity', () => {
    expect(douyinMediaPairingKey(genericSplitVideoA)).toBeUndefined()
    expect(douyinMediaPairingKey(genericSplitAudioA)).toBeUndefined()
  })

  it('does not freeze a cross-content pair from a generic structural path', () => {
    const completed: CompleteDouyinMediaCapture[] = []
    const observer = createDouyinMediaObserver((capture) =>
      completed.push(capture)
    )

    observer.observe(genericSplitVideoA)
    observer.observe(genericSplitVideoB)
    observer.observe(genericSplitAudioA)

    expect(completed).toHaveLength(0)
  })

  it.each(['stream', 'play', 'v1'])(
    'fails closed for the fixed TOS path segment %s across different tokens',
    (segment) => {
      const completed: CompleteDouyinMediaCapture[] = []
      const observer = createDouyinMediaObserver((capture) =>
        completed.push(capture)
      )
      const video = {
        url: `https://media-new.example/video/tos/cn/${segment}/media-video?token=A`,
        resourceType: 'media',
        contentType: 'video/mp4'
      }
      const audio = {
        url: `https://media-new.example/video/tos/cn/${segment}/media-audio?token=B`,
        resourceType: 'media',
        contentType: 'audio/mp4'
      }

      expect(douyinMediaPairingKey(video)).toBeUndefined()
      expect(douyinMediaPairingKey(audio)).toBeUndefined()

      observer.observe(video)
      observer.observe(audio)

      expect(completed).toHaveLength(0)
    }
  )

  it('marks one key ambiguous after a second distinct same-kind URL', () => {
    const completed: CompleteDouyinMediaCapture[] = []
    const observer = createDouyinMediaObserver((capture) =>
      completed.push(capture)
    )
    const videoA = {
      ...splitVideoA,
      url: 'https://media-new.example/video/tos/cn/oS1t2A3b4L5e6I7d/media-video?token=A'
    }
    const videoB = {
      ...splitVideoB,
      url: 'https://media-new.example/video/tos/cn/oS1t2A3b4L5e6I7d/media-video?token=B'
    }
    const audioA = {
      ...splitAudioA,
      url: 'https://media-new.example/video/tos/cn/oS1t2A3b4L5e6I7d/media-audio?token=A'
    }

    observer.observe(videoA)
    observer.observe(videoB)
    observer.observe(audioA)

    expect(completed).toHaveLength(0)
    expect(isDouyinMediaComplete(observer.current())).toBe(false)
  })

  it('keeps protocol and port in the split pairing origin', () => {
    const secure = {
      ...querySplitVideoA,
      url: 'https://media-new.example:8443/media-video?video_id=A'
    }
    const insecure = {
      ...querySplitAudioA,
      url: 'http://media-new.example:8443/media-audio?video_id=A'
    }
    const anotherPort = {
      ...querySplitAudioA,
      url: 'https://media-new.example:9443/media-audio?video_id=A'
    }

    expect(douyinMediaPairingKey(secure)).not.toBe(
      douyinMediaPairingKey(insecure)
    )
    expect(douyinMediaPairingKey(secure)).not.toBe(
      douyinMediaPairingKey(anotherPort)
    )
  })

  it('keeps interleaved split candidates isolated by pairing key', () => {
    const completed: CompleteDouyinMediaCapture[] = []
    const observer = createDouyinMediaObserver((capture) =>
      completed.push(capture)
    )

    observer.observe(splitVideoA)
    observer.observe(splitVideoB)
    observer.observe(splitAudioA)

    expect(completed).toEqual([
      expect.objectContaining({
        directUrl: splitVideoA.url,
        audioUrl: splitAudioA.url,
        delivery: 'split'
      })
    ])
  })

  it('does not pair an audio candidate with a video from another key', () => {
    const audioOnly = addDouyinMediaCandidate({}, splitAudioA)
    const mismatched = addDouyinMediaCandidate(audioOnly, splitVideoB)

    expect(isDouyinMediaComplete(mismatched)).toBe(false)
    expect(mismatched).not.toMatchObject({ audioUrl: splitAudioA.url })
  })

  it('resets an incomplete split group before accepting another epoch', () => {
    const completed: CompleteDouyinMediaCapture[] = []
    const observer = createDouyinMediaObserver((capture) =>
      completed.push(capture)
    )

    observer.observe(splitVideoA)
    observer.reset()
    observer.observe(splitAudioA)

    expect(completed).toHaveLength(0)
    expect(isDouyinMediaComplete(observer.current())).toBe(false)
  })

  it('accepts media only inside a canonical navigation epoch', () => {
    const completed: CompleteDouyinMediaCapture[] = []
    const observer = createDouyinMediaObserver((capture) =>
      completed.push(capture)
    )
    const controller = createDouyinMediaEpochController({
      observe: observer.observe,
      reset: observer.reset
    })

    expect(controller.observeRequest(splitVideoA)).toBeUndefined()
    controller.navigate('https://www.douyin.com/video/7647483788033843429')
    expect(controller.observeRequest(splitVideoA)).toBeTypeOf('number')
    controller.navigate('https://www.douyin.com/video/7647483788033843429')
    controller.observeRequest(splitAudioA)

    expect(completed).toHaveLength(0)
  })

  it('ignores a response whose Content-Type resolves after the epoch changes', async () => {
    const observed = vi.fn()
    let resolveContentType: ((value: string | null) => void) | undefined
    const contentType = new Promise<string | null>((resolve) => {
      resolveContentType = resolve
    })

    const controller = createDouyinMediaEpochController({
      observe: observed,
      reset: vi.fn()
    })
    controller.navigate('https://www.douyin.com/video/7647483788033843429')
    const responseEpoch = controller.currentEpoch()
    expect(responseEpoch).toBeTypeOf('number')
    const pending = controller.observeResponse(
      responseEpoch!,
      {
        url: splitAudioA.url,
        resourceType: splitAudioA.resourceType
      },
      () => contentType
    )

    controller.navigate('https://www.douyin.com/video/7647483788033843429')
    resolveContentType?.('audio/mp4')
    await pending

    expect(observed).not.toHaveBeenCalled()
  })

  it('does not start another epoch for the same canonical page without its trailing slash', () => {
    const completed: CompleteDouyinMediaCapture[] = []
    const observer = createDouyinMediaObserver((capture) =>
      completed.push(capture)
    )
    const controller = createDouyinMediaEpochController({
      observe: observer.observe,
      reset: observer.reset
    })

    controller.navigate('https://www.douyin.com/video/7647483788033843429/')
    const establishedEpoch = controller.observeRequest(splitVideoA)
    controller.ensureCanonical(
      'https://www.douyin.com/video/7647483788033843429'
    )
    controller.observeRequest(splitAudioA)

    expect(controller.currentEpoch()).toBe(establishedEpoch)
    expect(completed).toHaveLength(1)
  })

  it('uses response Content-Type to accept an unknown CDN', () => {
    const completed: CompleteDouyinMediaCapture[] = []
    const observer = createDouyinMediaObserver((capture) => completed.push(capture))

    observer.observe({
      url: 'https://media-new.example/video/tos/cn/oA1b2C3d4E5f6G7h/media-video-avc1/',
      resourceType: 'fetch',
      contentType: 'video/mp4'
    })
    observer.observe({
      url: 'https://media-new.example/video/tos/cn/oA1b2C3d4E5f6G7h/media-audio-und-mp4a/',
      resourceType: 'fetch',
      contentType: 'audio/mp4'
    })

    expect(completed).toHaveLength(1)
    expect(completed[0].delivery).toBe('split')
  })

  it('emits once when the same complete candidate is observed by request and response', () => {
    const completed: CompleteDouyinMediaCapture[] = []
    const observer = createDouyinMediaObserver((capture) => completed.push(capture))
    const url = mainVideoUrl

    observer.observe({ url, resourceType: 'fetch' })
    observer.observe({ url, resourceType: 'media', contentType: 'video/mp4' })

    expect(completed).toHaveLength(1)
  })

  it('keeps the first combined capture after a later split video candidate', () => {
    const completed: CompleteDouyinMediaCapture[] = []
    const observer = createDouyinMediaObserver((capture) => completed.push(capture))

    observer.observe({ url: mainVideoUrl, resourceType: 'fetch' })
    observer.observe({
      url: 'https://media-new.example/video/tos/id/media-video-avc1/',
      resourceType: 'media'
    })

    expect(completed).toHaveLength(1)
    expect(observer.current()).toEqual({
      directUrl: mainVideoUrl,
      delivery: 'combined'
    })
    expect(isDouyinMediaComplete(observer.current())).toBe(true)
  })

  it('completes split capture when audio is observed before video', () => {
    const completed: CompleteDouyinMediaCapture[] = []
    const observer = createDouyinMediaObserver((capture) => completed.push(capture))

    observer.observe({
      url: 'https://media-new.example/video/tos/cn/oA1b2C3d4E5f6G7h/media-audio-und-mp4a/',
      resourceType: 'fetch',
      contentType: 'audio/mp4'
    })
    observer.observe({
      url: 'https://media-new.example/video/tos/cn/oA1b2C3d4E5f6G7h/media-video-avc1/',
      resourceType: 'fetch',
      contentType: 'video/mp4'
    })

    expect(completed).toHaveLength(1)
    expect(completed[0]).toMatchObject({ delivery: 'split' })
  })

  it('does not emit again for candidates observed after completion', () => {
    const completed: CompleteDouyinMediaCapture[] = []
    const observer = createDouyinMediaObserver((capture) => completed.push(capture))

    observer.observe({
      url: 'https://media-new.example/video/tos/cn/oA1b2C3d4E5f6G7h/media-video-avc1/',
      resourceType: 'media'
    })
    observer.observe({
      url: 'https://media-new.example/video/tos/cn/oA1b2C3d4E5f6G7h/media-audio-und-mp4a/',
      resourceType: 'fetch',
      contentType: 'audio/mp4'
    })
    observer.observe({
      url: 'https://media-new.example/video/tos/id/another-video/',
      resourceType: 'media'
    })

    expect(completed).toHaveLength(1)
  })

  it('accepts an unknown CDN only when multiple media signals agree', () => {
    expect(classifyDouyinMediaObservation(unknownSplitVideo)).toBe('video')
    expect(classifyDouyinMediaObservation(unknownSplitAudio)).toBe('audio')
    expect(
      classifyDouyinMediaObservation({
        url: 'https://media-new.example/object.mp4?mime_type=video_mp4',
        resourceType: 'xhr'
      })
    ).toBeUndefined()
  })

  it('rejects effect, image, script and non-media observations', () => {
    expect(
      classifyDouyinMediaObservation({
        url: 'https://lf3-effectcdn-tos.byteeffecttos.com/obj/ies-fe-bee/bee.mp4',
        resourceType: 'media',
        contentType: 'video/mp4'
      })
    ).toBeUndefined()
    expect(
      classifyDouyinMediaObservation({
        url: 'https://media-new.example/poster.jpg',
        resourceType: 'image',
        contentType: 'image/jpeg'
      })
    ).toBeUndefined()
    expect(
      classifyDouyinMediaObservation({
        url: 'https://media-new.example/player.js',
        resourceType: 'script',
        contentType: 'text/javascript'
      })
    ).toBeUndefined()
  })

  it('enforces media classification safety boundaries', () => {
    const cases: Array<{
      observation: Parameters<typeof classifyDouyinMediaObservation>[0]
      expected: ReturnType<typeof classifyDouyinMediaObservation>
    }> = [
      {
        observation: {
          url: 'file:///video/tos/item.mp4',
          resourceType: 'media',
          contentType: 'video/mp4'
        },
        expected: undefined
      },
      ...['document', 'stylesheet', 'font'].map((resourceType) => ({
        observation: {
          url: 'https://media-new.example/video/tos/item.mp4',
          resourceType,
          contentType: 'video/mp4'
        },
        expected: undefined
      })),
      {
        observation: {
          url: 'https://media-new.example/object',
          contentType: 'video/mp4'
        },
        expected: undefined
      },
      {
        observation: {
          url: 'https://media-new.example/object',
          resourceType: 'media',
          contentType: 'video/mp4'
        },
        expected: 'combined'
      },
      {
        observation: {
          url: 'https://media-new.example/video/tos/item',
          contentType: 'Audio/MP4; charset=binary'
        },
        expected: 'audio'
      },
      {
        observation: {
          url: 'https://v3-web.douyinvod.com/video/tos/item?mime_type=video_mp4'
        },
        expected: 'combined'
      },
      ...['https://byteeffecttos.com/video/tos/item', 'https://cdn.byteeffecttos.com/video/tos/item'].map(
        (url) => ({
          observation: {
            url,
            resourceType: 'media',
            contentType: 'video/mp4'
          },
          expected: undefined
        })
      ),
      {
        observation: {
          url: 'https://notbyteeffecttos.com/video/tos/item',
          resourceType: 'media',
          contentType: 'video/mp4'
        },
        expected: 'combined'
      }
    ]

    for (const { observation, expected } of cases) {
      expect(classifyDouyinMediaObservation(observation)).toBe(expected)
    }
  })

  it('accepts a canonical video page even when Douyin adds query parameters', () => {
    expect(
      isDouyinVideoPageUrl(
        'https://www.douyin.com/video/7647483788033843429?previous_page=web_code_link'
      )
    ).toBe(true)
    expect(isDouyinVideoPageUrl('https://www.douyin.com/')).toBe(false)
  })

  it('pairs split streams from an unknown CDN and preserves delivery mode', () => {
    const videoOnly = addDouyinMediaCandidate({}, unknownSplitVideo)
    expect(videoOnly).toMatchObject({
      directUrl: unknownSplitVideo.url,
      delivery: 'split'
    })
    expect(isDouyinMediaComplete(videoOnly)).toBe(false)

    const complete = addDouyinMediaCandidate(videoOnly, unknownSplitAudio)
    expect(isDouyinMediaComplete(complete)).toBe(true)
    expect(complete).toMatchObject({
      directUrl: unknownSplitVideo.url,
      audioUrl: unknownSplitAudio.url,
      delivery: 'split'
    })
  })

  it('completes a combined response without waiting for audio', () => {
    const complete = addDouyinMediaCandidate({}, {
      url: 'https://media-new.example/chunk/1',
      resourceType: 'media',
      contentType: 'video/mp4'
    })

    expect(isDouyinMediaComplete(complete)).toBe(true)
    expect(complete.delivery).toBe('combined')
  })

  it('clears a stale split audio track when a combined response arrives', () => {
    const audioOnly = addDouyinMediaCandidate({}, unknownSplitAudio)
    const combined = addDouyinMediaCandidate(audioOnly, {
      url: 'https://media-new.example/chunk/2',
      resourceType: 'media',
      contentType: 'video/mp4'
    })

    expect(isDouyinMediaComplete(combined)).toBe(true)
    expect(combined).toEqual({
      directUrl: 'https://media-new.example/chunk/2',
      delivery: 'combined'
    })
  })

  it('builds useful metadata from the redirected video page', () => {
    expect(
      buildDouyinMetadata({
        directUrl: 'https://media-new.example/chunk/1',
        delivery: 'combined',
        finalPageUrl:
          'https://www.douyin.com/video/7647483788033843429',
        title: '前端开发5个顶级动画库 - 抖音',
        author: '粉包课堂'
      })
    ).toEqual({
      sourceUrl: 'https://media-new.example/chunk/1',
      id: '7647483788033843429',
      platform: '抖音',
      author: '粉包课堂',
      title: '前端开发5个顶级动画库'
    })
  })

  it('keeps the paired audio track in metadata for split delivery', () => {
    expect(
      buildDouyinMetadata({
        directUrl: splitVideoUrl,
        audioUrl: splitAudioUrl,
        delivery: 'split',
        finalPageUrl:
          'https://www.douyin.com/video/7647483788033843429',
        title: 'Split delivery - Douyin',
        author: 'Fenbao'
      })
    ).toMatchObject({
      sourceUrl: splitVideoUrl,
      audioUrl: splitAudioUrl
    })
  })

  it('rejects a non-HTTP(S) direct URL for combined delivery', () => {
    expect(() =>
      buildDouyinMetadata({
        directUrl: 'ftp://media-new.example/chunk/1',
        delivery: 'combined',
        finalPageUrl:
          'https://www.douyin.com/video/7647483788033843429',
        title: 'Combined delivery',
        author: 'Fenbao'
      })
    ).toThrow('抖音没有返回可下载的主视频')
  })

  it('rejects split delivery without an audio URL', () => {
    expect(() =>
      buildDouyinMetadata({
        directUrl: 'https://media-new.example/video/1',
        delivery: 'split',
        finalPageUrl:
          'https://www.douyin.com/video/7647483788033843429',
        title: 'Split delivery',
        author: 'Fenbao'
      })
    ).toThrow('抖音没有返回可合并的音频流')
  })

  it('rejects a non-HTTP(S) audio URL for split delivery', () => {
    expect(() =>
      buildDouyinMetadata({
        directUrl: 'https://media-new.example/video/1',
        audioUrl: 'ftp://media-new.example/audio/1',
        delivery: 'split',
        finalPageUrl:
          'https://www.douyin.com/video/7647483788033843429',
        title: 'Split delivery',
        author: 'Fenbao'
      })
    ).toThrow('抖音没有返回可合并的音频流')
  })

  it('rejects a share link that redirects to the Douyin home page', () => {
    expect(() =>
      buildDouyinMetadata({
        directUrl: mainVideoUrl,
        delivery: 'combined',
        finalPageUrl: 'https://www.douyin.com/',
        title: '抖音-记录美好生活',
        author: ''
      })
    ).toThrow('链接已失效')
  })

  it('translates a browser connection rejection into a useful retry message', () => {
    expect(
      describeDouyinBrowserError(
        new Error(
          'page.goto: net::ERR_CONNECTION_CLOSED at https://www.douyin.com/video/1'
        )
      )
    ).toBe('抖音暂时拒绝连接，请稍后重新点击下载')
  })

  it('uses an on-screen interactive window and a longer login timeout', () => {
    expect(browserLaunchArgs('interactive')).toContain(
      '--window-position=120,80'
    )
    expect(browserLaunchArgs('interactive')).not.toContain(
      '--window-position=-10000,-10000'
    )
    expect(browserLaunchArgs('background')).toContain(
      '--window-position=-10000,-10000'
    )
    expect(captureTimeoutForMode('interactive')).toBe(300_000)
    expect(captureTimeoutForMode('background')).toBe(45_000)
  })

  it('recognizes the isolated browser login cookies', () => {
    expect(hasDouyinLoginCookie([{ name: 'sessionid_ss' }])).toBe(true)
    expect(hasDouyinLoginCookie([{ name: '__ac_nonce' }])).toBe(false)
  })

  it('reports an unrecognized stream when interactive login cookies exist', () => {
    expect(
      classifyDouyinCaptureTimeout('interactive', [{ name: 'sessionid_ss' }])
    ).toMatchObject({
      reason: 'stream-unrecognized',
      message: '页面已登录，但未识别到可下载媒体，请稍后重试'
    })
  })

  it('keeps login guidance when interactive cookies are absent', () => {
    expect(classifyDouyinCaptureTimeout('interactive', [])).toMatchObject({
      reason: 'login-timeout'
    })
  })

  it('requires login after a background timeout regardless of cookies', () => {
    expect(
      classifyDouyinCaptureTimeout('background', [{ name: 'sessionid_ss' }])
    ).toMatchObject({ reason: 'login-required' })
    expect(classifyDouyinCaptureTimeout('background', [])).toMatchObject({
      reason: 'login-required'
    })
  })

  it('summarizes media observations without exposing signed URLs', () => {
    const summary = summarizeDouyinMediaObservation({
      url: 'https://media-new.example/video/tos/id/media-video-avc1/?token=secret&mime_type=video_mp4',
      resourceType: 'media',
      contentType: 'video/mp4; charset=binary'
    })

    expect(summary).toContain('media-new.example')
    expect(summary).toContain('media-video')
    expect(summary).not.toContain('secret')
    expect(summary).not.toContain('token=')
    expect(summary).not.toContain('/video/tos/id/')
    expect(summary).toBe(
      'host=media-new.example resource=media content-type=video/mp4 flags=video/tos,media-video'
    )
  })

  it('keeps media observation summaries to safe normalized fields', () => {
    const summary = summarizeDouyinMediaObservation({
      url: 'not a url?token=secret/path/media-video-avc1',
      resourceType: 'MEDIA; cookie=sessionid_ss',
      contentType: 'Video/MP4; charset=binary'
    })

    expect(summary).toContain('invalid-host')
    expect(summary).toContain('unknown')
    expect(summary).toContain('video/mp4')
    expect(summary).not.toContain('not a url')
    expect(summary).not.toContain('secret')
    expect(summary).not.toContain('sessionid_ss')
    expect(summary).not.toContain('/path/')
  })

  it('deduplicates media diagnostics and retains at most twelve summaries', () => {
    const observation = (host: string) => ({
      url: `https://${host}/video/tos/id/media-video-avc1/?token=secret`,
      resourceType: 'media',
      contentType: 'video/mp4'
    })
    let summaries: readonly string[] = []

    summaries = retainDouyinMediaObservationSummary(summaries, observation('cdn-0.example'))
    summaries = retainDouyinMediaObservationSummary(summaries, observation('cdn-0.example'))
    for (let index = 1; index <= 12; index += 1) {
      summaries = retainDouyinMediaObservationSummary(
        summaries,
        observation(`cdn-${index}.example`)
      )
    }

    expect(summaries).toHaveLength(12)
    expect(summaries.filter((summary) => summary.includes('cdn-0.example'))).toHaveLength(1)
    expect(summaries.some((summary) => summary.includes('cdn-12.example'))).toBe(false)
  })

  it('prioritizes likely-media diagnostics without filling capacity with ordinary resources', () => {
    let summaries: readonly string[] = []
    const firstOrdinary = {
      url: 'https://www.douyin.com/ordinary/first?token=secret',
      resourceType: 'document'
    }
    expect(
      retainDouyinMediaObservationSummary(summaries, firstOrdinary)
    ).toBe(summaries)
    for (let index = 0; index < 13; index += 1) {
      summaries = retainDouyinMediaObservationSummary(summaries, {
        url: `https://www.douyin.com/ordinary/${index}?token=secret`,
        resourceType: index % 2 === 0 ? 'document' : 'fetch'
      })
    }
    const media = {
      url: 'https://cdn-media.example/video/tos/id/media-video-avc1/?token=secret',
      resourceType: 'media'
    }
    const afterMedia = retainDouyinMediaObservationSummary(summaries, media)

    expect(summaries).toEqual([])
    expect(afterMedia).toHaveLength(1)
    expect(retainDouyinMediaObservationSummary(afterMedia, media)).toBe(
      afterMedia
    )
  })

  it('keeps media diagnostic order and returns the current list after capacity is reached', () => {
    let summaries: readonly string[] = []
    for (let index = 0; index < 12; index += 1) {
      summaries = retainDouyinMediaObservationSummary(summaries, {
        url: `https://cdn-${index}.example/video/tos/id/media-video-avc1/`,
        resourceType: 'media'
      })
    }
    const overflow = retainDouyinMediaObservationSummary(summaries, {
      url: 'https://cdn-12.example/video/tos/id/media-video-avc1/',
      resourceType: 'media'
    })

    expect(summaries[0]).toContain('cdn-0.example')
    expect(summaries[11]).toContain('cdn-11.example')
    expect(overflow).toBe(summaries)
  })

  it('keeps diagnostics ASCII-safe when resource fields contain controls', () => {
    const summary = summarizeDouyinMediaObservation({
      url: 'https://user:password@media-new.example/private/account/video/tos/id/media-video-avc1/?token=secret',
      resourceType: 'me\r\ndia',
      contentType: 'vid\u202Eeo/mp4; cookie=sessionid_ss'
    })

    expect(summary).toBe(
      'host=media-new.example resource=unknown content-type=unknown flags=video/tos,media-video'
    )
    expect(summary).toMatch(/^[\x20-\x7e]+$/u)
    expect(summary).not.toContain('password')
    expect(summary).not.toContain('secret')
    expect(summary).not.toContain('/private/account/')
  })

  it('uses the current cookie reader to classify capture timeouts', async () => {
    const readCookies = vi.fn().mockResolvedValue([{ name: 'sessionid_ss' }])

    await expect(
      resolveDouyinCaptureTimeoutFailure('interactive', readCookies)
    ).resolves.toMatchObject({ reason: 'stream-unrecognized' })
    expect(readCookies).toHaveBeenCalledOnce()
  })

  it('keeps login guidance when timeout cookie reading fails', async () => {
    await expect(
      resolveDouyinCaptureTimeoutFailure('interactive', async () => {
        throw new Error('cookie reader failed')
      })
    ).resolves.toMatchObject({ reason: 'login-timeout' })
  })

  it('requires login for background timeouts even when cookie reading succeeds', async () => {
    await expect(
      resolveDouyinCaptureTimeoutFailure('background', async () => [
        { name: 'sessionid_ss' }
      ])
    ).resolves.toMatchObject({ reason: 'login-required' })
  })

  it('logs only safe summaries for unrecognized streams', () => {
    const logger = vi.fn()
    const summaries = [
      summarizeDouyinMediaObservation({
        url: 'https://media-new.example/video/tos/id/media-video-avc1/?token=secret',
        resourceType: 'media',
        contentType: 'video/mp4'
      })
    ]
    const failure = new DouyinCaptureFailure(
      'stream-unrecognized',
      '页面已登录，但未识别到可下载媒体，请稍后重试'
    )

    logDouyinCaptureFailure(failure, summaries, logger)

    expect(logger).toHaveBeenCalledWith(
      '[粉包抖音抓流]',
      failure.message,
      summaries
    )
    expect(logger.mock.calls.flat()).not.toContain(failure)
    expect(JSON.stringify(logger.mock.calls)).not.toContain('token=secret')
    expect(JSON.stringify(logger.mock.calls)).not.toContain('sessionid_ss')
  })

  it('does not attach media summaries to ordinary capture failures', () => {
    const logger = vi.fn()
    const failure = new DouyinCaptureFailure('login-required', '抖音会话需要登录')

    logDouyinCaptureFailure(failure, ['host=media-new.example'], logger)

    expect(logger).toHaveBeenCalledWith('[粉包抖音抓流]', failure.message)
  })

  it('preserves an existing capture failure unchanged', () => {
    const failure = new DouyinCaptureFailure(
      'stream-unrecognized',
      '页面已登录，但未识别到可下载媒体，请稍后重试'
    )

    expect(classifyDouyinBrowserError(failure, 'interactive')).toBe(failure)
  })

  it('waits briefly for the content title after media capture', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ title: '', author: '' })
      .mockResolvedValueOnce({
        title: '局部最优陷阱 - 抖音',
        author: '粉包课堂'
      })
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(
      waitForDouyinPageInformation(read, {
        sleep,
        attempts: 3,
        intervalMs: 10
      })
    ).resolves.toEqual({
      title: '局部最优陷阱 - 抖音',
      author: '粉包课堂'
    })
    expect(read).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(10)
  })

  it('closes restored tabs so only the active capture page keeps loading', async () => {
    const activePage = { close: vi.fn() }
    const restoredPage = { close: vi.fn().mockResolvedValue(undefined) }
    const context = {
      pages: vi.fn().mockReturnValue([activePage, restoredPage]),
      newPage: vi.fn()
    }

    await expect(
      prepareSingleCapturePage(
        context as unknown as Parameters<typeof prepareSingleCapturePage>[0]
      )
    ).resolves.toBe(activePage)
    expect(restoredPage.close).toHaveBeenCalledOnce()
    expect(activePage.close).not.toHaveBeenCalled()
    expect(context.newPage).not.toHaveBeenCalled()
  })

  it('maps a background no-stream timeout to login fallback', () => {
    expect(
      classifyDouyinBrowserError(
        new Error('no video stream'),
        'background'
      )
    ).toMatchObject({ reason: 'login-required' })
  })

  it('maps an interactive timeout to a user login instruction', () => {
    const failure = classifyDouyinBrowserError(
      new Error('no video stream'),
      'interactive'
    )

    expect(failure).toMatchObject({ reason: 'login-timeout' })
    expect(failure.message).toBe(
      '登录未完成，请重新点击下载后在弹出的窗口登录'
    )
  })

  it('opens the interactive attempt when the persistent session is not ready', async () => {
    const marker: SessionMarker = {
      isReady: vi.fn().mockResolvedValue(false),
      markReady: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined)
    }
    const attempt = vi.fn().mockResolvedValue({
      directUrl: mainVideoUrl,
      delivery: 'combined',
      finalPageUrl: 'https://www.douyin.com/video/7647483788033843429',
      title: '登录后的视频',
      author: '粉包课堂'
    })
    const capture = createDouyinPageCapture('D:\\data\\douyin-browser', {
      attempt,
      marker
    })

    await expect(
      capture('https://v.douyin.com/example/')
    ).resolves.toMatchObject({ title: '登录后的视频' })
    expect(attempt).toHaveBeenCalledWith(
      'https://v.douyin.com/example/',
      'interactive',
      undefined
    )
    expect(marker.markReady).toHaveBeenCalledOnce()
  })
})
