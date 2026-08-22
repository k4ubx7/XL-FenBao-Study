import type {
  DownloadRequest,
  ProgressEvent,
  VideoMetadata
} from '../../shared/contracts'
import type { YtDlpAdapter } from './yt-dlp'

export interface DouyinResolver {
  resolve(url: string, signal?: AbortSignal): Promise<VideoMetadata>
}

export function isDouyinPageUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'douyin.com' || hostname.endsWith('.douyin.com')
  } catch {
    return false
  }
}

export class SiteAwareDownloadAdapter implements YtDlpAdapter {
  constructor(
    private readonly primary: YtDlpAdapter,
    private readonly douyin: DouyinResolver
  ) {}

  async resolve(
    url: string,
    signal?: AbortSignal
  ): Promise<VideoMetadata[]> {
    if (isDouyinPageUrl(url)) {
      return [await this.douyin.resolve(url, signal)]
    }
    return this.primary.resolve(url, signal)
  }

  download(
    request: DownloadRequest,
    onProgress: (event: ProgressEvent) => void,
    signal: AbortSignal
  ): Promise<void> {
    return this.primary.download(request, onProgress, signal)
  }
}
