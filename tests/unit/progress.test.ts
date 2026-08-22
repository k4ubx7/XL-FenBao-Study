import { describe, expect, it } from 'vitest'
import { parseProgressLine } from '../../src/main/downloads/progress'

describe('parseProgressLine', () => {
  it('parses machine-readable download progress', () => {
    expect(
      parseProgressLine(
        'FENBAO:{"status":"downloading","downloaded":7340032,"total":10485760,"speed":2097152,"eta":2}'
      )
    ).toEqual({
      status: 'downloading',
      downloadedBytes: 7_340_032,
      totalBytes: 10_485_760,
      speedBytesPerSecond: 2_097_152,
      etaSeconds: 2,
      percent: 70
    })
  })

  it('coerces quoted numeric values and ignores unavailable fields', () => {
    expect(
      parseProgressLine(
        'FENBAO:{"status":"downloading","downloaded":"1024","total":"NA","speed":"512","eta":null}'
      )
    ).toEqual({
      status: 'downloading',
      downloadedBytes: 1024,
      speedBytesPerSecond: 512
    })
  })

  it('ignores unrelated or malformed lines', () => {
    expect(parseProgressLine('[download] 50%')).toBeUndefined()
    expect(parseProgressLine('FENBAO:{bad json')).toBeUndefined()
  })

  it('maps merger and transcoder output to stable statuses', () => {
    expect(parseProgressLine('[Merger] Merging formats')).toEqual({
      status: 'merging'
    })
    expect(parseProgressLine('[VideoConvertor] Converting video')).toEqual({
      status: 'transcoding'
    })
  })
})
