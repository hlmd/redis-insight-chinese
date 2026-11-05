// src/updater.js —— 注入程序的「在线更新」(移植自 postman-chinese-injector/src/updater.js)
//
//   ① 译文热更新:CI 在 main 每次改动词典 / 钩子后,把全部内嵌数据(词典 + 钩子源码)打成单个
//      ri-update.json.gz 推到 update-data 分支(.github/workflows/update-data.yml)。注入前并行从
//      GitHub raw 与 jsDelivr 镜像拉取,取最新的一份缓存到本机;离线用缓存,缓存也没有 / 不比内嵌新
//      就回退二进制内嵌快照。
//   ② 程序自更新(仅单文件二进制):对比 GitHub 最新 Release 的版本号,有新版就下载对应平台压缩包
//      → 按 SHA256SUMS.txt 校验 → 解压替换自身 → 以原参数重新运行新版本。
//
// 任何一步失败都只打印警告,不影响用现有数据完成注入。
import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import crypto from "crypto";
import { spawnSync } from "child_process";

export const REPO = "hlmd/redis-insight-chinese";
const DATA_BRANCH = "update-data";
export const DATA_FILE = "ri-update.json.gz";
// 数据包格式版本:数据结构变了就 +1,老程序会忽略新格式的数据包(转而靠自更新)
export const DATA_SCHEMA = 1;
const DATA_URLS = [
  `https://raw.githubusercontent.com/${REPO}/${DATA_BRANCH}/${DATA_FILE}`,
  `https://cdn.jsdelivr.net/gh/${REPO}@${DATA_BRANCH}/${DATA_FILE}`,
  `https://fastly.jsdelivr.net/gh/${REPO}@${DATA_BRANCH}/${DATA_FILE}`,
];
const RELEASE_LATEST = `https://github.com/${REPO}/releases/latest`;
const releaseAsset = (tag, name) => `https://github.com/${REPO}/releases/download/${tag}/${name}`;
// 大文件直连 GitHub 常被截断,失败后走加速镜像;下载内容一律按 GitHub 上的 SHA256SUMS 校验
const ASSET_MIRRORS = [(u) => u, (u) => `https://ghfast.top/${u}`];
const UA = "redis-insight-chinese-updater";
const SELF_UPDATED_ENV = "RICN_SELF_UPDATED";
const ASSET_PREFIX = "redis-insight-chinese";

// ---------- HTTP ----------
// timeout 是「空闲超时」:连续这么久没收到数据就放弃。onProgress(已收字节, 总字节或 0)。
async function httpGet(url, { method = "GET", timeout = 15000, onProgress, signal } = {}) {
  const ac = new AbortController();
  if (signal) signal.addEventListener("abort", () => ac.abort(), { once: true });
  let timer;
  const kick = () => { clearTimeout(timer); timer = setTimeout(() => ac.abort(), timeout); };
  kick();
  try {
    const res = await fetch(url, { method, redirect: "follow", signal: ac.signal, headers: { "User-Agent": UA } });
    const chunks = [];
    if (method !== "HEAD" && res.body) {
      const total = parseInt(res.headers.get("content-length"), 10) || 0;
      const reader = res.body.getReader();
      let got = 0;
      for (;;) {
        kick();
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
        got += value.length;
        if (onProgress) onProgress(got, total);
      }
    }
    return { status: res.status, url: res.url || url, body: Buffer.concat(chunks) };
  } catch (e) {
    throw new Error(signal && signal.aborted ? "已取消" : ac.signal.aborted ? `${timeout / 1000}s 内无响应` : e.message);
  } finally {
    clearTimeout(timer);
  }
}

async function getOk(url, opts) {
  const res = await httpGet(url, opts);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  return res;
}

// 下载进度:每 10% 打一行(不用回车原地刷新,兼容双击运行的控制台与日志重定向)
function progressLogger(log) {
  let last = -1;
  return (got, total) => {
    if (!total) return;
    const pct = Math.floor((got / total) * 10) * 10;
    if (pct > last) {
      last = pct;
      log(`         ${pct}%(${(got / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB)`);
    }
  };
}

export function cmpVer(a, b) {
  const pa = String(a).replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

function cacheDir() {
  const home = os.homedir();
  let base;
  if (process.platform === "win32") base = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
  else if (process.platform === "darwin") base = path.join(home, "Library", "Caches");
  else base = process.env.XDG_CACHE_HOME || path.join(home, ".cache");
  return path.join(base, "redis-insight-chinese");
}

// ---------- ① 译文数据包 ----------
// 结构:{ schema, version, commit, committedAt, files: { "相对路径": 文件文本 } }(files 与 generated/embedded.json 同构)
// 解析并校验;gzip 或纯 JSON 都认(镜像可能透明解压)。required 为必须存在的文件。不合格抛异常。
export function parseDataBundle(buf, required = []) {
  const raw = buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf;
  const b = JSON.parse(raw.toString("utf8"));
  if (!b || typeof b !== "object") throw new Error("数据包不是对象");
  if (b.schema !== DATA_SCHEMA) throw new Error(`数据包格式 ${b.schema} 与本程序(${DATA_SCHEMA})不兼容`);
  if (!b.files || typeof b.files !== "object") throw new Error("数据包缺少 files");
  for (const rel of required) {
    if (typeof b.files[rel] !== "string" || !b.files[rel]) throw new Error(`数据包缺少 ${rel}`);
    if (rel.endsWith(".json")) JSON.parse(b.files[rel]);
  }
  if (typeof b.committedAt !== "string" || isNaN(Date.parse(b.committedAt))) throw new Error("数据包缺少时间戳");
  return b;
}

const newer = (a, b) => Date.parse(a.committedAt) > Date.parse(b.committedAt);

// 并行拉取所有数据源,取 committedAt 最新的一份(jsDelivr 对分支有最长 12h 缓存,raw 通常最新)
async function fetchLatestData(required, log) {
  const results = await Promise.allSettled(DATA_URLS.map(async (u) => {
    const { body } = await getOk(u, { timeout: 12000 });
    return { buf: body, bundle: parseDataBundle(body, required), url: u };
  }));
  let best = null;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      if (!best || newer(r.value.bundle, best.bundle)) best = r.value;
    } else {
      log(`[更新] ${new URL(DATA_URLS[i]).host} 拉取失败: ${r.reason && r.reason.message}`);
    }
  });
  return best;
}

function readCachedData(required) {
  try { return parseDataBundle(fs.readFileSync(path.join(cacheDir(), DATA_FILE)), required); } catch { return null; }
}

function writeCachedData(buf) {
  try {
    fs.mkdirSync(cacheDir(), { recursive: true });
    fs.writeFileSync(path.join(cacheDir(), DATA_FILE), buf);
  } catch { /* 缓存写不进去不影响本次注入 */ }
}

/**
 * 取可用的最新译文数据包。embeddedAt 为内嵌快照的提交时间(ISO,未知可为 null)。
 * 返回比内嵌更新的数据包(含 from 字段说明来源),否则 null(调用方用内嵌快照)。
 */
export async function resolveDataBundle({ embeddedAt, offline, required = [], log = console.log } = {}) {
  let cand = null;
  if (!offline) {
    log("[更新] 正在检查最新译文…");
    const got = await fetchLatestData(required, log);
    if (got) {
      writeCachedData(got.buf);
      cand = Object.assign(got.bundle, { from: new URL(got.url).host });
    }
  }
  if (!cand) {
    const cached = readCachedData(required);
    if (cached) cand = Object.assign(cached, { from: "本机缓存" });
  }
  if (!cand) return null;
  if (embeddedAt && !newer(cand, { committedAt: embeddedAt })) {
    log(`[更新] 内嵌译文已是最新(${embeddedAt})`);
    return null;
  }
  return cand;
}

// ---------- ② 程序自更新 ----------
// 是否为 bun --compile 出的单文件二进制;用 node / bun 直接跑源码时不自更新
export function isStandaloneBinary() {
  if (!process.versions.bun) return false;
  return !/^(bun|node)(\.exe)?$/i.test(path.basename(process.execPath));
}

// 当前平台对应的 Release 压缩包名(与 .github/workflows/release.yml 的产物一致)
export function assetNameFor(platform = process.platform, arch = process.arch) {
  if (platform === "win32") return `${ASSET_PREFIX}-win-x64.zip`; // arm64 Windows 走 x64 模拟
  if (platform === "linux" && (arch === "x64" || arch === "arm64")) return `${ASSET_PREFIX}-linux-${arch}.tar.xz`;
  if (platform === "darwin") return `${ASSET_PREFIX}-macos-${arch === "arm64" ? "arm64" : "x64"}.tar.xz`;
  return null;
}

// 最新 Release 的 tag:跟随 /releases/latest 的重定向,从最终 URL 取(不占 API 限额)
async function latestReleaseTag() {
  const res = await httpGet(RELEASE_LATEST, { method: "HEAD", timeout: 10000 });
  const m = /\/releases\/tag\/([^/?#]+)/.exec(res.url);
  if (!m) throw new Error(`无法从 ${res.url} 解析最新版本(HTTP ${res.status})`);
  return decodeURIComponent(m[1]);
}

export function parseSums(text) {
  const map = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^([0-9a-f]{64})\s+\*?(.+)$/i.exec(line.trim());
    if (m) map[m[2].trim()] = m[1].toLowerCase();
  }
  return map;
}

// 从 zip 取出唯一的文件(读中央目录,支持 stored / deflate;Release 的 Windows 包只含一个 exe)
export function extractSingleFromZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("不是有效的 zip");
  let p = buf.readUInt32LE(eocd + 16);
  const entries = buf.readUInt16LE(eocd + 10);
  for (let n = 0; n < entries; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("zip 中央目录损坏");
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue;
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error("zip 本地头损坏");
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + csize);
    if (method === 0) return { name, data: Buffer.from(data) };
    if (method === 8) return { name, data: zlib.inflateRawSync(data) };
    throw new Error(`不支持的 zip 压缩方式 ${method}`);
  }
  throw new Error("zip 里没有文件");
}

// tar.xz 交给系统 tar(macOS 自带 bsdtar、Linux GNU tar + xz 都支持 -J)
function extractTarXz(archive, destDir) {
  const r = spawnSync("tar", ["-xJf", archive, "-C", destDir], { stdio: ["ignore", "ignore", "pipe"] });
  if (r.error || r.status !== 0) {
    throw new Error(`解压失败(需要系统 tar 支持 xz):${r.error ? r.error.message : String(r.stderr).trim()}`);
  }
  const files = fs.readdirSync(destDir).filter((f) => f.startsWith(ASSET_PREFIX) && !f.endsWith(".tar.xz"));
  if (files.length !== 1) throw new Error("压缩包内容不符合预期");
  return path.join(destDir, files[0]);
}

// 校验和文件很小,优先直连 GitHub(多试几次);都失败再走镜像(只能防截断、不能防镜像篡改,故提示)
async function fetchSums(tag, log) {
  const url = releaseAsset(tag, "SHA256SUMS.txt");
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try { return (await getOk(url, { timeout: 15000 })).body; } catch (e) { lastErr = e; }
  }
  for (const mirror of ASSET_MIRRORS.slice(1)) {
    try {
      const { body } = await getOk(mirror(url), { timeout: 15000 });
      log("[自更新] 直连 GitHub 取校验和失败,已改用镜像获取");
      return body;
    } catch (e) { lastErr = e; }
  }
  throw new Error(`获取 SHA256SUMS.txt 失败: ${lastErr && lastErr.message}`);
}

// 所有源同时下载,第一个下完且 SHA256 校验通过的胜出,其余立即取消
async function downloadAsset(tag, name, expectSha, log) {
  const ac = new AbortController();
  const urls = ASSET_MIRRORS.map((m) => m(releaseAsset(tag, name)));
  const progress = progressLogger(log);
  const sofar = urls.map(() => 0);
  log(`[自更新] 并行下载 ${name}(${urls.map((u) => new URL(u).host).join(" / ")})`);
  try {
    return await Promise.any(urls.map(async (url, i) => {
      try {
        const { body } = await getOk(url, {
          timeout: 20000, signal: ac.signal,
          onProgress: (got, total) => { sofar[i] = got; progress(Math.max(...sofar), total); },
        });
        const sha = crypto.createHash("sha256").update(body).digest("hex");
        if (sha !== expectSha) throw new Error("SHA256 校验不符(下载不完整或被篡改)");
        ac.abort();
        log(`[自更新] 已从 ${new URL(url).host} 下载完成,校验通过`);
        return body;
      } catch (e) {
        if (!ac.signal.aborted) log(`[自更新] ${new URL(url).host} 失败: ${e.message}`);
        throw e;
      }
    }));
  } catch {
    throw new Error("所有下载源均失败");
  }
}

// 用新二进制替换当前可执行文件。Windows 不能覆盖运行中的 exe,但可以改名:exe → exe.old
function replaceSelf(newBin) {
  const exe = process.execPath;
  if (process.platform === "win32") {
    const old = exe + ".old";
    try { fs.unlinkSync(old); } catch { /* 不存在或仍被占用 */ }
    fs.renameSync(exe, old);
    try { fs.renameSync(newBin, exe); } catch (e) { fs.renameSync(old, exe); throw e; }
    return;
  }
  fs.chmodSync(newBin, 0o755);
  if (process.platform === "darwin") {
    // CI 在 Linux 交叉编译,产物无签名;Apple Silicon 要求至少 ad-hoc 签名,否则启动即被杀
    spawnSync("codesign", ["--force", "--sign", "-", newBin], { stdio: "ignore" });
  }
  fs.renameSync(newBin, exe); // 同目录 rename 原子替换
}

// 上次在 Windows 上自更新留下的 exe.old,下次启动时顺手清掉
export function cleanupOldBinary() {
  if (process.platform !== "win32" || !isStandaloneBinary()) return;
  try { fs.unlinkSync(process.execPath + ".old"); } catch { /* 不存在或仍被占用 */ }
}

/** 检查并执行程序自更新。已更新则以原参数运行新版本并返回其退出码;否则返回 null 继续当前流程。 */
export async function selfUpdate({ currentVersion, argv, log = console.log } = {}) {
  if (!isStandaloneBinary() || process.env[SELF_UPDATED_ENV]) return null;
  const name = assetNameFor();
  if (!name) return null;

  let tag;
  try {
    tag = await latestReleaseTag();
  } catch (e) {
    log(`[自更新] 检查新版本失败,跳过: ${e.message}`);
    return null;
  }
  if (cmpVer(tag, currentVersion) <= 0) {
    log(`[自更新] 已是最新版本 v${currentVersion}`);
    return null;
  }
  log(`[自更新] 发现新版本 ${tag}(当前 v${currentVersion}),开始更新…`);

  let work = null;
  try {
    // 临时目录放在 exe 同目录,保证最后的 rename 不跨文件系统
    work = fs.mkdtempSync(path.join(path.dirname(process.execPath), ".ricn-update-"));
    const expect = parseSums((await fetchSums(tag, log)).toString("utf8"))[name];
    if (!expect) throw new Error(`SHA256SUMS.txt 里没有 ${name}`);
    const archive = await downloadAsset(tag, name, expect, log);
    let newBin;
    if (name.endsWith(".zip")) {
      newBin = path.join(work, "new.exe");
      fs.writeFileSync(newBin, extractSingleFromZip(archive).data);
    } else {
      const archivePath = path.join(work, name);
      fs.writeFileSync(archivePath, archive);
      newBin = extractTarXz(archivePath, work);
    }
    replaceSelf(newBin);
  } catch (e) {
    log(`[自更新] 更新失败,继续使用当前版本: ${e.message}`);
    log(`         可手动下载:https://github.com/${REPO}/releases/latest`);
    if (e.code === "EACCES" || e.code === "EPERM") log("         (程序所在目录无写权限,可移到有权限的目录或用 sudo 运行)");
    return null;
  } finally {
    if (work) try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  log(`[自更新] 已更新到 ${tag},重新运行新版本…\n`);
  const r = spawnSync(process.execPath, argv, {
    stdio: "inherit",
    env: Object.assign({}, process.env, { [SELF_UPDATED_ENV]: "1" }),
  });
  if (r.error) {
    log(`[自更新] 启动新版本失败: ${r.error.message};请手动重新运行`);
    return 1;
  }
  return r.status === null ? 1 : r.status;
}
