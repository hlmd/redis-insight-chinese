# 关闭 Redis Insight 自动更新（保持汉化不被冲掉）

Redis Insight 桌面端内置自动更新（electron-updater）：启动时、之后每 84 小时检查一次，有新版就**后台下载、退出时自动安装**。
安装新版会整包替换 `resources/app.asar`，汉化随之消失，需要重新运行一次注入程序。

想固定在当前版本，有两种办法，都可随时恢复。

## 方法 A（推荐）：注入时加 `--no-app-update`

```bash
redis-insight-chinese-win-x64.exe --no-app-update
# 或源码模式
node redis-insight-chinese.js apply --no-app-update
```

注入程序本来就会在主进程最前面挂一个汉化钩子；加了这个开关，钩子会在 Redis Insight 读取更新地址之前，
把更新源（`RI_MANUAL_UPGRADES_LINK`）指向一个不可达的本机地址，并设置新版本认的 `RI_DISABLE_AUTO_UPGRADE=true`。
更新检查会静默失败（只写日志，不弹窗），界面照常使用。

- **只影响汉化后的这份安装**，不改系统环境变量、不改 hosts。
- **恢复**：不加 `--no-app-update` 重新 `apply` 一次，或运行 `restore` 还原原版。
- 想升级时：先恢复自动更新（或直接到官网下载新版覆盖安装），升级后再运行注入程序。

## 方法 B：手动设置环境变量

不想改安装包里的东西，也可以给当前用户设置环境变量，让 Redis Insight 去一个不可达的地址检查更新：

| 平台 | 命令 | 恢复 |
| --- | --- | --- |
| Windows | `setx RI_MANUAL_UPGRADES_LINK http://127.0.0.1:9/` | `reg delete HKCU\Environment /v RI_MANUAL_UPGRADES_LINK /f` |
| macOS | `launchctl setenv RI_MANUAL_UPGRADES_LINK http://127.0.0.1:9/`（重启后失效，需写进登录项） | `launchctl unsetenv RI_MANUAL_UPGRADES_LINK` |
| Linux | 在 `~/.profile` 加 `export RI_MANUAL_UPGRADES_LINK=http://127.0.0.1:9/` | 删掉这一行 |

设置后需**完全退出并重新打开** Redis Insight（Windows 上 `setx` 只对之后新开的程序生效）。

> 不建议用 hosts 屏蔽：更新包放在 `s3.amazonaws.com` 这类公共域名上，屏蔽会连带影响其它网站和服务。
