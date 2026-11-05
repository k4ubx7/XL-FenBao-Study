# Changelog

## 1.1.0 — 2026-11-05

- 新增 macOS 13+ Apple Silicon 与 Intel 的 DMG/ZIP 构建，保留 Windows x64 便携版。
- 修复 Electron 运行时安装、程序资源路径、下载工具与 FFmpeg 合并中的 Windows 专用假设。
- Mac 设置和历史存入 Application Support，视频默认存入 Downloads/粉包学习记，支持只读应用目录。
- 增加三平台 CI、原生打包与发布流水线、SHA-256 校验及对应第三方源码附件。
- 增加 Mac 路径回归测试，并让离线下载和打包恢复测试在 Windows/Mac 上共用。

## 1.0.0 — 2026-08-22

- 首次公开发布 Electron、React 与 TypeScript 源码。
- 支持分享文案 URL 提取、yt-dlp 多站点解析、抖音隔离浏览器解析、下载队列、统一命名和本地历史。
- 提供 Windows x64 便携包，内含经过哈希核验的 yt-dlp、FFmpeg 和 FFprobe。
- 补齐 Apache-2.0、第三方许可、FFmpeg 对应源码说明、隐私边界、构建文档和发布校验。
- 170 项自动测试、类型检查、生产构建、离线 Electron 端到端和便携重启恢复验证通过。
