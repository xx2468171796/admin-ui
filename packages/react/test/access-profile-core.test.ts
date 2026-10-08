import test from "node:test";
import assert from "node:assert/strict";
import type { EffectiveAccessRow } from "../src/access/contracts.ts";
import { accessProfileStats, personalOnly, rowExpiry } from "../src/access/profile-core.ts";
import { EMPTY_TARGET_DRAFT, draftToTarget, sameTargetDraft, scopedCodeOptions, targetKinds, targetLabel, targetToDraft } from "../src/access/override-core.ts";

const ROWS: EffectiveAccessRow[] = [
  { code: "customer:read", label: "看客户", category: "action", allowed: true, sources: [{ kind: "role", id: "sales", label: "销售" }], blocks: [] },
  { code: "customer:export", label: "导出客户", category: "action", allowed: false, sources: [{ kind: "role", id: "sales", label: "销售" }], blocks: [{ kind: "denied", label: "林经理减的" }] },
  { code: "customer:read@b", label: "二组美华的客户", category: "scope", allowed: true, sources: [{ kind: "personal", id: "p1", label: "周组长加的", expiresAt: "2026-10-12T15:59:00Z" }], blocks: [] },
  { code: "customer.phone", label: "手机", category: "field", allowed: true, sources: [{ kind: "post", id: "p-sales", label: "销售岗" }, { kind: "role", id: "sales", label: "销售" }], blocks: [] },
  { code: "customer.quality", label: "客户质量", category: "field", allowed: false, sources: [{ kind: "field_default", label: "字段默认不可见" }], blocks: [{ kind: "not_granted", label: "" }] },
  { code: "customer#c1", label: "张家豪", category: "record", allowed: true, sources: [{ kind: "shared_record", id: "s1", label: "阿杰共享的", expiresAt: "2026-10-20T00:00:00Z" }, { kind: "shared_record", id: "s1", label: "阿杰共享的" }], blocks: [] },
];

test("profile stats: roles (incl. post), personal adds, denies, shared records", () => {
  const stats = accessProfileStats(ROWS);
  assert.deepEqual(stats.map((s) => [s.key, s.value, s.tone]), [
    ["roles", 2, "neutral"],
    ["personalAdd", 1, "brand"],
    ["personalDeny", 1, "danger"],
    ["shared", 1, "neutral"],
  ]);
  assert.deepEqual(accessProfileStats([]).map((s) => s.value), [0, 0, 0, 0]);
});

test("personal-only rows and the soonest expiry", () => {
  assert.deepEqual(personalOnly(ROWS).map((r) => r.code), ["customer:export", "customer:read@b"]);
  assert.equal(rowExpiry(ROWS[2]!), "2026-10-12T15:59:00Z");
  assert.equal(rowExpiry(ROWS[0]!), null);
  assert.equal(rowExpiry({ ...ROWS[5]!, sources: [{ kind: "personal", label: "a", expiresAt: "2026-12-01T00:00:00Z" }, { kind: "personal", label: "b", expiresAt: "2026-11-01T00:00:00Z" }] }), "2026-11-01T00:00:00Z");
});

test("override targets: validation, labels, round trip, offered kinds", () => {
  assert.deepEqual(draftToTarget(EMPTY_TARGET_DRAFT), { error: "请选择权限" });
  assert.deepEqual(draftToTarget({ ...EMPTY_TARGET_DRAFT, code: "customer:read" }), { target: { kind: "action", code: "customer:read" } });
  assert.deepEqual(draftToTarget({ ...EMPTY_TARGET_DRAFT, kind: "scope", code: "customer:read", tier: "dept" }), { target: { kind: "scope", code: "customer:read", scope: { tier: "dept" } } });
  assert.ok("error" in draftToTarget({ ...EMPTY_TARGET_DRAFT, kind: "scope", code: "customer:read", tier: "custom" }), "指定部门不在这里配");
  assert.ok("error" in draftToTarget({ ...EMPTY_TARGET_DRAFT, kind: "field", resource: "customer" }));
  const field = draftToTarget({ ...EMPTY_TARGET_DRAFT, kind: "field", resource: "customer", field: "price", ability: "write" });
  assert.deepEqual<unknown>(field, { target: { kind: "field", resource: "customer", field: "price", ability: "write" } });
  const record = draftToTarget({ ...EMPTY_TARGET_DRAFT, kind: "record", resource: "customer", recordId: "c1", recordLabel: "张家豪", level: "editor" });
  assert.ok("target" in record);
  if ("target" in record) {
    assert.equal(targetLabel(record.target), "指定记录 · 张家豪 · 可读写");
    assert.deepEqual(targetToDraft(record.target, "x"), { ...EMPTY_TARGET_DRAFT, kind: "record", resource: "customer", recordId: "c1", recordLabel: "张家豪", level: "editor" });
  }
  if ("target" in field) {
    const resources = [{ id: "customer", label: "客户", actions: ["read"], fields: [{ id: "price", label: "成交价" }] }];
    assert.equal(targetLabel(field.target, resources), "字段 · 客户.成交价 可读写");
  }
  assert.equal(targetLabel({ kind: "scope", code: "customer:read", scope: { tier: "dept_tree" } }, [], (c) => (c === "customer:read" ? "查看客户" : c)), "数据范围 · 查看客户 本部门及以下");
  assert.deepEqual(targetToDraft(undefined, "customer:read"), { ...EMPTY_TARGET_DRAFT, code: "customer:read" });
  assert.deepEqual(targetKinds({ targeted: false, scoped: true, fields: true, records: true }), ["action"], "后端不支持就只给操作");
  assert.deepEqual(targetKinds({ targeted: true, scoped: true, fields: true, records: false }), ["action", "scope", "field"]);
  assert.deepEqual(scopedCodeOptions([{ value: "customer:read" }, { value: "customer:export" }, { value: "deal.read" }, { value: "plain" }], [{ id: "read", label: "查看", scoped: true }, { id: "export", label: "导出" }]).map((o) => o.value), ["customer:read", "deal.read"]);
});

test("override target equality (dirty check when editing): only the chosen kind's parts, not the record label", () => {
  const field = { ...EMPTY_TARGET_DRAFT, kind: "field" as const, resource: "customer", field: "price", ability: "read" as const };
  assert.equal(sameTargetDraft(field, { ...field, code: "ignored" }), true);
  assert.equal(sameTargetDraft(field, { ...field, ability: "write" }), false, "可读 → 可读写 is a change");
  const record = { ...EMPTY_TARGET_DRAFT, kind: "record" as const, resource: "customer", recordId: "c1", recordLabel: "张家豪", level: "viewer" as const };
  assert.equal(sameTargetDraft(record, { ...record, recordLabel: "" }), true);
  assert.equal(sameTargetDraft(record, { ...record, level: "editor" }), false);
  assert.equal(sameTargetDraft({ ...EMPTY_TARGET_DRAFT, kind: "scope", code: "a", tier: "own" }, { ...EMPTY_TARGET_DRAFT, kind: "scope", code: "a", tier: "dept" }), false);
  assert.equal(sameTargetDraft({ ...EMPTY_TARGET_DRAFT, code: "a" }, { ...EMPTY_TARGET_DRAFT, kind: "scope", code: "a" }), false);
});
