# 构建环境与第三方工具

## 源码依赖

支持 Windows 10/11 x64 和 macOS 13+（Apple Silicon / Intel）。建议准备：

- Node.js 24 LTS；最低使用 Node.js 22。
- npm（随 Node.js 安装）。
- Microsoft Edge 或 Google Chrome。
- Windows 推荐 PowerShell 7；Mac 编译 FFmpeg 需要 Xcode Command Line Tools。

安装项目依赖：

```powershell
npm ci
```

安装脚本会检查当前系统与芯片架构的 Electron 运行时。缺失时，它从 Electron 官方 GitHub Release 下载压缩包并根据 Electron 包内的官方校验表验证 SHA-256。

## 准备 `vendor/bin`

推荐执行 `npm run tools:prepare`：Windows 复用 v1.0.0 的固定、已核验工具；Mac 下载官方通用版 yt-dlp，并从固定 FFmpeg 源码构建当前架构的 FFmpeg/FFprobe。源码和下载均核验 SHA-256，原生工具会执行版本检查并生成 `tools-manifest.json`。Mac 的三个可执行文件名没有 `.exe` 后缀；编译说明见 [`FFmpeg-MAC-SOURCE.md`](FFmpeg-MAC-SOURCE.md)。

以下文件不进入 Git：

```text
vendor/bin/
├─ yt-dlp.exe
├─ ffmpeg.exe
├─ ffprobe.exe
└─ FFmpeg-LICENSE.txt
```

请只从官方项目或明确记录的构建发行方获取：

- yt-dlp：https://github.com/yt-dlp/yt-dlp/releases
- FFmpeg：https://ffmpeg.org/download.html
- BtbN Windows builds：https://github.com/BtbN/FFmpeg-Builds/releases

校验本地文件：

```powershell
Get-FileHash -Algorithm SHA256 vendor/bin/yt-dlp.exe
Get-FileHash -Algorithm SHA256 vendor/bin/ffmpeg.exe
Get-FileHash -Algorithm SHA256 vendor/bin/ffprobe.exe
```

把版本、来源和哈希更新到 [`vendor/bin/README.md`](../vendor/bin/README.md)。不要盲目沿用旧哈希；升级工具后重新确认功能和许可证。

## 开发、测试与构建

```powershell
npm run dev
npm test
npm run typecheck
npm run build
```

端到端测试需要 `vendor/bin`：

```powershell
npm run test:e2e
```

真实抖音检查默认跳过，只有设置 `FENBAO_DOUYIN_URL` 才运行。它会访问外部站点，应使用你有权测试的公开链接。

生成 Windows 便携目录：

```powershell
npm run pack
```

输出位于 `release/win-unpacked/`。

在 Mac 上构建 DMG 和 ZIP：

```sh
npm ci
npm run tools:prepare
npm run pack:mac
```

工具在本机架构上编译，因此请在对应 Apple Silicon/Intel 机器构建。发布流水线使用 `macos-15`（arm64）和 `macos-15-intel`（x64）原生构建，支持目标 macOS 13+。默认 ad-hoc 签名、未公证；正式 Developer ID 签名和公证需要发行者自己的 Apple 证书及凭据。

打包后设置 `FENBAO_PACKAGED_EXE` 为 `.app/Contents/MacOS/粉包学习记` 或 Windows EXE 的完整路径，运行 `npx playwright test tests/e2e/packaged.spec.ts`，验证内置工具、下载和重启恢复。`node scripts/collect-artifacts.mjs` 收集安装包并生成 SHA-256 文件。

便携目录包含项目 Apache-2.0 许可证、yt-dlp 的许可证与第三方声明，以及 FFmpeg 的 GPL 与对应源码说明。不要删除这些文件后再分发。

## 第三方许可

本项目的 Apache-2.0 只覆盖项目自身源码，不会替代依赖和二进制工具的许可证。发布包含 yt-dlp 或 FFmpeg 的程序前，请阅读 [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)，并根据实际二进制构建履行许可、声明与源代码提供义务。
