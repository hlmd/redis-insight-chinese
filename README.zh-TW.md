# Redis Insight 中文本地化 · Redis Insight Chinese

[简体中文](README.md) · **繁體中文**

[![Release](https://img.shields.io/github/v/release/hlmd/redis-insight-chinese?sort=semver)](../../releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
[![Redis Insight](https://img.shields.io/badge/Redis%20Insight-3.x-red)](#支援的-redis-insight-版本)

給 **Redis Insight 桌面端**注入中文介面，支援簡體中文與繁體中文。譯文已全部預置、開箱即用，按系統語言自動選擇，也可用 `--lang` 指定：

| 代碼 | 語言 | 代碼 | 語言 |
|------|------|------|------|
| `zh-CN` | 簡體中文 | `zh-TW` | 繁體中文 |

> 簡體中文為人工複核譯文；繁體中文由簡體經 OpenCC 轉換並套用常用詞修正，歡迎提 Issue 糾錯。

- **單檔案可執行程式**：Windows / macOS / Linux 都有，目標機無需裝 Node；也可用 Node 原始碼執行。
- **覆蓋面廣**：頁面文字、原生選單與對話方塊、內建教程（含程式碼塊註釋）、資料庫分析的最佳化建議、命令助手。
- **線上更新**：譯文修好就能拿到，不用等發版；程式本身也會自動更新到最新 Release。

> [!WARNING]
> **非官方專案**：與 Redis Ltd. 無任何關聯，未獲授權或背書；"Redis" 與 "Redis Insight" 是其商標。
> 本倉庫不含也不分發 Redis Insight 的任何原始碼或二進位制。僅供個人本地使用，自負風險。
> 詳見文末 [法律宣告](#法律宣告--disclaimer)。

**目錄**

[快速開始](#快速開始) · [支援的版本](#支援的-redis-insight-版本) · [下載 Redis Insight](#下載-redis-insight) · [關閉自動更新](#關閉自動更新保持翻譯不被覆蓋) · [翻譯範圍](#翻譯範圍) · [工作原理](#工作原理) · [使用說明](#使用說明) · [報毒說明](#防毒軟體報毒誤報說明) · [翻譯資料](#翻譯資料) · [常見問題](#常見問題) · [交流意見回饋](#交流--意見回饋) · [法律宣告](#法律宣告--disclaimer)

---

## 快速開始

**用包管理器安裝**（裝好後在任意目錄直接用 `redis-insight-chinese` 命令，繁體加 `--lang zh-TW`；注入前先完全退出 Redis Insight）：

```bash
# Windows（Scoop）
scoop bucket add hlmd https://github.com/hlmd/scoop-bucket
scoop install hlmd/redis-insight-chinese

# macOS / Linux（Homebrew）
brew install hlmd/tap/redis-insight-chinese

# 任意平台（npm，需 Node.js ≥ 22.12）
npx redis-insight-chinese
```

詳見 [方式零：包管理器](#方式零包管理器scoop--homebrew--npm)。**或者手動下載**：

1. 到 [Release](../../releases) 下載對應平台的壓縮包並解壓；
2. **完全退出 Redis Insight**（包括系統托盤裡的圖示）；
3. 執行解壓出的可執行檔案（自動探測安裝位置）；
4. 重新開啟 Redis Insight，介面變成系統語言（或 `--lang` 指定的語言）。

> 解除安裝翻譯：執行時加 `restore`，如 `redis-insight-chinese-win-x64.exe restore`。
> 想讓 Redis Insight 不再自動升級（升級會覆蓋翻譯）：加 `--no-app-update`，見 [關閉自動更新](#關閉自動更新保持翻譯不被覆蓋)。

下面是完整說明。

---

## 支援的 Redis Insight 版本

| 項 | 說明 |
|------|------|
| **已適配** | Redis Insight 桌面端 **3.x**，以最新正式版（目前 3.8.0）為主要測試目標 |
| **覆蓋度** | 詞典對齊「目前版本的介面文案」，越接近最新版覆蓋越全；舊版介面文案不同，可能有部分未翻譯 |
| **形態** | Electron 安裝版（`resources/app.asar`）；Docker / Web 版不在支援範圍 |

翻譯只依賴兩點：安裝目錄裡有 `app.asar`，以及渲染程序能載入本地指令碼。介面文案以「整段文字」為單位匹配，
版本升級後沒變的文案繼續顯示譯文，新增 / 改過的文案顯示英文，直到詞典補上。

---

## 下載 Redis Insight

本工具**只注入**已安裝的 Redis Insight，不包含 Redis Insight 本體。

- 官方下載頁：<https://redis.io/insight/>
- 各版本發行說明與安裝包：<https://github.com/redis/RedisInsight/releases>

---

## 關閉自動更新（保持翻譯不被覆蓋）

Redis Insight 會**自動下載新版、退出時安裝**，安裝會整包替換 `app.asar` → 介面變回英文。想固定在目前版本，注入時加 `--no-app-update`：

```bash
redis-insight-chinese-win-x64.exe --no-app-update
```

**👉 [關閉 Redis Insight 自動更新](docs/disable-auto-update.md)** —— 原理、手動設定環境變數的替代方法與恢復辦法。

---

## 翻譯範圍

| 部分 | 來源 | 說明 |
|------|------|------|
| **頁面文字** | 安裝包 | 按鈕、標題、提示、表格、彈窗等，約 2200+ 條；拼接出來的句子片段按上下文翻譯 |
| **原生選單 / 對話方塊** | 安裝包（主程序） | 頂部選單欄、托盤選單、右鍵選單、確認框；保留「視窗(&W)」形式的 Alt 快捷鍵 |
| **內建教程** | 遠端下發（`~/.redis-insight/tutorials`） | 目錄樹 + 正文，按段落翻譯，**程式碼塊裡的 `//` 註釋也翻**；命令照常能執行 |
| **最佳化建議（Tips）** | 遠端下發（`~/.redis-insight/content`） | 資料庫分析頁的建議、建立資料庫入口等 |
| **命令助手** | 遠端下發（`commands.json`） | 700+ 條命令簡介與複雜度說明 |

**刻意保留英文**：Redis 命令與參數、資料類型名（Hash、List、Sorted Set、Stream、JSON、Time Series…）、模組名、產品名（Redis Cloud、Redis Software、RDI…）、
命令助手的分組名——這些是對照官方文件時要用的關鍵詞，翻了反而不好查。

---

## 工作原理

本工具**不修改 Redis Insight 原有的任何程式碼或字串**，而是在 `app.asar` 里加幾個執行時鉤子：

- **渲染程序**：寫入 `dist/renderer/ri-chinese.js`，並在 `index.html` 里加一行 `<script>`。鉤子用 `MutationObserver` 遍歷 DOM，
  只把**整段文字**以及 `title` / `placeholder` / `aria-label` 等屬性中與詞典精確匹配的英文換成目標語言，
  並把 `<html lang>` 設成目標語言（簡繁共用的漢字按它選對字形）。
  - 帶 `{{占位}}` 的詞條按模板匹配；數量類佔位（`{{count}}` 等）只匹配數字，不會吞掉普通句子。
  - 拼接句裡的短詞（`of`、`now`、`entries`…）太短不能全域性替換，只按所在位置翻譯（如「1 / 17」「(0 條)」「剛剛」），規則按語言寫在 `locales/<语言>/fragments.json`。
- **教程**：鉤子攔截對 `static/tutorials/**.md` 的請求，渲染前按段落替換 Markdown 源文字；教程遠端更新後不用重新注入。
- **主程序**：寫入 `dist/main/ri-main-cn.js`，在入口 `main.js` 最前面插一行 `require`，包裝 `Menu.buildFromTemplate` 與 `dialog.showMessageBox`；
  選單的 Alt 快捷鍵補成「視窗(&W)」形式。

因為是整段精確匹配，不會像「直接改 bundle 裡的字串」那樣誤傷程式碼（比如把 `startsWith` 改成 `starts使用`）。

**備份與還原**：第一次注入時自動備份 `app.asar.bak`（及 `app.asar.unpacked` 的備份）。每次注入都「從備份重新解包 → 注入 → 打包」，
可重複執行、結果一致；打包後會核對原生模組（`better-sqlite3` / `keytar` 等）一個不少，不一致自動回滾。`restore` 一鍵恢復英文原版。

---

## 使用說明

### 方式零：包管理器（Scoop / Homebrew / npm）

| 平台 | 安裝 | 更新程式 | 解除安裝程式 |
|------|------|----------|----------|
| Windows（[Scoop](https://scoop.sh)） | `scoop bucket add hlmd https://github.com/hlmd/scoop-bucket`<br>`scoop install hlmd/redis-insight-chinese` | `scoop update redis-insight-chinese` | `scoop uninstall redis-insight-chinese` |
| macOS / Linux（[Homebrew](https://brew.sh)） | `brew install hlmd/tap/redis-insight-chinese` | `brew upgrade redis-insight-chinese` | `brew uninstall redis-insight-chinese` |
| 任意平台（npm，需 Node.js ≥ 22.12） | `npm i -g redis-insight-chinese`，或不安裝直接 `npx redis-insight-chinese` | `npm i -g redis-insight-chinese@latest` | `npm rm -g redis-insight-chinese` |

裝好後命令統一是 `redis-insight-chinese`，參數與下文 [命令與選項](#命令與選項) 一致：

```bash
redis-insight-chinese                    # 注入（先完全退出 Redis Insight）
redis-insight-chinese --no-app-update    # 注入，并关闭 Redis Insight 自动更新
redis-insight-chinese restore            # 还原英文
```

- **程式更新交給包管理器**：Scoop / Homebrew / npm 安裝的版本不會自更新（否則包管理器記錄的版本就對不上了），請用上表的更新命令；
  **譯文熱更新照常**，每次注入都會拉最新譯文。
- 「解除安裝程式」只是刪掉這個工具；要把 Redis Insight 變回英文，請先執行 `redis-insight-chinese restore`。
- Redis Insight 裝在需要管理員許可權的目錄（如 `C:\Program Files`、`/Applications`）時，需要用管理員終端機或 `sudo` 執行。

### 方式一：下載二進位制（目標機無需 Node）

從 [Release](../../releases) 下載對應平台的壓縮包，解壓得到單檔案：

| 平台 | 下載檔案 | 解壓後 |
|------|----------|--------|
| Windows x64 | `redis-insight-chinese-win-x64.zip` | `redis-insight-chinese-win-x64.exe` |
| Linux x64 / arm64 | `redis-insight-chinese-linux-x64.tar.xz` / `-arm64.tar.xz` | `redis-insight-chinese-linux-x64` / `-arm64` |
| macOS Intel / Apple Silicon | `redis-insight-chinese-macos-x64.tar.xz` / `-arm64.tar.xz` | `redis-insight-chinese-macos-x64` / `-arm64` |

> Windows 雙擊 `.zip` 即可解壓；Linux / macOS：`tar -xf redis-insight-chinese-*.tar.xz`（解壓後如丟失執行許可權：`chmod +x <文件名>`）。

```bash
# 1. 完全退出 Redis Insight
# 2. 注入（自动探测安装位置）
./redis-insight-chinese-win-x64.exe          # Windows
./redis-insight-chinese-macos-arm64          # macOS / Linux
# 3. 重新打开 Redis Insight
```

二進位制已內嵌全部譯文與依賴，斷網也能用內嵌譯文注入。

#### 線上更新（程式 + 譯文）

二進位制每次注入前會聯網檢查兩件事，任何一步失敗都只提示、不影響注入：

1. **程式自更新** —— 對比 GitHub 最新 Release，有新版就下載本平台壓縮包（GitHub 直連與 `ghfast.top` 映象**同時下載**，誰先完成用誰），
   按 Release 附帶的 `SHA256SUMS.txt` 校驗後替換自身，再以相同參數執行新版本。
2. **譯文熱更新** —— 預設分支每次改動詞典，CI 就把全部譯文 + 鉤子打成 `ri-update.json.gz` 推到 [`update-data`](../../tree/update-data) 分支；
   程式同時從 GitHub raw 與 jsDelivr 映象拉取、取最新一份，快取到本機（Windows `%LOCALAPPDATA%\redis-insight-chinese`、macOS `~/Library/Caches/…`、
   Linux `~/.cache/…`），離線時用快取。**不用等發版，譯文修好就能拿到。**

| 想要 | 加參數 |
|------|--------|
| 只更新譯文、不替換程式 | `--no-self-update` |
| 完全不聯網（有快取用快取，否則用內嵌） | `--offline` |

> Windows 自更新後程式旁會留一個 `*.exe.old`，下次執行自動刪除。程式所在目錄沒有寫許可權時自更新會跳過，照常注入。
> 想用自己改的譯文？把 `locales/` 資料夾放在**可執行檔案旁邊**即可覆蓋內嵌與線上資料（此時不聯網取譯文）。

### 方式二：Node 原始碼執行（開發 / 改譯文）

需要 Node.js ≥ 22.12。原始碼模式以倉庫裡的 `locales/` 為準，不拉線上譯文、也不自更新。

```bash
git clone git@github.com:hlmd/redis-insight-chinese.git
cd redis-insight-chinese
npm install
node redis-insight-chinese.js            # 注入（等同 apply）
```

### 命令與選項

下面用 `node redis-insight-chinese.js` 舉例；二進位制把它換成可執行檔名即可。

| 命令 | 作用 |
|------|------|
| `apply`（預設） | 注入翻譯 |
| `restore` | 從備份還原英文原版 |
| `verify` | 只讀檢查：asar 路徑、unpacked 原生模組數量、備份是否存在 |
| `langs` | 列出支援的語言、各自的覆蓋率，以及本機會自動選中哪種 |
| `extract` | 從安裝包提取候選英文串（開發用，見 [翻譯資料](#翻譯資料)） |
| `version` | 顯示本工具版本（同 `-v`、`--version`） |
| `help` | 顯示命令與選項說明（同 `-h`、`--help`） |

| 選項 | 作用 |
|------|------|
| `--lang <代码>` | 指定語言（見上表；只寫 `--lang` 不帶程式碼會列出支援的語言）。不指定時依次看環境變數 `RI_LANG`、`LC_ALL` / `LC_MESSAGES` / `LANG`、macOS 的系統語言、系統區域設定，都認不出用簡體中文 |
| `--install <路径>` | 指定 Redis Insight 安裝目錄，或直接指向 `app.asar`（跳過自動探測） |
| `--no-app-update` | 關閉 Redis Insight 自身的自動更新（見 [關閉自動更新](docs/disable-auto-update.md)） |
| `--offline` | 不聯網：不自更新、不拉取線上譯文 |
| `--no-self-update` | 只拉取線上譯文，不更新程式本身 |
| `--dry-run` | 試執行：只列印將注入的內容，不寫回 `app.asar` |
| `--dict <文件>` | 用指定的頁面詞典 JSON 覆蓋內建詞典 |
| `--out <文件>` | 輸出到另一個 asar，不覆蓋安裝目錄裡的 |

#### 預設探測位置

| 平台 | 位置 |
|------|------|
| Windows | 先查登錄檔解除安裝項（`HKCU` / `HKLM`），再查 `%LOCALAPPDATA%\Programs\Redis Insight`、`%ProgramFiles%\Redis Insight` 等 |
| macOS | `/Applications/Redis Insight.app`、`~/Applications/Redis Insight.app` |
| Linux | `/opt/Redis Insight`、`/opt/RedisInsight`、`/usr/lib/redisinsight` |

> 探測不到時用 `--install <安装目录>` 指定。macOS / Linux 的系統級目錄可能需要 `sudo` 才能寫入。

#### 驗證注入是否成功

- **看報告**：注入結束會列印各部分的條目數（頁面 / 教程 / 靜態內容 / 命令定義 / 主程序）和「已寫入」。
- **看介面**：重新開啟 Redis Insight，選單、按鈕、教程變成目標語言即成功。
- **只讀檢查**：`verify` 顯示備份是否存在（存在說明注入過至少一次）。

### 自行編譯二進位制

需要 [Bun](https://bun.sh)（`--compile` 交叉編譯）：

```bash
npm install
npm run build:all       # 全部 5 个平台到 dist/；或 build:win / build:linux / build:linux-arm64 / build:mac-x64 / build:mac-arm
```

> - 編譯前會自動生成內嵌快照 `generated/embedded.json`（詞典 + 鉤子）。
> - 在 Windows 上交叉編譯**非 Windows** 目標時 Bun 可能下載不完整（oven-sh/bun#25346），可在對應平台或 WSL 上編譯。
> - 也可直接打 tag（`git tag -a v0.3.0 -m "本次更新…" && git push origin v0.3.0`），由 [`.github/workflows/release.yml`](.github/workflows/release.yml)
>   在 CI 上交叉編譯、壓縮併發布 Release（tag 註解會成為 Release 的「本次更新」）。

---

## 防毒軟體報毒（誤報）說明

部分防毒軟體可能把 `.exe` 標記為 `Trojan:Win32/Wacatac.B!ml` 之類的**啟發式威脅**。這是**誤報**：

1. **單檔案二進位制的結構像加殼程式**——由 `bun --compile` 生成，產物 = 執行時 + 追加的指令碼載荷，這類打包器被機器學習模型誤判是行業級老問題；
2. **行為像「打補丁器」**——本工具會讀寫你已安裝的 Redis Insight 的 `app.asar`，行為規則上難以和惡意篡改區分；
3. **未做程式碼簽名**——新發布的未簽名 exe 在 SmartScreen 下一律顯示「未知發布者」。

**怎麼自己核實**

- **核對校驗和**：每個 Release 都附帶 `SHA256SUMS.txt`。

  ```powershell
  Get-FileHash .\redis-insight-chinese-win-x64.zip -Algorithm SHA256
  ```

- **驗證構建來源**：所有二進位制**均由 GitHub Actions 從公開原始碼構建**，並附帶[構建來源證明](https://docs.github.com/actions/security-guides/using-artifact-attestations)：

  ```bash
  gh attestation verify redis-insight-chinese-win-x64.zip --repo hlmd/redis-insight-chinese
  ```

- **上傳 [VirusTotal](https://www.virustotal.com/) 複核**：少數引擎標紅、主流引擎全綠，是典型的啟發式誤報特徵。

**不想跟殺軟糾纏**：直接用[方式二](#方式二node-原始碼執行開發--改譯文)跑原始碼，純 JavaScript 不經打包器，不會觸發這類誤報。
或把可執行檔案加入殺軟白名單（Defender：**Windows 安全中心 → 病毒和威脅防護 → 管理設定 → 排除項 → 新增檔案**）。

> 本工具只修改 Redis Insight 安裝目錄裡的 `app.asar`（並自動備份），**不上傳任何資料、不常駐背景**。聯網只有兩處：拉取線上譯文、檢查程式新版本，都可用 `--offline` 關掉。

---

## 翻譯資料

```
locales/
└── <语言>/                  # zh-CN、zh-TW
    ├── renderer.json        # 页面词典 { "英文": "译文" }，支持 {{占位}}
    ├── main.json            # 主进程词典（菜单 / 对话框），key 去掉助记符 &
    ├── fragments.json       # 拼接句短词规则（量词、「刚刚」等，见渲染钩子 ri-chinese.js）
    ├── tutorials.json       # 教程 { manifest: 目录树文字, markdown: 正文段落与代码注释 }
    ├── content.json         # 优化建议 Tips 等远端静态内容 { dom: … }
    └── commands.json        # 命令助手 { dom: 命令简介 / 复杂度 }
```

- key 是介面上**某個元素完整顯示的英文文字**（或屬性的完整值），區分大小寫；value 是譯文。值為空或與 key 相同的條目不注入。
- 除 `renderer.json` 外都是可選的，缺了對應部分就顯示英文。
- 短的單個小寫詞（`on`、`to`、`now`…）不收進全域性詞典，避免誤改使用者的鍵值、命令輸出；需要時按上下文規則處理。
- 詞典由同級目錄的 `redis-insight-locale-fetcher` 維護：從 Redis Insight 原始碼與安裝包提取英文、按版本歸檔、只翻新增文案、校驗後寫回 `locales/`。
  教程 / 靜態內容 / 命令定義按遠端發布時間或內容雜湊單獨更新。直接手改 `locales/` 也能生效，但下次同步會被覆蓋。

**改了譯文怎麼生效**：原始碼模式重跑 `node redis-insight-chinese.js`；推送到預設分支後，二進位制使用者下次執行就會自動拿到。

---

## 常見問題

**介面還是英文**
① 注入前是否**完全退出** Redis Insight（含托盤圖示）；② 報告最後是否有「已寫入」；③ 是否打到了正在用的那份安裝（多份安裝用 `--install` 指定）。

**Redis Insight 自動更新後又變回英文**
升級會整包替換 `app.asar`，重新執行一次注入程式即可（它會先把自己和譯文更新到最新再注入）。想不再被覆蓋：加 `--no-app-update`。

**某處沒翻譯 / 翻譯不當**
附截圖提 [Issue](../../issues)（選「漏譯 / 誤譯」模板），說明所在介面。拼接句裡的短詞、程式按英文格式生成的日期（如 `Jul 21, 2026`）可能仍是英文。

**`app.asar` 被佔用 / `EBUSY` / `EPERM`**
Redis Insight 還在執行，或系統目錄需要管理員許可權。退出應用後重試；macOS / Linux 系統目錄用 `sudo`。

**防毒軟體報毒 / SmartScreen 攔截**
單檔案二進位制的啟發式誤報，見 [防毒軟體報毒（誤報）說明](#防毒軟體報毒誤報說明)。

**想解除安裝翻譯 / 換一種語言**
執行 `restore` 恢復到注入前的英文原版；換語言直接用 `--lang <代码>` 重新注入即可（每次都從備份重新生成）。

**命令列輸出是中文**
注入程式自己的提示資訊目前只有簡體中文，不影響 Redis Insight 介面用哪種語言。

---

## 交流 / 意見回饋

- 問題與建議歡迎提 [Issue](../../issues)。
- QQ 群：**494969115**

### 提 Issue 前請附上這些資訊

點 **New issue** 會有現成模板（Bug / 漏譯誤譯 / 功能建議），報 Bug 時請儘量附上：

| 資訊 | 怎麼拿 |
|------|--------|
| **作業系統與版本** | Windows 10/11、macOS 版本 + 晶片（Intel / Apple Silicon）、Linux 發行版 |
| **Redis Insight 版本** | Redis Insight 選單 `帮助 → 关于`（英文介面為 `Help → About`） |
| **本工具版本** | 執行 `... version`，或所下載 Release 的版本號 |
| **使用方式** | 二進位制 / Node 原始碼執行 |
| **注入報告** | 執行注入時終端機輸出的整段「本地化報告」 |
| **完整報錯** | 終端機的完整錯誤文字，別隻截一半 |
| **復現步驟與截圖** | 做了什麼、期望什麼、實際什麼；未翻譯的位置附截圖示出 |

---

## 法律宣告 / Disclaimer

- **非官方、無關聯**：本專案是社羣維護的第三方本地化工具，**與 Redis Ltd. 沒有任何關聯**，未獲其授權、贊助或背書。"Redis" 與 "Redis Insight" 是 Redis Ltd. 的商標，此處僅作描述性指代。
- **不分發 Redis Insight 資產**：本倉庫**不包含、也不分發** Redis Insight 的任何原始碼或二進位制程式。倉庫內容只有本專案自己的指令碼與各語言譯文。
- **譯文資料**：`locales/` 下的譯文派生自 Redis Insight 的介面文案、教程與命令文件。本專案對這部分**不主張版權**，也不保證其可在所有場景下自由再分發；如 Redis Ltd. 提出異議，將配合處理。
- **本地使用、自負風險**：本工具在**你自己的機器**上修改**你自己安裝**的 Redis Insight（重打包 `app.asar`）。是否使用由你自行決定並承擔風險，請遵守 Redis Insight 的許可條款。
- **許可**：本專案**自身程式碼**以 MIT 許可發布；該許可**不覆蓋**上述派生自 Redis Insight 文案的譯文資料。
- 本說明不構成法律意見。

---

<details>
<summary><b>開發者：目錄結構</b></summary>

```
redis-insight-chinese/
├── redis-insight-chinese.js        # CLI 入口：apply / langs / restore / verify / extract / version
├── src/
│   ├── hooks/
│   │   ├── ri-chinese.js           # 渲染进程钩子（DOM 替换 + 上下文规则 + 教程 .md 拦截 + <html lang>）
│   │   ├── ri-main-cn.cjs     # 主进程钩子（原生菜单 / 对话框 + --no-app-update）
│   │   └── md-segments.cjs      # 教程 Markdown 段落切分器（钩子与 fetcher 共用）
│   ├── inject.js                # 写入渲染钩子
│   ├── menu.js                  # 写入主进程钩子
│   ├── i18n.js                  # 支持的语言、系统语言探测、各语言词典路径
│   ├── updater.js               # 在线更新：程序自更新 + 译文热更新
│   ├── resources.js             # 词典 / 钩子读取（exe 旁 > 仓库 > 在线数据包 > 内嵌快照）
│   └── locate.js / asar.js / backup.js / …
├── locales/                     # 各语言词典（见「翻译数据」）
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
