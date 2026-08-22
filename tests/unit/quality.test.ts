import { describe, expect, it } from 'vitest'
import { downloadOutputArgs, qualityArgs } from '../../src/main/downloads/quality'

describe('qualityArgs', () => {
  const windowsCompatibleFormat =
    'bv*[vcodec^=avc1]+ba/b[vcodec^=avc1]/bv*+ba/b'

  it.each([
    ['low', ['-f', windowsCompatibleFormat, '-S', '+res']],
    ['medium', ['-f', windowsCompatibleFormat, '-S', 'res:720']],
    ['high', ['-f', windowsCompatibleFormat, '-S', 'res:1080']],
    ['best', ['-f', windowsCompatibleFormat]]
  ] as const)('maps %s to yt-dlp arguments', (preset, expected) => {
    expect(qualityArgs(preset)).toEqual(expected)
  })

  it('returns fresh arrays so one task cannot mutate another', () => {
    const first = qualityArgs('medium')
    first.push('--unexpected')

    expect(qualityArgs('medium')).not.toContain('--unexpected')
  })
})

describe('downloadOutputArgs', () => {
  it('keeps only the final MP4 without covers, metadata or subtitles', () => {
    expect(downloadOutputArgs()).toEqual([
      '--merge-output-format',
      'mp4',
      '--recode-video',
      'mp4',
      '--continue',
      '--newline',
      '--no-write-thumbnail',
      '--no-write-info-json',
      '--no-write-subs'
    ])
  })
})
