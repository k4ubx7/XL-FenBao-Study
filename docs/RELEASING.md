# 发布 Windows 与 macOS 版本

本文件用于维护者发布 Windows x64 便携包、macOS Apple Silicon 和 Intel 安装包。GitHub 源码仓库不提交打包产物和第三方可执行文件。

## 自动发布

1. 同步 `package.json`、`package-lock.json`、CHANGELOG 和 `docs/RELEASE-v<版本>.md`。
2. 推送源码后，在 Actions → Release 手动运行。默认构建草稿；选择 `publish` 会在所有检查通过后正式发布。推送 `v*` 标签也会触发正式发布。
3. 三台原生机器分别准备已校验的工具、运行测试、打包并执行打包后的下载/重启恢复检查。任一平台失败都不会发布。
4. 汇总任务核验所有安装包的 SHA-256，附上对应第三方源码，然后上传草稿并按选项发布。已公开的同版本 Release 不会被覆盖。

Mac 包额外校验完整 ad-hoc 签名。Mac FFmpeg 从固定源码构建，仅链接系统动态库；其 LGPL 文本和源码说明会替换 Windows 专用的 GPL 说明。

## 1. 准备第三方工具

按照 [`BUILDING.md`](BUILDING.md) 准备 `vendor/bin/yt-dlp.exe`、`ffmpeg.exe`、`ffprobe.exe` 和对应许可文件，并核对来源、版本、哈希和再分发义务。

## 2. 自动验证

```powershell
npm ci
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run pack
```

真实抖音测试必须使用你有权测试的公开链接，并通过临时环境变量显式启用：

```powershell
$env:FENBAO_DOUYIN_URL = 'https://www.douyin.com/video/...'
npm run test:e2e
Remove-Item Env:FENBAO_DOUYIN_URL
```

## 3. 便携包检查

- [ ] `粉包学习记.exe` 可以启动。
- [ ] `使用说明.txt` 位于主程序旁。
- [ ] `resources/bin` 包含经过核验的 yt-dlp、FFmpeg 和 FFprobe。
- [ ] 第三方许可与说明文件已包含。
- [ ] 项目 Apache-2.0、yt-dlp 许可/第三方声明和 FFmpeg GPL/源码说明已包含。
- [ ] 本地测试页面的完整下载流程通过。
- [ ] 每个视频只产生一个同名文件夹和一个同名 MP4。
- [ ] 没有封面、字幕、元数据和临时文件残留。
- [ ] 关闭并重新启动后，设置与历史能够恢复。
- [ ] 宽窗口、最小窗口、设置面板、失败和重试状态已人工检查。

## 4. 隐私发布门禁

发布目录不得包含：

- `data/`、`.dev-data/` 或 `downloads/`。
- Cookie、浏览器配置、下载历史和账号信息。
- 真实下载媒体、测试媒体和用户文件。
- `.env`、日志、崩溃转储和本机绝对路径。
- 未记录来源和许可证的二进制文件。

发布前应从一份全新的 `release/win-unpacked/` 构建结果开始，不要直接压缩正在使用的便携目录。

## 5. GitHub Release 资产

每个公开便携版本至少包含：

- `XL-FenBao-Study-<version>-windows-x64-portable.zip`
- `XL-FenBao-Study-<version>-macos-arm64.dmg` 与 `.zip`
- `XL-FenBao-Study-<version>-macos-x64.dmg` 与 `.zip`
- 便携 ZIP 的 `.sha256` 校验文件
- 对应 FFmpeg 源码归档
- 对应 BtbN FFmpeg 构建脚本归档
- 对应 yt-dlp 源码归档

Release 说明必须链接项目源码、说明当前无商业代码签名及 Mac 未公证，并声明第三方组件保留各自许可证。先构建并验证所有平台，再创建草稿、上传完整资产并正式发布。使用带注释的版本标签时，其提交必须与构建提交一致。
