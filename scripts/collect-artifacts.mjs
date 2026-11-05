import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const release = join(root, 'release')
const artifacts = join(release, 'artifacts')
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
mkdirSync(artifacts, { recursive: true })
const names = []
if (process.platform === 'win32') {
  const unpacked = join(release, 'win-unpacked')
  for (const name of ['data', 'downloads', '.dev-data']) {
    if (existsSync(join(unpacked, name))) throw new Error(`Private directory in package: ${name}`)
  }
  const name = `XL-FenBao-Study-v${version}-windows-x64-portable.zip`
  rmSync(join(artifacts, name), { force: true })
  const powershell = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-Command',
    '$ErrorActionPreference = "Stop"; Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory($env:FENBAO_ARCHIVE_SOURCE, $env:FENBAO_ARCHIVE_DESTINATION, [IO.Compression.CompressionLevel]::Optimal, $false)'
  ], {
    stdio: 'inherit', windowsHide: true,
    env: { ...process.env, FENBAO_ARCHIVE_SOURCE: unpacked, FENBAO_ARCHIVE_DESTINATION: join(artifacts, name) }
  })
  if (result.error || result.status !== 0) throw new Error('Portable archive failed')
  names.push(name)
} else if (process.platform === 'darwin') {
  for (const ext of ['dmg', 'zip']) {
    const name = `XL-FenBao-Study-v${version}-macos-${process.arch}.${ext}`
    copyFileSync(join(release, name), join(artifacts, name))
    names.push(name)
  }
} else {
  throw new Error('Collect artifacts on a native Windows or macOS runner')
}
for (const name of names) {
  const digest = createHash('sha256').update(readFileSync(join(artifacts, name))).digest('hex')
  writeFileSync(join(artifacts, `${name}.sha256`), `${digest}  ${name}\n`)
}
console.log(readdirSync(artifacts).join('\n'))
