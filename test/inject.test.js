import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { buildInjectScript, injectInto } from "../src/inject.js";

test("buildInjectScript 内嵌字典且是合法 JS", () => {
  const script = buildInjectScript({ Save: "保存", Skip: "", Keep: "Keep" });
  expect(script).toContain('"Save":"保存"');
  expect(script).not.toContain("Skip"); // 空值被过滤
  expect(script).not.toContain('"Keep"'); // 值等于键的被过滤
  // 语法合法：能被编译（不执行，避免引用 document 报错）
  expect(() => new Function(script)).not.toThrow();
});

function makeTree() {
  const root = mkdtempSync(join(tmpdir(), "inject-"));
  const rd = join(root, "dist", "renderer");
  mkdirSync(rd, { recursive: true });
  writeFileSync(
    join(rd, "index.html"),
    `<!doctype html><html><head>
<script>var X="startsWith";X.startsWith("s");</script>
</head><body><div id="root"></div>
<script type="module" crossorigin src="./assets/index-abc.js"></script>
</body></html>`
  );
  return { root, rd };
}

test("injectInto 生成 zh-inject.js 并在 module 脚本前插入引用，代码不被改动", () => {
  const { root, rd } = makeTree();
  const res = injectInto(root, { Save: "保存", Delete: "删除" });
  // 1. 注入脚本生成，含字典
  expect(existsSync(join(rd, "zh-inject.js"))).toBe(true);
  expect(readFileSync(join(rd, "zh-inject.js"), "utf8")).toContain("保存");
  expect(res.entries).toBe(2);
  expect(res.tagAdded).toBe(true);
  // 2. index.html 加了引用，且在 module 脚本之前
  const html = readFileSync(join(rd, "index.html"), "utf8");
  expect(html).toContain('<script src="./zh-inject.js"></script>');
  expect(html.indexOf("zh-inject.js")).toBeLessThan(html.indexOf('type="module"'));
  // 3. 原有内联代码原封不动（startsWith 未被破坏）
  expect(html).toContain('X.startsWith("s")');
});

test("injectInto 幂等：二次注入不重复插入 script 标签", () => {
  const { root, rd } = makeTree();
  injectInto(root, { Save: "保存" });
  const res2 = injectInto(root, { Save: "保存", Delete: "删除" });
  expect(res2.tagAdded).toBe(false);
  const html = readFileSync(join(rd, "index.html"), "utf8");
  const count = html.split('<script src="./zh-inject.js"></script>').length - 1;
  expect(count).toBe(1);
  // 但字典已更新为最新
  expect(readFileSync(join(rd, "zh-inject.js"), "utf8")).toContain("删除");
});
