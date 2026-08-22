import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const electronPackagePath = require.resolve('electron/package.json')
const electronDirectory = dirname(electronPackagePath)
const electronPackage = JSON.parse(readFileSync(electronPackagePath, 'utf8'))
const version = electronPackage.version
const artifact = `electron-v${version}-win32-x64.zip`
const executable = join(electronDirectory, 'dist', 'electron.exe')
const pathFile = join(electronDirectory, 'path.txt')

if (existsSync(executable)) {
  writeFileSync(pathFile, 'electron.exe')
  console.log(`Electron ${version} runtime is ready.`)
  process.exit(0)
}

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const cacheDirectory = join(projectRoot, '.cache', 'electron')
const archive = join(cacheDirectory, artifact)
mkdirSync(cacheDirectory, { recursive: true })

const checksums = JSON.parse(
  readFileSync(join(electronDirectory, 'checksums.json'), 'utf8')
)
const expectedHash = checksums[artifact]
if (!expectedHash) {
  throw new Error(`Missing official checksum for ${artifact}`)
}

function archiveMatches() {
  if (!existsSync(archive)) return false
  const actual = createHash('sha256')
    .update(readFileSync(archive))
    .digest('hex')
  return actual === expectedHash
}

if (!archiveMatches()) {
  rmSync(archive, { force: true })
  const url = `https://github.com/electron/electron/releases/download/v${version}/${artifact}`
  console.log(`Downloading official Electron ${version} runtime...`)
  const download = spawnSync(
    'curl.exe',
    ['-L', '--fail', '--retry', '3', '--output', archive, url],
    { stdio: 'inherit', windowsHide: true }
  )
  if (download.status !== 0 || !archiveMatches()) {
    throw new Error('Electron runtime download failed checksum verification')
  }
}

rmSync(join(electronDirectory, 'dist'), { recursive: true, force: true })
const electronRequire = createRequire(join(electronDirectory, 'install.js'))
const { extract } = electronRequire('@electron-internal/extract-zip')
await extract(archive, { dir: join(electronDirectory, 'dist') })
writeFileSync(pathFile, 'electron.exe')
console.log(`Electron ${version} runtime installed and verified.`)
