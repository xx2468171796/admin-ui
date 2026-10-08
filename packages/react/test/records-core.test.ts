import test from "node:test";
import assert from "node:assert/strict";
import { cleanOptions, fieldTypeInfo, groupTypeTiles, filterTypeTiles, tileStep, isTypeTileEnabled, newOptionId, nextOptionTone, optionProblems, validateFieldDraft, type FieldDraft } from "../src/field-dialog-core.ts";
import { filterSubjects, grantAudienceText, resolveEntry, subjectKind, suggestSubjects } from "../src/grant-list-core.ts";
import { filterComments } from "../src/comment-core.ts";
import { commentActions, editChanged, insertMention, isEdited, keptMentions, mentionQuery, openCount, patchComment, removeComment, splitMentions, toggleReaction, type CommentItem } from "../src/comment-core.ts";
import { canToggleField, hiddenTableFields, tableAccessChanges, tableFieldCounts, tableFieldPolicy, tableFieldTags, toggleTableField, type TableAccessField, type TableAccessValue } from "../src/access/table-access-core.ts";

// ---------------------------------------------------------------- R1 类型格子
const TILES = [
  { label: "文本", value: "text", keywords: "text 单行" },
  { label: "单选", value: "singleSelect", keywords: "select" },
  { label: "多选", value: "multiSelect", keywords: "select" },
  { label: "附件", later: "等文件存储" },
  { label: "评分", value: "rating", later: "B3" },
  { label: "日期", value: "date" },
];

test("类型格子：没有 value 或标了 later 的不能选；搜索按名称 / 关键词 / value，多个词都要命中", () => {
  assert.deepEqual(TILES.map(isTypeTileEnabled), [true, true, true, false, false, true]);
  assert.deepEqual(filterTypeTiles(TILES, "选").map((t) => t.label), ["单选", "多选"]);
  assert.deepEqual(filterTypeTiles(TILES, "SELECT 多").map((t) => t.label), ["多选"]);
  assert.equal(filterTypeTiles(TILES, "  ").length, TILES.length);
  assert.deepEqual(filterTypeTiles(TILES, "nothing"), []);
});

test("类型格子键盘：左右跨行、上下按列、Home / End，跳过不能选的格子", () => {
  const enabled = (i: number) => isTypeTileEnabled(TILES[i]!);
  // 3 列：文本 单选 多选 / 附件 评分 日期
  assert.equal(tileStep(0, "ArrowRight", 3, 6, enabled), 1);
  assert.equal(tileStep(2, "ArrowRight", 3, 6, enabled), 5, "跨行并跳过附件、评分");
  assert.equal(tileStep(5, "ArrowLeft", 3, 6, enabled), 2);
  assert.equal(tileStep(2, "ArrowDown", 3, 6, enabled), 5);
  assert.equal(tileStep(0, "ArrowDown", 3, 6, enabled), 1, "正下方不能选就往后找");
  assert.equal(tileStep(5, "ArrowUp", 3, 6, enabled), 2);
  assert.equal(tileStep(3, "Home", 3, 6, enabled), 0);
  assert.equal(tileStep(0, "End", 3, 6, enabled), 5);
  assert.equal(tileStep(5, "ArrowRight", 3, 6, enabled), null, "到头不绕回");
  assert.equal(tileStep(0, "Enter", 3, 6, enabled), null);
  assert.equal(tileStep(0, "ArrowRight", 3, 0), null);
});

// ---------------------------------------------------------------- R2 选项
test("选项 id 是 o + 5 位、不重复；新选项色调轮换 7 色", () => {
  let n = 0;
  const seq = [0.123456, 0.123456, 0.987654];
  const id = newOptionId([{ id: `o${(0.123456).toString(36).slice(2, 7)}` }], () => seq[n++]!);
  assert.match(id, /^o[0-9a-z]{5}$/);
  assert.notEqual(id, `o${(0.123456).toString(36).slice(2, 7)}`, "撞了就重新取");
  assert.deepEqual([0, 1, 2, 10].map(nextOptionTone), ["blue", "teal", "yellow", "blue"]);
});

test("选项问题：空名称、重名（去掉首尾空格后比较，第一个不算重）", () => {
  const options = [{ id: "a", label: "高" }, { id: "b", label: " 高 " }, { id: "c", label: "" }, { id: "d", label: "低" }];
  assert.deepEqual(optionProblems(options), { empty: ["c"], duplicate: ["b"] });
  assert.deepEqual(cleanOptions(options.map((o) => ({ ...o, tone: "green" as const }))).map((o) => o.label), ["高", "高", "低"]);
});

// ---------------------------------------------------------------- R3 字段弹窗校验
test("字段弹窗校验：名称必填 / 不超长 / 不重名；要选类型；带选项的类型至少一个、不重名", () => {
  const draft = (patch: Partial<FieldDraft>): FieldDraft => ({ name: "客户质量", type: "singleSelect", options: [{ id: "a", label: "高", tone: "green" }], allowCreate: true, description: "", ...patch });
  const rules = { optionTypes: ["singleSelect", "multiSelect"], existingNames: ["客户名称", "阶段"] };
  assert.deepEqual(validateFieldDraft(draft({}), rules), {});
  assert.equal(validateFieldDraft(draft({ name: "  " }), rules).name, "请填写字段名称");
  assert.equal(validateFieldDraft(draft({ name: "x".repeat(101) }), rules).name, "字段名称最多 100 个字");
  assert.equal(validateFieldDraft(draft({ name: " 阶段 " }), rules).name, "已经有叫「阶段」的字段了");
  assert.equal(validateFieldDraft(draft({ type: null }), rules).type, "请选择字段类型");
  assert.equal(validateFieldDraft(draft({ options: [{ id: "a", label: " ", tone: "green" }] }), rules).options, "至少要有一个选项");
  const dup = validateFieldDraft(draft({ options: [{ id: "a", label: "高", tone: "green" }, { id: "b", label: "高", tone: "red" }] }), rules);
  assert.equal(dup.options, "选项有重名的");
  assert.deepEqual(dup.optionRows, { b: "和上面的选项重名" });
  assert.deepEqual(validateFieldDraft(draft({ type: "text", options: [] }), rules), {}, "不带选项的类型不查选项");
});

// ---------------------------------------------------------------- P3 授权名单
const PEOPLE = [
  { id: "u1", name: "小A", hint: "运营，只负责智能家居线" },
  { id: "g1", name: "运营组", hint: "运营部 · 4 人", kind: "group" as const },
  { id: "r1", name: "运营", hint: "限智能家居", kind: "role" as const },
  { id: "u2", name: "林经理", group: false },
  { id: "d1", name: "技术部", group: true },
];
test("授权名单：候选人搜索去掉已选 / 锁定的，限条数；种类兼容旧的 group 标记", () => {
  assert.deepEqual(filterSubjects(PEOPLE, "运营").map((s) => s.id), ["u1", "g1", "r1"]);
  assert.deepEqual(filterSubjects(PEOPLE, "运营", new Set(["g1"])).map((s) => s.id), ["u1", "r1"]);
  assert.deepEqual(filterSubjects(PEOPLE, "", new Set(), 2).map((s) => s.id), ["u1", "g1"]);
  assert.deepEqual(PEOPLE.map(subjectKind), ["user", "group", "role", "user", "group"]);
  assert.deepEqual(resolveEntry({ id: "r1", level: "write" }, PEOPLE), { id: "r1", level: "write", name: "运营", hint: "限智能家居", kind: "role" });
  assert.deepEqual(resolveEntry({ id: "x9", level: "read", name: "离职的人" }, PEOPLE), { id: "x9", level: "read", name: "离职的人", hint: undefined, kind: "user" });
});

test("授权名单横幅：谁看不到（有角色名用角色名）、共几人能看（能改几人）、超过列出的写「等」", () => {
  const text = grantAudienceText(
    { hidden: { count: 9, names: ["销售", "组长", "主管", "林经理"], groups: ["销售", "经理"] }, readers: { count: 7, names: ["小B", "郑主管", "小A"], writers: 3 } },
    { where: "表格、详情、导出、筛选里都不会出现「客户质量」。", scopeNote: "只决定这一列能不能看；能看哪些记录照旧按行权限。" },
  );
  assert.equal(text.hidden?.title, "销售、经理看不到这个字段");
  assert.equal(text.hidden?.text, "销售、组长、主管、林经理 等都不在上面的名单里：表格、详情、导出、筛选里都不会出现「客户质量」。");
  assert.equal(text.readers?.title, "现在能看的共 7 人，能改的 3 人");
  assert.equal(text.readers?.text, "小B、郑主管、小A 等。只决定这一列能不能看；能看哪些记录照旧按行权限。");
  assert.deepEqual(grantAudienceText({ hidden: { count: 0, names: [] } }), {}, "没人看不到就不出横幅");
  assert.equal(grantAudienceText({ hidden: { count: 2, names: ["甲", "乙"] } }, { subject: "这张表" }).hidden?.title, "2 个人看不到这张表");
});

// ---------------------------------------------------------------- R5 评论
const ME = { id: "u1", name: "小王" };
test("评论正文：只高亮名单里的人，长名字优先，邮件里的 @ 不算", () => {
  const segs = splitMentions("@小王八 和 @小王 看一下，a@b.com 也抄送 @不存在", [ME, { id: "u2", name: "小王八" }]);
  assert.deepEqual(segs.map((s) => [s.kind, s.text]), [["mention", "@小王八"], ["text", " 和 "], ["mention", "@小王"], ["text", " 看一下，a@b.com 也抄送 @不存在"]]);
  assert.deepEqual(splitMentions("", []), []);
});

test("@ 补全：光标所在的 @词、插入名字后的文字和光标、删掉的人不再算提到", () => {
  assert.deepEqual(mentionQuery("找 @小", 4), { start: 2, query: "小" });
  assert.deepEqual(mentionQuery("@", 1), { start: 0, query: "" });
  assert.deepEqual(mentionQuery("问@阿明", 4), { start: 1, query: "阿明" }, "中文后面直接 @ 也算");
  assert.equal(mentionQuery("mail a@b", 8), null, "像邮件地址的不算");
  assert.equal(mentionQuery("@小王 你好", 7), null, "@ 后面有空格就结束了");
  assert.deepEqual(insertMention("找 @小 一下", 2, 4, "小王"), { text: "找 @小王  一下", caret: 6 });
  assert.deepEqual(keptMentions("@小王 你好", [ME, { id: "u3", name: "阿明" }, ME]), [ME]);
});

test("只看未解决、未解决数、本地切换回应（加 / 取消，到 0 去掉）", () => {
  const items: CommentItem[] = [
    { id: "c1", author: ME, createdAt: "2026-10-05T07:02:00Z", body: "a", resolved: true },
    { id: "c2", author: ME, createdAt: "2026-10-05T07:10:00Z", body: "b" },
  ];
  assert.deepEqual(filterComments(items, "open").map((c) => c.id), ["c2"]);
  assert.equal(filterComments(items, "all").length, 2);
  assert.equal(openCount(items), 1);
  assert.equal(openCount(items, 12), 12, "paged: the server's unresolved total wins");
  assert.equal(openCount(items, 0), 0);
  assert.deepEqual(toggleReaction([], "like"), [{ key: "like", count: 1, mine: true }]);
  assert.deepEqual(toggleReaction([{ key: "like", count: 2 }], "like"), [{ key: "like", count: 3, mine: true }]);
  assert.deepEqual(toggleReaction([{ key: "like", count: 1, mine: true }], "like"), []);
});

test("编辑 / 删除：谁能看到菜单、「已编辑」、改没改、本地改 / 删（墓碑保留回复）", () => {
  const mine: CommentItem = { id: "c1", author: ME, createdAt: "2026-10-05T07:02:00Z", body: "@小王 看样品间", mentions: [ME], attachments: [{ id: "p1", name: "a.jpg", kind: "image" }], canEdit: true, canDelete: true };
  const yes = () => true;
  const no = () => false;
  const fn = () => undefined;
  assert.deepEqual(commentActions(mine, { onEdit: fn, onDelete: fn, canEdit: yes, canDelete: no }), { edit: true, delete: false });
  assert.deepEqual(commentActions(mine, { canEdit: yes, canDelete: yes }), { edit: false, delete: false }, "没有回调就没有菜单项");
  assert.deepEqual(commentActions(mine, { readOnly: true, onEdit: fn, onDelete: fn, canEdit: yes, canDelete: yes }), { edit: false, delete: false }, "只读");
  assert.deepEqual(commentActions({ ...mine, deleted: true }, { onEdit: fn, onDelete: fn, canEdit: yes, canDelete: yes }), { edit: false, delete: false }, "墓碑不能再改 / 删");
  assert.equal(isEdited(mine), false);
  assert.equal(isEdited({ ...mine, editedAt: "2026-10-05T08:00:00Z" }), true);
  assert.equal(isEdited({ ...mine, edited: true }), true, "老服务端只给 edited");
  assert.equal(isEdited({ ...mine, editedAt: "2026-10-05T08:00:00Z", deleted: true }), false);
  const keep = { attachments: [...(mine.attachments ?? [])], files: [] as File[] };
  assert.equal(editChanged(mine, " @小王 看样品间 ", [ME], keep), false, "只多了空白不算改");
  assert.equal(editChanged(mine, "@小王 看样品间吧", [ME], keep), true);
  assert.equal(editChanged(mine, "小王 看样品间", [], keep), true, "去掉提到");
  assert.equal(editChanged(mine, "@小王 看样品间", [ME], { attachments: [], files: [] }), true, "去掉附件");
  assert.equal(editChanged(mine, "@小王 看样品间", [ME], { ...keep, files: [new File(["x"], "b.txt")] }), true, "加了新文件");
  assert.equal(editChanged(mine, "  ", [], { attachments: [], files: [] }), false, "全清空不能保存");
  const list: CommentItem[] = [{ ...mine, replies: [{ id: "r1", author: ME, createdAt: "2026-10-05T07:05:00Z", body: "回复" }] }, { id: "c2", author: ME, createdAt: "2026-10-05T07:10:00Z", body: "b" }];
  const patched = patchComment(list, "r1", (c) => ({ ...c, body: "改了", editedAt: "2026-10-05T09:00:00Z" }));
  assert.equal(patched[0]!.replies![0]!.body, "改了", "回复也能改");
  assert.equal(patched[1], list[1], "别的评论不动（同一个对象）");
  const tomb = removeComment(list, "c1", { tombstone: true });
  assert.equal(tomb[0]!.deleted, true);
  assert.equal(tomb[0]!.body, "");
  assert.deepEqual(tomb[0]!.attachments, []);
  assert.equal(tomb[0]!.replies!.length, 1, "墓碑下的回复保留");
  assert.deepEqual(removeComment(list, "c1").map((c) => c.id), ["c2"], "不留墓碑：连回复一起去掉");
  assert.deepEqual(removeComment(list, "r1")[0]!.replies, []);
  assert.equal(openCount(tomb), 1, "墓碑不算未解决");
  const lonely = removeComment(list, "c2", { tombstone: true });
  assert.deepEqual(filterComments(lonely, "open").map((c) => c.id), ["c1"], "只看未解决：没回复的墓碑收起");
  assert.equal(filterComments(lonely, "all").length, 2);
});

// ---------------------------------------------------------------- P2 表格就地权限
const FIELDS: TableAccessField[] = [
  { id: "name", label: "客户名称", primary: true },
  { id: "stage", label: "阶段" },
  { id: "phone", label: "手机", sensitive: true },
  { id: "amount", label: "预计金额" },
  { id: "quality", label: "客户质量", ownedBy: "运营专用，小B 加的" },
];
const VALUE: TableAccessValue = {
  scope: { tier: "dept" },
  actions: ["read", "update"],
  fields: { stage: { read: true, write: true, export: false, mask: false }, phone: { read: true, write: false, export: false, mask: true }, quality: { read: true, write: true, export: true, mask: false } },
};
test("字段权限：主字段总能读、别人加的字段这里改不了、打码只对敏感字段", () => {
  assert.deepEqual(tableFieldPolicy(VALUE, FIELDS[0]!), { read: true, write: false, export: false, mask: false });
  assert.equal(canToggleField(FIELDS[0]!, "read"), false);
  assert.equal(canToggleField(FIELDS[0]!, "write"), true);
  assert.equal(canToggleField(FIELDS[4]!, "read"), false);
  assert.equal(canToggleField(FIELDS[1]!, "mask"), false);
  assert.equal(toggleTableField(VALUE, FIELDS[4]!, "read"), VALUE, "锁住的行不变");
  const exp = toggleTableField(VALUE, FIELDS[3]!, "export");
  assert.deepEqual(exp.fields.amount, { read: true, write: false, export: true, mask: false }, "勾导出自动带上读");
  const off = toggleTableField(VALUE, FIELDS[2]!, "read");
  assert.deepEqual(off.fields.phone, { read: false, write: false, export: false, mask: false }, "去掉读全清");
  assert.deepEqual(toggleTableField(VALUE, FIELDS[0]!, "write").fields.name, { read: true, write: true, export: false, mask: false });
});

test("字段权限计数、行标签、「看不到的」筛选", () => {
  assert.deepEqual(tableFieldCounts(FIELDS, VALUE), { total: 5, read: 4, write: 2, mask: 1, export: 1 });
  assert.deepEqual(tableFieldTags(FIELDS[0]!, tableFieldPolicy(VALUE, FIELDS[0]!)), [{ kind: "always", label: "始终可见" }]);
  assert.deepEqual(tableFieldTags(FIELDS[3]!, tableFieldPolicy(VALUE, FIELDS[3]!), "技术"), [{ kind: "hidden", label: "技术看不到" }]);
  assert.deepEqual(tableFieldTags(FIELDS[2]!, tableFieldPolicy(VALUE, FIELDS[2]!)), [{ kind: "mask", label: "打码" }]);
  assert.deepEqual(tableFieldTags(FIELDS[4]!, tableFieldPolicy(VALUE, FIELDS[4]!)), [{ kind: "owned", label: "运营专用，小B 加的" }]);
  assert.deepEqual(hiddenTableFields(FIELDS, VALUE).map((f) => f.id), ["amount", "quality"]);
});

test("改动清单：范围、条件、交接、操作、字段", () => {
  const ctx = { fields: FIELDS, actions: [{ id: "read", label: "看" }, { id: "create", label: "加" }, { id: "update", label: "改" }] };
  assert.deepEqual(tableAccessChanges(VALUE, VALUE, ctx), []);
  const draft: TableAccessValue = { ...toggleTableField(VALUE, FIELDS[3]!, "read"), scope: { tier: "condition", condition: { join: "or" }, keepAfterHandover: true }, actions: ["update", "read", "create"] };
  assert.deepEqual(tableAccessChanges(VALUE, draft, ctx), [
    { label: "记录范围", from: "本部门", to: "按条件" },
    { label: "交接后保留只读", from: "否", to: "是" },
    { label: "能做的操作", from: "看、改", to: "看、加、改" },
    { label: "字段「预计金额」", from: "无", to: "读" },
  ]);
  const cond2 = { ...draft, scope: { ...draft.scope, condition: { join: "and" } } };
  assert.deepEqual(tableAccessChanges(draft, cond2, ctx), [{ label: "记录范围", from: "按条件", to: "按条件（已改条件）" }]);
  assert.deepEqual(tableAccessChanges(VALUE, { ...VALUE, actions: ["update", "read"] }, ctx), [], "操作顺序不同不算改动");
});

test("授权名单：服务端搜索的结果不再按文字过滤（拼音 / 邮箱命中的保留），只去掉已选 / 锁定的", () => {
  const server = [
    { id: "u1", name: "张家豪", hint: "业务部" },
    { id: "u2", name: "王美玲", hint: "mei@example.com" },
    { id: "u3", name: "陈主管" },
  ];
  assert.deepEqual(suggestSubjects(server, "zhang", new Set(["u3"]), true).map((s) => s.id), ["u1", "u2"], "拼音查到的人照样列出");
  assert.deepEqual(suggestSubjects(server, "zhang", new Set(), false).map((s) => s.id), [], "本地候选仍按文字过滤");
  assert.deepEqual(suggestSubjects(server, "美玲", new Set(), false).map((s) => s.id), ["u2"]);
  assert.equal(suggestSubjects(Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, name: `人${i}` })), "", new Set(), true).length, 30, "照样限条数");
});

test("newOptionId keeps the o + 5 chars shape even when random keeps colliding", () => {
  const id = newOptionId([{ id: "o00000" }], () => 0);
  assert.match(id, /^o[a-z0-9]{5}$/);
  assert.notEqual(id, "o00000");
});

test("类型分组：按 value / 名称归到 基础 / 选择 / 人与联系 / 关联与计算 / 系统自动；还没做的单独放；没有分组信息就一个平铺格子", () => {
  const tiles = [
    { label: "单选", value: "singleSelect" },
    { label: "文本", value: "text" },
    { label: "百分比", value: "percent" },
    { label: "创建人", value: "createdBy" },
    { label: "附件", later: "等文件存储" },
    { label: "自定义", value: "custom" },
    { label: "电话", value: "tel", group: "人与联系" },
  ];
  const { sections, later, grouped } = groupTypeTiles(tiles);
  assert.equal(grouped, true);
  assert.deepEqual(sections.map((s) => [s.group, s.tiles.map((t) => t.label)]), [
    ["基础", ["文本", "百分比"]],
    ["选择", ["单选"]],
    ["人与联系", ["电话"]],
    ["系统自动", ["创建人"]],
    ["其他", ["自定义"]],
  ]);
  assert.deepEqual(later.map((t) => t.label), ["附件"]);
  assert.equal(fieldTypeInfo({ label: "多行文本" })?.group, "基础", "按名称也认得");
  assert.equal(fieldTypeInfo({ label: "百分比", value: "percent" })?.description, "赢率、完成度");
  const flat = groupTypeTiles([{ label: "甲", value: "a" }, { label: "乙", value: "b" }]);
  assert.equal(flat.grouped, false);
  assert.deepEqual(flat.sections.map((s) => s.group), [""]);
});
