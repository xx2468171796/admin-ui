// bt/builders-a: form rules (FormBuilder / PublicForm, demos D08 / D18).
import test from "node:test";
import assert from "node:assert/strict";
import {
  addAllFormQuestions,
  addFormQuestion,
  buildPrefillLink,
  checkFormAnswer,
  describeFormCondition,
  formConditionFields,
  formFieldLists,
  formFieldUnsupported,
  formProgress,
  formSummary,
  joinPhone,
  parsePrefill,
  patchFormSettings,
  formSettingLocks,
  removeFormQuestion,
  revealInvalidHidden,
  reorderFormQuestions,
  splitPhone,
  submittedAnswers,
  validateFormAnswers,
  visibleFormQuestions,
  DEFAULT_FORM_SETTINGS,
  type FormDefinition,
  type FormField,
} from "../src/form-builder/form-core.ts";

const PRODUCTS = [
  { value: "lock", label: "智能门锁", tone: "green" as const },
  { value: "light", label: "智能照明", tone: "blue" as const },
  { value: "curtain", label: "窗帘电机", tone: "yellow" as const },
];
const FIELDS: FormField[] = [
  { key: "name", title: "客户名称", type: "text", primary: true },
  { key: "phone", title: "手机", type: "phone" },
  { key: "region", title: "地区", type: "singleSelect", options: [{ value: "tp", label: "上海" }, { value: "nt", label: "杭州" }] },
  { key: "products", title: "想了解的产品", type: "multiSelect", options: PRODUCTS },
  { key: "files", title: "现场资料", type: "attachment" },
  { key: "budget", title: "预算", type: "number" },
  { key: "mail", title: "邮箱", type: "email" },
  { key: "owner", title: "负责人", type: "user" },
  { key: "no", title: "编号", type: "autoNumber" },
  { key: "stars", title: "意向", type: "rating" },
];
const lockCondition = { id: "root", conjunction: "and" as const, items: [{ id: "f1", field: "products", op: "hasAny" as const, value: ["lock"] }] };
const FORM: FormDefinition = {
  title: "官网咨询表单",
  questions: [
    { field: "name", title: "您的称呼", required: true },
    { field: "phone", required: true },
    { field: "region" },
    { field: "products", required: true },
    { field: "files", title: "上传户型图", condition: lockCondition },
    { field: "budget" },
  ],
};

test("字段列表：已添加按题目顺序，未添加按字段顺序、不支持的放最后；加题不重复、系统字段加不进", () => {
  const { added, notAdded } = formFieldLists(FORM, FIELDS);
  assert.deepEqual(added.map((f) => f.key), ["name", "phone", "region", "products", "files", "budget"]);
  assert.deepEqual(notAdded.map((f) => f.key), ["mail", "stars", "owner", "no"]);
  assert.equal(formFieldUnsupported(FIELDS[8]!), "系统自动填写，不能做成题目");
  assert.equal(addFormQuestion(FORM, FIELDS[0]!), FORM, "不重复");
  assert.equal(addFormQuestion(FORM, FIELDS[8]!), FORM, "系统字段不行");
  assert.deepEqual(addFormQuestion(FORM, FIELDS[6]!, 1).questions.map((q) => q.field).slice(0, 3), ["name", "mail", "phone"]);
  assert.deepEqual(addAllFormQuestions(FORM, FIELDS).questions.map((q) => q.field).slice(6), ["mail", "stars"]);
});

test("显示条件只能看前面的题：移到前面 / 删掉被依赖的题会去掉那条条件；可选字段不含附件", () => {
  assert.deepEqual(formConditionFields(FORM, FIELDS, "files").map((f) => f.key), ["name", "phone", "region", "products"]);
  assert.equal(formConditionFields(FORM, FIELDS, "files")[0]!.title, "您的称呼", "用题目名");
  assert.deepEqual(formConditionFields(FORM, FIELDS, "budget").map((f) => f.key), ["name", "phone", "region", "products"], "附件不能做条件");
  const moved = reorderFormQuestions(FORM, ["files", "name", "phone", "region", "products", "budget"]);
  assert.equal(moved.questions[0]!.condition, null, "挪到最前面：条件清掉");
  const removed = removeFormQuestion(FORM, "products");
  assert.equal(removed.questions.find((q) => q.field === "files")!.condition, null);
  const kept = reorderFormQuestions(FORM, ["name", "products", "files", "phone", "region", "budget"]);
  assert.ok(kept.questions.find((q) => q.field === "files")!.condition, "依赖的题还在前面：保留");
});

test("条件显示：答了「智能门锁」才出现上传题；被隐藏的题答案不算数（连锁隐藏）", () => {
  assert.deepEqual(visibleFormQuestions(FORM, FIELDS, {}), ["name", "phone", "region", "products", "budget"]);
  assert.deepEqual(visibleFormQuestions(FORM, FIELDS, { products: ["light"] }), ["name", "phone", "region", "products", "budget"]);
  assert.deepEqual(visibleFormQuestions(FORM, FIELDS, { products: ["light", "lock"] }), ["name", "phone", "region", "products", "files", "budget"]);
  const chain: FormDefinition = {
    ...FORM,
    questions: [
      ...FORM.questions,
      { field: "mail", condition: { id: "root", conjunction: "and", items: [{ id: "f1", field: "files", op: "notEmpty" }] } },
    ],
  };
  const answers = { products: ["light"], files: [{ id: "a", name: "a.jpg" }] };
  assert.ok(!visibleFormQuestions(chain, FIELDS, answers).includes("mail"), "上传题隐藏了，依赖它的也隐藏");
  assert.ok(visibleFormQuestions(chain, FIELDS, { ...answers, products: ["lock"] }).includes("mail"));
  assert.deepEqual(Object.keys(submittedAnswers({ name: "陈", files: [] , extra: 1 }, ["name", "files"])), ["name", "files"]);
  // An incomplete condition (no value yet) shows the question.
  const incomplete: FormDefinition = { ...FORM, questions: [FORM.questions[3]!, { field: "budget", condition: { id: "root", conjunction: "and", items: [{ id: "f1", field: "products", op: "hasAny" }] } }] };
  assert.deepEqual(visibleFormQuestions(incomplete, FIELDS, {}), ["products", "budget"]);
});

test("校验：必填按类型说法、邮箱 / 手机格式、隐藏的题不校验；进度只数可见的题", () => {
  const visible = visibleFormQuestions(FORM, FIELDS, { products: ["lock"] });
  const errors = validateFormAnswers({ questions: [...FORM.questions, { field: "mail" }] }, FIELDS, { name: "  ", products: [], phone: "+86 12", mail: "abc" }, [...visible, "mail"]);
  assert.deepEqual(errors, { name: "请填写您的称呼", phone: "手机号位数不对", products: "请选择想了解的产品", mail: "邮箱格式不对，例如 name@example.com" });
  assert.equal(checkFormAnswer({ field: "files", required: true }, FIELDS[4]!, []), "请上传现场资料");
  assert.equal(checkFormAnswer({ field: "files", required: true, upload: { record: "only" } }, FIELDS[4]!, []), "请录一段现场资料");
  assert.equal(checkFormAnswer({ field: "phone", required: true }, FIELDS[1]!, "+86 13800138000"), null);
  assert.equal(checkFormAnswer({ field: "phone", required: true }, FIELDS[1]!, "+86 "), "请填写手机");
  const custom: FormField = { key: "budget", title: "预算", type: "number", validate: (v) => (Number(v) > 100 ? "最多 100" : null) };
  assert.equal(checkFormAnswer({ field: "budget" }, custom, 200), "最多 100");
  assert.deepEqual(formProgress(FIELDS, { name: "陈", products: ["lock"], files: [] }, visible), { answered: 2, total: 6 });
});

test("手机：国家区号拆开 / 拼回", () => {
  assert.deepEqual(splitPhone("+86 138-0013-8000"), { country: "+86", number: "138-0013-8000" });
  assert.deepEqual(splitPhone("13800138000"), { country: "", number: "13800138000" });
  assert.equal(joinPhone("+86", " 138 "), "+86 138");
  assert.equal(joinPhone("+86", ""), "");
});

test("提交成功页摘要：只列答了的可见题，手机打码，选项成胶囊，附件按类型计数", () => {
  const answers = {
    name: "陈雅婷",
    phone: "+86 13800138000",
    region: "tp",
    products: ["lock", "curtain"],
    files: [{ id: "1", name: "客厅.jpg" }, { id: "2", name: "大门.mp4" }, { id: "3", name: "语音.webm", kind: "audio" }, { id: "4", name: "户型.pdf" }],
    budget: 30,
  };
  const visible = visibleFormQuestions(FORM, FIELDS, answers);
  const sum = formSummary(FORM, FIELDS, answers, visible);
  assert.equal(sum.total, 6);
  assert.equal(sum.answered, 6);
  assert.equal(sum.rows[1]!.text, "+86 138 **** 8000", "没给本国：国际写法");
  assert.equal(formSummary(FORM, FIELDS, answers, visible, { home: "+86" }).rows[1]!.text, "138 **** 8000", "本国号码按当地写法");
  assert.equal(formSummary(FORM, FIELDS, { ...answers, phone: "+886 0912345678" }, visible, { home: "+86" }).rows[1]!.text, "+886 912 3** 678", "外国号码：国际写法、不带 0");
  assert.deepEqual(sum.rows[3]!.chips!.map((c) => c.label), ["智能门锁", "窗帘电机"]);
  assert.deepEqual(sum.rows[4]!.files, [{ kind: "image", count: 1 }, { kind: "video", count: 1 }, { kind: "audio", count: 1 }, { kind: "pdf", count: 1 }]);
  assert.equal(sum.rows[4]!.fileCount, 4);
  assert.equal(formSummary(FORM, FIELDS, { name: "陈" }, visible).answered, 1);
});

test("收集设置：按人限制 / 允许修改要登录；指定人 / 公司内强制登录；关登录退回不限", () => {
  const a = patchFormSettings(DEFAULT_FORM_SETTINGS, { submitLimit: "once" });
  assert.equal(a.loginRequired, true);
  const b = patchFormSettings({ ...a, allowEditOwn: true }, { loginRequired: false });
  assert.deepEqual([b.loginRequired, b.submitLimit, b.allowEditOwn], [false, "unlimited", false]);
  const c = patchFormSettings(DEFAULT_FORM_SETTINGS, { audience: "picked" });
  assert.equal(c.loginRequired, true);
  assert.equal(patchFormSettings(c, { loginRequired: false }).loginRequired, true, "指定人不能关登录");
  assert.match(formSettingLocks(c).loginRequired ?? "", /指定人/);
  assert.deepEqual(formSettingLocks(DEFAULT_FORM_SETTINGS), {});
  assert.equal(patchFormSettings(DEFAULT_FORM_SETTINGS, { submitLimit: "weekly" }).submitLimit, "weekly");
});

test("条件说成话、预填链接生成与读取", () => {
  assert.equal(describeFormCondition(lockCondition, FIELDS), "当「想了解的产品」包含任一「智能门锁」时显示");
  assert.equal(describeFormCondition(null, FIELDS), "一直显示");
  const nested = { id: "root", conjunction: "and" as const, items: [{ id: "f1", field: "region", op: "anyOf" as const, value: ["tp"] }, { id: "g1", conjunction: "or" as const, items: [{ id: "f2", field: "budget", op: "gte" as const, value: 30 }, { id: "f3", field: "phone", op: "notEmpty" as const }] }] };
  assert.equal(describeFormCondition(nested, FIELDS), "当「地区」是「上海」 且 （「预算」≥「30」 或 「手机」不为空）时显示".replace(" 且 ", " 且 "));
  const link = buildPrefillLink("https://app.example.com/f/kH8x2Q", [
    { field: { key: "region", title: "地区", type: "singleSelect", options: FIELDS[2]!.options }, value: "tp", hide: true },
    { field: { key: "name", title: "客户名称", type: "text" }, value: "" },
  ]);
  assert.equal(link, `https://app.example.com/f/kH8x2Q?prefill_${encodeURIComponent("地区")}=${encodeURIComponent("上海")}&hide_${encodeURIComponent("地区")}=1`);
  const read = parsePrefill(new URL(link).search, FIELDS);
  assert.deepEqual(read, { answers: { region: "tp" }, hidden: ["region"] });
  const multi = parsePrefill("?prefill_products=智能门锁,lock,不存在&prefill_预算=12&prefill_负责人=x&hide_预算=1&hide_手机=1", FIELDS);
  assert.deepEqual(multi, { answers: { products: ["lock", "lock"], budget: 12 }, hidden: ["budget"] });
});

test("字段列表拖动：拖进已添加 = 加题，拖出 = 移除，顺序跟着变", async () => {
  const { setFormQuestionOrder, formTypeLabel } = await import("../src/form-builder/form-core.ts");
  const next = setFormQuestionOrder(FORM, FIELDS, ["name", "mail", "phone", "region", "products", "budget"]);
  assert.deepEqual(next.questions.map((q) => q.field), ["name", "mail", "phone", "region", "products", "budget"]);
  assert.equal(setFormQuestionOrder(FORM, FIELDS, FORM.questions.map((q) => q.field)).questions.length, 6);
  assert.equal(formTypeLabel(FIELDS[4]!, { upload: { record: "only" } }), "录音");
  assert.equal(formTypeLabel(FIELDS[3]!), "多选");
});

test("附件题 maxFiles：超过个数报错；预填隐藏的题没通过校验就显示出来", () => {
  const files = FIELDS.find((f) => f.key === "files");
  assert.ok(files);
  const q = { field: "files", upload: { maxFiles: 2 } };
  const three = [1, 2, 3].map((i) => ({ id: `f${i}`, name: `${i}.jpg`, kind: "image" as const }));
  assert.equal(checkFormAnswer(q, files, three), "现场资料最多 2 个文件");
  assert.equal(checkFormAnswer(q, files, three.slice(0, 2)), null);
  const hidden = new Set(["phone", "region"]);
  const none = new Set<string>();
  assert.equal(revealInvalidHidden(hidden, {}, none), none, "都没问题：不显示，原样返回");
  const shown = revealInvalidHidden(hidden, { phone: "手机号位数不对", name: "请填写客户名称" }, none);
  assert.deepEqual([...shown], ["phone"], "只显示被隐藏又有错的题");
  assert.equal(revealInvalidHidden(hidden, {}, shown), shown, "改好后也不再藏回去");
});
