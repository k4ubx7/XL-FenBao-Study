import type { ProgressEvent } from '../../shared/contracts'

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '' || value === 'NA') {
    return undefined
  }

  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

export function parseProgressLine(line: string): ProgressEvent | undefined {
  if (line.includes('[Merger]')) {
    return { status: 'merging' }
  }

  if (
    line.includes('[VideoConvertor]') ||
    line.includes('[VideoRemuxer]') ||
    line.includes('[FFmpegVideoConvertor]')
  ) {
    return { status: 'transcoding' }
  }

  const markerIndex = line.indexOf('FENBAO:')
  if (markerIndex === -1) {
    return undefined
  }

  try {
    const payload = JSON.parse(line.slice(markerIndex + 'FENBAO:'.length)) as {
      status?: unknown
      postprocessor?: unknown
      downloaded?: unknown
      total?: unknown
      speed?: unknown
      eta?: unknown
    }

    if (
      typeof payload.postprocessor === 'string' &&
      payload.postprocessor.toLowerCase().includes('merger')
    ) {
      return { status: 'merging' }
    }

    if (
      typeof payload.postprocessor === 'string' &&
      /(convert|remux|ffmpeg)/iu.test(payload.postprocessor)
    ) {
      return { status: 'transcoding' }
    }

    if (payload.status !== 'downloading') {
      return undefined
    }

    const downloadedBytes = optionalNumber(payload.downloaded)
    const totalBytes = optionalNumber(payload.total)
    const speedBytesPerSecond = optionalNumber(payload.speed)
    const etaSeconds = optionalNumber(payload.eta)
    const percent =
      downloadedBytes !== undefined && totalBytes !== undefined && totalBytes > 0
        ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 1000) / 10)
        : undefined

    return {
      status: 'downloading',
      ...(downloadedBytes === undefined ? {} : { downloadedBytes }),
      ...(totalBytes === undefined ? {} : { totalBytes }),
      ...(speedBytesPerSecond === undefined ? {} : { speedBytesPerSecond }),
      ...(etaSeconds === undefined ? {} : { etaSeconds }),
      ...(percent === undefined ? {} : { percent })
    }
  } catch {
    return undefined
  }
}
