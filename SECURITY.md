# Security Policy

## Supported version

当前只维护默认分支上的最新版本。项目仍处于早期开源阶段，尚未承诺长期支持周期。

## Reporting a vulnerability

请优先使用 GitHub 仓库的 **Security → Report a vulnerability** 私密报告入口。报告中可以包含复现步骤、影响范围和修复建议，但不要附带真实 Cookie、Token、账号、私有视频或其他个人数据。

如果仓库暂未开放私密安全报告，请先创建不包含利用细节和秘密信息的普通 Issue，请求维护者建立私密沟通渠道。

## Sensitive local data

以下目录或文件可能包含敏感信息，不应提交或分享：

- `data/` 与 `.dev-data/`
- `data/douyin-browser/`
- `downloads/`
- Cookie、浏览器配置、日志、崩溃转储和任务历史

如果敏感数据已经进入 Git 历史，仅删除当前文件通常不够；请立即撤销相关凭据并清理完整历史。
