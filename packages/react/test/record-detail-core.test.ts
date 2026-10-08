import test from "node:test";
import assert from "node:assert/strict";
import {
  arrangeRecordFields,
  isRecordFieldEmpty,
  peekRecordFields,
  readRecordParam,
  recordFieldEditState,
  recordFillSummary,
  recordNavDelta,
  recordTabCount,
  recordTabs,
  splitRecordActions,
  suggestRecordLevel,
  unfilledRecordFields,
  visibleRecordFields,
  writeRecordParam,
  type RecordField,
  type RecordLayout,
} from "../src/record-detail-core.ts";

type Row = { name: string; note: string; owner: string | null; tags: string[] };
const field = (key: keyof Row, extra: Partial<RecordField<Row>> = {}): RecordField<Row> => ({ key, label: key, value: (r) => r[key] as never, ...extra });
const row: Row = { name: "甲", note: "", owner: null, tags: ["a"] };

test("emptiness and hideEmpty", () => {
  assert.equal(isRecordFieldEmpty(field("note"), row), true);
  assert.equal(isRecordFieldEmpty(field("owner"), row), true);
  assert.equal(isRecordFieldEmpty(field("tags"), { ...row, tags: [] }), true);
  assert.equal(isRecordFieldEmpty(field("name", { text: () => "  " }), row), true);
  assert.deepEqual(visibleRecordFields({ fields: [field("name"), field("note", { hideEmpty: true }), field("owner")] }, row).map((f) => f.key), ["name", "owner"]);
});

test("arrange: empty fields collapse into one line, placeholders count as empty, title not repeated", () => {
  const r = { ...row, note: "—", owner: null };
  assert.equal(isRecordFieldEmpty(field("note"), r), true, "表格里的占位「—」也算空");
  const { shown, empty } = arrangeRecordFields([field("name"), field("note"), field("owner", { showEmpty: true }), field("tags"), field("note", { key: "n2" } as never, ), field("owner", { hideEmpty: true, key: "o2" } as never)].map((f, i) => (i === 4 ? { ...f, key: "n2", label: "备注" } : i === 5 ? { ...f, key: "o2" } : f)), r, { title: "甲" });
  assert.deepEqual(shown.map((f) => f.key), ["owner", "tags"], "与标题相同的「名称」不再列出；showEmpty 的保留原位");
  assert.deepEqual(empty, ["note", "备注"], "hideEmpty 的连「未填写」都不进");
  assert.deepEqual(peekRecordFields({ sections: [{ key: "a", fields: [field("name"), field("tags")] }] }, row, 8, "甲").map((f) => f.key), ["tags"]);
});

test("peek fields: marked ones, else the first filled fields (long ones too)", () => {
  const layout = { sections: [{ key: "a", fields: [field("name"), field("note"), field("tags", { full: true }), field("owner")] }] };
  assert.deepEqual(peekRecordFields(layout, row).map((f) => f.key), ["name", "tags"]);
  assert.equal(peekRecordFields({ sections: [{ key: "a", fields: Array.from({ length: 12 }, () => field("name")) }] }, row).length, 8);
  const marked = { sections: [{ key: "a", fields: [field("name"), field("owner", { peek: true }), field("note", { peek: true, hideEmpty: true })] }] };
  assert.deepEqual(peekRecordFields(marked, row).map((f) => f.key), ["owner"]);
});

test("default level: peek for small records, expanded with tabs / free content / many fields", () => {
  const small: Pick<RecordLayout<Row>, "sections"> = { sections: [{ key: "a", fields: [field("name"), field("note")] }] };
  assert.equal(suggestRecordLevel(small), "peek");
  assert.equal(suggestRecordLevel({ ...small, tabs: [{ key: "t", label: "活动", render: () => null }] }), "expanded");
  assert.equal(suggestRecordLevel({ ...small, tabs: [{ key: "t", label: "图表", pageOnly: true, render: () => null }] }), "peek", "整页专用标签不算");
  assert.equal(suggestRecordLevel({ sections: [{ key: "a", render: () => null }] }), "expanded");
  assert.equal(suggestRecordLevel({ sections: [{ key: "a", fields: Array.from({ length: 9 }, () => field("name")) }] }), "expanded");
});

test("actions split and tabs per level", () => {
  const a = (key: string, primary = false) => ({ key, label: key, primary, onSelect: () => undefined });
  const { buttons, menu } = splitRecordActions([a("x"), a("p1", true), a("p2", true), a("p3", true)]);
  assert.deepEqual(buttons.map((b) => b.key), ["p1", "p2"]);
  assert.deepEqual(menu.map((b) => b.key), ["x", "p3"]);
  const layout = { tabs: [{ key: "act", label: "活动", render: () => null }, { key: "chart", label: "趋势", pageOnly: true, render: () => null }] };
  assert.deepEqual(recordTabs(layout, "expanded").map((t) => t.key), ["details", "act"]);
  assert.deepEqual(recordTabs(layout, "page").map((t) => t.key), ["details", "act", "chart"]);
});

test("attention action is a button besides the 2 primary ones, in layout order", () => {
  const act = (key: string, extra: object = {}) => ({ key, label: key, onSelect: () => undefined, ...extra });
  const { buttons, menu } = splitRecordActions([act("copy", { primary: true }), act("renew", { tone: "attention" }), act("edit", { primary: true }), act("share", { primary: true }), act("intro")]);
  assert.deepEqual(buttons.map((a) => a.key), ["copy", "renew", "edit"]);
  assert.deepEqual(menu.map((a) => a.key), ["share", "intro"]);
});

test("sections tabs: 「n 未填」 count, hidden / empty tabs left out, overview label", () => {
  const price = { key: "price", fields: [field("note"), field("owner"), field("name"), field("tags", { hideEmpty: true })] };
  const layout: Pick<RecordLayout<Row>, "tabs" | "overview"> = {
    overview: { label: "概览" },
    tabs: [
      { key: "price", label: "价格", sections: [price], countUnfilled: true },
      { key: "none", label: "空", sections: [{ key: "x", fields: (r) => (r.owner ? [field("owner")] : []) }] },
      { key: "log", label: "记录", count: () => 12, render: () => null, hidden: (r) => r.name === "乙" },
    ],
  };
  assert.equal(unfilledRecordFields([price], row), 2);
  assert.deepEqual(recordTabCount(layout.tabs![0]!, row), { value: "2 未填", tone: "danger" });
  assert.equal(recordTabCount(layout.tabs![0]!, { ...row, note: "x", owner: "y" }), undefined);
  assert.deepEqual(recordTabCount(layout.tabs![2]!, row), { value: 12, tone: undefined });
  assert.deepEqual(recordTabs(layout, "expanded", row).map((t) => t.label), ["概览", "价格", "记录"]);
  assert.deepEqual(recordTabs(layout, "expanded", { ...row, name: "乙", owner: "y" }).map((t) => t.key), ["details", "price", "none"]);
  assert.deepEqual(recordTabs(layout, "expanded").map((t) => t.key), ["details", "price", "none", "log"]);
});

test("URL parameter read / write keeps other params", () => {
  assert.deepEqual(readRecordParam("?tab=assets&record=a%2Fb"), { key: "a/b", level: "expanded" });
  assert.deepEqual(readRecordParam("record=7&recordView=peek"), { key: "7", level: "peek" });
  assert.equal(readRecordParam("?tab=x"), null);
  assert.equal(writeRecordParam("?tab=assets", { key: "a/b", level: "peek" }), "?tab=assets&record=a%2Fb&recordView=peek");
  assert.equal(writeRecordParam("?tab=assets&record=1&recordView=peek", { key: "2", level: "expanded" }), "?tab=assets&record=2");
  assert.equal(writeRecordParam("?record=1&recordView=peek", null), "");
  assert.equal(writeRecordParam("?a=1", { key: "9", level: "peek" }, "contract"), "?a=1&contract=9&contractView=peek");
  assert.deepEqual(readRecordParam("?contract=9&contractView=peek", "contract"), { key: "9", level: "peek" });
});

test("record navigation keys", () => {
  assert.equal(recordNavDelta({ key: "ArrowDown", altKey: true }), 1);
  assert.equal(recordNavDelta({ key: "ArrowUp", altKey: true }, { tagName: "INPUT" }), -1, "Alt+↑ 在输入框里也生效");
  assert.equal(recordNavDelta({ key: "j" }), 1);
  assert.equal(recordNavDelta({ key: "K" }), -1);
  assert.equal(recordNavDelta({ key: "j" }, { tagName: "TEXTAREA" }), null, "输入时 J/K 是打字");
  assert.equal(recordNavDelta({ key: "j" }, { tagName: "DIV", isContentEditable: true }), null);
  assert.equal(recordNavDelta({ key: "j", ctrlKey: true }), null);
  assert.equal(recordNavDelta({ key: "ArrowDown" }), null);
});

test("list display: editable empty fields stay in place, the fill line lists every empty one", () => {
  const edit = () => ({ render: () => null });
  const fields = [field("name"), field("note", { edit }), field("owner", { edit: () => null }), field("tags", { hideEmpty: true, edit })];
  const r = { ...row, tags: [] };
  const { shown, empty } = arrangeRecordFields(fields, r, { keepEmpty: (f) => recordFieldEditState(f, r) === "editable" });
  assert.deepEqual(shown.map((f) => f.key), ["name", "note"], "可编辑的空字段留在原位，能直接填");
  assert.deepEqual(empty, ["owner"], "只读的空字段收进「未填写」；hideEmpty 的都不提");
  assert.deepEqual(recordFillSummary(fields, r), { filled: 1, total: 3, empty: [{ key: "note", label: "note", editable: true }, { key: "owner", label: "owner", editable: false }] });
  assert.equal(recordFieldEditState(field("name"), r), "none");
  assert.equal(recordFieldEditState(fields[1]!, r), "editable");
  assert.equal(recordFieldEditState(fields[2]!, r), "locked", "有 edit 但这条记录不能改 = 锁");
});
