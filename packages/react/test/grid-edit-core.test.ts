import test from "node:test";
import assert from "node:assert/strict";
import type { GridField } from "../src/grid-core.ts";
import { fieldText } from "../src/grid-core.ts";
import {
  editorKeyAction,
  editorText,
  emptyGridHistory,
  gridKeyAction,
  isCellEditable,
  makeChange,
  parseFieldInput,
  parseTsv,
  planClear,
  planPaste,
  pushGridHistory,
  rangeBounds,
  rangeContains,
  rangeText,
  redoGridHistory,
  restoreGridHistory,
  toHtmlTable,
  toTsv,
  undoGridHistory,
  validateFieldInput,
  writeField,
  type PlanContext,
} from "../src/grid-edit-core.ts";

type Row = { id: string; name: string; stage: string | null; tags: string[]; amount: number | null; seats: number | null; day: string | null; at: string | null; paid: boolean; site: string | null; mail: string | null; owner: { name: string }[]; locked?: boolean };
const STAGES = [{ value: "lead", label: "线索" }, { value: "won", label: "赢单" }];
const TAGS = [{ value: "vip", label: "大客户" }, { value: "gov", label: "政企" }];
const f = <K extends keyof Row>(key: K, type: GridField<Row>["type"], extra: Partial<GridField<Row>> = {}): GridField<Row> => ({ key, title: key, type, editable: true, ...extra });
const fields = {
  name: f("name", "text", { required: true }),
  stage: f("stage", "singleSelect", { options: STAGES }),
  tags: f("tags", "multiSelect", { options: TAGS }),
  amount: f("amount", "money", { currency: "¥" }),
  seats: f("seats", "number", { precision: 0 }),
  day: f("day", "date"),
  at: f("at", "datetime", { timeZone: "Asia/Shanghai" }),
  paid: f("paid", "checkbox"),
  site: f("site", "url"),
  mail: f("mail", "email"),
  owner: f("owner", "user"),
};
const row = (i: number, extra: Partial<Row> = {}): Row => ({ id: `r${i}`, name: `客户${i}`, stage: "lead", tags: ["vip"], amount: 12345, seats: 10, day: "2026-09-30", at: "2026-09-30T06:05:00.000Z", paid: false, site: null, mail: null, owner: [], ...extra });

test("parseFieldInput: each type accepts what the grid copies and common spreadsheet spellings", () => {
  const p = (field: GridField<Row>, text: string) => parseFieldInput(field, text);
  assert.deepEqual(p(fields.name, "  新名字\n第二行 "), { ok: true, value: "新名字 第二行" });
  assert.deepEqual(p(fields.amount, "¥1,234.5"), { ok: true, value: 123450 });
  assert.deepEqual(p(fields.amount, "-0.05元"), { ok: true, value: -5 });
  assert.equal(p(fields.amount, "1.234").ok, true, "多余小数位截断（与 majorToMinor 一致）");
  assert.equal(p(fields.amount, "abc").ok, false);
  assert.deepEqual(p(fields.seats, "1,200"), { ok: true, value: 1200 });
  assert.deepEqual(p(fields.seats, "12.6"), { ok: true, value: 13 }, "precision 0 四舍五入");
  assert.deepEqual(p(f("seats", "number"), "50%"), { ok: true, value: 0.5 });
  assert.equal(p(fields.seats, "12x").ok, false);
  assert.deepEqual(p(fields.day, "2026/9/3"), { ok: true, value: "2026-09-03" });
  assert.deepEqual(p(fields.day, "2026年10月1日"), { ok: true, value: "2026-10-01" });
  assert.deepEqual(p(fields.day, "46000"), { ok: true, value: "2025-12-09" }, "Excel 序列日期");
  assert.equal(p(fields.day, "2026-02-30").ok, false, "不存在的日期");
  assert.deepEqual(p(fields.at, "2026-09-30 14:05"), { ok: true, value: "2026-09-30T06:05:00.000Z" }, "按上海时间解释");
  assert.deepEqual(p(fields.stage, "赢单"), { ok: true, value: "won" });
  assert.deepEqual(p(fields.stage, "WON"), { ok: true, value: "won" });
  assert.match((p(fields.stage, "不存在") as { error: string }).error, /没有这个选项/);
  assert.deepEqual(p(fields.tags, "大客户、政企,大客户"), { ok: true, value: ["vip", "gov"] });
  assert.deepEqual(p(fields.paid, "是"), { ok: true, value: true });
  assert.deepEqual(p(fields.paid, "✓"), { ok: true, value: true });
  assert.deepEqual(p(fields.paid, ""), { ok: true, value: false });
  assert.equal(p(fields.paid, "也许").ok, false);
  assert.deepEqual(p(fields.site, "example.com/a"), { ok: true, value: "https://example.com/a" });
  assert.equal(p(fields.site, "javascript:alert(1)").ok, false, "危险协议拒绝");
  assert.equal(p(fields.mail, "a@b").ok, false);
  assert.deepEqual(p(fields.owner, "陈晓、林宁"), { ok: true, value: [{ name: "陈晓" }, { name: "林宁" }] });
  assert.equal(parseFieldInput(fields.owner, "外人", { people: [{ name: "陈晓" }] }).ok, false);
  assert.deepEqual(p(fields.stage, "  "), { ok: true, value: null }, "空 = 清空");
  assert.deepEqual(p(fields.tags, ""), { ok: true, value: [] });
});

test("copy text round-trips through parse for every editable type", () => {
  const r = row(1, { stage: "won", tags: ["vip", "gov"], amount: 98765, paid: true, owner: [{ name: "陈晓" }], site: "https://a.example/x" });
  for (const field of Object.values(fields)) {
    const text = fieldText(field, r);
    const parsed = parseFieldInput(field, text);
    assert.ok(parsed.ok, `${field.key}: ${text}`);
    assert.equal(makeChange(field, r, r.id, parsed.value), null, `${field.key} 复制再粘贴不产生改动（${text}）`);
  }
  // the editor's starting text round-trips too
  for (const field of Object.values(fields)) {
    const text = editorText(field, (r as Record<string, unknown>)[field.key]);
    const parsed = parseFieldInput(field, text);
    assert.ok(parsed.ok && makeChange(field, r, r.id, parsed.value) === null, `${field.key} 编辑器初值 ${text}`);
  }
});

test("validateFieldInput: required and validate", () => {
  assert.match((validateFieldInput(fields.name, " ", row(1)) as { error: string }).error, /不能为空/);
  const seats = { ...fields.seats, validate: (v: unknown) => (typeof v === "number" && v > 500 ? "最多 500 席" : null) };
  assert.deepEqual(validateFieldInput(seats, "600", row(1)), { ok: false, error: "最多 500 席" });
});

test("editable / write", () => {
  const locked = { ...fields.name, editable: (r: Row) => !r.locked };
  assert.equal(isCellEditable(locked, row(1, { locked: true })), false);
  assert.equal(isCellEditable(locked, row(1)), true);
  assert.equal(isCellEditable({ ...fields.name, editable: undefined }, row(1)), false);
  assert.equal(isCellEditable({ key: "x", title: "x", type: "custom", editable: true }, row(1)), false, "custom 没有 parse 不能编辑");
  assert.throws(() => writeField({ ...fields.name, value: (r: Row) => r.name }, row(1), "x"), /write/);
  const next = writeField(fields.name, row(1), "新");
  assert.equal(next.name, "新");
});

test("TSV: Excel quoting, CRLF, trailing newline, html table", () => {
  const m = [["a", "带\t制表"], ['引号"', "两\n行"]];
  const tsv = toTsv(m);
  assert.equal(tsv, 'a\t"带\t制表"\r\n"引号"""\t"两\n行"');
  assert.deepEqual(parseTsv(tsv), m);
  assert.deepEqual(parseTsv("1\t2\r\n3\t4\r\n"), [["1", "2"], ["3", "4"]]);
  assert.deepEqual(parseTsv("x"), [["x"]]);
  assert.deepEqual(parseTsv(""), [[""]]);
  assert.deepEqual(parseTsv("a\t\tb"), [["a", "", "b"]]);
  assert.equal(toHtmlTable([["<b>", "x\ny"]]), "<table><tr><td>&lt;b&gt;</td><td>x<br>y</td></tr></table>");
});

// rows by display index: 0 = group header, 1..4 = records
const list = [null, row(1), row(2), row(3, { locked: true }), row(4)];
const cols: (GridField<Row> | null)[] = [null, { ...fields.name, editable: (r: Row) => !r.locked }, fields.stage, fields.amount, null];
const ctx: PlanContext<Row> = {
  rowAt: (i) => (list[i] ? { row: list[i]!, rowId: list[i]!.id } : null),
  rowCount: list.length,
  fieldAt: (c) => cols[c] ?? null,
};

test("planPaste: block from top-left, skips group rows, read-only and invalid cells", () => {
  const plan = planPaste([["甲", "赢单", "1.00"], ["乙", "胡写", "2"], ["丙", "线索", "3"]], { anchor: { row: 0, col: 1 }, focus: { row: 0, col: 1 } }, ctx);
  const by = Object.fromEntries(plan.changes.map((c) => [`${c.rowId}.${c.field}`, c.value]));
  assert.deepEqual(by, { "r1.name": "甲", "r1.stage": "won", "r1.amount": 100, "r2.name": "乙", "r2.amount": 200, "r3.amount": 300 });
  assert.deepEqual(plan.skipped.map((s) => s.reason), ["没有这个选项：胡写", "「name」不能编辑"]);
  assert.equal(plan.changes.find((c) => c.rowId === "r1" && c.field === "amount")!.next.stage, "won", "同一行多格改动累积到 next");
  assert.equal(plan.changes.some((c) => c.field === "stage" && c.rowId === "r3"), false, "r3 阶段本来就是线索：没有改动");
});

test("planPaste: one value fills the whole range; block never adds rows or columns", () => {
  const fill = planPaste([["赢单"]], { anchor: { row: 1, col: 2 }, focus: { row: 4, col: 2 } }, ctx);
  assert.deepEqual(fill.changes.map((c) => c.rowId), ["r1", "r2", "r3", "r4"]);
  const big = planPaste([["a", "线索", "1", "x", "y"], ["b"], ["c"], ["d"], ["e"], ["f"]], { anchor: { row: 3, col: 1 }, focus: { row: 3, col: 1 } }, ctx);
  assert.deepEqual(big.changes.map((c) => `${c.rowId}.${c.field}`), ["r3.amount", "r4.name"]);
});

test("planClear: empties editable cells, refuses required, skips locked", () => {
  const plan = planClear({ anchor: { row: 1, col: 1 }, focus: { row: 3, col: 3 } }, ctx);
  assert.deepEqual(plan.changes.map((c) => `${c.rowId}.${c.field}=${JSON.stringify(c.value)}`), ["r1.stage=null", "r1.amount=null", "r2.stage=null", "r2.amount=null", "r3.stage=null", "r3.amount=null"]);
  assert.ok(plan.skipped.every((s) => /不能为空|不能编辑/.test(s.reason)));
});

test("rangeText / bounds / contains", () => {
  const range = { anchor: { row: 2, col: 3 }, focus: { row: 0, col: 1 } };
  assert.deepEqual(rangeBounds(range), { top: 0, bottom: 2, left: 1, right: 3 });
  assert.equal(rangeContains(range, { row: 1, col: 2 }), true);
  assert.equal(rangeContains(range, { row: 3, col: 2 }), false);
  assert.deepEqual(rangeText(range, ctx, fieldText, { headers: true }), [["name", "stage", "amount"], ["客户1", "线索", "¥123.45"], ["客户2", "线索", "¥123.45"]]);
});

test("undo history: push / undo / redo / restore, limit", () => {
  const change = makeChange(fields.name, row(1), "r1", "新")!;
  let h = pushGridHistory(emptyGridHistory(), "编辑", [change]);
  assert.equal(h.past.length, 1);
  const u = undoGridHistory(h)!;
  assert.deepEqual(u.entry.cells, [{ rowId: "r1", field: "name", before: "客户1", after: "新" }]);
  h = u.history;
  assert.equal(h.future.length, 1);
  const r = redoGridHistory(h)!;
  assert.equal(r.history.past.length, 1);
  assert.deepEqual(restoreGridHistory(h, u.entry, "undo"), { past: [u.entry], future: [] });
  assert.equal(undoGridHistory(emptyGridHistory()), null);
  let big = emptyGridHistory();
  for (let i = 0; i < 120; i++) big = pushGridHistory(big, "x", [change]);
  assert.equal(big.past.length, 100);
  assert.equal(pushGridHistory(h, "空", []), h, "空批次不入栈");
});

test("keyboard maps", () => {
  assert.equal(gridKeyAction({ key: "Enter" }), "edit");
  assert.equal(gridKeyAction({ key: "F2" }), "edit");
  assert.equal(gridKeyAction({ key: " " }), "expand");
  assert.equal(gridKeyAction({ key: " ", shiftKey: true }), "toggleRow");
  assert.equal(gridKeyAction({ key: "z", ctrlKey: true }), "undo");
  assert.equal(gridKeyAction({ key: "Z", ctrlKey: true, shiftKey: true }), "redo");
  assert.equal(gridKeyAction({ key: "y", metaKey: true }), "redo");
  assert.equal(gridKeyAction({ key: "a", ctrlKey: true }), "selectAll");
  assert.equal(gridKeyAction({ key: "c", ctrlKey: true }), null, "复制走原生 copy 事件");
  assert.equal(gridKeyAction({ key: "中" }), "type");
  assert.equal(gridKeyAction({ key: "Backspace" }), "clear");
  assert.equal(gridKeyAction({ key: "ArrowDown" }), null);
  assert.equal(editorKeyAction({ key: "Enter" }, false), "commitDown");
  assert.equal(editorKeyAction({ key: "Enter", shiftKey: true }, false), "commitUp");
  assert.equal(editorKeyAction({ key: "Enter", shiftKey: true }, true), null, "长文本 Shift+Enter 换行");
  assert.equal(editorKeyAction({ key: "Enter", isComposing: true }, false), null, "输入法选词时回车不提交");
  // 记录详情里的字段（variant field）：长文本 Enter 换行、Ctrl / ⌘ + Enter 保存；单行 Enter 保存；Tab 保存；Esc 取消
  assert.equal(editorKeyAction({ key: "Enter" }, true, "field"), null, "字段长文本 Enter 换行");
  assert.equal(editorKeyAction({ key: "Enter", ctrlKey: true }, true, "field"), "commitDown");
  assert.equal(editorKeyAction({ key: "Enter", metaKey: true }, true, "field"), "commitDown");
  assert.equal(editorKeyAction({ key: "Enter" }, false, "field"), "commitDown");
  assert.equal(editorKeyAction({ key: "Enter", shiftKey: true }, false, "field"), null);
  assert.equal(editorKeyAction({ key: "Tab" }, true, "field"), "commitRight");
  assert.equal(editorKeyAction({ key: "Escape" }, true, "field"), "cancel");
  assert.equal(editorKeyAction({ key: "Enter", ctrlKey: true, isComposing: true }, true, "field"), null);
  assert.equal(editorKeyAction({ key: "Tab", shiftKey: true }, false), "commitLeft");
  assert.equal(editorKeyAction({ key: "Escape" }, false), "cancel");
});
