// test/translate.test.js
import { test, expect } from "bun:test";
import { applyDict } from "../src/translate.js";

test("替换三种引号形式的字符串字面量", () => {
  const src = `a("Save")+b('Save')+c(\`Save\`)`;
  const { text, counts } = applyDict(src, { Save: "保存" });
  expect(text).toBe(`a("保存")+b('保存')+c(\`保存\`)`);
  expect(counts.Save).toBe(3);
});

test("不替换未加引号的标识符/子串", () => {
  const src = `SaveButton; save; "Save"`;
  const { text, counts } = applyDict(src, { Save: "保存" });
  expect(text).toBe(`SaveButton; save; "保存"`);
  expect(counts.Save).toBe(1);
});

test("长短语优先于其子短语", () => {
  const src = `"Add database","Add"`;
  const { text } = applyDict(src, { "Add": "添加", "Add database": "添加数据库" });
  expect(text).toBe(`"添加数据库","添加"`);
});

test("空 value 的 key 被跳过", () => {
  const src = `"Save"`;
  const { text, counts } = applyDict(src, { Save: "" });
  expect(text).toBe(`"Save"`);
  expect(counts.Save).toBeUndefined();
});

test("含 ${ 的模板不做反引号替换，但双引号形式仍替换", () => {
  const src = "`Save ${x}`+\"Save\"";
  const { text } = applyDict(src, { Save: "保存" });
  expect(text).toBe("`Save ${x}`+\"保存\"");
});

test("value 中的引号被转义", () => {
  const src = `"Say"`;
  const { text } = applyDict(src, { Say: `He said "hi"` });
  expect(text).toBe(`"He said \\"hi\\""`);
});

test("html 模式替换裸文本", () => {
  const src = `<title>Loading</title>`;
  const { text } = applyDict(src, { Loading: "加载中" }, { html: true });
  expect(text).toBe(`<title>加载中</title>`);
});

test("key 含 ${ 时跳过反引号形式（不替换）", () => {
  const src = "`Save ${x}`";
  const { text, counts } = applyDict(src, { "Save ${x}": "保存" });
  expect(text).toBe("`Save ${x}`");
  expect(counts["Save ${x}"]).toBeUndefined();
});

test("html 模式统计替换次数", () => {
  const src = `<title>Loading</title> Loading`;
  const { text, counts } = applyDict(src, { Loading: "加载中" }, { html: true });
  expect(text).toBe(`<title>加载中</title> 加载中`);
  expect(counts.Loading).toBe(2);
});
