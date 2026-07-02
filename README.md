# redisinsight-hanhua

一个用于给 RedisInsight（Electron 桌面应用）打中文补丁的命令行工具。

RedisInsight 官方只提供英文界面，本工具通过直接修改其 `app.asar`（Electron 应用资源包）中的 JS/HTML 字符串字面量，把界面文案替换为简体中文，从而实现"汉化"。整个过程是"就地替换"，不依赖官方多语言支持，也不需要重新编译 RedisInsight 源码。

## 用途

- 从真实安装目录的 `app.asar` 中提取候选英文字符串（`extract`），供人工/助手挑选、翻译。
- 用一份 `{"English": "中文"}` 字典，对 `app.asar` 里的字符串做精确匹配替换，生成中文界面（`apply`）。
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

### 1. `apply` —— 应用汉化字典

```bash
bun hanhua.js apply --install "C:/Program Files/Redis Insight" --dict translations.json
```

参数：

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `--install` | RedisInsight 安装目录（工具会在其中定位 `resources/app.asar`） | 必填 |
| `--dict` | 翻译字典 JSON 文件路径 | `translations.json` |
| `--out` | 输出的 asar 路径；不指定则直接原地覆盖安装目录里的 `app.asar` | 原 `app.asar` 路径 |
| `--dry-run` | 试运行：只统计命中情况、不写回 asar（仍会生成 `.bak` 备份，因为读取过程需要先从备份解包） | 关闭 |

执行流程：

1. 定位 `app.asar`，若尚无备份则自动创建 `app.asar.bak`（以及原生模块目录 `app.asar.unpacked` 的备份 `app.asar.bak.unpacked`，如果存在的话）。
2. 从备份中解包到临时目录，按字典做字符串精确替换。
3. 非 `--dry-run` 时，把替换后的临时目录重新打包为 asar，并与备份的 unpacked 表比对，确认不多不少（保证 `better-sqlite3`/`keytar`/`ssh2` 等原生模块依旧被正确保留在 unpacked 里）；比对不一致会自动回滚并报错，不会留下半写状态。
4. 打印报告：字典条目数、命中并应用的 key 数、修改文件数、总替换次数、以及零命中的 key 列表（用于回头检查字典拼写是否与源码一致）。

`--dry-run` 只做统计和一致性预检，**不会**写回真正的 `app.asar`，可以放心反复运行来调整字典。

### 2. `extract` —— 从真实安装提取候选字符串

```bash
bun hanhua.js extract --install "C:/Program Files/Redis Insight" --out translations.todo.json --min-len 3
```

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `--install` | RedisInsight 安装目录 | 必填 |
| `--out` | 输出的候选字典 JSON 路径 | `translations.todo.json` |
| `--min-len` | 候选字符串的最小长度（字符数），用来过滤过短、噪声较大的片段 | `3` |

输出是一个 `{"English串": ""}` 的 JSON（值都是空字符串，占位待填），条目是从 `app.asar` 里所有 JS/HTML 文件中提取出的引号字符串字面量去重后的结果。这个文件包含大量非 UI 文本（第三方库的错误码、后端服务描述、Swagger 文档字符串、CSS 片段等），需要人工/助手筛选出真正会出现在界面上的文案，再整理进 `translations.json`。

### 3. `restore` —— 从备份还原

```bash
bun hanhua.js restore --install "C:/Program Files/Redis Insight"
```

把 `app.asar.bak`（及 `app.asar.bak.unpacked`，如果存在）复制回原始位置，撤销汉化，恢复到打补丁之前的状态。若找不到备份会报错退出。

### 4. `verify` —— 检查当前状态

```bash
bun hanhua.js verify --install "C:/Program Files/Redis Insight"
```

打印：asar 路径、unpacked（原生模块等未打包文件）数量、备份文件是否存在。可用于打补丁前后核对 unpacked 文件集合是否完整。

## 字典格式

`translations.json`（以及 `extract` 生成的 `translations.todo.json`）都是最简单的平铺 JSON 对象：

```json
{
  "Save": "保存",
  "Cancel": "取消",
  "Add Redis Database": "添加 Redis 数据库"
}
```

- key：必须是在 `app.asar` 解包后的源文件中**逐字**出现的英文字符串（区分大小写、含标点）。
- value：对应的简体中文翻译。
- 替换是整串精确匹配（不是子串替换、不是正则），所以 key 必须和源码里的字符串字面量完全一致，否则会被计入"零命中"。

## 幂等性、自动备份与还原机制

- **幂等**：`apply` 每次都是"从备份重新解包 → 应用字典 → 重新打包"，而不是在已经被汉化过的 asar 上继续叠加替换。因此重复执行相同字典多次，结果是一致的，不会出现文案被翻译两次或叠加乱码的问题。
- **自动备份**：第一次对某个 `app.asar`执行 `apply`（含 `--dry-run`）时，如果尚不存在备份，会自动创建：
  - `app.asar.bak` —— 原始 asar 的完整拷贝；
  - `app.asar.bak.unpacked` —— 原始 `app.asar.unpacked` 目录（存放 `better-sqlite3`、`keytar`、`ssh2` 等原生模块）的完整拷贝，如果原来就存在这个目录的话。
  
  已存在备份时不会覆盖，即多次运行 `apply` 始终基于同一份"最初的英文原版"重新生成，避免误把已汉化的版本当作原始版本再次备份。
- **还原**：`bun hanhua.js restore` 会把 `.bak` / `.bak.unpacked` 复制回原位，一键恢复到打补丁前的英文原版状态。
- **一致性校验**：正式写回（非 `--dry-run`）时，工具会比较重新打包后的 unpacked 文件集合与备份的 unpacked 文件集合是否完全一致；如果不一致（例如漏掉了某个原生模块），会自动执行一次 `restore` 回滚并报错退出，不会让安装目录停留在半写、可能无法启动的状态。

## 跨平台可执行文件

项目内置了基于 `bun build --compile` 的打包脚本，可以编译成无需安装 Bun/Node 环境即可运行的独立可执行文件：

```bash
bun run build:all
```

会在 `dist/` 目录下生成：

- `hanhua-win-x64.exe`（Windows x64）
- `hanhua-macos-arm64`（macOS Apple Silicon）
- `hanhua-macos-x64`（macOS Intel）
- `hanhua-linux-x64`（Linux x64）

也可以单独编译某一平台：`bun run build:win` / `build:mac-arm` / `build:mac-x64` / `build:linux`。

`dist/` 目录已加入 `.gitignore`，不会被提交到仓库；发布时按需分发对应平台的可执行文件即可。

## 已知局限（v1）

- **拼接/插值构建的文本不翻译**：如果界面文案是在代码里通过字符串拼接或模板插值动态拼出来的（例如 `` `Welcome to ${appName}` `` 或 `"Welcome to " + name`），本工具只能匹配到其中的静态片段（如 `"Welcome to "`），无法整体翻译，也不会尝试翻译被拆开的片段，以避免产出语序错误、断句怪异的中文。这类文案通常需要人工识别后单独处理，或保持英文。
- **过短英文词可能被误伤**：像 `Type`、`Value`、`Key` 这类很短的单词，既可能是界面标签，也可能是代码内部常量/字段名/枚举值。字典里应尽量使用**完整的、语义明确的短语**作为 key（例如用 `"Key Type"` 而不是单独的 `"Type"`），如果确实需要收录短词，务必先用 `--dry-run` 观察命中的文件与次数是否符合预期，发现命中位置不像是界面文案时应将该词从字典中移除。
- **不修改图片中的文字**：工具只处理 JS/HTML 源码里的字符串字面量，图标、截图、SVG 内嵌文字等以图片形式存在的英文内容不会被翻译。
- **只做精确字符串匹配**：不支持正则、不支持大小写不敏感匹配、不支持部分替换，源字符串必须与字典 key 逐字一致（含标点和空格）才会命中。
- **一次只覆盖一份安装**：工具直接操作指定 `--install` 目录下的 `app.asar`，多开/多版本安装需要分别指定路径执行。
