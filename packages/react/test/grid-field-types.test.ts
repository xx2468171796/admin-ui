// bt/grid-b G12：新字段类型的纯规则——基础类型映射、显示文字、掩码、输入解析、只读、筛选 / 排序 / 分组 / 统计、
// 服务端查询校验与 SQL 映射。
import test from "node:test";
import assert from "node:assert/strict";
import {
  fieldText,
  filterGridRows,
  gridFilterOps,
  GRID_FIELD_TYPES,
  GRID_FILTER_OPS,
  gridGroupKey,
  isEmptyValue,
  normalizeGridView,
  gridViewReducer,
  sortKey,
  summarizeField,
  summaryKindsFor,
  type GridField,
} from "../src/grid-core.ts";
import { emptyFieldValue, isCellEditable, parseFieldInput, planClear, type PlanContext } from "../src/grid-edit-core.ts";
import {
  coreType,
  GRID_EXTRA_FIELD_LABELS,
  GRID_EXTRA_FIELD_TYPES,
  isReadOnlyType,
  maskPhone,
  toAttachments,
  toLookupTexts,
  toPercent,
  toProgress,
  toRating,
  toRecordRefs,
} from "../src/grid-field-types.ts";
import { parseGridQuery, applyGridQuery } from "../src/grid-data-core.ts";
import { buildGridSql } from "../src/grid-sql.ts";

type Row = {
  id: string;
  name: string;
  intent: number | null;
  progress: number | null;
  phone: string;
  no: number;
  files: { id: string; name: string; kind?: "image" | "audio" | "pdf" }[];
  opp: { id: string; title: string }[];
  stage: string[];
  fee: number | null;
  by: { name: string };
  at: string;
};
const fields: GridField<Row>[] = [
  { key: "name", title: "客户", type: "text", primary: true, editable: true },
  { key: "intent", title: "意向", type: "rating", editable: true },
  { key: "progress", title: "进度", type: "progress", editable: true },
  { key: "phone", title: "手机", type: "phone", mask: true, editable: true },
  { key: "no", title: "编号", type: "autoNumber", editable: true },
  { key: "files", title: "资料", type: "attachment", editable: true },
  { key: "opp", title: "商机", type: "link", editable: true },
  { key: "stage", title: "商机阶段", type: "lookup", editable: true },
  { key: "fee", title: "佣金", type: "formula", resultType: "money", currency: "¥", editable: true },
  { key: "by", title: "创建人", type: "createdBy" },
  { key: "at", title: "创建时间", type: "createdAt", timeZone: "Asia/Shanghai" },
];
const f = (key: string) => fields.find((field) => field.key === key)!;
const rows: Row[] = [
  { id: "a", name: "陈雅婷", intent: 4, progress: 62, phone: "138-0013-8000", no: 1, files: [{ id: "f1", name: "客厅.jpg" }, { id: "f2", name: "报价单.pdf" }], opp: [{ id: "o1", title: "全屋智能" }], stage: ["已报价"], fee: 360000, by: { name: "小B" }, at: "2026-09-12T02:00:00.000Z" },
  { id: "b", name: "林志明", intent: null, progress: 100, phone: "13812345678", no: 2, files: [], opp: [], stage: [], fee: null, by: { name: "小王" }, at: "2026-09-13T02:00:00.000Z" },
  { id: "c", name: "王美玲", intent: 2, progress: 0, phone: "", no: 3, files: [{ id: "f3", name: "录音.m4a", kind: "audio" }], opp: [{ id: "o2", title: "门店改造" }, { id: "o3", title: "二期" }], stage: ["方案中", "待签约"], fee: 120050, by: { name: "小B" }, at: "2026-09-11T02:00:00.000Z" },
];

test("every extra type is a GridFieldType with a label, a base type and filter ops", () => {
  for (const type of GRID_EXTRA_FIELD_TYPES) {
    assert.ok(GRID_FIELD_TYPES.includes(type), type);
    assert.ok(GRID_EXTRA_FIELD_LABELS[type], type);
    assert.ok(GRID_FILTER_OPS[type].length > 0, type);
  }
  assert.equal(coreType("rating"), "number");
  assert.equal(coreType("phone"), "text");
  assert.equal(coreType("createdBy"), "user");
  assert.equal(coreType("modifiedAt"), "datetime");
  assert.equal(coreType("formula"), "text");
  assert.equal(coreType({ type: "formula", resultType: "money" }), "money");
  assert.equal(coreType("singleSelect"), "singleSelect", "基础类型映射到自己");
  assert.deepEqual(gridFilterOps(f("fee")), GRID_FILTER_OPS.money, "公式按结果类型给条件");
  assert.deepEqual([...GRID_FILTER_OPS.rating].sort(), [...GRID_FILTER_OPS.number].sort(), "评分和数字同一组条件");
  assert.equal(GRID_FILTER_OPS.rating[0], "gte", "评分默认「大于等于」（样稿 D04，bt/grid-a）");
  assert.deepEqual(GRID_FILTER_OPS.createdAt, GRID_FILTER_OPS.datetime);
  assert.ok(summaryKindsFor(f("fee")).includes("sum"), "金额公式可以求和");
  assert.ok(!summaryKindsFor("phone").includes("sum"));
});

test("values: normalisers and display text (copy / search)", () => {
  assert.equal(toRating("4"), 4);
  assert.equal(toRating(9, 5), 5);
  assert.equal(toProgress(140), 100);
  assert.equal(toProgress("62%"), 62);
  assert.deepEqual(toRecordRefs(["x", { id: "o1", title: "" }]), [{ id: "x", title: "x" }, { id: "o1", title: "o1" }]);
  assert.deepEqual(toLookupTexts([1, "a", { title: "b" }, { name: "c" }, null]), ["1", "a", "b", "c"]);
  assert.equal(toAttachments([{ id: 1 }, { id: "f", name: "a.png" }]).length, 1);
  const a = rows[0]!;
  assert.equal(fieldText(f("intent"), a), "4");
  assert.equal(fieldText(f("progress"), a), "62%");
  assert.equal(fieldText(f("phone"), a), "138-****-8000", "掩码字段复制 / 搜索都用掩码后的文字");
  assert.equal(fieldText(f("no"), a), "1");
  assert.equal(fieldText(f("files"), a), "客厅.jpg、报价单.pdf");
  assert.equal(fieldText(f("opp"), rows[2]!), "门店改造、二期");
  assert.equal(fieldText(f("stage"), rows[2]!), "方案中、待签约");
  assert.equal(fieldText(f("fee"), a), "¥3,600.00", "公式按结果类型（金额）格式化");
  assert.equal(fieldText(f("by"), a), "小B");
  assert.match(fieldText(f("at"), a), /^2026-09-12 10:00$/);
  assert.equal(isEmptyValue("attachment", []), true);
  assert.equal(isEmptyValue("rating", null), true);
});

test("maskPhone keeps separators and the ends", () => {
  assert.equal(maskPhone("0912-345-678"), "0912-***-678");
  assert.equal(maskPhone("13812345678"), "138****5678");
  assert.equal(maskPhone("138-****-8000"), "138-****-8000", "服务端已脱敏的原样返回");
  assert.equal(maskPhone("110"), "110", "太短不掩");
  assert.equal(maskPhone("13800138000", (v) => `${v.slice(0, 2)}…`), "13…");
  assert.equal(maskPhone("13800138000", false), "13800138000");
});

test("input: rating / progress / phone parse, read-only and host-edited types refuse text", () => {
  const ok = (key: string, text: string) => parseFieldInput(f(key), text);
  assert.deepEqual(ok("intent", "4"), { ok: true, value: 4 });
  assert.deepEqual(ok("intent", "★★★"), { ok: true, value: 3 });
  assert.deepEqual(ok("intent", "4星"), { ok: true, value: 4 });
  assert.equal(ok("intent", "6").ok, false);
  assert.deepEqual(ok("progress", "62%"), { ok: true, value: 62 });
  assert.deepEqual(ok("progress", "62"), { ok: true, value: 62 });
  assert.equal(ok("progress", "120").ok, false);
  assert.deepEqual(ok("phone", " +86 138-0013-8000 "), { ok: true, value: "+86 138-0013-8000" });
  assert.deepEqual(ok("phone", "021-6123 4567 转 802"), { ok: true, value: "021-6123 4567 转 802" });
  assert.equal(ok("phone", "打电话").ok, false);
  assert.deepEqual(ok("intent", ""), { ok: true, value: null }, "空文字清空");
  assert.deepEqual(ok("files", ""), { ok: true, value: [] }, "附件清空成空数组");
  assert.match((ok("files", "a.png") as { error: string }).error, /附件请上传/);
  assert.match((ok("opp", "x") as { error: string }).error, /选择器/);
  assert.match((ok("no", "3") as { error: string }).error, /系统生成/);
  assert.deepEqual(emptyFieldValue("link"), []);
  for (const type of ["autoNumber", "createdBy", "createdAt", "modifiedBy", "modifiedAt", "formula", "lookup"] as const) assert.equal(isReadOnlyType(type), true, type);
  assert.equal(isReadOnlyType("rating"), false);
  assert.equal(isCellEditable(f("no"), rows[0]!), false, "editable: true 也改不了自动编号");
  assert.equal(isCellEditable(f("fee"), rows[0]!), false);
  assert.equal(isCellEditable(f("intent"), rows[0]!), true);
  // Clear skips the read-only cells
  const context: PlanContext<Row> = { rowAt: (i) => (rows[i] ? { row: rows[i]!, rowId: rows[i]!.id } : null), rowCount: rows.length, fieldAt: (c) => fields[c] ?? null };
  const plan = planClear({ anchor: { row: 0, col: 1 }, focus: { row: 0, col: 8 } }, context);
  assert.deepEqual(plan.changes.map((c) => c.field).sort(), ["files", "intent", "opp", "phone", "progress"].sort());
  assert.deepEqual(plan.skipped.map((s) => s.col), [4, 7, 8]);
});

test("filters, sort, group and summaries follow the base type", () => {
  const base = normalizeGridView({}, fields);
  const by = (filters: { field: string; op: string; value?: unknown }[]) => filterGridRows(rows, fields, { ...base, filter: undefined, filters: filters.map((x, i) => ({ id: `f${i}`, ...x })) as never }).map((r) => r.id);
  assert.deepEqual(by([{ field: "intent", op: "gte", value: 3 }]), ["a"]);
  assert.deepEqual(by([{ field: "progress", op: "eq", value: 100 }]), ["b"]);
  assert.deepEqual(by([{ field: "phone", op: "contains", value: "***" }]), ["a", "b"], "电话按掩码后的文字筛选");
  assert.deepEqual(by([{ field: "files", op: "contains", value: "报价" }]), ["a"]);
  assert.deepEqual(by([{ field: "files", op: "empty" }]), ["b"]);
  assert.deepEqual(by([{ field: "opp", op: "contains", value: "二期" }]), ["c"]);
  assert.deepEqual(by([{ field: "fee", op: "gt", value: "2000" }]), ["a"], "金额公式按元筛选");
  assert.deepEqual(by([{ field: "by", op: "hasAny", value: ["小B"] }]), ["a", "c"]);
  assert.deepEqual(by([{ field: "at", op: "before", value: "2026-09-12" }]), ["c"]);
  assert.equal(sortKey(f("intent"), rows[0]!), 4);
  assert.equal(sortKey(f("intent"), rows[1]!), undefined, "空评分排最后");
  assert.equal(typeof sortKey(f("fee"), rows[0]!), "bigint");
  assert.equal(gridGroupKey(f("by"), rows[0]!), "小B");
  assert.equal(summarizeField(f("progress"), rows, "avg").text, "54%", "进度平均值带 %");
  assert.equal(summarizeField(f("intent"), rows, "avg").text, "3", "空评分不算进平均");
  assert.equal(summarizeField(f("fee"), rows, "sum").text, "¥4,800.50");
  assert.equal(summarizeField(f("files"), rows, "filled").text, "2");
  // A formula filter survives normalisation (ops follow resultType)
  const view = normalizeGridView({ filters: [{ id: "x", field: "fee", op: "gt", value: "1" }] }, fields);
  assert.equal(view.filter.items.length, 1, "旧的扁平 filters 迁移成条件树后仍在");
  assert.equal((gridViewReducer(base, { type: "addFilter", field: "fee" }, fields).filter.items[0] as { op: string }).op, "eq");
});

test("freeze is part of the view: normalised, reduced, removable", () => {
  assert.equal(normalizeGridView({}, fields).frozen, undefined, "没设置 = 用表格的 frozenColumns");
  assert.equal(normalizeGridView({ frozen: 3.7 }, fields).frozen, 3);
  assert.equal(normalizeGridView({ frozen: 99 }, fields).frozen, fields.length);
  assert.equal(normalizeGridView({ frozen: -2 }, fields).frozen, 0);
  assert.equal(normalizeGridView({ frozen: "2" }, fields).frozen, undefined);
  const view = gridViewReducer(normalizeGridView({}, fields), { type: "freeze", count: 4 }, fields);
  assert.equal(view.frozen, 4);
  assert.equal(gridViewReducer(view, { type: "freeze", count: null }, fields).frozen, undefined, "null 回到默认");
});

test("server: parseGridQuery / applyGridQuery / buildGridSql understand the extra types", () => {
  const server = fields.map(({ key, type, resultType }) => ({ key, type, resultType }));
  const q = parseGridQuery({ filters: [{ field: "fee", op: "gt", value: "1000" }, { field: "intent", op: "gte", value: 3 }, { field: "phone", op: "gt", value: 1 }], sort: [{ key: "intent", direction: "desc" }] }, server);
  assert.deepEqual(q.filters.map((x) => x.field), ["fee", "intent"], "电话不能用 >");
  assert.deepEqual(applyGridQuery(rows, fields, q, { offset: 0, limit: 10 }).rows.map((r) => r.id), ["a"]);
  const sql = buildGridSql({ ...q, search: "陈" }, {
    fee: { sql: "c.fee_fen", type: "formula", resultType: "money" },
    intent: { sql: "c.intent", type: "rating" },
    phone: { sql: "c.phone_masked", type: "phone" },
    at: { sql: "c.created_at", type: "createdAt" },
    files: { sql: "c.files", type: "attachment" },
  }, { dialect: "pg" });
  assert.equal(sql.where, "(c.fee_fen > $1 AND c.intent >= $2) AND (c.phone_masked::text ILIKE $3 ESCAPE '\\')");
  assert.deepEqual(sql.params, [100000, 3, "%陈%"], "金额公式按元转分；附件不参与搜索");
  assert.equal(sql.orderBy, "c.intent DESC NULLS LAST");
  const day = buildGridSql({ search: "", conjunction: "and", sort: [], filters: [{ id: "f", field: "at", op: "before", value: "2026-09-12" }] }, { at: { sql: "c.created_at", type: "createdAt" } }, { dialect: "pg", timeZone: "Asia/Shanghai" });
  assert.match(day.where, /^to_char\(\(c\.created_at\) AT TIME ZONE 'Asia\/Shanghai', 'YYYY-MM-DD'\) < \$1$/);
});

// 百分比字段（赢率）——按数字算，格子写「10%」+ 细条，编辑时 % 还在，复制 / 导出「10%」
test("percent: maps to number, text 「10%」, parse 0–100, summaries with %", () => {
  type P = { id: string; win: number | null };
  const win: GridField<P> = { key: "win", title: "赢率", type: "percent", editable: true };
  const list: P[] = [{ id: "a", win: 10 }, { id: "b", win: 60 }, { id: "c", win: null }];
  assert.equal(coreType("percent"), "number");
  assert.equal(GRID_EXTRA_FIELD_LABELS.percent, "百分比");
  assert.deepEqual([...GRID_FILTER_OPS.percent].sort(), [...GRID_FILTER_OPS.number].sort(), "和数字同一组条件");
  assert.ok(summaryKindsFor(win).includes("avg"));
  assert.equal(toPercent("60%"), 60);
  assert.equal(toPercent(120), 120, "显示不夹值（输入时才限 0–100）");
  assert.equal(toPercent(""), null);
  assert.equal(fieldText(win, list[0]!), "10%");
  assert.equal(fieldText({ ...win, precision: 1 }, { id: "x", win: 33.333 }), "33.3%");
  assert.equal(fieldText(win, list[2]!), "");
  assert.equal(isEmptyValue("percent", null), true);
  assert.deepEqual(parseFieldInput(win, "60%"), { ok: true, value: 60 });
  assert.deepEqual(parseFieldInput(win, "60 ％"), { ok: true, value: 60 });
  assert.deepEqual(parseFieldInput(win, "7.5"), { ok: true, value: 7.5 });
  assert.equal(parseFieldInput(win, "120").ok, false);
  assert.equal(parseFieldInput(win, "高").ok, false);
  assert.deepEqual(parseFieldInput(win, ""), { ok: true, value: null }, "空文字清空");
  assert.equal(sortKey(win, list[1]!), 60);
  assert.equal(sortKey(win, list[2]!), undefined);
  assert.equal(summarizeField(win, list, "avg").text, "35%", "平均值带 %，空值不算");
  assert.equal(summarizeField(win, list, "max").text, "60%");
  const view = normalizeGridView({}, [win]);
  assert.deepEqual(filterGridRows(list, [win], { ...view, filter: undefined, filters: [{ id: "f0", field: "win", op: "gte", value: 50 }] } as never).map((r) => r.id), ["b"]);
});
