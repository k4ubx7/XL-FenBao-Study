# 发布便携版

本文件用于维护者发布 Windows x64 便携目录。GitHub 源码仓库不提交打包产物和第三方可执行文件。

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
- 便携 ZIP 的 `.sha256` 校验文件
- 对应 FFmpeg 源码归档
- 对应 BtbN FFmpeg 构建脚本归档
- 对应 yt-dlp 源码归档

Release 说明必须链接项目源码、说明当前无商业代码签名，并声明第三方组件保留各自许可证。先创建草稿、上传并核验全部资产，再正式发布和推送带注释的版本标签。
