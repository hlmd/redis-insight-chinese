# redisinsight-hanhua

一个用于给 RedisInsight（Electron 桌面应用）打中文补丁的命令行工具。

RedisInsight 官方界面几乎全是英文（内置的 i18n 迁移进度极低）。本工具采用**运行时 DOM 注入**的方式汉化：向应用的 `app.asar` 中注入一个 `zh-inject.js` 脚本，并在 `index.html` 里加一行 `<script>` 引用它。该脚本在界面渲染后遍历 DOM，只把**整段元素文字**以及 `title`/`placeholder`/`aria-label` 等属性中与字典精确匹配的英文替换成中文。

它**从不修改任何 JS 代码或字符串字面量**——只在浏览器渲染出来的文本节点上做替换。因此不会像"直接改 bundle 里的字符串"那样误伤代码（例如把 `startsWith` 改成 `starts使用`、破坏 ajv 等库），也能安全地翻译 `Name`、`Type` 这类既是界面标签又是代码常量的短词。

## 用途

- 从真实安装目录的 `app.asar` 中提取候选英文字符串（`extract`），供人工/助手挑选、翻译。
- 用一份 `{"English": "中文"}` 字典，向 `app.asar` 注入运行时汉化脚本（`apply`）。
- 自动备份原始 `app.asar`（含 `.unpacked` 目录），并支持一键还原（`restore`）。
- 校验当前安装的 asar 状态、unpacked 原生模块数量、备份是否存在（`verify`）。

## 安装

需要 [Bun](https://bun.sh/)。

```bash
bun install
```

## 命令用法

统一入口：

```bash
bun hanhua.js <command> [--install PATH] [--dict PATH] [--out PATH] [--dry-run] [--min-len N]
```

四条命令：`apply` | `extract` | `restore` | `verify`

> Windows 提示：`apply`/`restore` 会写 `app.asar`，请先**完全退出 RedisInsight**，否则文件被占用会失败。

### 1. `apply` —— 注入汉化脚本

```bash
bun hanhua.js apply --install "C:/Program Files/Redis Insight" --dict translations.json
```

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `--install` | RedisInsight 安装目录（工具会在其中定位 `resources/app.asar`），也可直接指向 `app.asar` 文件 | 省略则按当前系统自动探测常见安装路径 |
| `--dict` | 翻译字典 JSON 文件路径 | `translations.json` |
| `--out` | 输出的 asar 路径；不指定则直接原地覆盖安装目录里的 `app.asar` | 原 `app.asar` 路径 |
| `--dry-run` | 试运行：只打印将注入的字典规模、不写回 asar（仍会生成 `.bak` 备份，因为读取过程需要先从备份解包） | 关闭 |

执行流程：

1. 定位 `app.asar`，若尚无备份则自动创建 `app.asar.bak`（以及原生模块目录 `app.asar.unpacked` 的备份 `app.asar.bak.unpacked`，如果存在的话）。
2. 从备份中解包到临时目录，生成内嵌字典的 `dist/renderer/zh-inject.js`，并在 `dist/renderer/index.html` 里插入一行 `<script src="./zh-inject.js"></script>`（放在应用主入口 module 脚本之前）。
3. 非 `--dry-run` 时，把注入后的临时目录重新打包为 asar，并与备份的 unpacked 表比对，确认不多不少（保证 `better-sqlite3`/`keytar`/`ssh2` 等原生模块依旧被正确保留在 unpacked 里）；比对不一致会自动回滚并报错，不会留下半写状态。
4. 打印报告：字典总条目数、实际内嵌到注入脚本的可用中文条目数、注入脚本路径、`<script>` 引用是否新增。

### 2. `extract` —— 从真实安装提取候选字符串

```bash
bun hanhua.js extract --install "C:/Program Files/Redis Insight" --out translations.todo.json --min-len 3
```

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `--install` | RedisInsight 安装目录 | 必填 |
| `--out` | 输出的候选字典 JSON 路径 | `translations.todo.json` |
| `--min-len` | 候选字符串的最小长度（字符数），用来过滤过短、噪声较大的片段 | `3` |

输出是一个 `{"English串": ""}` 的 JSON（值都是空字符串，占位待填）。它包含大量非 UI 文本（第三方库错误码、后端服务描述、CSS 片段等），需要人工/助手筛选出真正会出现在界面上的文案再整理进 `translations.json`。

> 更好的做法：如果手头有 RedisInsight 源码，可从源码 `.tsx` 中提取 JSX 文本与 `label`/`title`/`placeholder` 等属性字符串（高置信度 UI 文本），再与安装包做逐字交集，得到更干净、更完整的候选集。本仓库的 `translations.json` 就是这样生成的。

### 3. `restore` —— 从备份还原

```bash
bun hanhua.js restore --install "C:/Program Files/Redis Insight"
```

把 `app.asar.bak`（及 `app.asar.bak.unpacked`，如果存在）复制回原始位置，撤销汉化（注入脚本与 `index.html` 改动一并消失），恢复到打补丁之前的英文原版。若找不到备份会报错退出。

### 4. `verify` —— 检查当前状态

```bash
bun hanhua.js verify --install "C:/Program Files/Redis Insight"
```

打印：asar 路径、unpacked（原生模块等未打包文件）数量、备份文件是否存在。

## 字典格式

`translations.json` 是最简单的平铺 JSON 对象：

```json
{
  "Save": "保存",
  "Cancel": "取消",
  "Add Redis Database": "添加 Redis 数据库"
}
```

- key：应是界面上**某个元素完整显示出来的英文文本**（或 `title`/`placeholder`/`aria-label` 等属性的完整值）。匹配是对文本节点/属性做 `trim()` 后的**整段精确匹配**，区分大小写。
- value：对应简体中文。值为空字符串、或值与 key 完全相同的条目会被忽略（不注入）。
- 因为是整段精确匹配，短词（如 `Name`）只有在它是某个元素的**全部可见文字**时才会被替换，不会像子串替换那样误伤代码或单词内部——这正是注入方式相比"改 bundle 字符串"更安全的原因。

## 幂等性、自动备份与还原机制

- **幂等**：`apply` 每次都是"从备份重新解包 → 注入 → 重新打包"，而不是在已注入过的 asar 上继续叠加。重复执行相同字典多次，结果一致，不会重复插入 `<script>`。
- **自动备份**：第一次对某个 `app.asar` 执行 `apply`（含 `--dry-run`）时，如果尚不存在备份，会自动创建 `app.asar.bak` 与 `app.asar.bak.unpacked`（若原有 unpacked 目录）。已存在备份时不会覆盖，保证始终基于最初的英文原版重新生成。
- **还原**：`restore` 把 `.bak` / `.bak.unpacked` 复制回原位，一键恢复英文原版。
- **一致性校验**：正式写回时会比较重新打包后的 unpacked 集合与备份是否完全一致，不一致则自动回滚并报错，不会让安装目录停留在可能无法启动的半写状态。

## 跨平台可执行文件

```bash
bun run build:all
```

会在 `dist/` 下生成 `hanhua-win-x64.exe`、`hanhua-macos-arm64`、`hanhua-macos-x64`、`hanhua-linux-x64`；也可单独 `bun run build:win` / `build:mac-arm` / `build:mac-x64` / `build:linux`。

> 已知问题：在 Windows 主机上用 `bun build --compile` 交叉编译**非 Windows** 目标时，Bun 存在下载不完整的 bug（oven-sh/bun#25346）。可在对应平台（或 WSL/Linux）上分别编译，或只用 `build:win` 产出 Windows 版。`dist/` 已加入 `.gitignore`。

## 已知局限

- **只翻译"整段"匹配的文本**：文案若在渲染时被拆成多个 DOM 文本节点（例如 `Welcome to <b>{name}</b>` 这类带内联元素/插值的结构），只有其中恰好等于字典 key 的那一段会被替换，跨节点的整句不会合并翻译。此类文案可按实际渲染出的片段补充字典。
- **依赖注入脚本能运行**：汉化在运行时生效。如果某个版本对渲染进程施加了严格的 CSP（禁止加载本地脚本），注入脚本可能不执行——此时界面保持英文，但应用不会崩溃。
- **不翻译图片/canvas 里的文字**：只处理 DOM 文本与上述属性；图标、截图、SVG 内嵌文字、canvas 绘制的文字不受影响。
- **需要维护字典**：key 必须与界面实际显示文本逐字一致（含标点、空格）。用 `extract` 或源码提取得到候选，翻译后填入 `translations.json`。
- **一次覆盖一份安装**：直接操作 `--install` 指定目录下的 `app.asar`，多版本安装需分别执行。
