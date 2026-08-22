import {
  chromium,
  type BrowserContext,
  type Page,
  type Request
} from 'playwright-core'
import { join } from 'node:path'
import type {
  DouyinCaptureResult,
  DouyinPageCapture
} from './douyin-browser'
import {
  addDouyinMediaCandidate,
  douyinMediaPairingKey,
  isDouyinMediaComplete,
  isDouyinVideoPageUrl,
  type CompleteDouyinMediaCapture,
  type DouyinMediaCapture,
  type DouyinMediaObservation
} from './douyin-browser'
import {
  captureWithLoginFallback,
  DouyinCaptureFailure,
  type DouyinCaptureMode,
  type SessionMarker
} from './douyin-login-session'
import { FileSessionMarker } from './file-session-marker'

const NAVIGATION_TIMEOUT_MS = 30_000
const BACKGROUND_CAPTURE_TIMEOUT_MS = 45_000
const INTERACTIVE_CAPTURE_TIMEOUT_MS = 300_000
const CHROME_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const LOGIN_COOKIE_NAMES = new Set([
  'sessionid',
  'sessionid_ss',
  'sid_guard',
  'uid_tt',
  'uid_tt_ss'
])

export function createDouyinMediaObserver(
  onComplete: (capture: CompleteDouyinMediaCapture) => void
): {
  observe(observation: DouyinMediaObservation): void
  current(): DouyinMediaCapture
  reset(): void
} {
  let capture: DouyinMediaCapture = {}
  let completed = false
  const splitCaptures = new Map<string, DouyinMediaCapture>()

  return {
    observe(observation): void {
      if (completed) return
      const pairingKey = douyinMediaPairingKey(observation)
      capture = addDouyinMediaCandidate(
        pairingKey ? (splitCaptures.get(pairingKey) ?? {}) : {},
        observation
      )
      if (pairingKey) {
        splitCaptures.set(pairingKey, capture)
      }
      if (isDouyinMediaComplete(capture)) {
        completed = true
        onComplete(capture)
      }
    },
    current(): DouyinMediaCapture {
      return capture
    },
    reset(): void {
      if (completed) return
      capture = {}
      splitCaptures.clear()
    }
  }
}

export function createDouyinMediaEpochController(callbacks: {
  observe(observation: DouyinMediaObservation): void
  reset(): void
  onEpochChange?(): void
}): {
  navigate(url: string): void
  ensureCanonical(url: string): void
  currentEpoch(): number | undefined
  observeRequest(observation: DouyinMediaObservation): number | undefined
  observeResponse(
    epoch: number,
    observation: Omit<DouyinMediaObservation, 'contentType'>,
    readContentType: () => Promise<string | null>
  ): Promise<void>
} {
  let epoch = 0
  let canonicalPage: string | undefined

  const canonicalIdentity = (value: string): string | undefined => {
    if (!isDouyinVideoPageUrl(value)) return undefined
    const parsed = new URL(value)
    const pathname = parsed.pathname.replace(/\/$/u, '')
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname}`
  }
  const isCurrent = (candidate: number): boolean =>
    canonicalPage !== undefined && candidate === epoch
  const navigate = (url: string): void => {
    epoch += 1
    canonicalPage = canonicalIdentity(url)
    callbacks.reset()
    callbacks.onEpochChange?.()
  }

  return {
    navigate,
    ensureCanonical(url): void {
      const identity = canonicalIdentity(url)
      if (identity !== canonicalPage) {
        navigate(url)
      }
    },
    currentEpoch(): number | undefined {
      return canonicalPage ? epoch : undefined
    },
    observeRequest(observation): number | undefined {
      if (!canonicalPage) return undefined
      callbacks.observe(observation)
      return epoch
    },
    async observeResponse(
      responseEpoch,
      observation,
      readContentType
    ): Promise<void> {
      if (!isCurrent(responseEpoch)) return
      const contentType = await readContentType()
      if (!isCurrent(responseEpoch)) return
      callbacks.observe({
        ...observation,
        contentType: contentType ?? undefined
      })
    }
  }
}

export interface DouyinNavigationTracker {
  documentRequestStarted(request: object): void
  documentRequestSettled(request: object): void
  frameNavigated(url: string): void
}

export function createDouyinNavigationTracker(controller: Pick<
  ReturnType<typeof createDouyinMediaEpochController>,
  'navigate' | 'ensureCanonical'
>): DouyinNavigationTracker {
  const pendingDocumentRequests = new Set<object>()

  return {
    documentRequestStarted(request): void {
      pendingDocumentRequests.add(request)
    },
    documentRequestSettled(request): void {
      pendingDocumentRequests.delete(request)
    },
    frameNavigated(url): void {
      if (pendingDocumentRequests.size > 0) {
        pendingDocumentRequests.clear()
        controller.navigate(url)
        return
      }
      controller.ensureCanonical(url)
    }
  }
}

export function bindDouyinNavigationEvents(
  page: Pick<Page, 'mainFrame' | 'on'>,
  tracker: DouyinNavigationTracker
): void {
  const isMainFrameNavigation = (request: Request): boolean =>
    request.isNavigationRequest() && request.frame() === page.mainFrame()
  const settleDocumentRequest = (request: Request): void => {
    if (isMainFrameNavigation(request)) {
      tracker.documentRequestSettled(request)
    }
  }

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      tracker.frameNavigated(frame.url())
    }
  })
  page.on('request', (request) => {
    if (isMainFrameNavigation(request)) {
      tracker.documentRequestStarted(request)
    }
  })
  page.on('requestfailed', settleDocumentRequest)
  page.on('requestfinished', settleDocumentRequest)
}

function abortError(): Error {
  const error = new Error('操作已取消')
  error.name = 'AbortError'
  return error
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function browserLaunchArgs(mode: DouyinCaptureMode): string[] {
  return [
    mode === 'interactive'
      ? '--window-position=120,80'
      : '--window-position=-10000,-10000',
    mode === 'interactive'
      ? '--window-size=1080,760'
      : '--window-size=960,720',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--no-first-run'
  ]
}

export function captureTimeoutForMode(mode: DouyinCaptureMode): number {
  return mode === 'interactive'
    ? INTERACTIVE_CAPTURE_TIMEOUT_MS
    : BACKGROUND_CAPTURE_TIMEOUT_MS
}

export function hasDouyinLoginCookie(
  cookies: readonly { name: string }[]
): boolean {
  return cookies.some((cookie) => LOGIN_COOKIE_NAMES.has(cookie.name))
}

export function classifyDouyinCaptureTimeout(
  mode: DouyinCaptureMode,
  cookies: readonly { name: string }[]
): DouyinCaptureFailure {
  if (mode === 'interactive') {
    return hasDouyinLoginCookie(cookies)
      ? new DouyinCaptureFailure(
          'stream-unrecognized',
          '页面已登录，但未识别到可下载媒体，请稍后重试'
        )
      : new DouyinCaptureFailure(
          'login-timeout',
          '登录未完成，请重新点击下载后在弹出的窗口登录'
        )
  }

  return new DouyinCaptureFailure('login-required', '抖音会话需要登录')
}

function normalizedResourceType(value?: string): string {
  const normalized = value?.trim().toLowerCase()
  return normalized && /^[a-z-]{1,32}$/u.test(normalized)
    ? normalized
    : 'unknown'
}

function normalizedContentType(value?: string): string {
  const normalized = value?.split(';', 1)[0]?.trim().toLowerCase()
  return normalized && /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/u.test(normalized)
    ? normalized
    : 'unknown'
}

export function summarizeDouyinMediaObservation(
  observation: DouyinMediaObservation
): string {
  let hostname = 'invalid-host'
  const flags: string[] = []

  try {
    const parsed = new URL(observation.url)
    if (/^[a-z0-9.-]+$/iu.test(parsed.hostname)) {
      hostname = parsed.hostname.toLowerCase()
    }
    const pathname = parsed.pathname.toLowerCase()
    if (pathname.includes('/video/tos')) flags.push('video/tos')
    if (pathname.includes('media-video')) flags.push('media-video')
    if (pathname.includes('media-audio')) flags.push('media-audio')
  } catch {
    // Do not echo malformed URLs into diagnostics.
  }

  return [
    `host=${hostname}`,
    `resource=${normalizedResourceType(observation.resourceType)}`,
    `content-type=${normalizedContentType(observation.contentType)}`,
    `flags=${flags.length ? flags.join(',') : 'none'}`
  ].join(' ')
}

export function retainDouyinMediaObservationSummary(
  current: readonly string[],
  observation: DouyinMediaObservation
): readonly string[] {
  if (!isLikelyDouyinMediaObservation(observation)) return current
  const summary = summarizeDouyinMediaObservation(observation)
  return current.length >= 12 || current.includes(summary)
    ? current
    : [...current, summary]
}

function isLikelyDouyinMediaObservation(
  observation: DouyinMediaObservation
): boolean {
  if (normalizedResourceType(observation.resourceType) === 'media') {
    return true
  }
  if (/^(?:audio|video)\//u.test(normalizedContentType(observation.contentType))) {
    return true
  }
  try {
    const pathname = new URL(observation.url).pathname.toLowerCase()
    return (
      pathname.includes('/video/tos') ||
      pathname.includes('media-video') ||
      pathname.includes('media-audio')
    )
  } catch {
    return false
  }
}

export async function resolveDouyinCaptureTimeoutFailure(
  mode: DouyinCaptureMode,
  readCookies: () => Promise<readonly { name: string }[]>
): Promise<DouyinCaptureFailure> {
  const cookies = await readCookies().catch(() => [])
  return classifyDouyinCaptureTimeout(mode, cookies)
}

export function logDouyinCaptureFailure(
  failure: DouyinCaptureFailure,
  summaries: readonly string[],
  logger: (...args: unknown[]) => void = console.error
): void {
  if (failure.reason === 'stream-unrecognized') {
    logger('[粉包抖音抓流]', failure.message, summaries)
    return
  }
  logger('[粉包抖音抓流]', failure.message)
}

export function classifyDouyinBrowserError(
  error: unknown,
  mode: DouyinCaptureMode
): DouyinCaptureFailure {
  if (error instanceof DouyinCaptureFailure) return error
  const message = errorMessage(error)
  if (
    error instanceof Error &&
    (error.name === 'AbortError' || /操作已取消/u.test(message))
  ) {
    return new DouyinCaptureFailure('cancelled', '操作已取消')
  }
  if (/(链接已失效|不是视频页面)/u.test(message)) {
    return new DouyinCaptureFailure(
      'link-invalid',
      '抖音链接已失效或不是视频页面'
    )
  }
  if (/(ERR_CONNECTION_(?:CLOSED|RESET|ABORTED)|ERR_NETWORK_CHANGED)/iu.test(message)) {
    return new DouyinCaptureFailure(
      'connection',
      '抖音暂时拒绝连接，请稍后重新点击下载'
    )
  }
  if (/(executable doesn't exist|browser.*not found|could not find.*browser)/iu.test(message)) {
    return new DouyinCaptureFailure(
      'browser-unavailable',
      '系统未找到可用的 Edge 或 Chrome 浏览器'
    )
  }
  if (/(timeout|没有返回视频流|no video stream)/iu.test(message)) {
    return mode === 'interactive'
      ? new DouyinCaptureFailure(
          'login-timeout',
          '登录未完成，请重新点击下载后在弹出的窗口登录'
        )
      : new DouyinCaptureFailure(
          'login-required',
          '抖音会话需要登录'
        )
  }
  return new DouyinCaptureFailure(
    'unknown',
    '抖音视频解析失败，请稍后重新点击下载'
  )
}

export function describeDouyinBrowserError(error: unknown): string {
  return classifyDouyinBrowserError(error, 'background').message
}

async function launchIsolatedContext(
  profilePath: string,
  mode: DouyinCaptureMode
): Promise<BrowserContext> {
  const options = {
    headless: false,
    viewport:
      mode === 'interactive'
        ? { width: 1040, height: 680 }
        : { width: 960, height: 720 },
    userAgent: CHROME_USER_AGENT,
    locale: 'zh-CN',
    args: browserLaunchArgs(mode)
  }

  try {
    return await chromium.launchPersistentContext(profilePath, {
      ...options,
      channel: 'msedge'
    })
  } catch (edgeError) {
    try {
      return await chromium.launchPersistentContext(profilePath, {
        ...options,
        channel: 'chrome'
      })
    } catch (chromeError) {
      throw new Error(
        `${errorMessage(edgeError)}\n${errorMessage(chromeError)}`
      )
    }
  }
}

export async function prepareSingleCapturePage(
  context: BrowserContext
): Promise<Page> {
  const pages = context.pages()
  const page = pages[0] ?? (await context.newPage())
  await Promise.all(
    pages
      .filter((candidate) => candidate !== page)
      .map((candidate) => candidate.close().catch(() => undefined))
  )
  return page
}

export async function triggerPrimaryPlayback(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      const primaryVideo = Array.from(document.querySelectorAll('video'))
        .map((video) => {
          const rect = video.getBoundingClientRect()
          const style = window.getComputedStyle(video)
          const visibleWidth = Math.max(
            0,
            Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)
          )
          const visibleHeight = Math.max(
            0,
            Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
          )
          return {
            video,
            rect,
            style,
            visibleArea: visibleWidth * visibleHeight
          }
        })
        .filter(
          ({ rect, style, visibleArea }) =>
            Number.isFinite(rect.width) &&
            Number.isFinite(rect.height) &&
            rect.width > 0 &&
            rect.height > 0 &&
            Number.isFinite(visibleArea) &&
            visibleArea > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            Number.parseFloat(style.opacity) !== 0
        )
        .sort((a, b) => b.visibleArea - a.visibleArea)[0]

      if (primaryVideo) {
        primaryVideo.video.muted = true
        void primaryVideo.video.play().catch(() => undefined)
      }
    })
    .catch(() => undefined)

  const viewport = page.viewportSize()
  if (viewport) {
    await page.mouse
      .click(Math.floor(viewport.width / 2), Math.floor(viewport.height / 2))
      .catch(() => undefined)
  }
}

async function readPageInformation(
  page: Page
): Promise<{ title: string; author: string }> {
  return page.evaluate(() => {
    const content = (selector: string, attribute = 'content'): string =>
      document.querySelector(selector)?.getAttribute(attribute)?.trim() ?? ''
    const text = (selector: string): string =>
      document.querySelector(selector)?.textContent?.trim() ?? ''

    return {
      title:
        content('meta[property="og:title"]') ||
        content('meta[name="description"]') ||
        document.title ||
        '',
      author:
        content('meta[name="author"]') ||
        text('[data-e2e="video-author-name"]') ||
        text('[data-e2e="author-name"]') ||
        ''
    }
  })
}

export async function waitForDouyinPageInformation(
  read: () => Promise<{ title: string; author: string }>,
  options: {
    sleep?: (milliseconds: number) => Promise<void>
    attempts?: number
    intervalMs?: number
  } = {}
): Promise<{ title: string; author: string }> {
  const sleep = options.sleep ?? delay
  const attempts = options.attempts ?? 12
  const intervalMs = options.intervalMs ?? 250
  let information = { title: '', author: '' }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    information = await read()
    if (information.title.trim()) return information
    if (attempt < attempts - 1) {
      await sleep(intervalMs)
    }
  }

  return information
}

async function navigateToVideo(page: Page, url: string): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(url, {
        waitUntil: 'commit',
        timeout: NAVIGATION_TIMEOUT_MS
      })
      await page.waitForURL(
        (candidate) =>
          isDouyinVideoPageUrl(candidate.href) ||
          candidate.hostname.toLowerCase() === 'www.douyin.com',
        { timeout: NAVIGATION_TIMEOUT_MS, waitUntil: 'commit' }
      )
      const finalPageUrl = page.url()
      if (!isDouyinVideoPageUrl(finalPageUrl)) {
        throw new Error('抖音链接已失效或不是视频页面')
      }
      return finalPageUrl
    } catch (error) {
      lastError = error
      if (
        attempt === 0 &&
        /ERR_CONNECTION_(?:CLOSED|RESET|ABORTED)|ERR_NETWORK_CHANGED/iu.test(
          errorMessage(error)
        )
      ) {
        await delay(1_200)
        continue
      }
      throw error
    }
  }
  throw lastError
}

async function captureDouyinOnce(
  profilePath: string,
  url: string,
  mode: DouyinCaptureMode,
  signal?: AbortSignal
): Promise<DouyinCaptureResult> {
  if (signal?.aborted) throw abortError()

  let context: BrowserContext | undefined
  let rejectCaptured: ((reason: Error) => void) | undefined
  let loginRefresh: NodeJS.Timeout | undefined
  let checkingLogin = false
  let mediaObservationSummaries: readonly string[] = []
  const handleAbort = (): void => {
    rejectCaptured?.(abortError())
    void context?.close()
  }
  signal?.addEventListener('abort', handleAbort, { once: true })

  try {
    context = await launchIsolatedContext(profilePath, mode)
    const page = await prepareSingleCapturePage(context)
    if (mode === 'interactive') {
      await page.bringToFront()
    }

    let resolveCaptured:
      | ((value: CompleteDouyinMediaCapture) => void)
      | undefined
    let refreshedAfterLogin = false
    const captured = new Promise<CompleteDouyinMediaCapture>(
      (resolve, reject) => {
      resolveCaptured = resolve
      rejectCaptured = reject
      }
    )
    const observer = createDouyinMediaObserver((capture) => {
      resolveCaptured?.(capture)
    })
    const observeMedia = (observation: DouyinMediaObservation): void => {
      mediaObservationSummaries = retainDouyinMediaObservationSummary(
        mediaObservationSummaries,
        observation
      )
      observer.observe(observation)
    }
    const epochController = createDouyinMediaEpochController({
      observe: observeMedia,
      reset: observer.reset,
      onEpochChange: () => {
        mediaObservationSummaries = []
      }
    })
    const navigationTracker = createDouyinNavigationTracker(epochController)
    const requestEpochs = new WeakMap<object, number>()

    bindDouyinNavigationEvents(page, navigationTracker)

    page.on('request', (request) => {
      const requestEpoch = epochController.observeRequest({
        url: request.url(),
        resourceType: request.resourceType()
      })
      if (requestEpoch !== undefined) {
        requestEpochs.set(request, requestEpoch)
      }
    })

    page.on('response', (response) => {
      const request = response.request()
      const requestEpoch = requestEpochs.get(request)
      const responseEpoch = epochController.currentEpoch()
      if (requestEpoch === undefined || requestEpoch !== responseEpoch) return
      void epochController
        .observeResponse(
          responseEpoch,
          {
            url: response.url(),
            resourceType: request.resourceType()
          },
          () => response.headerValue('content-type')
        )
        .catch(() => undefined)
    })

    const finalPageUrl = await navigateToVideo(page, url)
    epochController.ensureCanonical(finalPageUrl)
    await triggerPrimaryPlayback(page)

    if (mode === 'interactive') {
      loginRefresh = setInterval(() => {
        if (
          isDouyinMediaComplete(observer.current()) ||
          refreshedAfterLogin ||
          checkingLogin ||
          !context
        ) {
          return
        }
        checkingLogin = true
        void context
          .cookies('https://www.douyin.com')
          .then(async (cookies) => {
            if (!hasDouyinLoginCookie(cookies) || refreshedAfterLogin) return
            refreshedAfterLogin = true
            await page.reload({
              waitUntil: 'commit',
              timeout: NAVIGATION_TIMEOUT_MS
            })
            epochController.ensureCanonical(page.url())
            await page.bringToFront()
            await triggerPrimaryPlayback(page)
          })
          .catch(() => undefined)
          .finally(() => {
            checkingLogin = false
          })
      }, 2_000)
    }

    const currentCapture = observer.current()
    const capturedMedia =
      (isDouyinMediaComplete(currentCapture) && currentCapture) ||
      (await Promise.race([
        captured,
        delay(captureTimeoutForMode(mode)).then(async () => {
          throw await resolveDouyinCaptureTimeoutFailure(mode, () =>
            context!.cookies('https://www.douyin.com')
          )
        })
      ]))
    const pageInformation = await waitForDouyinPageInformation(() =>
      readPageInformation(page)
    ).catch(() => ({ title: '', author: '' }))

    return {
      directUrl: capturedMedia.directUrl,
      ...(capturedMedia.audioUrl
        ? { audioUrl: capturedMedia.audioUrl }
        : {}),
      delivery: capturedMedia.delivery,
      finalPageUrl,
      title: pageInformation.title,
      author: pageInformation.author
    }
  } catch (error) {
    const failure = classifyDouyinBrowserError(error, mode)
    logDouyinCaptureFailure(failure, mediaObservationSummaries)
    throw failure
  } finally {
    if (loginRefresh) clearInterval(loginRefresh)
    signal?.removeEventListener('abort', handleAbort)
    await context?.close().catch(() => undefined)
  }
}

export function createDouyinPageCapture(
  profilePath: string,
  options: {
    attempt?: (
      url: string,
      mode: DouyinCaptureMode,
      signal?: AbortSignal
    ) => Promise<DouyinCaptureResult>
    marker?: SessionMarker
  } = {}
): DouyinPageCapture {
  const marker =
    options.marker ??
    new FileSessionMarker(join(profilePath, '.fenbao-session-ready'))
  const attempt =
    options.attempt ??
    ((url: string, mode: DouyinCaptureMode, signal?: AbortSignal) =>
      captureDouyinOnce(profilePath, url, mode, signal))

  return (url, signal) =>
    captureWithLoginFallback(
      (mode, attemptSignal) => attempt(url, mode, attemptSignal),
      marker,
      signal
    )
}
