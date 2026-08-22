import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { SessionMarker } from './douyin-login-session'

export class FileSessionMarker implements SessionMarker {
  constructor(private readonly path: string) {}

  async isReady(): Promise<boolean> {
    return access(this.path).then(
      () => true,
      () => false
    )
  }

  async markReady(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true })
    await writeFile(this.path, 'ready\n', 'utf8')
  }

  async clear(): Promise<void> {
    await rm(this.path, { force: true })
  }
}
