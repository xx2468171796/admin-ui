import test from "node:test";
import assert from "node:assert/strict";
import { groupByDay, suggestCollection, summarizeChecks } from "../src/collections-core.ts";

const NOW = Date.parse("2026-10-01T06:00:00Z"); // 上海 14:00，星期四

test("suggestCollection follows the guide", () => {
  assert.equal(suggestCollection({ rows: 120, explore: true }), "table", "后台主列表默认数据表格");
  assert.equal(suggestCollection({ rows: 120, explore: true, editCells: true }), "grid", "在格子里改数据才用多维表格");
  assert.equal(suggestCollection({ rows: 30, editCells: true }), "grid");
  assert.equal(suggestCollection({ rows: 3, explore: true, embedded: true }), "compact");
  assert.equal(suggestCollection({ rows: 15, explore: true, embedded: true }), "table");
  assert.equal(suggestCollection({ rows: 20 }), "compact");
  assert.equal(suggestCollection({ rows: 50, timeOrdered: true }), "feed");
  assert.equal(suggestCollection({ rows: 40000, timeOrdered: true, explore: true }), "table", "大日志要搜要筛仍是表格");
  assert.equal(suggestCollection({ rows: 6, statusChecks: true }), "checklist");
  assert.equal(suggestCollection({ rows: 1, singleObject: true }), "description");
});

test("summarizeChecks: counts, worst, text", () => {
  assert.deepEqual(summarizeChecks(["ok", "ok"]).text, "全部正常（2 项）");
  const s = summarizeChecks(["ok", "error", "warning", "ok"]);
  assert.equal(s.worst, "error");
  assert.equal(s.text, "1 项异常 · 1 项注意 · 2 项正常");
  assert.equal(summarizeChecks([]).text, "没有检查项");
});

test("groupByDay: newest day first, newest item first, unknown times last", () => {
  const items = [
    { id: "a", at: "2026-09-30T02:00:00Z" },
    { id: "b", at: "2026-10-01T05:00:00Z" },
    { id: "c", at: null },
    { id: "d", at: "2026-10-01T01:00:00Z" },
    { id: "e", at: "2026-09-30T03:00:00Z" },
  ];
  const groups = groupByDay(items, (i) => i.at);
  assert.deepEqual(groups.map((g) => [g.key, g.items.map((i) => i.id)]), [["2026-10-01", ["b", "d"]], ["2026-09-30", ["e", "a"]], ["", ["c"]]]);
});
