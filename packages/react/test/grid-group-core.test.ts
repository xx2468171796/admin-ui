import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGridView, type GridField } from "../src/grid-core.ts";
import { allGroupKeys, flatLayout, groupedRowOrder, groupLayout, groupTreeFromNodes, groupTreeFromRows, keepRowOrder, orderLabels } from "../src/grid-group-core.ts";
import { applyGridGroups, applyGridQuery, gridQueryKey, gridQueryOf, parseGridQuery, type GridQuery } from "../src/grid-data-core.ts";
import { buildGridSql, type GridSqlColumn } from "../src/grid-sql.ts";
import { buildGridGroupSql, formatGroupSummary, gridGroupsFromSql } from "../src/grid-sql-groups.ts";

type Lead = { id: string; stage: string; owner: string; region: string | null; amount: number; won: boolean; day: string };
const fields: GridField<Lead>[] = [
  { key: "id", title: "编号", type: "text", primary: true },
  { key: "stage", title: "阶段", type: "singleSelect", options: [{ value: "first", label: "首通" }, { value: "quote", label: "报价" }, { value: "deal", label: "成交" }, { value: "install", label: "安装" }] },
  { key: "owner", title: "负责人", type: "user" },
  { key: "region", title: "地区", type: "singleSelect", options: [{ value: "tp", label: "上海" }, { value: "tc", label: "苏州" }, { value: "kh", label: "广州" }] },
  { key: "amount", title: "预计金额", type: "money", currency: "¥" },
  { key: "won", title: "已签", type: "checkbox" },
  { key: "day", title: "日期", type: "date", timeZone: "Asia/Shanghai" },
];
const STAGES = ["first", "quote", "deal"];
const OWNERS = ["小王", "阿杰", "小李"];
const REGIONS = ["tp", "tc", null];
const rows: Lead[] = Array.from({ length: 60 }, (_, i) => ({ id: `r${String(i).padStart(2, "0")}`, stage: STAGES[i % 3]!, owner: OWNERS[(i >> 1) % 3]!, region: REGIONS[(i >> 2) % 3]!, amount: (i + 1) * 10000, won: i % 4 === 0, day: `2026-10-${String((i % 9) + 1).padStart(2, "0")}` }));
const levels = [{ field: "stage", order: "asc" as const }, { field: "owner", order: "asc" as const }, { field: "region", order: "desc" as const }];

test("3 levels from rows: counts add up, option order, desc level, empty group last, rows in flat grouped order", () => {
  const tree = groupTreeFromRows(rows, levels, fields);
  assert.deepEqual(tree.map((g) => g.value), ["first", "quote", "deal"], "按选项顺序");
  assert.equal(tree.reduce((n, g) => n + g.count, 0), 60);
  const first = tree[0]!;
  assert.equal(first.children.reduce((n, g) => n + g.count, 0), first.count);
  const regions = first.children[0]!.children.map((g) => g.value);
  assert.deepEqual(regions.filter(Boolean), regions.filter(Boolean).slice().sort((a, b) => ["tp", "tc"].indexOf(b) - ["tp", "tc"].indexOf(a)), "第 3 级倒序");
  assert.equal(regions.at(-1), "", "空值组倒序也在最后");
  const flat = groupedRowOrder(tree);
  assert.equal(flat.length, 60);
  const leaf = first.children[0]!.children[0]!;
  assert.deepEqual(flat.slice(leaf.offset, leaf.offset + leaf.count), leaf.rows, "叶子组的 offset 指向它的行");
  assert.equal(allGroupKeys(tree).length, tree.length + tree.flatMap((g) => g.children).length + tree.flatMap((g) => g.children.flatMap((c) => c.children)).length);
  assert.equal(leaf.key, ["first", leaf.path[1], leaf.path[2]].join("\u001f"), "路径键");
  // 显示空分组: options without records appear with 0 at their option position.
  const withEmpty = groupTreeFromRows(rows, levels.slice(0, 1), fields, { showEmpty: true });
  assert.deepEqual(withEmpty.map((g) => [g.value, g.count, Boolean(g.empty)]), [["first", 20, false], ["quote", 20, false], ["deal", 20, false], ["install", 0, true]]);
  assert.deepEqual(groupTreeFromRows(rows, [{ field: "won", order: "asc" }], fields).map((g) => g.value), ["false", "true"]);
  assert.deepEqual(orderLabels(fields[4]), ["从小到大 0 → 9", "从大到小 9 → 0"]);
  assert.deepEqual(orderLabels(fields[6]), ["从早到晚", "从晚到早"]);
});

test("layout: headers + rows, collapse, row spans for server blocks, item of an offset", () => {
  const tree = groupTreeFromRows(rows, levels.slice(0, 2), fields);
  const open = groupLayout(tree, []);
  const subgroups = tree.reduce((n, g) => n + g.children.length, 0);
  assert.equal(open.count, 60 + tree.length + subgroups, "每行 + 每个组头");
  assert.deepEqual(open.at(0), { kind: "group", group: tree[0] });
  assert.equal(open.at(1)?.kind, "group");
  assert.deepEqual(open.at(2), { kind: "row", offset: 0 });
  const folded = groupLayout(tree, [tree[0]!.key, tree[1]!.children[0]!.key]);
  assert.equal(folded.count, 1 + (1 + tree[1]!.children.length + tree[1]!.count - tree[1]!.children[0]!.count) + (1 + tree[2]!.children.length + tree[2]!.count), "收起一级组只剩组头，收起二级组只剩它的组头");
  assert.equal(folded.indexOfOffset(0), -1, "收起的组里的行不显示");
  const second = tree[1]!.children[1]!;
  const index = folded.indexOfOffset(second.offset);
  assert.deepEqual(folded.at(index), { kind: "row", offset: second.offset });
  assert.deepEqual(folded.rowSpan(0, 3), null, "只有组头");
  const span = folded.rowSpan(0, folded.count - 1)!;
  assert.equal(span[0], second.offset);
  assert.equal(span[1], 59);
  assert.deepEqual(flatLayout(5).rowSpan(3, 99), [3, 4]);
  assert.equal(flatLayout(5).indexOfOffset(7), -1);
});

test("server mode = client mode: applyGridQuery orders rows by groups, applyGridGroups answers the headers", () => {
  const view = normalizeGridView({ groupBy: levels, sort: [{ key: "amount", direction: "desc" }], filter: { items: [{ field: "won", op: "unchecked" }] } }, fields);
  const query = gridQueryOf(view, fields, { groups: true });
  assert.deepEqual(query.groups, levels);
  assert.notEqual(gridQueryKey(query), gridQueryKey({ ...query, groups: [] }), "分组进缓存键");
  const page = applyGridQuery(rows, fields, query, { offset: 0, limit: 1000 });
  const answer = applyGridGroups(rows, fields, query, { summaries: { amount: "sum" } });
  const tree = groupTreeFromNodes<Lead>(answer.groups, levels, fields);
  const client = groupTreeFromRows(rows.filter((r) => !r.won).sort((a, b) => b.amount - a.amount), levels, fields);
  const shape = (list: typeof tree): unknown => list.map((g) => [g.key, g.count, g.offset, shape(g.children)]);
  assert.deepEqual(shape(tree), shape(client), "服务端分组 = 前端分组（键、条数、offset）");
  assert.deepEqual(page.rows.map((r) => r.id), groupedRowOrder(client).map((r) => r.id), "服务端分页的行顺序 = 前端分组后的顺序");
  const top = answer.groups.find((g) => g.path.length === 1 && g.path[0] === "first")!;
  assert.match(top.summaries!.amount!, /^¥/);
  assert.equal(answer.groups.filter((g) => g.path.length === 1).length, 3);
  assert.deepEqual(applyGridGroups(rows, fields, { ...query, groups: [] }), { groups: [] });
  assert.equal(applyGridGroups(rows, fields, query, { maxGroups: 4 }).truncated, true);
  // Nodes for empty groups (显示空分组) appear between the server's groups without shifting offsets.
  const withEmpty = groupTreeFromNodes<Lead>(answer.groups, levels.slice(0, 1), fields, { showEmpty: true });
  assert.deepEqual(withEmpty.map((g) => [g.value, g.offset]), [["first", 0], ["quote", tree[1]!.offset], ["deal", tree[2]!.offset], ["install", 45]]);
});

test("parseGridQuery v2: nested tree within limits, dynamic and relative values kept, group levels validated", () => {
  const q = parseGridQuery({
    search: "",
    filter: { conjunction: "and", items: [
      { id: "<script>", field: "owner", op: "hasAny", value: { dynamic: "me" } },
      { conjunction: "or", items: [{ field: "day", op: "inRange", value: { relative: "pastDays", days: 7 } }, { field: "amount", op: "gte", value: "100" }, { conjunction: "and", items: [{ field: "id", op: "is", value: "x" }] }] },
      { field: "stage", op: "anyOf", value: [] },
    ] },
    groups: [{ field: "stage", order: "desc" }, { field: "nope" }, { field: "owner" }, { field: "region" }, { field: "day" }],
    sort: [],
  }, fields);
  assert.deepEqual(q.filter, { id: "root", conjunction: "and", items: [
    { id: "f1", field: "owner", op: "hasAny", value: { dynamic: "me" } },
    { id: "g1", conjunction: "or", items: [{ id: "f2", field: "day", op: "inRange", value: { relative: "pastDays", days: 7 } }, { id: "f3", field: "amount", op: "gte", value: "100" }] },
  ] }, "第二层组去掉、没填完的去掉、id 由服务端重编");
  assert.deepEqual(q.filters, [], "有嵌套组时旧的扁平字段为空");
  assert.deepEqual(q.groups, [{ field: "stage", order: "desc" }, { field: "owner", order: "asc" }, { field: "region", order: "asc" }], "最多 3 级，未知字段丢掉");
  const tooMany = parseGridQuery({ filter: { items: Array.from({ length: 80 }, () => ({ field: "id", op: "contains", value: "a" })) } }, fields);
  assert.equal(tooMany.filter!.items.length, 50, "默认最多 50 个条件");
  assert.equal(parseGridQuery({ filter: { items: Array.from({ length: 80 }, () => ({ field: "id", op: "contains", value: "a" })) } }, fields, { maxFilters: 60 }).filter!.items.length, 60);
});

const columns: Record<string, GridSqlColumn> = {
  id: { sql: "l.code", type: "text" },
  stage: { sql: "l.stage", type: "singleSelect", options: ["first", "quote", "deal", "install"] },
  owner: { sql: "l.owners", type: "user", array: true },
  region: { sql: "l.region", type: "singleSelect", options: ["tp", "tc", "kh"] },
  amount: { sql: "l.amount_fen", type: "money" },
  won: { sql: "l.won", type: "checkbox" },
  day: { sql: "l.day", type: "date" },
};

test("buildGridSql v2: nested groups in parentheses, 「我」 from the server, relative dates as day params, group levels lead ORDER BY", () => {
  const query: GridQuery = {
    search: "",
    filters: [],
    conjunction: "and",
    filter: { id: "root", conjunction: "and", items: [
      { id: "f1", field: "owner", op: "hasAny", value: { dynamic: "me" } },
      { id: "g1", conjunction: "or", items: [{ id: "f2", field: "day", op: "inRange", value: { relative: "thisWeek" } }, { id: "f3", field: "amount", op: "gte", value: "12.5" }, { id: "f4", field: "day", op: "before", value: { relative: "today" } }] },
    ] },
    sort: [{ key: "amount", direction: "desc" }],
    groups: [{ field: "stage", order: "asc" }, { field: "won", order: "desc" }],
  };
  const sql = buildGridSql(query, columns, { dialect: "pg", timeZone: "Asia/Shanghai", now: Date.parse("2026-10-07T04:00:00Z"), resolve: (t) => (t === "me" ? ["u42"] : null) });
  const day = "to_char((l.day) AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')";
  assert.equal(sql.where, `(l.owners && $1::text[] AND ((${day} >= $2 AND ${day} <= $3) OR l.amount_fen >= $4 OR ${day} < $5))`);
  assert.deepEqual(sql.params, [["u42"], "2026-10-05", "2026-10-11", 1250, "2026-10-07"]);
  assert.equal(sql.orderBy, "CASE WHEN (l.stage IS NULL OR l.stage = '') THEN 1 ELSE 0 END ASC, CASE l.stage WHEN 'first' THEN 0 WHEN 'quote' THEN 1 WHEN 'deal' THEN 2 WHEN 'install' THEN 3 ELSE 4 END ASC, CASE WHEN l.won THEN 'true' ELSE 'false' END DESC, l.amount_fen DESC NULLS LAST");
  const unresolved = buildGridSql(query, columns, { dialect: "pg" });
  assert.match(unresolved.where, /^\(1 = 0 AND/, "解析不了「我」→ 条件为假，不会放出全部数据");
  const mysql = buildGridSql({ ...query, filter: { id: "root", conjunction: "or", items: [{ id: "a", field: "day", op: "notInRange", value: { from: "2026-10-01", to: "2026-10-03" } }] } }, columns, { dialect: "mysql" });
  assert.match(mysql.where, /^\(l\.day IS NULL OR DATE_FORMAT\(.+\) < \? OR DATE_FORMAT\(.+\) > \?\)$/);
  assert.deepEqual(mysql.params, ["2026-10-01", "2026-10-03"]);
});

test("buildGridGroupSql: one statement per level, same WHERE, summaries; gridGroupsFromSql formats them", () => {
  const query: GridQuery = { search: "", filters: [{ id: "f1", field: "won", op: "unchecked" }], conjunction: "and", sort: [], groups: [{ field: "stage", order: "asc" }, { field: "day", order: "desc" }] };
  const plan = buildGridGroupSql(query, columns, { dialect: "pg", timeZone: "Asia/Shanghai", summaries: { amount: "sum", day: "max", id: "count" } });
  assert.equal(plan.where, "(l.won IS NULL OR l.won = false)");
  assert.equal(plan.levels.length, 2);
  assert.equal(plan.levels[0]!.select, "COALESCE(l.stage::text, '') AS g0, COUNT(*) AS n, SUM(l.amount_fen) AS s0, MAX(l.day) AS s1");
  assert.equal(plan.levels[1]!.groupBy, "l.stage, to_char((l.day) AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')");
  assert.match(plan.levels[1]!.orderBy, /, CASE WHEN to_char\(.+\) IS NULL THEN 1 ELSE 0 END ASC, to_char\(.+\) DESC$/);
  assert.deepEqual(plan.summaries.map((s) => s.field), ["amount", "day"], "记录数不用聚合（组头已有条数）");
  const result = gridGroupsFromSql([
    [{ g0: "first", n: 3, s0: "1250050", s1: "2026-10-02T00:00:00Z" }, { g0: null, n: "1", s0: null, s1: null }],
    [{ g0: "first", g1: "2026-10-02", n: 2, s0: 1000000, s1: null }],
  ], plan, fields);
  assert.deepEqual(result.groups[0], { path: ["first"], count: 3, summaries: { amount: "¥12,500.50", day: "2026-10-02" } });
  assert.deepEqual(result.groups[1], { path: [""], count: 1, summaries: { amount: "—", day: "—" } });
  assert.deepEqual(result.groups[2]!.path, ["first", "2026-10-02"]);
  assert.equal(formatGroupSummary(fields[4]!, "avg", "1234.5"), "¥12.35", "平均值四舍五入到分");
  assert.equal(formatGroupSummary(fields[4]!, "filled", 7), "7");
});

test("自动排序 off: rows keep their places, new rows go last", () => {
  const first = keepRowOrder(rows.slice(0, 4), null, (r) => r.id);
  assert.deepEqual(first.rows.map((r) => r.id), ["r00", "r01", "r02", "r03"]);
  const resorted = [rows[3]!, rows[0]!, { ...rows[1]!, id: "new" }, rows[2]!, rows[1]!];
  assert.deepEqual(keepRowOrder(resorted, first.order, (r) => r.id).rows.map((r) => r.id), ["r00", "r01", "r02", "r03", "new"]);
});
