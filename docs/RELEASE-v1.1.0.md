新增 macOS 版本，Windows 与 Mac 共用视频链接解析、下载队列、统一命名和历史记录功能。

## 下载选择

| 电脑 | 下载附件 |
| --- | --- |
| Windows 10/11，64 位 Intel/AMD | `XL-FenBao-Study-v1.1.0-windows-x64-portable.zip` |
| Mac，Apple 芯片（M1/M2/M3/M4 及更新型号） | `XL-FenBao-Study-v1.1.0-macos-arm64.dmg` |
| Mac，Intel 芯片 | `XL-FenBao-Study-v1.1.0-macos-x64.dmg` |

Mac 需要 macOS 13 或更新系统；也提供同架构 ZIP。打开 DMG，把“粉包学习记”拖入“应用程序”，再启动。使用抖音解析时，请先安装 Google Chrome 或 Microsoft Edge。

## 这次更新

- Mac 内置对应架构的 FFmpeg、FFprobe 与通用版 yt-dlp，无需安装 Node.js、Python 或 Homebrew。
- Mac 设置和历史保存在 `~/Library/Application Support/粉包学习记`，视频默认保存在 `~/Downloads/粉包学习记`。
- Windows 延续便携目录的 `data` 和 `downloads`，设置中可以更改视频保存位置。
- 修复运行时安装脚本、程序资源路径和音视频合并工具中的 Windows 专用路径。
- 三个平台分别构建并执行单元测试、类型检查、离线下载和打包后的重启恢复测试。

## 首次启动

此版本没有商业代码签名证书。Mac 使用 ad-hoc 签名，尚未通过 Apple 公证；首次打开时系统可能拦截。确认从本仓库下载后，可以在“系统设置 → 隐私与安全性”中对本应用选择“仍要打开”。不需要关闭系统整体安全检查。受管理的 Mac 可能需要管理员允许。

Windows 更新时请备份旧版的 `data` 和 `downloads`，将新包解压到新文件夹，再复制这两个目录；不要把自己的数据目录上传或分享。

每个安装包附 `.sha256` 校验文件。FFmpeg、yt-dlp 及其他第三方组件保留各自许可证；对应 FFmpeg、BtbN 构建脚本和 yt-dlp 源码归档附在此 Release。

[本版本项目源码](https://github.com/k4ubx7/XL-FenBao-Study/tree/v1.1.0) · [构建说明](https://github.com/k4ubx7/XL-FenBao-Study/blob/v1.1.0/docs/BUILDING.md)

macOS FFmpeg 采用 LGPL 2.1+ 源码构建，Windows FFmpeg 沿用已核验的 BtbN GPL 构建。网站兼容性取决于平台变化；自动化验证使用本地测试媒体，未覆盖所有在线站点。
