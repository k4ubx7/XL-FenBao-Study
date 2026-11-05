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

License and source material retained in this directory:

- `yt-dlp-LICENSE.txt` and `yt-dlp-THIRD_PARTY_LICENSES.txt` correspond to yt-dlp `2026.07.04`.
- `FFmpeg-LICENSE.txt` is the GPL license distributed with the selected BtbN build.
- `FFmpeg-SOURCE.md` identifies the exact FFmpeg source and BtbN build-script revisions.

The copied hashes must match this table before packaging.

## macOS (v1.1.0 and later)

Run `npm run tools:prepare` on the target architecture. The official universal
`yt-dlp_macos` 2026.07.04 binary is stored as `yt-dlp` and verified against SHA-256
`498bd0dae17855c599d371d68ec5bafc439a9d8640e838be25c765a9792f261b`.
FFmpeg and FFprobe are built from the same pinned FFmpeg source revision, without
external codec libraries, under LGPL 2.1+. See `docs/FFmpeg-MAC-SOURCE.md`.
The script creates native `ffmpeg`/`ffprobe` executables, replaces the bundled
FFmpeg license/source notice for macOS, and records hashes in `tools-manifest.json`.
Do not commit generated binaries or replace the Windows license in Git with a
locally generated macOS license; the preparation script selects it at build time.
