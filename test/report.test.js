import { test, expect } from "bun:test";
import { formatReport } from "../src/report.js";

test("报告包含关键计数与未命中列表", () => {
  const s = formatReport({ dictSize: 10, filesChanged: 3, occurrences: 42, appliedKeys: 8, unmatchedKeys: ["Foo", "Bar"] });
  expect(s).toContain("10");
  expect(s).toContain("42");
  expect(s).toContain("Foo");
  expect(s).toContain("Bar");
});

test("dryRun 报告标注未写入", () => {
  const s = formatReport({ dictSize: 1, filesChanged: 0, occurrences: 0, appliedKeys: 0, unmatchedKeys: [] }, { dryRun: true });
  expect(s).toMatch(/dry|试运行|未写入/i);
});
