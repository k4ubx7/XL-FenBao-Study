export type DouyinCaptureMode = 'background' | 'interactive'

export type DouyinCaptureFailureReason =
  | 'login-required'
  | 'login-timeout'
  | 'stream-unrecognized'
  | 'link-invalid'
  | 'connection'
  | 'browser-unavailable'
  | 'cancelled'
  | 'unknown'

export class DouyinCaptureFailure extends Error {
  override readonly name = 'DouyinCaptureFailure'

  constructor(
    readonly reason: DouyinCaptureFailureReason,
    message: string
  ) {
    super(message)
  }
}

export interface SessionMarker {
  isReady(): Promise<boolean>
  markReady(): Promise<void>
  clear(): Promise<void>
}

export type DouyinCaptureAttempt<T> = (
  mode: DouyinCaptureMode,
  signal?: AbortSignal
) => Promise<T>

const FALLBACK_REASONS = new Set<DouyinCaptureFailureReason>([
  'login-required',
  'connection'
])

export async function captureWithLoginFallback<T>(
  attempt: DouyinCaptureAttempt<T>,
  marker: SessionMarker,
  signal?: AbortSignal
): Promise<T> {
  if (await marker.isReady()) {
    try {
      return await attempt('background', signal)
    } catch (error) {
      if (
        !(error instanceof DouyinCaptureFailure) ||
        !FALLBACK_REASONS.has(error.reason)
      ) {
        throw error
      }
      await marker.clear()
    }
  }

  const result = await attempt('interactive', signal)
  await marker.markReady()
  return result
}
