import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { locateAsar, candidatesFor } from "../src/locate.js";
import { toPosix } from "../src/paths.js";

test("candidatesFor 目录返回 resources/Contents/直下 三候选", () => {
  const c = candidatesFor("/opt/ri", "linux").map(toPosix);
  expect(c).toEqual([
    "/opt/ri/resources/app.asar",
    "/opt/ri/Contents/Resources/app.asar",
    "/opt/ri/app.asar",
  ]);
});

test("locateAsar 直接接受 .asar 文件路径", () => {
  const root = mkdtempSync(join(tmpdir(), "loc-"));
  const f = join(root, "app.asar");
  writeFileSync(f, "x");
  expect(toPosix(locateAsar(f))).toBe(toPosix(f));
});

test("locateAsar 在目录下找到 resources/app.asar", () => {
  const root = mkdtempSync(join(tmpdir(), "loc-"));
  mkdirSync(join(root, "resources"), { recursive: true });
  const f = join(root, "resources", "app.asar");
  writeFileSync(f, "x");
  expect(toPosix(locateAsar(root))).toBe(toPosix(f));
});

test("找不到时抛错并提示 --install", () => {
  const root = mkdtempSync(join(tmpdir(), "loc-"));
  expect(() => locateAsar(root)).toThrow(/--install/);
});
