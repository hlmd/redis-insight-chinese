import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { locateAsar, candidatesFor, parseRegInstallDirs } from "../src/locate.js";
import { toPosix } from "../src/paths.js";

test("candidatesFor 目录返回 resources/Contents/直下 三候选", () => {
  const c = candidatesFor("/opt/ri", "linux").map(toPosix);
  assert.deepStrictEqual(c, [
    "/opt/ri/resources/app.asar",
    "/opt/ri/Contents/Resources/app.asar",
    "/opt/ri/app.asar",
  ]);
});

test("locateAsar 直接接受 .asar 文件路径", () => {
  const root = mkdtempSync(join(tmpdir(), "loc-"));
  const f = join(root, "app.asar");
  writeFileSync(f, "x");
  assert.strictEqual(toPosix(locateAsar(f)), toPosix(f));
});

test("locateAsar 在目录下找到 resources/app.asar", () => {
  const root = mkdtempSync(join(tmpdir(), "loc-"));
  mkdirSync(join(root, "resources"), { recursive: true });
  const f = join(root, "resources", "app.asar");
  writeFileSync(f, "x");
  assert.strictEqual(toPosix(locateAsar(root)), toPosix(f));
});

test("parseRegInstallDirs 从 NSIS 卸载项提取安装目录", () => {
  const text = [
    "HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\35443657",
    "    DisplayName    REG_SZ    Redis Insight 3.8.0",
    '    UninstallString    REG_SZ    "C:\\Program Files\\Redis Insight\\Uninstall Redis Insight.exe" /allusers',
    "    DisplayIcon    REG_SZ    C:\\Program Files\\Redis Insight\\Redis Insight.exe,0",
    "    InstallLocation    REG_SZ    E:\\Tools\\RedisInsight",
    "    DisplayIcon    REG_SZ    C:\\ProgramData\\Package Cache\\vc_redist.x64.exe,0",
  ].join("\r\n");
  assert.deepStrictEqual(parseRegInstallDirs(text).map(toPosix), [
    "C:/Program Files/Redis Insight",
    "E:/Tools/RedisInsight",
  ]);
});

test("找不到时抛错并提示 --install", () => {
  const root = mkdtempSync(join(tmpdir(), "loc-"));
  assert.throws(() => locateAsar(root), /--install/);
});
