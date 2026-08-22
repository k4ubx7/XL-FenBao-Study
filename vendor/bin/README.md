# Bundled download tools

These executables are copied into the portable package at build time. They are
intentionally ignored by Git because of their size.

Acquired and verified locally on 2026-07-22:

| File | Version/build | SHA-256 |
| --- | --- | --- |
| `yt-dlp.exe` | `2026.07.04` official Windows x64 release | `52fe3c26dcf71fbdc85b528589020bb0b8e383155cfa81b64dd447bbe35e24b8` |
| `ffmpeg.exe` | `N-125708-gccc57378b3-20260721`, BtbN win64 GPL build | `1032c6f282a291c93a8c925c9d1081d7e75f32e8c11aa1f1093eb54b699fb25d` |
| `ffprobe.exe` | `N-125708-gccc57378b3-20260721`, BtbN win64 GPL build | `7e092cab506bf2dcf6b50403b2bde8f58c7e21119486d04d4542c705cb7c64c2` |

Sources:

- yt-dlp releases: https://github.com/yt-dlp/yt-dlp/releases
- FFmpeg source: https://ffmpeg.org/
- Windows FFmpeg build: https://github.com/BtbN/FFmpeg-Builds/releases

The copied hashes must match this table before packaging.
