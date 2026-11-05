import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync, deflateRawSync } from "zlib";
import { parseDataBundle, assetNameFor, parseSums, extractSingleFromZip, cmpVer, DATA_SCHEMA } from "../src/updater.js";

const bundle = (over = {}) => ({
  schema: DATA_SCHEMA, version: "0.1.0", commit: "abc", committedAt: "2026-11-05T10:00:00+08:00",
  files: { "locales/zh-CN/renderer.json": '{"Save":"保存"}', "src/hooks/ri-chinese.js": "/* hook */" },
  ...over,
});

test("parseDataBundle:gzip 与纯 JSON 都认,校验必需文件与时间戳", () => {
  const req = ["locales/zh-CN/renderer.json", "src/hooks/ri-chinese.js"];
  const b = bundle();
  assert.equal(parseDataBundle(gzipSync(Buffer.from(JSON.stringify(b))), req).commit, "abc");
  assert.equal(parseDataBundle(Buffer.from(JSON.stringify(b)), req).commit, "abc");
  assert.throws(() => parseDataBundle(Buffer.from(JSON.stringify(bundle({ schema: 999 }))), req), /不兼容/);
  assert.throws(() => parseDataBundle(Buffer.from(JSON.stringify(bundle({ committedAt: "x" }))), req), /时间戳/);
  assert.doesNotThrow(() => parseDataBundle(Buffer.from(JSON.stringify(bundle())))); // 不要求文件时只校验结构
});

test("parseDataBundle:缺文件或词典 JSON 损坏时拒收", () => {
  const req = ["locales/zh-CN/renderer.json", "locales/zh-CN/main.json"];
  assert.throws(() => parseDataBundle(Buffer.from(JSON.stringify(bundle())), req), /缺少 locales\/zh-CN\/main/);
  const broken = bundle({ files: { "locales/zh-CN/renderer.json": "{oops" } });
  assert.throws(() => parseDataBundle(Buffer.from(JSON.stringify(broken)), ["locales/zh-CN/renderer.json"]));
});

test("assetNameFor 与 release.yml 的产物名一致", () => {
  assert.equal(assetNameFor("win32", "x64"), "redis-insight-chinese-win-x64.zip");
  assert.equal(assetNameFor("win32", "arm64"), "redis-insight-chinese-win-x64.zip");
  assert.equal(assetNameFor("linux", "arm64"), "redis-insight-chinese-linux-arm64.tar.xz");
  assert.equal(assetNameFor("darwin", "arm64"), "redis-insight-chinese-macos-arm64.tar.xz");
  assert.equal(assetNameFor("darwin", "x64"), "redis-insight-chinese-macos-x64.tar.xz");
  assert.equal(assetNameFor("freebsd", "x64"), null);
});

test("parseSums / cmpVer", () => {
  const sha = "a".repeat(64);
  assert.deepEqual(parseSums(`${sha}  redis-insight-chinese-win-x64.zip\n\n`), { "redis-insight-chinese-win-x64.zip": sha });
  assert.ok(cmpVer("v0.2.0", "0.1.9") > 0);
  assert.equal(cmpVer("v1.0", "1.0.0"), 0);
});

// 手工拼一个只含一个 deflate 文件的 zip
function makeZip(name, data) {
  const comp = deflateRawSync(data);
  const nameBuf = Buffer.from(name);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10);
  central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(0, 42);
  const cdOffset = local.length + nameBuf.length + comp.length;
  const cd = Buffer.concat([central, nameBuf]);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(cdOffset, 16);
  return Buffer.concat([local, nameBuf, comp, cd, eocd]);
}

test("extractSingleFromZip 取出唯一文件", () => {
  const data = Buffer.from("MZ fake exe ".repeat(50));
  const r = extractSingleFromZip(makeZip("redis-insight-chinese-win-x64.exe", data));
  assert.equal(r.name, "redis-insight-chinese-win-x64.exe");
  assert.ok(r.data.equals(data));
});
