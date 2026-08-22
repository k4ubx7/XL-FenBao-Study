import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'

export interface MediaServer {
  pageUrl: string
  close(): Promise<void>
}

function parseRange(
  header: string | undefined,
  size: number
): { start: number; end: number } | undefined {
  const match = header?.match(/^bytes=(\d+)-(\d*)$/u)
  if (!match) return undefined
  const start = Number(match[1])
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  if (!Number.isInteger(start) || start < 0 || start > end) return undefined
  return { start, end }
}

export async function startMediaServer(
  fixturePath: string
): Promise<MediaServer> {
  const media = await stat(fixturePath)
  const server = createServer((request, response) => {
    const host = request.headers.host ?? '127.0.0.1'

    if (request.url === '/' || request.url === '/index.html') {
      const videoUrl = `http://${host}/fixture.mp4`
      const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>本地学习视频</title>
    <meta property="og:title" content="本地学习视频">
    <meta property="og:video" content="${videoUrl}">
    <meta property="og:video:type" content="video/mp4">
  </head>
  <body><video controls src="/fixture.mp4"></video></body>
</html>`
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(html)
      })
      response.end(html)
      return
    }

    if (request.url === '/fixture.mp4') {
      const range = parseRange(request.headers.range, media.size)
      const start = range?.start ?? 0
      const end = range?.end ?? media.size - 1
      response.writeHead(range ? 206 : 200, {
        'Accept-Ranges': 'bytes',
        'Content-Type': 'video/mp4',
        'Content-Length': end - start + 1,
        ...(range
          ? { 'Content-Range': `bytes ${start}-${end}/${media.size}` }
          : {})
      })
      if (request.method === 'HEAD') {
        response.end()
      } else {
        createReadStream(fixturePath, { start, end }).pipe(response)
      }
      return
    }

    response.writeHead(404)
    response.end('Not found')
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Local media server did not expose a TCP port')
  }

  return {
    pageUrl: `http://127.0.0.1:${address.port}/`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
  }
}
