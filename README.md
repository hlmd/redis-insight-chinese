# redis-insight-chinese

Redis Insight（Electron 桌面应用）的非官方汉化工具。仓库：<https://github.com/hlmd/redis-insight-chinese>

> 本项目与 Redis Ltd. 无关，不包含、不分发 Redis Insight 的任何代码或二进制，仅供个人本地使用。

Redis Insight 官方界面几乎全是英文（内置的 i18n 迁移进度极低）。本工具采用**运行时注入**的方式汉化，分两部分：

- **渲染进程**（页面里的按钮、标题、提示等）：向 `app.asar` 写入钩子 `ri-chinese.js`，并在 `index.html` 里加一行 `<script>` 引用它。钩子在界面渲染后遍历 DOM，只把**整段元素文字**以及 `title`/`placeholder`/`aria-label` 等属性中与字典精确匹配的英文替换成中文。
- **主进程**（顶部菜单栏 Window / View / Help、托盘菜单、右键菜单、原生对话框）：这些由 Electron 原生 API 绘制，不在 DOM 里。工具把钩子 `ri-main-cn.js` 写到 `dist/main/`，并在入口 `main.js` 最前面插一行 `require`；钩子包装 `Menu.buildFromTemplate` 与 `dialog.showMessageBox` 等，按词典翻译菜单 label 和对话框文字。菜单助记符保留为「窗口(&W)」形式。

两者都**不修改应用原有的任何代码或字符串字面量**，因此不会像"直接改 bundle 里的字符串"那样误伤代码（例如把 `startsWith` 改成 `starts使用`、破坏 ajv 等库）。

## 目录结构

```
redis-insight-chinese.js     CLI 入口（apply / extract / restore / verify），根目录唯一的 js
src/                         CLI 各模块（定位安装、asar 解包打包、备份、注入、资源读取）
  hooks/
    ri-chinese.js            渲染进程钩子（DOM 注入），写入 dist/renderer/
    ri-main-cn.cjs           主进程钩子（原生菜单 / 对话框），写入 dist/main/ri-main-cn.js
    md-segments.cjs          教程 Markdown 段落切分器（内联进渲染钩子；fetcher 也用它提取段落）
locales/
  zh-CN/renderer.json        渲染进程词典 {英文: 中文}
  main/zh-CN.json            主进程词典（菜单 / 对话框），支持 {{占位}}
  tutorials/zh-CN.json       教程词典 { manifest: 目录树文字, markdown: 正文段落与代码注释 }
  content/zh-CN.json         远端静态内容词典 { dom: 建议 Tips / 创建数据库入口等的文字 }，并入页面词典
  commands/zh-CN.json        命令助手词典 { dom: 命令简介 / 复杂度说明 }，并入页面词典
scripts/
  build-data.js              生成编译用的内嵌快照 generated/embedded.json
  build-bin.js               bun --compile 编译单文件二进制（先自动跑 build-data）
test/                        测试
generated/                   编译期生成物（已忽略）
.github/                     Issue 模板与发版工作流
```

钩子源码与词典的读取顺序：可执行文件旁（编译版可在 exe 旁放 `locales/` 等文件覆盖内嵌数据）→ 仓库根目录（源码模式）→ 编译期内嵌的 `generated/embedded.json`。
## 用途

- 从真实安装目录的 `app.asar` 中提取候选英文字符串（`extract`），供人工/助手挑选、翻译。
- 用一份 `{"English": "中文"}` 字典，向 `app.asar` 注入运行时汉化脚本（`apply`）。
- 自动备份原始 `app.asar`（含 `.unpacked` 目录），并支持一键还原（`restore`）。
- 校验当前安装的 asar 状态、unpacked 原生模块数量、备份是否存在（`verify`）。

## 安装

需要 Node.js ≥ 22.12（运行、测试）；只有编译单文件二进制时才需要 [Bun](https://bun.sh/)。

```bash
npm install
npm test
```

也可以直接下载编译好的单文件二进制（`redis-insight-chinese-win-x64.exe` 等），无需安装任何运行时。

## 命令用法

统一入口：

```bash
node redis-insight-chinese.js <command> [--install PATH] [--dict PATH] [--out PATH] [--dry-run] [--offline] [--no-self-update] [--min-len N]
```

命令：`apply`（默认）| `extract` | `restore` | `verify` | `version`

> Windows 提示：`apply`/`restore` 会写 `app.asar`，请先**完全退出 RedisInsight**，否则文件被占用会失败。

### 1. `apply` —— 注入汉化脚本

```bash
node redis-insight-chinese.js apply --install "C:/Program Files/Redis Insight"
```

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `--install` | RedisInsight 安装目录（工具会在其中定位 `resources/app.asar`），也可直接指向 `app.asar` 文件 | 省略则自动探测（Windows 先查注册表卸载项，再查常见安装路径） |
| `--dict` | 渲染进程词典 JSON 路径（覆盖内置词典） | `locales/zh-CN/renderer.json` |
| `--out` | 输出的 asar 路径；不指定则直接原地覆盖安装目录里的 `app.asar` | 原 `app.asar` 路径 |
| `--dry-run` | 试运行：只打印将注入的字典规模、不写回 asar（仍会生成 `.bak` 备份，因为读取过程需要先从备份解包） | 关闭 |
| `--offline` | 不联网：不检查程序新版本、不拉取在线译文（有本机缓存则用缓存） | 关闭 |
| `--no-self-update` | 只拉取在线译文，不自动更新程序本身 | 关闭 |

执行流程：

1. 定位 `app.asar`，若尚无备份则自动创建 `app.asar.bak`（以及原生模块目录 `app.asar.unpacked` 的备份 `app.asar.bak.unpacked`，如果存在的话）。
2. 从备份中解包到临时目录：
   - 渲染进程：生成内嵌字典的 `dist/renderer/ri-chinese.js`，并在 `dist/renderer/index.html` 里插入一行 `<script src="./ri-chinese.js"></script>`（放在应用主入口 module 脚本之前）；
   - 主进程：写入 `dist/main/ri-main-cn.js` 与 `dist/main/ri-main-data.json`，并在 `package.json` 的 `main` 入口最前面插一行 `require('./ri-main-cn.js')`。
3. 非 `--dry-run` 时，把注入后的临时目录重新打包为 asar，并与备份的 unpacked 表比对，确认不多不少（保证 `better-sqlite3`/`keytar`/`ssh2` 等原生模块依旧被正确保留在 unpacked 里）；比对不一致会自动回滚并报错，不会留下半写状态。
4. 打印报告：两个词典的来源与条目数、注入位置、是否新接入。

### 2. `extract` —— 从真实安装提取候选字符串

```bash
node redis-insight-chinese.js extract --install "C:/Program Files/Redis Insight" --out translations.todo.json --min-len 3
```

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `--install` | RedisInsight 安装目录 | 必填 |
| `--out` | 输出的候选字典 JSON 路径 | `translations.todo.json` |
| `--min-len` | 候选字符串的最小长度（字符数），用来过滤过短、噪声较大的片段 | `3` |

输出是一个 `{"English串": ""}` 的 JSON（值都是空字符串，占位待填）。它包含大量非 UI 文本（第三方库错误码、后端服务描述、CSS 片段等），需要人工/助手筛选出真正会出现在界面上的文案再整理进 `locales/zh-CN/renderer.json`。

> 更好的做法：如果手头有 RedisInsight 源码，可从源码 `.tsx` 中提取 JSX 文本与 `label`/`title`/`placeholder` 等属性字符串（高置信度 UI 文本），再与安装包做逐字交集，得到更干净、更完整的候选集。本仓库的 `locales/zh-CN/renderer.json` 就是这样生成的。

### 3. `restore` —— 从备份还原

```bash
node redis-insight-chinese.js restore --install "C:/Program Files/Redis Insight"
```

把 `app.asar.bak`（及 `app.asar.bak.unpacked`，如果存在）复制回原始位置，撤销汉化（注入脚本与 `index.html` 改动一并消失），恢复到打补丁之前的英文原版。若找不到备份会报错退出。

### 4. `verify` —— 检查当前状态

```bash
node redis-insight-chinese.js verify --install "C:/Program Files/Redis Insight"
```

打印：asar 路径、unpacked（原生模块等未打包文件）数量、备份文件是否存在。

## 字典格式

`locales/zh-CN/renderer.json` 是最简单的平铺 JSON 对象：

```json
{
  "Save": "保存",
  "Cancel": "取消",
  "Add Redis Database": "添加 Redis 数据库"
}
```

- key：应是界面上**某个元素完整显示出来的英文文本**（或 `title`/`placeholder`/`aria-label` 等属性的完整值）。匹配是对文本节点/属性做 `trim()` 后的**整段精确匹配**，区分大小写。
- value：对应简体中文。值为空字符串、或值与 key 完全相同的条目会被忽略（不注入）。
- key 可含 `{{name}}` 占位，对应 i18next 插值（如 `"Delete {{count}} keys": "删除 {{count}} 个键"`），匹配时占位视作任意文本并代入译文。
- 词条主要来自 Redis Insight 源码的 `redisinsight/ui/src/i18n/locales/en.json`（官方英文语言包）与 `.tsx/.ts` 中的界面字面量，并与安装包逐字核对过。带 `<tag>` 的 Trans 文案在页面上会拆成多个文本节点，按片段分别收录。
- `locales/main/zh-CN.json` 格式相同，key 是去掉助记符 `&` 后的菜单文字；可用 `{{name}}` 占位匹配动态部分，如 `"About {{appName}}": "关于 {{appName}}"`。
- 因为是整段精确匹配，短词（如 `Name`）只有在它是某个元素的**全部可见文字**时才会被替换，不会像子串替换那样误伤代码或单词内部——这正是注入方式相比"改 bundle 字符串"更安全的原因。

## 在线更新

单文件二进制每次 `apply` 前会联网做两件事（任何一步失败都只打印警告，照常用现有数据注入；`--offline` 全部跳过）：

- **译文热更新**：默认分支上词典 / 钩子一改，GitHub Actions（`.github/workflows/update-data.yml`）就把全部内嵌数据打成
  `ri-update.json.gz`，强推到孤儿分支 `update-data`。注入程序并行从 GitHub raw 与 jsDelivr 拉取，取提交时间最新的一份，
  缓存到本机（Windows `%LOCALAPPDATA%edis-insight-chinese`）；只在比二进制内嵌数据新时才使用。改了译文不用发版。
- **程序自更新**：对比 GitHub 最新 Release，有新版就下载对应平台压缩包、按 `SHA256SUMS.txt` 校验后替换自身，并以原参数重新运行。

源码模式（`node redis-insight-chinese.js`）或 exe 旁放了 `locales/` 时，以本地文件为准，不拉在线译文、也不自更新。

## 教程汉化

Explore 面板里的 Redis tutorials 不在应用安装包里：Redis Insight 运行时从 GitHub Release 下载教程包解压到 `~/.redis-insight/tutorials/`，远端有新版就整包替换。所以教程不改文件，而是在渲染进程里拦截：

- **目录树**（分组名、教程标题、悬停简介）：`tutorials/zh-CN.json` 的 `manifest` 并入页面词典，按 DOM 整段匹配。
- **正文**：钩子拦截对 `static/tutorials/**.md` 的请求，在内容渲染前用 `md-segments.cjs` 按段落（标题、段落、整个列表 / 表格、运行按钮文字）替换 Markdown 源文本；代码块原样保留，命令照常能运行。

教程更新后，没变的段落继续是中文，改过的段落显示英文原文，直到词典补上；不需要在教程更新后重新 apply。

## 词典维护（版本更新）

三份词典由同级目录的 [`redis-insight-locale-fetcher`](../redis-insight-locale-fetcher) 生成和维护：从 Redis Insight 源码（`en.json` + `.tsx/.ts` 字面量）与安装包提取英文，按版本号归档，只把新版本**新出现**的文案挑出来翻译，校验通过后用 `sync_injector.js` 写回本仓库的 `locales/`。Redis Insight 升级后按那边 README 的「一次完整的版本更新」走一遍即可。教程词典由 fetcher 的 `tutorials.js` 按教程发布时间戳维护，流程相同（见那边 README 的「教程」一节）。

> 直接手改 `locales/` 也能生效，但下次同步会被覆盖；长期保留的修改请改在 fetcher 的 `<版本>/zh-CN/` 里（或写成 `rev_*.json` 回写）。

## 幂等性、自动备份与还原机制

- **幂等**：`apply` 每次都是"从备份重新解包 → 注入 → 重新打包"，而不是在已注入过的 asar 上继续叠加。重复执行相同字典多次，结果一致，不会重复插入 `<script>`。
- **自动备份**：第一次对某个 `app.asar` 执行 `apply`（含 `--dry-run`）时，如果尚不存在备份，会自动创建 `app.asar.bak` 与 `app.asar.bak.unpacked`（若原有 unpacked 目录）。已存在备份时不会覆盖，保证始终基于最初的英文原版重新生成。
- **还原**：`restore` 把 `.bak` / `.bak.unpacked` 复制回原位，一键恢复英文原版。
- **一致性校验**：正式写回时会比较重新打包后的 unpacked 集合与备份是否完全一致，不一致则自动回滚并报错，不会让安装目录停留在可能无法启动的半写状态。

## 跨平台可执行文件

```bash
npm run build:all
```

会在 `dist/` 下生成 `redis-insight-chinese-win-x64.exe`、`redis-insight-chinese-macos-arm64`、`redis-insight-chinese-macos-x64`、`redis-insight-chinese-linux-x64`（编译前自动生成内嵌快照 `generated/embedded.json`）；也可单独 `npm run build:win` / `build:mac-arm` / `build:mac-x64` / `build:linux`。

> 已知问题：在 Windows 主机上用 `bun build --compile` 交叉编译**非 Windows** 目标时，Bun 存在下载不完整的 bug（oven-sh/bun#25346）。可在对应平台（或 WSL/Linux）上分别编译，或只用 `build:win` 产出 Windows 版；推 `v*` tag 时 GitHub Actions 会在 Linux 上编出全平台版本并发布 Release。`dist/` 与 `generated/` 已加入 `.gitignore`。

## 已知局限

- **只翻译"整段"匹配的文本**：文案若在渲染时被拆成多个 DOM 文本节点（例如 `Welcome to <b>{name}</b>` 这类带内联元素/插值的结构），只有其中恰好等于字典 key 的那一段会被替换，跨节点的整句不会合并翻译。此类文案可按实际渲染出的片段补充字典。
- **依赖注入脚本能运行**：汉化在运行时生效。如果某个版本对渲染进程施加了严格的 CSP（禁止加载本地脚本），注入脚本可能不执行——此时界面保持英文，但应用不会崩溃。
- **不翻译图片/canvas 里的文字**：只处理 DOM 文本与上述属性；图标、截图、SVG 内嵌文字、canvas 绘制的文字不受影响。
- **需要维护字典**：key 必须与界面实际显示文本逐字一致（含标点、空格）。用 `extract` 或源码提取得到候选，翻译后填入 `locales/zh-CN/renderer.json`。
- **一次覆盖一份安装**：直接操作 `--install` 指定目录下的 `app.asar`，多版本安装需分别执行。
