# 包管理器发布（维护者用）

推送 `v*` tag 后，`.github/workflows/release.yml` 会在构建 Release 之后再跑两个 job：

| job | 做什么 | 需要 |
|-----|--------|------|
| `publish-npm` | 校验 tag 与 `package.json` 版本一致 → `npm publish --provenance`（该版本已存在就跳过） | npm 可信发布（推荐），或仓库密钥 `NPM_TOKEN` |
| `update-package-managers` | 用本次的 `SHA256SUMS.txt` 跑 `scripts/gen-packaging.js`，把清单推到两个仓库 | 仓库密钥 `PACKAGING_TOKEN`（没配就跳过并给出警告） |

清单推送到：

- [`hlmd/scoop-bucket`](https://github.com/hlmd/scoop-bucket)：`bucket/redis-insight-chinese.json`
- [`hlmd/homebrew-tap`](https://github.com/hlmd/homebrew-tap)：`Formula/redis-insight-chinese.rb`（Homebrew 要求 tap 仓库名以 `homebrew-` 开头）

## 一次性设置

1. **在 GitHub 上建两个公开仓库** `hlmd/scoop-bucket` 和 `hlmd/homebrew-tap`，推送初始内容。
2. **PACKAGING_TOKEN**：建一个 fine-grained PAT，Repository access 只选这两个仓库，权限给 *Contents: Read and write*；
   然后在主仓库的 Settings → Secrets and variables → Actions 里添加，名字填 `PACKAGING_TOKEN`。
3. **npm**：
   - 第一次发布要手动来：`npm login`，然后在仓库根目录运行 `npm publish --access public`；
   - 之后在 npmjs.com 上，到这个包的 Settings → Trusted Publisher，选 GitHub Actions，填 `hlmd` / `redis-insight-chinese` / `release.yml`。
     这样以后发版就不需要令牌了。如果不想用可信发布，就在主仓库添加密钥 `NPM_TOKEN`（Automation 类型的令牌）。

## 发版流程

```bash
npm version 0.3.0 --no-git-tag-version   # 改 package.json / package-lock.json 版本号
git commit -am "chore: 发布 v0.3.0"
git tag -a v0.3.0 -m "本次更新说明"
git push && git push origin v0.3.0
```

## 手动生成或补发清单

```bash
curl -fsSLO https://github.com/hlmd/redis-insight-chinese/releases/download/v0.3.0/SHA256SUMS.txt
node scripts/gen-packaging.js v0.3.0 SHA256SUMS.txt out
# 产出 out/scoop/bucket/*.json 和 out/homebrew/Formula/*.rb，分别复制到两个仓库后提交
```

## 自更新与包管理器

单文件程序会通过可执行文件所在的路径判断是不是由包管理器安装的（`src/updater.js` 的 `managedInstall`）：

- 路径里有 `scoop/apps/`，或者在 `$SCOOP` / `$SCOOP_GLOBAL` 下面 → 判定为 Scoop；
- 路径里有 `Cellar/redis-insight-chinese/`，或者在 `$HOMEBREW_CELLAR` 下面 → 判定为 Homebrew。

是包管理器安装的就不自更新，只提示对应的更新命令。npm 安装是用 Node 运行源码，本来就不会自更新。

npm 包里带的 `locales/` 只是发版那一刻的快照，优先级排在线上译文包之后（`src/resources.js` 的 `isNpmInstall`），
所以用 npx 运行一样能拿到最新译文。
