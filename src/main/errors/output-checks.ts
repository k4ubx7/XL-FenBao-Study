import { open, mkdir, rm, statfs } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { UserFacingError } from './user-errors'

export const MEBIBYTE = 1024 * 1024
const UNKNOWN_SIZE_REQUIREMENT = 2 * 1024 * MEBIBYTE
const KNOWN_SIZE_HEADROOM = 512 * MEBIBYTE

export function requiredFreeBytes(expectedBytes?: number): number {
  return expectedBytes === undefined
    ? UNKNOWN_SIZE_REQUIREMENT
    : expectedBytes + KNOWN_SIZE_HEADROOM
}

async function availableBytes(path: string): Promise<number> {
  const stats = await statfs(path)
  return Number(stats.bavail) * Number(stats.bsize)
}

interface OutputCheckOptions {
  freeBytes?: (path: string) => Promise<number>
}

export async function ensureOutputReady(
  root: string,
  expectedBytes?: number,
  options: OutputCheckOptions = {}
): Promise<void> {
  try {
    await mkdir(root, { recursive: true })
    const probePath = join(root, `.fenbao-write-probe-${randomUUID()}`)
    const probe = await open(probePath, 'wx')
    try {
      await probe.sync()
    } finally {
      await probe.close()
      await rm(probePath, { force: true })
    }
  } catch {
    throw new UserFacingError(
      'OUTPUT_NOT_WRITABLE',
      '保存位置无法写入，请在设置中选择其他文件夹。'
    )
  }

  const free = await (options.freeBytes ?? availableBytes)(root)
  if (free < requiredFreeBytes(expectedBytes)) {
    throw new UserFacingError(
      'DISK_FULL',
      '保存位置空间不足，请清理空间或在设置中更换文件夹。'
    )
  }
}
