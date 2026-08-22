import { toUserFacingError } from './user-errors'

const DEFAULT_DELAYS = [1_000, 3_000, 9_000] as const

function wait(delay: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const error = new Error('操作已取消')
      error.name = 'AbortError'
      reject(error)
      return
    }

    const timer = setTimeout(resolve, delay)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        const error = new Error('操作已取消')
        error.name = 'AbortError'
        reject(error)
      },
      { once: true }
    )
  })
}

interface RetryOptions {
  delays?: readonly number[]
  sleep?: (delay: number, signal?: AbortSignal) => Promise<void>
  signal?: AbortSignal
}

export async function withNetworkRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const delays = options.delays ?? DEFAULT_DELAYS
  const sleep = options.sleep ?? wait

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      if (
        options.signal?.aborted ||
        toUserFacingError(error).code !== 'NETWORK_FAILED' ||
        attempt >= delays.length
      ) {
        throw error
      }
      await sleep(delays[attempt], options.signal)
    }
  }
}
