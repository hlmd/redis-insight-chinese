# Redis Insight 中文汉化 · Redis Insight Chinese

[![Release](https://img.shields.io/github/v/release/hlmd/redis-insight-chinese?sort=semver)](../../releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
[![Redis Insight](https://img.shields.io/badge/Redis%20Insight-3.x-red)](#支持的-redis-insight-版本)

把简体中文注入 **Redis Insight 桌面端**，让界面变中文。译文已全部预置、开箱即用。

- **单文件可执行程序**：Windows / macOS / Linux 都有，目标机无需装 Node；也可用 Node 源码运行。
- **覆盖面广**：页面文字、原生菜单与对话框、内置教程（含代码块注释）、数据库分析的优化建议、命令助手、带字的插图。
- **在线更新**：译文修好就能拿到，不用等发版；程序本身也会自动更新到最新 Release。

> [!WARNING]
> **非官方项目**：与 Redis Ltd. 无任何关联，未获授权或背书；"Redis" 与 "Redis Insight" 是其商标。
> 本仓库不含也不分发 Redis Insight 的任何源码或二进制。仅供个人本地使用，自负风险。
> 详见文末 [法律声明](#法律声明--disclaimer)。

**目录**

[快速开始](#快速开始) · [支持的版本](#支持的-redis-insight-版本) · [下载 Redis Insight](#下载-redis-insight) · [关闭自动更新](#关闭自动更新保持汉化不被冲掉) · [汉化范围](#汉化范围) · [工作原理](#工作原理) · [使用说明](#使用说明) · [报毒说明](#杀毒软件报毒误报说明) · [翻译数据](#翻译数据) · [常见问题](#常见问题) · [交流反馈](#交流--反馈) · [法律声明](#法律声明--disclaimer)

---

## 快速开始

1. 到 [Release](../../releases) 下载对应平台的压缩包并解压；
2. **完全退出 Redis Insight**（包括系统托盘里的图标）；
3. 运行解压出的可执行文件（自动探测安装位置）；
4. 重新打开 Redis Insight，界面变中文。

> 卸载汉化：运行时加 `restore`，如 `redis-insight-chinese-win-x64.exe restore`。
> 想让 Redis Insight 不再自动升级（升级会冲掉汉化）：加 `--no-app-update`，见 [关闭自动更新](#关闭自动更新保持汉化不被冲掉)。

下面是完整说明。

---

## 支持的 Redis Insight 版本

| 项 | 说明 |
|------|------|
| **已适配** | Redis Insight 桌面端 **3.x**，以最新正式版（当前 3.8.0）为主要测试目标 |
| **覆盖度** | 词典对齐「当前版本的界面文案」，越接近最新版覆盖越全；旧版界面文案不同，可能有部分未翻译 |
| **形态** | Electron 安装版（`resources/app.asar`）；Docker / Web 版不在支持范围 |

汉化只依赖两点：安装目录里有 `app.asar`，以及渲染进程能加载本地脚本。界面文案以「整段文字」为单位匹配，
版本升级后没变的文案继续是中文，新增 / 改过的文案显示英文，直到词典补上。

---

## 下载 Redis Insight

本工具**只注入**已安装的 Redis Insight，不包含 Redis Insight 本体。

- 官方下载页：<https://redis.io/insight/>
- 各版本发行说明与安装包：<https://github.com/redis/RedisInsight/releases>

---

## 关闭自动更新（保持汉化不被冲掉）

Redis Insight 会**自动下载新版、退出时安装**，安装会整包替换 `app.asar` → 界面变回英文。想固定在当前版本，注入时加 `--no-app-update`：

```bash
redis-insight-chinese-win-x64.exe --no-app-update
```

**👉 [关闭 Redis Insight 自动更新](docs/disable-auto-update.md)** —— 原理、手动设置环境变量的替代方法与恢复办法。

---

## 汉化范围

| 部分 | 来源 | 说明 |
|------|------|------|
| **页面文字** | 安装包 | 按钮、标题、提示、表格、弹窗等，约 2200+ 条；拼接出来的句子片段按上下文翻译 |
| **原生菜单 / 对话框** | 安装包（主进程） | 顶部菜单栏、托盘菜单、右键菜单、确认框；保留「窗口(&W)」形式的 Alt 快捷键 |
| **内置教程** | 远端下发（`~/.redis-insight/tutorials`） | 目录树 + 正文，按段落翻译，**代码块里的 `//` 注释也翻**；命令照常能运行 |
| **优化建议（Tips）** | 远端下发（`~/.redis-insight/content`） | 数据库分析页的建议、创建数据库入口等 |
| **命令助手** | 远端下发（`commands.json`） | 700+ 条命令简介与复杂度说明 |
| **插图** | 安装包 | 文字已转成轮廓的插图（如 RDI 数据流示意图）换成汉化版 |

**刻意保留英文**：Redis 命令与参数、数据类型名（Hash、List、Sorted Set、Stream、JSON、Time Series…）、模块名、产品名（Redis Cloud、Redis Software、RDI…）、
命令助手的分组名——这些是对照官方文档时要用的关键词，翻了反而不好查。

---

## 工作原理

本工具**不修改 Redis Insight 原有的任何代码或字符串**，而是在 `app.asar` 里加几个运行时钩子：

- **渲染进程**：写入 `dist/renderer/ri-chinese.js`，并在 `index.html` 里加一行 `<script>`。钩子用 `MutationObserver` 遍历 DOM，
  只把**整段文字**以及 `title` / `placeholder` / `aria-label` 等属性中与词典精确匹配的英文换成中文。
  - 带 `{{占位}}` 的词条按模板匹配；数量类占位（`{{count}}` 等）只匹配数字，不会吞掉普通句子。
  - 拼接句里的短词（`of`、`now`、`entries`…）太短不能全局替换，只按所在位置翻译（如「1 / 17」「(0 条)」「刚刚」）。
- **教程**：钩子拦截对 `static/tutorials/**.md` 的请求，渲染前按段落替换 Markdown 源文本；教程远端更新后不用重新注入。
- **主进程**：写入 `dist/main/ri-main-cn.js`，在入口 `main.js` 最前面插一行 `require`，包装 `Menu.buildFromTemplate` 与 `dialog.showMessageBox`。
- **插图**：替换 `dist/renderer/assets/` 下带字的 SVG；只在原图哈希与记录一致时才换，上游换了图就跳过，不会贴错。

因为是整段精确匹配，不会像「直接改 bundle 里的字符串」那样误伤代码（比如把 `startsWith` 改成 `starts使用`）。

**备份与还原**：第一次注入时自动备份 `app.asar.bak`（及 `app.asar.unpacked` 的备份）。每次注入都「从备份重新解包 → 注入 → 打包」，
可重复执行、结果一致；打包后会核对原生模块（`better-sqlite3` / `keytar` 等）一个不少，不一致自动回滚。`restore` 一键恢复英文原版。

---

## 使用说明

### 方式一：下载二进制（推荐，目标机无需 Node）

从 [Release](../../releases) 下载对应平台的压缩包，解压得到单文件：

| 平台 | 下载文件 | 解压后 |
|------|----------|--------|
| Windows x64 | `redis-insight-chinese-win-x64.zip` | `redis-insight-chinese-win-x64.exe` |
| Linux x64 / arm64 | `redis-insight-chinese-linux-x64.tar.xz` / `-arm64.tar.xz` | `redis-insight-chinese-linux-x64` / `-arm64` |
| macOS Intel / Apple Silicon | `redis-insight-chinese-macos-x64.tar.xz` / `-arm64.tar.xz` | `redis-insight-chinese-macos-x64` / `-arm64` |

> Windows 双击 `.zip` 即可解压；Linux / macOS：`tar -xf redis-insight-chinese-*.tar.xz`（解压后如丢失执行权限：`chmod +x <文件名>`）。

```bash
# 1. 完全退出 Redis Insight
# 2. 注入（自动探测安装位置）
./redis-insight-chinese-win-x64.exe          # Windows
./redis-insight-chinese-macos-arm64          # macOS / Linux
# 3. 重新打开 Redis Insight
```

二进制已内嵌全部译文与依赖，断网也能用内嵌译文注入。

#### 在线更新（程序 + 译文）

二进制每次注入前会联网检查两件事，任何一步失败都只提示、不影响注入：

1. **程序自更新** —— 对比 GitHub 最新 Release，有新版就下载本平台压缩包（GitHub 直连与 `ghfast.top` 镜像**同时下载**，谁先完成用谁），
   按 Release 附带的 `SHA256SUMS.txt` 校验后替换自身，再以相同参数运行新版本。
2. **译文热更新** —— 默认分支每次改动词典，CI 就把全部译文 + 钩子打成 `ri-update.json.gz` 推到 [`update-data`](../../tree/update-data) 分支；
   程序同时从 GitHub raw 与 jsDelivr 镜像拉取、取最新一份，缓存到本机（Windows `%LOCALAPPDATA%\redis-insight-chinese`、macOS `~/Library/Caches/…`、
   Linux `~/.cache/…`），离线时用缓存。**不用等发版，译文修好就能拿到。**

| 想要 | 加参数 |
|------|--------|
| 只更新译文、不替换程序 | `--no-self-update` |
| 完全不联网（有缓存用缓存，否则用内嵌） | `--offline` |

> Windows 自更新后程序旁会留一个 `*.exe.old`，下次运行自动删除。程序所在目录没有写权限时自更新会跳过，照常注入。
> 想用自己改的译文？把 `locales/` 文件夹放在**可执行文件旁边**即可覆盖内嵌与在线数据（此时不联网取译文）。

### 方式二：Node 源码运行（开发 / 改译文）

需要 Node.js ≥ 22.12。源码模式以仓库里的 `locales/` 为准，不拉在线译文、也不自更新。

```bash
git clone git@github.com:hlmd/redis-insight-chinese.git
cd redis-insight-chinese
npm install
node redis-insight-chinese.js            # 注入（等同 apply）
```

### 命令与选项

下面用 `node redis-insight-chinese.js` 举例；二进制把它换成可执行文件名即可。

| 命令 | 作用 |
|------|------|
| `apply`（默认） | 注入汉化 |
| `restore` | 从备份还原英文原版 |
| `verify` | 只读检查：asar 路径、unpacked 原生模块数量、备份是否存在 |
| `extract` | 从安装包提取候选英文串（开发用，见 [翻译数据](#翻译数据)） |
| `version` | 显示本工具版本 |

| 选项 | 作用 |
|------|------|
| `--install <路径>` | 指定 Redis Insight 安装目录，或直接指向 `app.asar`（跳过自动探测） |
| `--no-app-update` | 关闭 Redis Insight 自身的自动更新（见 [关闭自动更新](docs/disable-auto-update.md)） |
| `--offline` | 不联网：不自更新、不拉取在线译文 |
| `--no-self-update` | 只拉取在线译文，不更新程序本身 |
| `--dry-run` | 试运行：只打印将注入的内容，不写回 `app.asar` |
| `--dict <文件>` | 用指定的页面词典 JSON 覆盖内置词典 |
| `--out <文件>` | 输出到另一个 asar，不覆盖安装目录里的 |

#### 默认探测位置

| 平台 | 位置 |
|------|------|
| Windows | 先查注册表卸载项（`HKCU` / `HKLM`），再查 `%LOCALAPPDATA%\Programs\Redis Insight`、`%ProgramFiles%\Redis Insight` 等 |
| macOS | `/Applications/Redis Insight.app`、`~/Applications/Redis Insight.app` |
| Linux | `/opt/Redis Insight`、`/opt/RedisInsight`、`/usr/lib/redisinsight` |

> 探测不到时用 `--install <安装目录>` 指定。macOS / Linux 的系统级目录可能需要 `sudo` 才能写入。

#### 验证注入是否成功

- **看报告**：注入结束会打印各部分的条目数（页面 / 教程 / 静态内容 / 命令定义 / 插图 / 主进程）和「已写入」。
- **看界面**：重新打开 Redis Insight，菜单、按钮、教程变中文即成功。
- **只读检查**：`verify` 显示备份是否存在（存在说明注入过至少一次）。

### 自行编译二进制

需要 [Bun](https://bun.sh)（`--compile` 交叉编译）：

```bash
npm install
npm run build:all       # 全部 5 个平台到 dist/；或 build:win / build:linux / build:linux-arm64 / build:mac-x64 / build:mac-arm
```

> - 编译前会自动生成内嵌快照 `generated/embedded.json`（词典 + 钩子 + 插图）。
> - 在 Windows 上交叉编译**非 Windows** 目标时 Bun 可能下载不完整（oven-sh/bun#25346），可在对应平台或 WSL 上编译。
> - 也可直接打 tag（`git tag -a v0.2.0 -m "本次更新…" && git push origin v0.2.0`），由 [`.github/workflows/release.yml`](.github/workflows/release.yml)
>   在 CI 上交叉编译、压缩并发布 Release（tag 注解会成为 Release 的「本次更新」）。

---

## 杀毒软件报毒（误报）说明

部分杀毒软件可能把 `.exe` 标记为 `Trojan:Win32/Wacatac.B!ml` 之类的**启发式威胁**。这是**误报**：

1. **单文件二进制的结构像加壳程序**——由 `bun --compile` 生成，产物 = 运行时 + 追加的脚本载荷，这类打包器被机器学习模型误判是行业级老问题；
2. **行为像「打补丁器」**——本工具会读写你已安装的 Redis Insight 的 `app.asar`，行为规则上难以和恶意篡改区分；
3. **未做代码签名**——新发布的未签名 exe 在 SmartScreen 下一律显示「未知发布者」。

**怎么自己核实**

- **核对校验和**：每个 Release 都附带 `SHA256SUMS.txt`。

  ```powershell
  Get-FileHash .\redis-insight-chinese-win-x64.zip -Algorithm SHA256
  ```

- **验证构建来源**：所有二进制**均由 GitHub Actions 从公开源码构建**，并附带[构建来源证明](https://docs.github.com/actions/security-guides/using-artifact-attestations)：

  ```bash
  gh attestation verify redis-insight-chinese-win-x64.zip --repo hlmd/redis-insight-chinese
  ```

- **上传 [VirusTotal](https://www.virustotal.com/) 复核**：少数引擎标红、主流引擎全绿，是典型的启发式误报特征。

**不想跟杀软纠缠**：直接用[方式二](#方式二node-源码运行开发--改译文)跑源码，纯 JavaScript 不经打包器，不会触发这类误报。
或把可执行文件加入杀软白名单（Defender：**Windows 安全中心 → 病毒和威胁防护 → 管理设置 → 排除项 → 添加文件**）。

> 本工具只修改 Redis Insight 安装目录里的 `app.asar`（并自动备份），**不上传任何数据、不常驻后台**。联网只有两处：拉取在线译文、检查程序新版本，都可用 `--offline` 关掉。

---

## 翻译数据

```
locales/
├── zh-CN/renderer.json      # 页面词典 { "英文": "中文" }，支持 {{占位}}
├── main/zh-CN.json          # 主进程词典（菜单 / 对话框），key 去掉助记符 &
├── tutorials/zh-CN.json     # 教程 { manifest: 目录树文字, markdown: 正文段落与代码注释 }
├── content/zh-CN.json       # 优化建议 Tips 等远端静态内容 { dom: … }
├── commands/zh-CN.json      # 命令助手 { dom: 命令简介 / 复杂度 }
└── assets/                  # 汉化插图 + manifest.json（原图哈希）
```

- key 是界面上**某个元素完整显示的英文文本**（或属性的完整值），区分大小写；value 是简体中文。值为空或与 key 相同的条目不注入。
- 短的单个小写词（`on`、`to`、`now`…）不收进全局词典，避免误改用户的键值、命令输出；需要时按上下文规则处理。
- 词典由同级目录的 `redis-insight-locale-fetcher` 维护：从 Redis Insight 源码与安装包提取英文、按版本归档、只翻新增文案、校验后写回 `locales/`。
  教程 / 静态内容 / 命令定义按远端发布时间或内容哈希单独更新。直接手改 `locales/` 也能生效，但下次同步会被覆盖。

**改了译文怎么生效**：源码模式重跑 `node redis-insight-chinese.js`；推送到默认分支后，二进制用户下次运行就会自动拿到。

---

## 常见问题

**界面还是英文**
① 注入前是否**完全退出** Redis Insight（含托盘图标）；② 报告最后是否有「已写入」；③ 是否打到了正在用的那份安装（多份安装用 `--install` 指定）。

**Redis Insight 自动更新后又变回英文**
升级会整包替换 `app.asar`，重新运行一次注入程序即可（它会先把自己和译文更新到最新再注入）。想不再被冲掉：加 `--no-app-update`。

**某处没翻译 / 翻译不当**
附截图提 [Issue](../../issues)（选「漏译 / 误译」模板），说明所在界面。拼接句里的短词、程序按英文格式生成的日期（如 `Jul 21, 2026`）可能仍是英文。

**`app.asar` 被占用 / `EBUSY` / `EPERM`**
Redis Insight 还在运行，或系统目录需要管理员权限。退出应用后重试；macOS / Linux 系统目录用 `sudo`。

**杀毒软件报毒 / SmartScreen 拦截**
单文件二进制的启发式误报，见 [杀毒软件报毒（误报）说明](#杀毒软件报毒误报说明)。

**想卸载汉化**
运行 `restore`，恢复到注入前的英文原版。

---

## 交流 / 反馈

问题与建议欢迎提 [Issue](../../issues)。点 **New issue** 会有现成模板（Bug / 漏译误译 / 功能建议），报 Bug 时请尽量附上：

| 信息 | 怎么拿 |
|------|--------|
| **操作系统与版本** | Windows 10/11、macOS 版本 + 芯片（Intel / Apple Silicon）、Linux 发行版 |
| **Redis Insight 版本** | Redis Insight 菜单 `帮助 → 关于`（英文界面为 `Help → About`） |
| **本工具版本** | 运行 `... version`，或所下载 Release 的版本号 |
| **使用方式** | 二进制 / Node 源码运行 |
| **注入报告** | 运行注入时终端输出的整段「汉化报告」 |
| **完整报错** | 终端的完整错误文本，别只截一半 |
| **复现步骤与截图** | 做了什么、期望什么、实际什么；未翻译的位置附截图标出 |

---

## 法律声明 / Disclaimer

- **非官方、无关联**：本项目是社区维护的第三方汉化工具，**与 Redis Ltd. 没有任何关联**，未获其授权、赞助或背书。"Redis" 与 "Redis Insight" 是 Redis Ltd. 的商标，此处仅作描述性指代。
- **不分发 Redis Insight 资产**：本仓库**不包含、也不分发** Redis Insight 的任何源代码或二进制程序。仓库内容只有本项目自己的脚本、社区编写的中文译文，以及据原插图重绘文字的汉化插图。
- **译文数据**：`locales/` 下的中文译文派生自 Redis Insight 的界面文案、教程与命令文档。本项目对这部分**不主张版权**，也不保证其可在所有场景下自由再分发；如 Redis Ltd. 提出异议，将配合处理。
- **本地使用、自负风险**：本工具在**你自己的机器**上修改**你自己安装**的 Redis Insight（重打包 `app.asar`）。是否使用由你自行决定并承担风险，请遵守 Redis Insight 的许可条款。
- **许可**：本项目**自身代码**以 MIT 许可发布；该许可**不覆盖**上述派生自 Redis Insight 文案的译文数据。
- 本说明不构成法律意见。

---

<details>
<summary><b>开发者：目录结构</b></summary>

```
redis-insight-chinese/
├── redis-insight-chinese.js     # CLI 入口：apply / restore / verify / extract / version
├── src/
│   ├── hooks/
│   │   ├── ri-chinese.js        # 渲染进程钩子（DOM 替换 + 上下文规则 + 教程 .md 拦截）
│   │   ├── ri-main-cn.cjs       # 主进程钩子（原生菜单 / 对话框 + --no-app-update）
│   │   └── md-segments.cjs      # 教程 Markdown 段落切分器（钩子与 fetcher 共用）
│   ├── inject.js                # 写入渲染钩子、替换插图
│   ├── menu.js                  # 写入主进程钩子
│   ├── updater.js               # 在线更新：程序自更新 + 译文热更新
│   ├── resources.js             # 词典 / 钩子读取（exe 旁 > 仓库 > 在线数据包 > 内嵌快照）
│   └── locate.js / asar.js / backup.js / …
├── locales/                     # 词典与汉化插图（见「翻译数据」）
├── scripts/
│   ├── build-data.js            # 生成内嵌快照 generated/embedded.json
│   ├── build-bin.js             # bun --compile 编译单文件二进制
│   └── build-update.js          # 生成在线数据包 dist/update/ri-update.json.gz
├── docs/disable-auto-update.md
├── test/                        # npm test
└── .github/workflows/
    ├── release.yml              # 打 v* tag：测试、交叉编译、校验和、来源证明、发 Release
    └── update-data.yml          # 默认分支改词典：打包在线数据包推到 update-data 分支
```

</details>
