# FFmpeg binary and corresponding source

The portable distribution uses unmodified `ffmpeg.exe` and `ffprobe.exe` files from the BtbN win64 GPL build identified below.

## Binary identification

- Version: `N-125708-gccc57378b3-20260721`
- Provider: https://github.com/BtbN/FFmpeg-Builds
- `ffmpeg.exe` SHA-256: `1032c6f282a291c93a8c925c9d1081d7e75f32e8c11aa1f1093eb54b699fb25d`
- `ffprobe.exe` SHA-256: `7e092cab506bf2dcf6b50403b2bde8f58c7e21119486d04d4542c705cb7c64c2`
- License: GPL version 3 or later; see `FFmpeg-LICENSE.txt`.

## Source and build scripts

- FFmpeg source revision: `ccc57378b37d9129396a037df02c83a877d8eef0`
- FFmpeg source archive: https://github.com/FFmpeg/FFmpeg/archive/ccc57378b37d9129396a037df02c83a877d8eef0.zip
- BtbN build-script revision: `8c736b2d6fe5da2a10a8896d01e53bfb0ca4f665`
- BtbN build-script archive: https://github.com/BtbN/FFmpeg-Builds/archive/8c736b2d6fe5da2a10a8896d01e53bfb0ca4f665.zip

Copies of both archives are attached to the XL-FenBao Study GitHub Release that distributes these binaries. The BtbN scripts record the external libraries, source locations, patches and reproducible Docker-based build process.

## Build configuration

The binary reports a static Windows x64 GPLv3 build with `--enable-gpl`, `--enable-version3`, MinGW-w64 and external libraries recorded by the BtbN scripts. Run the following command for the full configuration embedded in the binary:

```powershell
ffmpeg.exe -buildconf
```

The binaries are separate command-line programs launched by XL-FenBao Study. FFmpeg and its bundled libraries remain under their own licenses; the application's Apache-2.0 license does not replace or restrict those terms.

