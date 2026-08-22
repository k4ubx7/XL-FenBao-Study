# Third-party notices

XL-FenBao Study uses third-party libraries and can bundle third-party command-line tools in a locally built portable distribution. Those projects keep their own copyrights and licenses.

The Git repository does **not** include the third-party executable files listed below. Developers and distributors must obtain them from their official sources, verify them and independently comply with their licenses.

## yt-dlp

- Project: https://github.com/yt-dlp/yt-dlp
- License: https://github.com/yt-dlp/yt-dlp/blob/master/LICENSE
- Bundled executable notices: https://github.com/yt-dlp/yt-dlp/blob/master/THIRD_PARTY_LICENSES.txt

The official PyInstaller-based Windows executable contains components under additional licenses. Consult the notices distributed by yt-dlp before redistributing a binary.

## FFmpeg and FFprobe

- Project: https://ffmpeg.org/
- Legal and licensing information: https://ffmpeg.org/legal.html
- Source repository: https://git.ffmpeg.org/ffmpeg.git
- Windows build provider used during the original validation: https://github.com/BtbN/FFmpeg-Builds

The original portable build used the BtbN win64 GPL build `N-125708-gccc57378b3-20260721`. Its locally verified hashes are documented in `vendor/bin/README.md`; the corresponding GPL text is retained at `vendor/bin/FFmpeg-LICENSE.txt`.

Redistributors are responsible for checking the exact configuration and license of the FFmpeg build they ship and for fulfilling all applicable source-code and notice obligations.

## Playwright Core

- Project: https://github.com/microsoft/playwright
- License: Apache License 2.0

Playwright Core launches an isolated copy of Microsoft Edge or Google Chrome already installed on the computer. The application does not read the user's normal browser profile. If the user signs in to Douyin in the application-owned browser window, that isolated profile and its Cookie remain in the local `data/douyin-browser` directory.

## JavaScript dependencies

The dependency tree and exact pinned versions are recorded in `package-lock.json`. Each package remains subject to its own license. Run an appropriate software-composition analysis before distributing a build.

## User content

These tools do not grant permission to copy a video. Users remain responsible for downloading only content they are authorized to save and for following the source platform's terms and applicable law.
