#!/usr/bin/env node
/*
 * gen-packaging.js —— 按某个 Release 的 SHA256SUMS.txt 生成包管理器清单:
 *   <outdir>/scoop/bucket/redis-insight-chinese.json   → 推到 hlmd/scoop-bucket 仓库的 bucket/ 下
 *   <outdir>/homebrew/Formula/redis-insight-chinese.rb  → 推到 hlmd/homebrew-tap 仓库的 Formula/ 下
 *
 * 用法: node scripts/gen-packaging.js <版本号,如 0.3.0 或 v0.3.0> <SHA256SUMS.txt 路径> <输出目录>
 * release.yml 发版后自动调用;也可手动对已有 Release 生成:
 *   curl -fsSLO https://github.com/hlmd/redis-insight-chinese/releases/download/v0.2.0/SHA256SUMS.txt
 *   node scripts/gen-packaging.js 0.2.0 SHA256SUMS.txt out
 */
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseSums, REPO } from "../src/updater.js";

const NAME = "redis-insight-chinese";
const DESC = "Redis Insight 桌面端非官方汉化工具(与 Redis Ltd. 无关)";
const HOMEPAGE = `https://github.com/${REPO}`;
const LICENSE = "MIT";
const asset = (v, f) => `https://github.com/${REPO}/releases/download/v${v}/${f}`;

function need(sums, file) {
  if (!sums[file]) throw new Error(`SHA256SUMS.txt 里没有 ${file}`);
  return sums[file];
}

export function scoopManifest(version, sums) {
  const zip = `${NAME}-win-x64.zip`;
  return {
    version,
    description: DESC,
    homepage: HOMEPAGE,
    license: LICENSE,
    notes: [
      "运行前请完全退出 Redis Insight(包括托盘图标)。",
      "注入: redis-insight-chinese    还原: redis-insight-chinese restore",
      "程序更新请用 scoop update redis-insight-chinese(Scoop 安装时不自更新)。",
    ],
    architecture: {
      "64bit": { url: asset(version, zip), hash: need(sums, zip) },
      arm64: { url: asset(version, zip), hash: need(sums, zip) }, // Windows arm64 走 x64 模拟
    },
    bin: [[`${NAME}-win-x64.exe`, NAME]],
    checkver: { github: HOMEPAGE },
    autoupdate: {
      architecture: {
        "64bit": { url: `https://github.com/${REPO}/releases/download/v$version/${zip}` },
        arm64: { url: `https://github.com/${REPO}/releases/download/v$version/${zip}` },
      },
      hash: { url: `https://github.com/${REPO}/releases/download/v$version/SHA256SUMS.txt` },
    },
  };
}

export function homebrewFormula(version, sums) {
  const f = (p) => `${NAME}-${p}.tar.xz`;
  const block = (p) => `      url "${asset(version, f(p))}"\n      sha256 "${need(sums, f(p))}"`;
  return `# 由 hlmd/redis-insight-chinese 的 scripts/gen-packaging.js 自动生成,请勿手改
class RedisInsightChinese < Formula
  desc "${DESC}"
  homepage "${HOMEPAGE}"
  version "${version}"
  license "${LICENSE}"

  on_macos do
    on_arm do
${block("macos-arm64")}
    end
    on_intel do
${block("macos-x64")}
    end
  end

  on_linux do
    on_arm do
${block("linux-arm64")}
    end
    on_intel do
${block("linux-x64")}
    end
  end

  def install
    binary = Dir["${NAME}-*"].reject { |f| f.end_with?(".tar.xz") }.first
    odie "压缩包里没有找到可执行文件" if binary.nil?
    chmod 0755, binary
    bin.install binary => "${NAME}"
    # CI 在 Linux 上交叉编译,产物无签名;Apple Silicon 要求至少 ad-hoc 签名,否则启动即被杀
    system "codesign", "--force", "--sign", "-", bin/"${NAME}" if OS.mac?
  end

  def caveats
    <<~EOS
      运行前请完全退出 Redis Insight(包括托盘 / 菜单栏图标)。
        注入:  ${NAME}
        还原:  ${NAME} restore
      Redis Insight 装在 /Applications 时,可能需要 sudo ${NAME}。
      程序更新请用 brew upgrade ${NAME}(Homebrew 安装时不自更新)。
    EOS
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/${NAME} version")
  end
end
`;
}

const isMain = !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  const [rawVersion, sumsPath, outDir] = process.argv.slice(2);
  if (!rawVersion || !sumsPath || !outDir) {
    console.error("用法: node scripts/gen-packaging.js <版本号> <SHA256SUMS.txt> <输出目录>");
    process.exit(1);
  }
  const version = rawVersion.replace(/^v/, "");
  const sums = parseSums(readFileSync(sumsPath, "utf8"));
  const scoopPath = join(outDir, "scoop", "bucket", `${NAME}.json`);
  const brewPath = join(outDir, "homebrew", "Formula", `${NAME}.rb`);
  for (const p of [scoopPath, brewPath]) mkdirSync(dirname(p), { recursive: true });
  writeFileSync(scoopPath, JSON.stringify(scoopManifest(version, sums), null, 4) + "\n");
  writeFileSync(brewPath, homebrewFormula(version, sums));
  console.log(`已生成 v${version}:\n  ${scoopPath}\n  ${brewPath}`);
}
