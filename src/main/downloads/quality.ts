import type { QualityPreset } from '../../shared/contracts'

const windowsCompatibleFormat =
  'bv*[vcodec^=avc1]+ba/b[vcodec^=avc1]/bv*+ba/b'

export function qualityArgs(preset: QualityPreset): string[] {
  switch (preset) {
    case 'low':
      return ['-f', windowsCompatibleFormat, '-S', '+res']
    case 'medium':
      return ['-f', windowsCompatibleFormat, '-S', 'res:720']
    case 'high':
      return ['-f', windowsCompatibleFormat, '-S', 'res:1080']
    case 'best':
      return ['-f', windowsCompatibleFormat]
  }
}

export function downloadOutputArgs(): string[] {
  return [
    '--merge-output-format',
    'mp4',
    '--recode-video',
    'mp4',
    '--continue',
    '--newline',
    '--no-write-thumbnail',
    '--no-write-info-json',
    '--no-write-subs'
  ]
}
