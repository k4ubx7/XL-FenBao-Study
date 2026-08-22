import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { VideoMetadata } from '../../shared/contracts'

const MAX_VIDEO_PATH_LENGTH = 220
const WINDOWS_RESERVED_NAME =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu

export function sanitizeSegment(value: string): string {
  const sanitized = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/gu, '-')
    .replace(/-{2,}/gu, '-')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/[ .]+$/gu, '')

  const safeValue = sanitized || '未知'
  return WINDOWS_RESERVED_NAME.test(safeValue) ? `_${safeValue}` : safeValue
}

function formatDate(metadata: VideoMetadata, downloadedAt: Date): string {
  const uploadDate = metadata.uploadDate?.match(/^(\d{4})(\d{2})(\d{2})$/u)
  if (uploadDate) {
    return `${uploadDate[1]}-${uploadDate[2]}-${uploadDate[3]}`
  }

  const year = downloadedAt.getFullYear()
  const month = String(downloadedAt.getMonth() + 1).padStart(2, '0')
  const day = String(downloadedAt.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function nameParts(metadata: VideoMetadata, downloadedAt: Date): {
  prefix: string
  title: string
  suffix: string
} {
  const date = formatDate(metadata, downloadedAt)
  const platform = sanitizeSegment(metadata.platform)
  const author = sanitizeSegment(metadata.author)
  const title = sanitizeSegment(metadata.title)
  const id = sanitizeSegment(metadata.id)

  return {
    prefix: `${date}_${platform}_${author}_`,
    title,
    suffix: `_${id}`
  }
}

export function buildBaseName(
  metadata: VideoMetadata,
  downloadedAt: Date
): string {
  const { prefix, title, suffix } = nameParts(metadata, downloadedAt)
  return `${prefix}${title}${suffix}`
}

export function buildTargetPaths(
  root: string,
  metadata: VideoMetadata,
  downloadedAt: Date,
  exists: (path: string) => boolean = existsSync
): { directory: string; video: string; temporaryTemplate: string } {
  const { prefix, title, suffix } = nameParts(metadata, downloadedAt)
  const maxBaseLength = Math.floor(
    (MAX_VIDEO_PATH_LENGTH - root.length - 6) / 2
  )

  for (let sequence = 1; ; sequence += 1) {
    const collisionSuffix = sequence === 1 ? '' : `_${sequence}`
    const titleLength = Math.max(
      1,
      maxBaseLength - prefix.length - suffix.length - collisionSuffix.length
    )
    const baseName = `${prefix}${title.slice(0, titleLength)}${suffix}${collisionSuffix}`
    const directory = join(root, baseName)

    if (!exists(directory)) {
      return {
        directory,
        video: join(directory, `${baseName}.mp4`),
        temporaryTemplate: join(directory, `${baseName}.%(ext)s`)
      }
    }
  }
}
