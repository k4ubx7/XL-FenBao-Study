#!/usr/bin/env bash
set -euo pipefail
source_dir="$1"
output_dir="$2"
export MACOSX_DEPLOYMENT_TARGET=13.0
cd "$source_dir"
# No Homebrew libraries: the shipped tools depend only on macOS system libraries.
bash ./configure \
  --disable-autodetect --disable-shared --enable-static \
  --disable-doc --disable-debug --disable-x86asm \
  --disable-programs --enable-ffmpeg --enable-ffprobe \
  --enable-videotoolbox --enable-audiotoolbox --enable-securetransport \
  --extra-cflags=-mmacosx-version-min=13.0 \
  --extra-ldflags=-mmacosx-version-min=13.0
make -j "$(sysctl -n hw.ncpu)"
cp ffmpeg ffprobe "$output_dir/"
for tool in "$output_dir/ffmpeg" "$output_dir/ffprobe"; do
  if otool -L "$tool" | tail -n +2 | grep -Ev '^[[:space:]]+(/usr/lib/|/System/Library/)' ; then
    echo "Non-system dynamic dependency in $tool" >&2
    exit 1
  fi
done
