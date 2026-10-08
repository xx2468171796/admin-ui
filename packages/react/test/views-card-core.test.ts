import test from "node:test";
import assert from "node:assert/strict";
import { cardFieldEmpty, cardKeyline, cardOwner, cardTags, defaultCoverField, dueState, NO_COVER } from "../src/views/record-card-core.ts";
import type { GridField } from "../src/grid-core.ts";

type Row = { name: string; stage: string | null; products: string[]; amount: number | null; region: string; city: string; owner: string | null; next: string | null; phone: string };
const F = {
  stage: { key: "stage", title: "阶段", type: "singleSelect", options: [{ value: "quote", label: "报价", tone: "yellow" }, { value: "won", label: "成交", tone: "greenSolid" }] },
  products: { key: "products", title: "产品", type: "multiSelect", options: [{ value: "lock", label: "智能门锁", tone: "green" }, { value: "curtain", label: "窗帘", tone: "blue" }, { value: "light", label: "照明", tone: "yellow" }, { value: "av", label: "影音" }] },
  amount: { key: "amount", title: "预计金额", type: "money", currency: "¥", precision: 0 },
  region: { key: "region", title: "区域", type: "text" },
  city: { key: "city", title: "城区", type: "text" },
  owner: { key: "owner", title: "负责人", type: "user" },
  next: { key: "next", title: "下次跟进", type: "date" },
  phone: { key: "phone", title: "电话", type: "text" },
} satisfies Record<string, GridField<Row>>;
const row = (patch: Partial<Row> = {}): Row => ({ name: "赵静怡", stage: "quote", products: ["lock", "curtain"], amount: 18_600_000, region: "上海", city: "徐汇", owner: "小王", next: "2026-10-07", phone: "", ...patch });

test("下次跟进：今天 = 注意色，逾期 = 异常色「逾期 N 天」，明天，其余 MM-DD（跨年写全）", () => {
  const today = "2026-10-07";
  assert.deepEqual(dueState("2026-10-07", today), { tone: "attention", text: "今天" });
  assert.deepEqual(dueState("2026-10-05", today), { tone: "danger", text: "逾期 2 天" });
  assert.deepEqual(dueState("2026-10-08", today), { tone: null, text: "明天" });
  assert.deepEqual(dueState("2026-10-14", today), { tone: null, text: "10-14" });
  assert.deepEqual(dueState("2027-01-03", today), { tone: null, text: "2027-01-03" });
  assert.equal(dueState(null, today), null);
  assert.equal(dueState("", today), null);
  assert.equal(dueState("not a date", today), null);
  assert.equal(dueState({}, today), null);
});

test("下次跟进：带时区的时间按 timeZone 落到哪天", () => {
  // 2026-10-06T17:30Z = 上海 10-07 01:30（今天），= 纽约 10-06 13:30（逾期 1 天）
  assert.deepEqual(dueState("2026-10-06T17:30:00Z", "2026-10-07", "Asia/Shanghai"), { tone: "attention", text: "今天" });
  assert.deepEqual(dueState("2026-10-06T17:30:00Z", "2026-10-07", "America/New_York"), { tone: "danger", text: "逾期 1 天" });
  assert.deepEqual(dueState(Date.UTC(2026, 9, 7, 3), "2026-10-07", "Asia/Shanghai"), { tone: "attention", text: "今天" });
});

test("标签行：选项色调软标签，最多 3 个 + N，空字段不出", () => {
  const { chips, more } = cardTags([F.stage, F.products], row({ products: ["lock", "curtain", "light", "av"] }));
  assert.deepEqual(chips.map((c) => `${c.label}/${c.tone}`), ["报价/yellow", "智能门锁/green", "窗帘/blue"]);
  assert.equal(more, 2);
  const none = cardTags([F.stage, F.products], row({ stage: null, products: [] }));
  assert.deepEqual(none, { chips: [], more: 0 });
  assert.equal(cardTags([F.products], row({ products: ["av"] })).chips[0]?.tone, "gray", "没色调的选项 = 灰");
  assert.equal(cardTags([F.region], row()).chips[0]?.label, "上海", "其它类型 = 一个灰标签");
});

test("关键数行：金额加粗，空的跳过，顺序按字段", () => {
  const parts = cardKeyline([F.amount, F.region, F.city, F.phone], row());
  assert.deepEqual(parts.map((p) => p.key), ["amount", "region", "city"], "电话为空不占位");
  assert.equal(parts[0]?.strong, true);
  assert.equal(parts[1]?.strong, false);
  assert.match(parts[0]?.text ?? "", /^¥ ?186,000$/);
  assert.deepEqual(cardKeyline([F.amount], row({ amount: null })), []);
});

test("空字段判断与负责人", () => {
  assert.equal(cardFieldEmpty(F.phone, row()), true);
  assert.equal(cardFieldEmpty(F.region, row()), false);
  assert.equal(cardFieldEmpty({ ...F.phone, text: () => "  " }, row({ phone: "x" })), true, "有 text 时按 text 判断");
  assert.deepEqual(cardOwner(F.owner, row()), { name: "小王" });
  assert.equal(cardOwner(F.owner, row({ owner: null })), null);
  assert.equal(cardOwner(undefined, row()), null);
  assert.deepEqual(cardOwner(F.owner, { ...row(), owner: [{ name: "陈组长", key: "u7" }] } as unknown as Row), { name: "陈组长", id: "u7" });
});

test("画册默认封面：有图片 / 附件字段用第一个，没有就「不显示封面」", () => {
  assert.equal(defaultCoverField([{ key: "name", type: "text" }, { key: "files", type: "attachment" }, { key: "more", type: "attachment" }]), "files");
  assert.equal(defaultCoverField([{ key: "name", type: "text" }, { key: "amount", type: "money" }]), NO_COVER);
  const options: { value: string; label: string }[] = [{ value: "photos", label: "现场照片" }];
  assert.equal(defaultCoverField(options), "photos", "封面选项列表：第一个");
  assert.equal(defaultCoverField([]), NO_COVER);
  assert.equal(defaultCoverField(undefined), NO_COVER);
});
