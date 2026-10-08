import test from "node:test";
import assert from "node:assert/strict";
import { moveNode } from "../src/sortable-core.ts";
import {
  addRecordDetailSection,
  applyRecordDetailFieldTree,
  defaultRecordDetailSpec,
  foldRecordDetailFields,
  limitKeyNumbers,
  moveRecordDetailBlock,
  moveRecordDetailField,
  normalizeRecordDetailSpec,
  pickKeyNumbers,
  setRecordDetailKeyNumbers,
  recordDetailFieldTree,
  recordDetailHiddenItems,
  recordDetailPlacement,
  recordDetailSpecEqual,
  removeRecordDetailSection,
  resolveStagePath,
  setRecordDetailHidden,
  setRecordDetailPreset,
  stepRecordDetailBlock,
  updateRecordDetailBlock,
  type RecordDetailCatalog,
  type RecordDetailSpec,
} from "../src/record-detail-spec.ts";
import { cleanOptions, type EditableOption } from "../src/field-dialog-core.ts";

// 一条客户记录：7 个字段、两块宿主画的内容（跟进、评论）、有阶段和关键数。
const CATALOG: RecordDetailCatalog = { fields: ["phone", "line", "address", "need", "quality", "dealAmount", "dealDate"], slots: ["activity", "comments"], stage: true, keyNumbers: true };
const SECTIONS = [
  { id: "contact", title: "联系方式", fields: ["phone", "line", "address"] },
  { id: "need", title: "需求", fields: ["need", "quality"] },
];
const base = () => defaultRecordDetailSpec({ ...CATALOG, sections: SECTIONS });
const order = (spec: RecordDetailSpec, column?: "main" | "side") => spec.blocks.filter((b) => !column || b.column === column).map((b) => b.id).join(" ");

test("默认布局：阶段、关键数、宿主内容在主栏，分区在右栏，没归属的字段进「其他字段」", () => {
  const spec = base();
  assert.equal(spec.preset, "cards");
  assert.equal(order(spec, "main"), "stage keyNumbers activity comments");
  assert.equal(order(spec, "side"), "contact need other");
  assert.deepEqual(spec.blocks.find((b) => b.id === "other")?.fields, ["dealAmount", "dealDate"]);
  assert.equal(spec.blocks.find((b) => b.id === "other")?.title, "其他字段");
  assert.deepEqual(spec.hidden, []);
  // 不给分区：一个「字段」分区装全部
  const plain = defaultRecordDetailSpec({ fields: ["a", "b"] });
  assert.equal(order(plain), "fields");
  assert.deepEqual(plain.blocks[0]!.fields, ["a", "b"]);
});

test("normalize：乱的输入变成合法布局（去重、丢未知、补缺、隐藏只留认识的）", () => {
  const spec = normalizeRecordDetailSpec({
    preset: "weird",
    blocks: [
      { id: "contact", kind: "section", column: "middle", title: "  联系  ", fields: ["phone", "phone", "ghost", "line"] },
      { id: "contact", kind: "section", fields: ["need"] }, // 重复 id
      { id: "need", kind: "section", column: "main", fields: ["need", "line"] }, // line 已在联系里
      { id: "stage", kind: "stage", column: "side" },
      { id: "stage2", kind: "stage" }, // 只能有一个阶段
      { id: "old-slot", kind: "slot" }, // 宿主已经没有这块
      { id: "x", kind: "chart" },
      "garbage",
      { id: "", kind: "section" },
    ],
    hidden: ["phone", "phone", "nope", "comments", 3],
  }, CATALOG);
  assert.equal(spec.preset, "cards", "未知的预设回到卡片");
  assert.deepEqual(spec.blocks.find((b) => b.id === "contact"), { id: "contact", kind: "section", column: "side", title: "联系", fields: ["phone", "line"] });
  assert.deepEqual(spec.blocks.find((b) => b.id === "need")?.fields, ["need"]);
  assert.equal(spec.blocks.find((b) => b.id === "stage")?.column, "side", "保存的栏位保留");
  assert.equal(order(spec), "keyNumbers contact need stage activity comments other", "缺的关键数补在最前，缺的宿主块补在主栏末尾");
  assert.deepEqual(spec.blocks.find((b) => b.id === "other")?.fields, ["address", "quality", "dealAmount", "dealDate"]);
  assert.deepEqual(spec.hidden, ["phone", "comments"]);
});

test("normalize：宿主没有阶段 / 关键数就去掉；空的「其他字段」去掉；空输入回到默认或给的兜底", () => {
  const spec = normalizeRecordDetailSpec(base(), { fields: CATALOG.fields, slots: ["activity"] });
  assert.equal(order(spec), "activity contact need other");
  const allPlaced = normalizeRecordDetailSpec({ blocks: [{ id: "s", kind: "section", fields: ["a"] }, { id: "other", kind: "section", fields: [] }] }, { fields: ["a"] });
  assert.equal(order(allPlaced), "s");
  assert.ok(recordDetailSpecEqual(normalizeRecordDetailSpec(null, CATALOG), defaultRecordDetailSpec(CATALOG)));
  const fallback = setRecordDetailPreset(base(), "split");
  const fromFallback = normalizeRecordDetailSpec({ hidden: ["need"] }, CATALOG, fallback);
  assert.equal(fromFallback.preset, "split");
  assert.equal(order(fromFallback), order(fallback));
  assert.deepEqual(fromFallback.hidden, ["need"]);
  assert.ok(recordDetailSpecEqual(normalizeRecordDetailSpec(base(), CATALOG), base()), "合法布局 normalize 后不变");
  // 标题过长截断；hideEmpty 只有 false 才记下
  const long = normalizeRecordDetailSpec({ blocks: [{ id: "s", kind: "section", title: "长".repeat(60), fields: ["a"], hideEmpty: false }] }, { fields: ["a"] });
  assert.equal(long.blocks[0]!.title!.length, 40);
  assert.equal(long.blocks[0]!.hideEmpty, false);
});

test("三种预设的摆法：卡片 / 分栏把阶段和关键数放到顶上一整条，单栏一列（主栏在前）", () => {
  const spec = base();
  const cards = recordDetailPlacement(spec);
  assert.deepEqual([cards.top, cards.first, cards.second].map((list) => list.map((b) => b.id).join(" ")), ["stage keyNumbers", "activity comments", "contact need other"]);
  const split = recordDetailPlacement(spec, "split");
  assert.deepEqual([split.first, split.second].map((list) => list.map((b) => b.id).join(" ")), ["contact need other", "activity comments"], "分栏：左资料、右动态");
  const single = recordDetailPlacement(spec, "single");
  assert.equal(single.top.length + single.second.length, 0);
  assert.equal(single.first.map((b) => b.id).join(" "), order(spec, "main") + " " + order(spec, "side"));
});

test("移动卡片：栏内换位、跨栏、放到某张前面 / 栏末尾", () => {
  const spec = base();
  assert.equal(order(moveRecordDetailBlock(spec, "comments", "main", "activity"), "main"), "stage keyNumbers comments activity");
  const moved = moveRecordDetailBlock(spec, "need", "main", "comments");
  assert.equal(order(moved, "main"), "stage keyNumbers activity need comments");
  assert.equal(order(moved, "side"), "contact other");
  assert.equal(order(moveRecordDetailBlock(spec, "activity", "side", null), "side"), "contact need other activity");
  assert.equal(moveRecordDetailBlock(spec, "nope", "side", null), spec);
});

test("键盘一步：跳过隐藏的卡片，到边上返回 null", () => {
  const spec = setRecordDetailHidden(base(), "need", true);
  const visible = (b: { id: string }) => !spec.hidden.includes(b.id);
  assert.equal(order(stepRecordDetailBlock(spec, "contact", 1, visible)!, "side"), "need other contact", "越过隐藏的「需求」，落到「其他字段」后面");
  assert.equal(order(stepRecordDetailBlock(spec, "other", -1, visible)!, "side"), "other contact need");
  assert.equal(stepRecordDetailBlock(spec, "contact", -1, visible), null);
  assert.equal(stepRecordDetailBlock(spec, "comments", 1, visible), null);
});

test("字段在分区之间移动；隐藏 / 显示；改名、收起、空字段设置", () => {
  const spec = base();
  const moved = moveRecordDetailField(spec, "quality", "contact", "line");
  assert.deepEqual(moved.blocks.find((b) => b.id === "contact")?.fields, ["phone", "quality", "line", "address"]);
  assert.deepEqual(moved.blocks.find((b) => b.id === "need")?.fields, ["need"]);
  assert.equal(moveRecordDetailField(spec, "quality", "activity", null), spec, "宿主块不收字段");
  const hidden = setRecordDetailHidden(setRecordDetailHidden(spec, "phone", true), "comments", true);
  assert.deepEqual(recordDetailHiddenItems(hidden), { blocks: [spec.blocks.find((b) => b.id === "comments")!], fields: ["phone"] });
  assert.deepEqual(setRecordDetailHidden(hidden, "phone", false).hidden, ["comments"]);
  const renamed = updateRecordDetailBlock(spec, "need", { title: "  客户需求 ", collapsed: true, hideEmpty: false });
  assert.deepEqual(renamed.blocks.find((b) => b.id === "need"), { id: "need", kind: "section", column: "side", title: "客户需求", fields: ["need", "quality"], collapsed: true, hideEmpty: false });
  assert.equal(updateRecordDetailBlock(renamed, "need", { title: "   " }).blocks.find((b) => b.id === "need")?.title, "客户需求", "空标题不改");
  assert.deepEqual(updateRecordDetailBlock(renamed, "need", { collapsed: false, hideEmpty: true }).blocks.find((b) => b.id === "need"), { id: "need", kind: "section", column: "side", title: "客户需求", fields: ["need", "quality"] });
});

test("新建 / 删除分区：删掉的字段进「其他字段」；「其他字段」是唯一有字段的分区时不能删", () => {
  const { spec, id } = addRecordDetailSection(base(), "成交");
  assert.equal(id, "section-2");
  assert.equal(order(spec, "side"), "contact need other section-2");
  const gone = removeRecordDetailSection(spec, "contact")!;
  assert.deepEqual(gone.blocks.find((b) => b.id === "other")?.fields, ["dealAmount", "dealDate", "phone", "line", "address"]);
  const noOther = removeRecordDetailSection(removeRecordDetailSection(base(), "other")!, "need")!;
  assert.deepEqual(noOther.blocks.find((b) => b.id === "other")?.fields, ["need", "quality"], "没有「其他字段」时新建一个");
  assert.deepEqual(removeRecordDetailSection(base(), "other")!.blocks.find((b) => b.id === "contact")?.fields, ["phone", "line", "address", "dealAmount", "dealDate"]);
  const lonely = normalizeRecordDetailSpec({ blocks: [{ id: "other", kind: "section", fields: ["a"] }] }, { fields: ["a"] });
  assert.equal(removeRecordDetailSection(lonely, "other"), null);
  assert.equal(removeRecordDetailSection(base(), "activity"), null, "宿主块不能删，只能隐藏");
});

test("字段树（SortableList）：拖字段跨分区、分区换序只在本栏的位置里换", () => {
  const spec = moveRecordDetailBlock(base(), "need", "main", null); // 需求放主栏
  const tree = recordDetailFieldTree(spec);
  assert.deepEqual(tree.map((n) => n.id), ["need", "contact", "other"]);
  const fieldMoved = moveNode(tree, "phone", { parent: "other", index: 0 })!;
  const a = applyRecordDetailFieldTree(spec, fieldMoved);
  assert.deepEqual(a.blocks.find((b) => b.id === "other")?.fields, ["phone", "dealAmount", "dealDate"]);
  assert.deepEqual(a.blocks.find((b) => b.id === "contact")?.fields, ["line", "address"]);
  const swapped = moveNode(tree, "other", { parent: null, index: 1 })!; // other 排到 contact 前
  const b = applyRecordDetailFieldTree(spec, swapped);
  assert.equal(order(b, "side"), "other contact");
  assert.equal(order(b, "main"), order(spec, "main"), "主栏不受影响");
});

test("空字段收起、关键数最多 4 个", () => {
  const empty = new Set(["line", "address"]);
  assert.deepEqual(foldRecordDetailFields(["phone", "line", "address"], (k) => empty.has(k)), { shown: ["phone"], folded: ["line", "address"] });
  assert.deepEqual(foldRecordDetailFields(["phone", "line"], (k) => empty.has(k), { hideEmpty: false }), { shown: ["phone", "line"], folded: [] });
  assert.deepEqual(foldRecordDetailFields(["phone", "line"], (k) => empty.has(k), { keep: (k) => k === "line" }), { shown: ["phone", "line"], folded: [] });
  assert.deepEqual(limitKeyNumbers([1, 2, 3, 4, 5, 6]), [1, 2, 3, 4]);
});

test("阶段路径：按当前阶段推出状态、丢单 / 作废进「更多」、下一阶段", () => {
  const steps = [
    { id: "first", label: "首通", days: 1 },
    { id: "need", label: "需求确认", days: 3 },
    { id: "quote", label: "报价" },
    { id: "lost", label: "丢单", kind: "lost" as const },
    { id: "void", label: "作废", kind: "void" as const },
  ];
  const r = resolveStagePath(steps, "need");
  assert.deepEqual(r.path.map((s) => s.state), ["done", "current", "todo"]);
  assert.deepEqual(r.exits.map((s) => s.id), ["lost", "void"]);
  assert.equal(r.position, 2);
  assert.equal(r.next?.id, "quote");
  const lost = resolveStagePath(steps, "lost");
  assert.equal(lost.current?.state, "lost");
  assert.equal(lost.position, 0);
  assert.equal(lost.next, null);
  assert.deepEqual(lost.path.map((s) => s.state), ["todo", "todo", "todo"]);
  // 宿主自己给 state 时照用
  const own = resolveStagePath([{ id: "a", label: "A", state: "done" }, { id: "b", label: "B", state: "current" }]);
  assert.equal(own.current?.id, "b");
  assert.equal(own.next, null);
});

test("阶段路径：推进到谈判再退回首通 → 只有首通亮，谈判留着天数但不填色（旧 state 不作数）", () => {
  const labels = ["首通", "需求确认", "报价", "谈判", "成交", "装机", "回访"];
  const ids = ["first", "need", "quote", "talk", "won", "install", "revisit"];
  // 宿主把上一次渲染（当前 = 谈判）算好的 state / 天数原样带着，当前已退回首通
  const stale = ids.map((id, i) => ({ id, label: labels[i]!, state: (i < 3 ? "done" : i === 3 ? "current" : "todo") as "done" | "current" | "todo", ...(i <= 3 ? { days: 1 } : {}) }));
  const back = resolveStagePath(stale, "first");
  assert.deepEqual(back.path.map((s) => s.state), ["current", "todo", "todo", "todo", "todo", "todo", "todo"]);
  assert.equal(back.position, 1);
  assert.equal(back.next?.id, "need");
  assert.equal(back.path[3]!.days, 1, "走过的阶段保留天数");
  // 前进再后退（宿主不给 state）也一样
  const plain = ids.map((id, i) => ({ id, label: labels[i]! }));
  assert.deepEqual(resolveStagePath(plain, "talk").path.map((s) => s.state), ["done", "done", "done", "current", "todo", "todo", "todo"]);
  assert.deepEqual(resolveStagePath(plain, "first").path.filter((s) => s.state !== "todo").map((s) => s.id), ["first"]);
});

test("选项的宿主数据 meta：改名、换序、cleanOptions 都保留", () => {
  const options: EditableOption[] = [
    { id: "o1", label: " 首通 ", tone: "green", meta: { category: "open", winRate: 10 } },
    { id: "o2", label: "", tone: "blue" },
    { id: "o3", label: "丢单", tone: "red", meta: { category: "lost", winRate: 0 } },
  ];
  const renamed = options.map((o) => (o.id === "o1" ? { ...o, label: "首次沟通" } : o));
  assert.deepEqual(renamed[0]!.meta, { category: "open", winRate: 10 });
  const reordered = moveNode(renamed, "o3", { parent: null, index: 0 })!;
  assert.deepEqual(reordered[0]!.meta, { category: "lost", winRate: 0 });
  assert.deepEqual(cleanOptions(options).map((o) => [o.id, o.label, o.meta]), [["o1", "首通", { category: "open", winRate: 10 }], ["o3", "丢单", { category: "lost", winRate: 0 }]]);
});

test("关键数选择 keyNumbers：只留认识的、去重、最多 4 个，按选择的顺序画", () => {
  const catalog = { ...CATALOG, keyNumberKeys: ["amount", "next", "last", "count", "rate"] };
  const spec = normalizeRecordDetailSpec({ ...base(), keyNumbers: ["rate", "rate", "ghost", "amount", "next", "last", "count"] }, catalog);
  assert.deepEqual(spec.keyNumbers, ["rate", "amount", "next", "last"]);
  assert.equal(normalizeRecordDetailSpec(base(), catalog).keyNumbers, undefined, "没选 = 不写");
  assert.equal(normalizeRecordDetailSpec({ ...base(), keyNumbers: ["amount"] }, { fields: CATALOG.fields }).keyNumbers, undefined, "宿主没有关键数就去掉");
  const items = ["amount", "next", "last", "count", "rate"].map((key) => ({ key }));
  assert.deepEqual(pickKeyNumbers(items, {}).map((i) => i.key), ["amount", "next", "last", "count"]);
  assert.deepEqual(pickKeyNumbers(items, spec).map((i) => i.key), ["rate", "amount", "next", "last"]);
  assert.deepEqual(setRecordDetailKeyNumbers(base(), ["a", "b", "a", "c", "d", "e"]).keyNumbers, ["a", "b", "c", "d"]);
});

test("布局规则文件不依赖 React / DOM（@adminui/react/record-detail-spec 给服务端用）", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../src/record-detail-spec.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /^import /m);
  assert.doesNotMatch(source, /\b(document|window|HTMLElement)\b/);
});
