// test/packaging.test.js —— 包管理器相关:安装来源识别、npm 模式的资源查找、清单生成
import { test } from "node:test";
import assert from "node:assert/strict";
import { managedInstall } from "../src/updater.js";
import { isNpmInstall } from "../src/resources.js";
import { scoopManifest, homebrewFormula } from "../scripts/gen-packaging.js";

test("managedInstall:识别 Scoop / Homebrew 安装,其余返回 null", () => {
  const r = String.raw;
  assert.equal(managedInstall(r`C:\Users\a\scoop\apps\redis-insight-chinese\current\redis-insight-chinese-win-x64.exe`, {}).name, "Scoop");
  assert.equal(managedInstall(r`D:\Tools\apps\redis-insight-chinese\0.3.0\x.exe`, { SCOOP: r`D:\Tools\ `.trim() }).name, "Scoop");
  assert.equal(managedInstall("/opt/homebrew/Cellar/redis-insight-chinese/0.3.0/bin/redis-insight-chinese", {}).name, "Homebrew");
  assert.equal(managedInstall("/home/u/.linuxbrew/c/redis-insight-chinese/0.3.0/bin/x", { HOMEBREW_CELLAR: "/home/u/.linuxbrew/c" }).name, "Homebrew");
  assert.equal(managedInstall(r`C:\Users\a\Downloads\redis-insight-chinese-win-x64.exe`, {}), null);
  assert.equal(managedInstall("/usr/local/bin/redis-insight-chinese", { SCOOP: "" }), null);
});

test("isNpmInstall:包目录在 node_modules 下才算", () => {
  const r = String.raw;
  assert.equal(isNpmInstall(r`C:\Users\a\AppData\Roaming\npm\node_modules\redis-insight-chinese`), true);
  assert.equal(isNpmInstall("/home/u/.npm/_npx/abc/node_modules/redis-insight-chinese"), true);
  assert.equal(isNpmInstall(r`D:\src\redis-insight-chinese`), false);
  assert.equal(isNpmInstall(null), false);
});

const SUMS = Object.fromEntries(
  ["win-x64.zip", "macos-arm64.tar.xz", "macos-x64.tar.xz", "linux-arm64.tar.xz", "linux-x64.tar.xz"]
    .map((s, i) => [`redis-insight-chinese-${s}`, String(i).repeat(64)]),
);

test("scoopManifest:指向 Release 的 zip,命令名去掉平台后缀", () => {
  const m = scoopManifest("1.2.3", SUMS);
  assert.equal(m.version, "1.2.3");
  assert.match(m.architecture["64bit"].url, /\/v1\.2\.3\/redis-insight-chinese-win-x64\.zip$/);
  assert.equal(m.architecture["64bit"].hash, "0".repeat(64));
  assert.deepEqual(m.bin, [["redis-insight-chinese-win-x64.exe", "redis-insight-chinese"]]);
  assert.throws(() => scoopManifest("1.2.3", {}), /SHA256SUMS/);
});

test("homebrewFormula:四个平台都有 url 与 sha256", () => {
  const rb = homebrewFormula("1.2.3", SUMS);
  for (const p of ["macos-arm64", "macos-x64", "linux-arm64", "linux-x64"]) {
    assert.ok(rb.includes(`/v1.2.3/redis-insight-chinese-${p}.tar.xz`), p);
  }
  assert.ok(rb.includes(`sha256 "${"1".repeat(64)}"`));
  assert.match(rb, /class RedisInsightChinese < Formula/);
  assert.match(rb, /bin\.install binary => "redis-insight-chinese"/);
});
