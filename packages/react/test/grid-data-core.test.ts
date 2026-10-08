import test from "node:test";
import assert from "node:assert/strict";
import { filterGridRows, type GridField } from "../src/grid-core.ts";
import {
  applyGridQuery,
  blocksForRange,
  emptyBlockState,
  failBlock,
  gridQueryKey,
  gridQueryOf,
  markLoading,
  missingBlocks,
  parseGridQuery,
  patchBlockRows,
  receiveBlock,
  refreshBlockState,
  rowAtIndex,
} from "../src/grid-data-core.ts";
import { buildGridSql, type GridSqlColumn } from "../src/grid-sql.ts";

type Row = { id: string; name: string; stage: string; amount: number | null; day: string | null };
const fields: GridField<Row>[] = [
  { key: "name", title: "名称", type: "text", primary: true },
  { key: "stage", title: "阶段", type: "singleSelect", options: [{ value: "lead", label: "线索" }, { value: "won", label: "赢单" }] },
  { key: "amount", title: "金额", type: "money", currency: "¥" },
  { key: "day", title: "日期", type: "date" },
];
const rows: Row[] = Array.from({ length: 250 }, (_, i) => ({ id: `r${i}`, name: `客户${i}`, stage: i % 3 ? "lead" : "won", amount: i % 10 === 0 ? null : i * 100, day: `2026-09-${String((i % 28) + 1).padStart(2, "0")}` }));

test("gridQueryOf drops incomplete filters; key ignores filter ids", () => {
  const view = { search: "  客户  ", conjunction: "and" as const, sort: [{ key: "amount", direction: "desc" as const }], filters: [{ id: "f1", field: "name", op: "contains" as const, value: "" }, { id: "f2", field: "stage", op: "anyOf" as const, value: ["won"] }] };
  const q = gridQueryOf(view, fields);
  assert.equal(q.search, "客户");
  assert.deepEqual(q.filters, [{ id: "f2", field: "stage", op: "anyOf", value: ["won"] }]);
  assert.equal(gridQueryKey(q), gridQueryKey({ ...q, filters: [{ ...q.filters[0]!, id: "zz" }] }));
  assert.notEqual(gridQueryKey(q), gridQueryKey({ ...q, search: "x" }));
});

test("parseGridQuery: untrusted input is validated against the server's fields", () => {
  const q = parseGridQuery(JSON.stringify({ search: "x".repeat(500), conjunction: "or", filters: [{ field: "nope", op: "contains", value: "a" }, { field: "name", op: "gt", value: 1 }, { field: "amount", op: "gt", value: "10" }, { field: "stage", op: "anyOf", value: [{}] }, { field: "name", op: "contains", value: "" }], sort: [{ key: "amount", direction: "desc" }, { key: "amount", direction: "asc" }, { key: "x", direction: "asc" }, { key: "name", direction: "sideways" }] }), fields);
  assert.equal(q.search.length, 200);
  assert.equal(q.conjunction, "or");
  assert.deepEqual(q.filters, [{ id: "f1", field: "amount", op: "gt", value: "10" }]);
  assert.deepEqual(q.sort, [{ key: "amount", direction: "desc" }]);
  assert.deepEqual(parseGridQuery("not json", fields), { search: "", filter: { id: "root", conjunction: "and", items: [] }, filters: [], conjunction: "and", sort: [] });
});

test("applyGridQuery = client-side grid results, sorted with empties last, one block + summaries", () => {
  const query = { search: "客户1", filters: [{ id: "a", field: "stage", op: "anyOf" as const, value: ["lead"] }], conjunction: "and" as const, sort: [{ key: "amount", direction: "desc" as const }] };
  const all = applyGridQuery(rows, fields, query, { offset: 0, limit: 1000, summaries: { amount: "sum" } });
  const expected = filterGridRows(rows, fields, { ...query, hidden: [] });
  assert.equal(all.total, expected.length);
  assert.deepEqual(new Set(all.rows.map((r) => r.id)), new Set(expected.map((r) => r.id)));
  const amounts = all.rows.map((r) => r.amount);
  assert.equal(amounts.at(-1), null, "空值排最后");
  assert.ok(amounts.slice(0, -2).every((a, i) => a! >= amounts[i + 1]!), "降序");
  assert.match(all.summaries!.amount!, /^¥/);
  const page = applyGridQuery(rows, fields, { ...query, filters: [], search: "" }, { offset: 100, limit: 50 });
  assert.equal(page.total, 250);
  assert.equal(page.rows.length, 50);
  const asc = applyGridQuery(rows, fields, { search: "", filters: [], conjunction: "and", sort: [{ key: "amount", direction: "asc" }] });
  assert.equal(asc.rows.at(-1)!.amount, null, "升序空值也排最后");
});

test("block cache: missing / receive / stale answers / eviction / patch / refresh", () => {
  assert.deepEqual(blocksForRange(95, 205, 100), [0, 1, 2]);
  let s = emptyBlockState<Row>("q1");
  assert.deepEqual(missingBlocks(s, 0, 150, 100), [0, 1]);
  s = markLoading(s, [0, 1]);
  assert.deepEqual(missingBlocks(s, 0, 150, 100), []);
  s = receiveBlock(s, { key: "q1", generation: 0, block: 0, result: { rows: rows.slice(0, 100), total: 250 } });
  assert.equal(rowAtIndex(s, 42, 100)!.id, "r42");
  assert.equal(rowAtIndex(s, 142, 100), undefined);
  assert.equal(receiveBlock(s, { key: "old", generation: 0, block: 1, result: { rows: [], total: 0 } }), s, "旧查询的回包丢弃");
  s = failBlock(s, { key: "q1", generation: 0, block: 1, error: "超时" });
  assert.deepEqual(missingBlocks(s, 0, 249, 100), [2], "失败块不自动重试");
  assert.deepEqual(missingBlocks(s, 0, 249, 100, true), [1, 2]);
  assert.deepEqual(missingBlocks(s, 0, 999, 100), [2], "不超过 total");
  const patched = patchBlockRows(s, new Map([["r3", { ...rows[3]!, name: "改" }]]), (r) => r.id);
  assert.equal(rowAtIndex(patched, 3, 100)!.name, "改");
  assert.equal(patchBlockRows(s, new Map([["zz", rows[0]!]]), (r) => r.id), s);
  const fresh = refreshBlockState(s);
  assert.equal(fresh.total, 250, "刷新保留总数（滚动高度不跳）");
  assert.equal(fresh.blocks.size, 0);
  assert.equal(receiveBlock(fresh, { key: "q1", generation: 0, block: 0, result: { rows: [], total: 1 } }), fresh, "刷新前的回包丢弃");
  let many = emptyBlockState<Row>("q");
  for (let b = 0; b < 40; b++) many = receiveBlock(many, { key: "q", generation: 0, block: b, result: { rows: [], total: 4000 } }, 30);
  assert.equal(many.blocks.size, 30);
  assert.ok(many.blocks.has(39) && !many.blocks.has(0), "丢最远的块");
});

const columns: Record<string, GridSqlColumn> = {
  name: { sql: "c.name", type: "text" },
  stage: { sql: "c.stage", type: "singleSelect", options: ["lead", "won"] },
  amount: { sql: "c.amount_fen", type: "money" },
  day: { sql: "c.signed_at", type: "datetime" },
  tags: { sql: "c.tags", type: "multiSelect", array: true },
  paid: { sql: "c.paid", type: "checkbox" },
};

test("buildGridSql pg: parameters, conjunction, search terms, sort with empties last", () => {
  const sql = buildGridSql({
    search: "远山 50%",
    conjunction: "or",
    filters: [
      { id: "1", field: "name", op: "contains", value: "a_b" },
      { id: "2", field: "amount", op: "gte", value: "12.5" },
      { id: "3", field: "day", op: "onOrBefore", value: "2026-09-30" },
      { id: "4", field: "stage", op: "noneOf", value: ["won"] },
      { id: "5", field: "tags", op: "hasAll", value: ["vip", "gov"] },
      { id: "6", field: "paid", op: "unchecked" },
      { id: "7", field: "evil; drop", op: "contains", value: "x" },
    ],
    sort: [{ key: "stage", direction: "asc" }, { key: "amount", direction: "desc" }],
  }, columns, { dialect: "pg", timeZone: "Asia/Shanghai" });
  assert.equal(sql.where,
    "(c.name::text ILIKE $1 ESCAPE '\\' OR c.amount_fen >= $2 OR to_char((c.signed_at) AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') <= $3 OR (c.stage IS NULL OR NOT c.stage IN ($4)) OR c.tags @> $5::text[] OR (c.paid IS NULL OR c.paid = false))"
    + " AND (c.name::text ILIKE $6 ESCAPE '\\' OR c.stage::text ILIKE $7 ESCAPE '\\') AND (c.name::text ILIKE $8 ESCAPE '\\' OR c.stage::text ILIKE $9 ESCAPE '\\')");
  assert.deepEqual(sql.params, ["%a\\_b%", 1250, "2026-09-30", "won", ["vip", "gov"], "%远山%", "%远山%", "%50\\%%", "%50\\%%"]);
  assert.equal(sql.orderBy, "CASE c.stage WHEN 'lead' THEN 0 WHEN 'won' THEN 1 ELSE 2 END ASC NULLS LAST, c.amount_fen DESC NULLS LAST");
});

test("buildGridSql mysql / sqlite placeholders and empty-last ordering; empty query", () => {
  const q = { search: "", conjunction: "and" as const, filters: [{ id: "1", field: "amount", op: "neq" as const, value: "1" }, { id: "2", field: "day", op: "is" as const, value: "2026-09-30" }], sort: [{ key: "name", direction: "asc" as const }] };
  const my = buildGridSql(q, columns, { dialect: "mysql", timeZone: "Asia/Shanghai" });
  assert.equal(my.where, "((c.amount_fen IS NULL OR c.amount_fen <> ?) AND DATE_FORMAT(CONVERT_TZ(c.signed_at, '+00:00', '+08:00'), '%Y-%m-%d') = ?)");
  assert.equal(my.orderBy, "(c.name IS NULL) ASC, c.name ASC");
  const lite = buildGridSql(q, columns, { dialect: "sqlite", utcOffset: "+05:30" });
  assert.match(lite.where, /strftime\('%Y-%m-%d', c\.signed_at, '\+330 minutes'\) = \?/);
  assert.deepEqual(buildGridSql({ search: "", conjunction: "and", filters: [], sort: [] }, columns, { dialect: "pg" }), { where: "", params: [], orderBy: "" });
  assert.equal(buildGridSql({ search: "", conjunction: "and", filters: [{ id: "1", field: "name", op: "is", value: "A" }], sort: [] }, columns, { dialect: "pg", firstParam: 3 }).where, "lower(c.name::text) = $3");
});
