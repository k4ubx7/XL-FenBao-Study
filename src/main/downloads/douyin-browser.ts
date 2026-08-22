import type { VideoMetadata } from '../../shared/contracts'
import type { DouyinResolver } from './site-aware-adapter'

export interface DouyinCaptureResult {
  directUrl: string
  audioUrl?: string
  delivery: 'combined' | 'split'
  finalPageUrl: string
  title: string
  author: string
}

export type DouyinPageCapture = (
  url: string,
  signal?: AbortSignal
) => Promise<DouyinCaptureResult>

export interface DouyinMediaCapture {
  directUrl?: string
  audioUrl?: string
  delivery?: 'combined' | 'split'
  pairingKey?: string
  pairingAmbiguous?: boolean
}

export interface CompleteDouyinMediaCapture {
  directUrl: string
  audioUrl?: string
  delivery: 'combined' | 'split'
  pairingKey?: string
  pairingAmbiguous?: boolean
}

export type DouyinMediaKind = 'combined' | 'video' | 'audio'

const stablePairingIdentityParameters = [
  'video_id',
  'item_id',
  'aweme_id',
  'vid',
  'file_id'
] as const
const stableTosObjectIdPattern =
  /^(?=.{12,}$)(?=.*[a-z])(?=.*\d)[a-z0-9_-]+$/iu

export interface DouyinMediaObservation {
  url: string
  resourceType?: string
  contentType?: string
}

const blockedResourceTypes = new Set([
  'document',
  'stylesheet',
  'script',
  'image',
  'font'
])

function isKnownDouyinMediaHost(hostname: string): boolean {
  return (
    hostname === 'douyinvod.com' ||
    hostname.endsWith('.douyinvod.com') ||
    hostname === 'zjcdn.com' ||
    hostname.endsWith('.zjcdn.com')
  )
}

function isByteEffectTosHost(hostname: string): boolean {
  return (
    hostname === 'byteeffecttos.com' ||
    hostname.endsWith('.byteeffecttos.com')
  )
}

function contentKind(contentType?: string): 'audio' | 'video' | undefined {
  const value = contentType?.split(';', 1)[0]?.trim().toLowerCase()
  if (value?.startsWith('audio/')) return 'audio'
  if (value?.startsWith('video/')) return 'video'
  return undefined
}

export function classifyDouyinMediaObservation({
  url,
  resourceType,
  contentType
}: DouyinMediaObservation): DouyinMediaKind | undefined {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined
    }

    const hostname = parsed.hostname.toLowerCase()
    const pathname = parsed.pathname.toLowerCase()
    const normalizedResourceType = resourceType?.toLowerCase()
    const normalizedContentType = contentType?.toLowerCase().trim()
    if (
      (normalizedResourceType &&
        blockedResourceTypes.has(normalizedResourceType)) ||
      isByteEffectTosHost(hostname) ||
      hostname.includes('effectcdn') ||
      normalizedContentType?.startsWith('image/') ||
      normalizedContentType?.startsWith('text/') ||
      normalizedContentType?.includes('font')
    ) {
      return undefined
    }

    const knownHost = isKnownDouyinMediaHost(hostname)
    const mediaResource = normalizedResourceType === 'media'
    const responseKind = contentKind(contentType)
    const isTosVideoPath = pathname.includes('/video/tos/')

    if (
      pathname.includes('media-audio') &&
      (knownHost || mediaResource || Boolean(responseKind))
    ) {
      return 'audio'
    }
    if (
      pathname.includes('media-video') &&
      (knownHost || mediaResource || responseKind === 'video')
    ) {
      return 'video'
    }
    if (
      responseKind === 'audio' &&
      (mediaResource || isTosVideoPath)
    ) {
      return 'audio'
    }
    if (
      responseKind === 'video' &&
      (mediaResource || isTosVideoPath)
    ) {
      return 'combined'
    }
    if (
      knownHost &&
      isTosVideoPath &&
      parsed.searchParams.get('mime_type') === 'video_mp4'
    ) {
      return 'combined'
    }
  } catch {
    return undefined
  }

  return undefined
}

export function isDouyinVideoPageUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname.toLowerCase() === 'www.douyin.com' &&
      /^\/video\/\d+\/?$/u.test(parsed.pathname)
    )
  } catch {
    return false
  }
}

export function douyinMediaPairingKey(
  observation: DouyinMediaObservation
): string | undefined {
  const kind = classifyDouyinMediaObservation(observation)
  if (kind !== 'video' && kind !== 'audio') return undefined

  try {
    const parsed = new URL(observation.url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined
    }
    const pairedPathname = parsed.pathname.replace(
      /\/media-(?:video|audio)[^/]*/iu,
      '/:track'
    )
    if (pairedPathname === parsed.pathname) return undefined
    const stableIdentityValues = new Map<string, string>()
    for (const [name, value] of parsed.searchParams) {
      const normalizedName = name.toLowerCase()
      if (
        value &&
        stablePairingIdentityParameters.includes(
          normalizedName as (typeof stablePairingIdentityParameters)[number]
        ) &&
        !stableIdentityValues.has(normalizedName)
      ) {
        stableIdentityValues.set(normalizedName, value)
      }
    }
    const stableIdentity = stablePairingIdentityParameters.flatMap((name) => {
      const value = stableIdentityValues.get(name)
      return value === undefined
        ? []
        : [`${name}=${encodeURIComponent(value)}`]
    })
    const tosPathMatch = pairedPathname.match(
      /^\/video\/tos\/[a-z]{2}\/(?:tos-[a-z0-9-]+\/)?([^/]+)\/:track\/?$/iu
    )
    const hasStableTosObjectId = Boolean(
      tosPathMatch?.[1] && stableTosObjectIdPattern.test(tosPathMatch[1])
    )
    if (stableIdentity.length === 0 && !hasStableTosObjectId) return undefined

    return (
      `${parsed.origin}${pairedPathname}` +
      (stableIdentity.length ? `?${stableIdentity.join('&')}` : '')
    )
  } catch {
    return undefined
  }
}

export function addDouyinMediaCandidate(
  capture: DouyinMediaCapture,
  observation: DouyinMediaObservation
): DouyinMediaCapture {
  if (isDouyinMediaComplete(capture)) return capture

  const kind = classifyDouyinMediaObservation(observation)
  const pairingKey = douyinMediaPairingKey(observation)
  if (kind === 'combined') {
    return {
      directUrl: observation.url,
      delivery: 'combined'
    }
  }
  if (capture.pairingAmbiguous) return capture

  switch (kind) {
    case 'video':
      if (
        pairingKey &&
        capture.pairingKey === pairingKey &&
        capture.directUrl &&
        capture.directUrl !== observation.url
      ) {
        return { ...capture, pairingAmbiguous: true }
      }
      return {
        directUrl: observation.url,
        delivery: 'split',
        ...(pairingKey ? { pairingKey } : {}),
        ...(pairingKey &&
        capture.pairingKey === pairingKey &&
        capture.audioUrl
          ? { audioUrl: capture.audioUrl }
          : {})
      }
    case 'audio':
      if (
        pairingKey &&
        capture.pairingKey === pairingKey &&
        capture.audioUrl &&
        capture.audioUrl !== observation.url
      ) {
        return { ...capture, pairingAmbiguous: true }
      }
      return {
        ...(pairingKey &&
        capture.pairingKey === pairingKey &&
        capture.directUrl &&
        capture.delivery === 'split'
          ? { directUrl: capture.directUrl, delivery: capture.delivery }
          : {}),
        audioUrl: observation.url,
        ...(pairingKey ? { pairingKey } : {})
      }
    default:
      return capture
  }
}

export function isDouyinMediaComplete(
  capture: DouyinMediaCapture
): capture is CompleteDouyinMediaCapture {
  if (capture.pairingAmbiguous) return false
  if (!capture.directUrl || !capture.delivery) return false
  return capture.delivery === 'combined' || Boolean(capture.audioUrl)
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export function buildDouyinMetadata({
  directUrl,
  audioUrl,
  delivery,
  finalPageUrl,
  title,
  author
}: DouyinCaptureResult): VideoMetadata {
  if (!isDouyinVideoPageUrl(finalPageUrl)) {
    throw new Error('抖音链接已失效或不是视频页面')
  }
  const videoId = new URL(finalPageUrl).pathname.match(
    /^\/video\/(\d+)\/?$/u
  )?.[1]
  if (!videoId) throw new Error('抖音视频缺少有效 ID')
  if (!isHttpUrl(directUrl)) {
    throw new Error('抖音没有返回可下载的主视频')
  }
  if (delivery === 'split' && (!audioUrl || !isHttpUrl(audioUrl))) {
    throw new Error('抖音没有返回可合并的音频流')
  }

  const cleanTitle =
    title
      .replace(/\s*[-_|]\s*抖音(?:短视频)?(?:.*)?$/u, '')
      .trim() || `抖音视频_${videoId}`

  return {
    sourceUrl: directUrl,
    ...(delivery === 'split' && audioUrl ? { audioUrl } : {}),
    id: videoId,
    platform: '抖音',
    author: author.trim() || '未知作者',
    title: cleanTitle
  }
}

export class BrowserDouyinResolver implements DouyinResolver {
  constructor(private readonly capture: DouyinPageCapture) {}

  async resolve(
    url: string,
    signal?: AbortSignal
  ): Promise<VideoMetadata> {
    return buildDouyinMetadata(await this.capture(url, signal))
  }
}
