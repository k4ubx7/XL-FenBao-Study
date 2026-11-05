import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bin = join(root, 'vendor', 'bin')
const cache = join(root, '.cache', 'tools')
const sourceOutput = join(root, 'release', 'sources')
const originalRelease = 'https://github.com/k4ubx7/XL-FenBao-Study/releases/download/v1.0.0'
export const sourceAssets = [
  ['FFmpeg-ccc57378b37d9129396a037df02c83a877d8eef0-source.zip', 'f71c7c005929ea02c2242de226c1c8177dcde9bad5a3b231dd10a4e10d76ab36'],
  ['BtbN-FFmpeg-Builds-8c736b2d6fe5da2a10a8896d01e53bfb0ca4f665-source.zip', '3269bf8040feb32a3c97dc3ae5349a6b035c13920488b99967016eb589e54884'],
  ['yt-dlp-2026.07.04-source.tar.gz', '31c32457d1a573a341bb0929386c624fe47339a5338829e6e9c9454bdfa7397a']
]
const windowsHashes = {
  'yt-dlp.exe': '52fe3c26dcf71fbdc85b528589020bb0b8e383155cfa81b64dd447bbe35e24b8',
  'ffmpeg.exe': '1032c6f282a291c93a8c925c9d1081d7e75f32e8c11aa1f1093eb54b699fb25d',
  'ffprobe.exe': '7e092cab506bf2dcf6b50403b2bde8f58c7e21119486d04d4542c705cb7c64c2'
}
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const matches = (path, expected) => existsSync(path) && hash(path) === expected
const run = (file, args, options = {}) => {
  const result = spawnSync(file, args, { stdio: 'inherit', windowsHide: true, ...options })
  if (result.error || result.status !== 0) throw new Error(`${file} failed: ${result.error?.message || result.status}`)
}
async function download(url, path, expected) {
  if (matches(path, expected)) return
  mkdirSync(dirname(path), { recursive: true })
  run(process.platform === 'win32' ? 'curl.exe' : 'curl', ['--fail', '--location', '--retry', '3', '--output', path, url])
  if (!matches(path, expected)) throw new Error(`SHA-256 mismatch: ${path}`)
}
async function extract(archive, destination) {
  const require = createRequire(import.meta.url)
  const electronRequire = createRequire(require.resolve('electron/install.js'))
  await electronRequire('@electron-internal/extract-zip').extract(archive, { dir: destination })
}
function findFile(directory, name) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isFile() && entry.name === name) return path
    if (entry.isDirectory()) {
      const result = findFile(path, name)
      if (result) return result
    }
  }
}

mkdirSync(bin, { recursive: true })
mkdirSync(cache, { recursive: true })
if (process.argv.includes('--sources-only')) {
  for (const [name, digest] of sourceAssets) {
    await download(`${originalRelease}/${name}`, join(sourceOutput, name), digest)
  }
  process.exit(0)
}

let names
if (process.platform === 'win32') {
  names = Object.keys(windowsHashes)
  if (!names.every(name => matches(join(bin, name), windowsHashes[name]))) {
    const name = 'XL-FenBao-Study-v1.0.0-windows-x64-portable.zip'
    const archive = join(cache, name)
    await download(`${originalRelease}/${name}`, archive, '3d1c95eafc86efe5ee54bd826bb02f2be6c5b745bac9abd50db74b5e75a7eee3')
    const unpacked = join(cache, 'windows-v1')
    await extract(archive, unpacked)
    for (const name of names) {
      const path = findFile(unpacked, name)
      if (!path || !matches(path, windowsHashes[name])) throw new Error(`Unverified Windows tool: ${name}`)
      copyFileSync(path, join(bin, name))
    }
  }
} else if (process.platform === 'darwin') {
  names = ['yt-dlp', 'ffmpeg', 'ffprobe']
  await download('https://github.com/yt-dlp/yt-dlp/releases/download/2026.07.04/yt-dlp_macos',
    join(bin, 'yt-dlp'), '498bd0dae17855c599d371d68ec5bafc439a9d8640e838be25c765a9792f261b')
  const [sourceName, sourceHash] = sourceAssets[0]
  const archive = join(cache, sourceName)
  await download(`${originalRelease}/${sourceName}`, archive, sourceHash)
  const sourceDirectory = join(cache, 'ffmpeg-source')
  await extract(archive, sourceDirectory)
  const configure = findFile(sourceDirectory, 'configure')
  if (!configure) throw new Error('FFmpeg source archive is missing configure')
  run('bash', [join(root, 'scripts', 'build-ffmpeg-mac.sh'), dirname(configure), bin])
  copyFileSync(join(dirname(configure), 'COPYING.LGPLv2.1'), join(bin, 'FFmpeg-LICENSE.txt'))
  copyFileSync(join(root, 'docs', 'FFmpeg-MAC-SOURCE.md'), join(bin, 'FFmpeg-SOURCE.md'))
  for (const name of names) chmodSync(join(bin, name), 0o755)
} else {
  throw new Error('Release tools support Windows and macOS only')
}
for (const name of names) run(join(bin, name), [name.startsWith('yt-dlp') ? '--version' : '-version'])
writeFileSync(join(bin, 'tools-manifest.json'), JSON.stringify({
  platform: process.platform,
  arch: process.arch,
  files: Object.fromEntries(names.map(name => [name, hash(join(bin, name))]))
}, null, 2) + '\n')
