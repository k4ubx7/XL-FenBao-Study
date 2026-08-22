import { spawn } from 'node:child_process'
import { mkdir, stat } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function createMediaFixture(
  ffmpegPath: string,
  outputPath: string
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true })

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      ffmpegPath,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=c=0x19344a:s=640x360:d=2',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=1000:duration=2',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-shortest',
        outputPath
      ],
      { shell: false, windowsHide: true }
    )
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-4_000)
    })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr || `FFmpeg fixture exited with ${code}`))
    })
  })

  const media = await stat(outputPath)
  if (media.size <= 1_024) {
    throw new Error('Generated media fixture is unexpectedly small')
  }
}
