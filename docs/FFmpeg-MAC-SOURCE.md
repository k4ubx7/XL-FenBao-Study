# macOS FFmpeg build and corresponding source

FFmpeg and FFprobe are built directly from FFmpeg revision
`ccc57378b37d9129396a037df02c83a877d8eef0` on native Apple Silicon and Intel runners.

- Source: https://github.com/FFmpeg/FFmpeg/tree/ccc57378b37d9129396a037df02c83a877d8eef0
- Archive: `FFmpeg-ccc57378b37d9129396a037df02c83a877d8eef0-source.zip`, attached to this application's release.
- Archive SHA-256: `f71c7c005929ea02c2242de226c1c8177dcde9bad5a3b231dd10a4e10d76ab36`
- Build recipe: `scripts/build-ffmpeg-mac.sh` in the application source tag.
- License: LGPL 2.1 or later. No GPL, nonfree or external codec libraries are enabled.
- Minimum deployment target: macOS 13.0.

The tools are separate command-line executables, with FFmpeg's own libraries
linked statically and only macOS system libraries linked dynamically. The build
does not require Homebrew or a separate FFmpeg installation on the user's Mac.
The app does not restrict replacing or debugging the separately bundled tools.
The exact build configuration is available with `ffmpeg -buildconf`.
The pre-signing binary hashes are recorded in `tools-manifest.json`.

Build from this checkout on a Mac with Node.js 24 and Xcode Command Line Tools:

```sh
npm ci
npm run tools:prepare
```

`prepare-tools.mjs` verifies the source archive, builds both executables, and
copies the LGPL text. Apple system frameworks are supplied by macOS.
