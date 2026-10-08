/**
 * Pure rules of TableAccessPanel (bt/records P2, demo D13 「就地权限」): one role's access to one table —
 * which records (six tiers, the last one 「按条件」), which actions, and per field read / write / mask /
 * export. Field rules reuse the matrix ones (matrix-core `toggleFieldAbility`: write / mask / export
 * need read). No React / DOM; unit-tested in test/records-core.test.ts.
 */
import type { FieldAbility, FieldPolicy, ScopeTier } from "./contracts.ts";
import { NO_FIELD_ACCESS, describeFieldPolicy, normalizeFieldPolicy, toggleFieldAbility } from "./matrix-core.ts";

/** Record scope tiers of a table: the quanxian ones plus 「按条件」 (a condition the host's editor builds). */
export type TableScopeTier = ScopeTier | "condition";
export type TableScope<C = unknown> = {
  tier: TableScopeTier;
  /** `custom` tier: the departments. */
  deptIds?: readonly string[];
  /** `condition` tier: whatever the condition editor edits (default editor: governance CondDraft). */
  condition?: C;
  /** 「交接后，参与过的人保留只读」 */
  keepAfterHandover?: boolean;
};
export type TableScopeOption = { value: TableScopeTier; label: string; hint?: string };
/** D13 wording; hosts replace hints with real names (「技术部」「智能家居全部客户」). */
export const TABLE_SCOPE_TIERS: readonly TableScopeOption[] = [
  { value: "own", label: "仅自己负责的", hint: "负责人是我" },
  { value: "subordinates", label: "本人及下属", hint: "我和我带的人" },
  { value: "dept", label: "本部门", hint: "所在部门" },
  { value: "dept_tree", label: "部门及下级", hint: "含下级部门" },
  { value: "all", label: "本业务线全部", hint: "这条业务线的全部记录" },
  { value: "condition", label: "按条件", hint: "满足条件的记录" },
];

/** A field row of the panel. */
export type TableAccessField = {
  id: string;
  label: string;
  /** The table's main field: always readable (「始终可见」), only write / export can change. */
  primary?: boolean;
  /**
   * Belongs to someone else's grant (「运营专用，小B 加的」): shown greyed with this text, not editable
   * here (its own field dialog decides).
   */
  ownedBy?: string;
  /** Sensitive (phone, ID): the mask column applies; other rows show 「—」 there. */
  sensitive?: boolean;
};
export type TableAccessValue<C = unknown> = {
  scope: TableScope<C>;
  /** Granted action ids (看 / 加 / 改 / 删 / 导出 …). */
  actions: readonly string[];
  /** Field id → policy; a missing field = no access (default whitelist), except primary = read. */
  fields: Readonly<Record<string, FieldPolicy>>;
};

/** The policy a row shows: owned rows are what the owner set (read-only here), primary always reads. */
export function tableFieldPolicy(value: Pick<TableAccessValue, "fields">, field: TableAccessField): FieldPolicy {
  const own = value.fields[field.id] ?? NO_FIELD_ACCESS;
  if (field.primary) return normalizeFieldPolicy({ ...own, read: true });
  return normalizeFieldPolicy(own);
}

/** Can this ability of this row be changed here? (owned rows: no; primary: not read; mask only on sensitive fields) */
export function canToggleField(field: TableAccessField, ability: FieldAbility): boolean {
  if (field.ownedBy) return false;
  if (field.primary && ability === "read") return false;
  if (ability === "mask" && !field.sensitive) return false;
  return true;
}

/** Toggle one ability of one field (write / mask / export turn read on; read off clears all); no-op when locked. */
export function toggleTableField<C>(value: TableAccessValue<C>, field: TableAccessField, ability: FieldAbility): TableAccessValue<C> {
  if (!canToggleField(field, ability)) return value;
  let next = toggleFieldAbility(tableFieldPolicy(value, field), ability);
  if (field.primary) next = { ...next, read: true };
  return { ...value, fields: { ...value.fields, [field.id]: next } };
}

/** Header counts: 「可读 11 / 15」「可写 5」「打码 1」「可导出 1」. */
export function tableFieldCounts(fields: readonly TableAccessField[], value: Pick<TableAccessValue, "fields">) {
  const policies = fields.map((f) => tableFieldPolicy(value, f));
  return {
    total: fields.length,
    read: policies.filter((p) => p.read).length,
    write: policies.filter((p) => p.write).length,
    mask: policies.filter((p) => p.mask).length,
    export: policies.filter((p) => p.export).length,
  };
}

export type TableFieldTag = { kind: "always" | "owned" | "hidden" | "mask"; label: string };
/** Row tags: 「始终可见」 (primary), the owner text (owned), 「对该角色隐藏」 (no read), 「打码」 (masked). */
export function tableFieldTags(field: TableAccessField, policy: FieldPolicy, roleName?: string): TableFieldTag[] {
  if (field.ownedBy) return [{ kind: "owned", label: field.ownedBy }];
  if (field.primary) return [{ kind: "always", label: "始终可见" }];
  if (!policy.read) return [{ kind: "hidden", label: roleName ? `${roleName}看不到` : "对该角色隐藏" }];
  if (policy.mask) return [{ kind: "mask", label: "打码" }];
  return [];
}

/** Only fields the role can't read (the 「看不到的」 filter); owned rows count as not readable. */
export const hiddenTableFields = (fields: readonly TableAccessField[], value: Pick<TableAccessValue, "fields">) =>
  fields.filter((f) => f.ownedBy || !tableFieldPolicy(value, f).read);

const sameList = (a: readonly string[] = [], b: readonly string[] = []) => a.length === b.length && [...a].sort().join("\u0000") === [...b].sort().join("\u0000");
const samePolicy = (a: FieldPolicy, b: FieldPolicy) => a.read === b.read && a.write === b.write && a.export === b.export && a.mask === b.mask;

/** Changes between the saved and the draft value as ChangeList rows (condition compared by JSON). */
export function tableAccessChanges<C>(saved: TableAccessValue<C>, draft: TableAccessValue<C>, ctx: { fields: readonly TableAccessField[]; actions: readonly { id: string; label: string }[]; tiers?: readonly TableScopeOption[] }) {
  const tiers = ctx.tiers ?? TABLE_SCOPE_TIERS;
  const tierLabel = (t: TableScopeTier) => tiers.find((x) => x.value === t)?.label ?? t;
  const items: { label: string; from: string; to: string }[] = [];
  const a = saved.scope;
  const b = draft.scope;
  if (a.tier !== b.tier || !sameList(a.deptIds, b.deptIds) || (b.tier === "condition" && JSON.stringify(a.condition ?? null) !== JSON.stringify(b.condition ?? null)))
    items.push({ label: "记录范围", from: tierLabel(a.tier), to: a.tier === b.tier ? `${tierLabel(b.tier)}（已改条件）` : tierLabel(b.tier) });
  if (Boolean(a.keepAfterHandover) !== Boolean(b.keepAfterHandover)) items.push({ label: "交接后保留只读", from: a.keepAfterHandover ? "是" : "否", to: b.keepAfterHandover ? "是" : "否" });
  if (!sameList(saved.actions, draft.actions)) {
    const names = (ids: readonly string[]) => ctx.actions.filter((x) => ids.includes(x.id)).map((x) => x.label).join("、") || "无";
    items.push({ label: "能做的操作", from: names(saved.actions), to: names(draft.actions) });
  }
  for (const field of ctx.fields) {
    const before = tableFieldPolicy(saved, field);
    const after = tableFieldPolicy(draft, field);
    if (!samePolicy(before, after)) items.push({ label: `字段「${field.label}」`, from: describeFieldPolicy(before), to: describeFieldPolicy(after) });
  }
  return items;
}

export const tableAccessDirty = <C,>(saved: TableAccessValue<C>, draft: TableAccessValue<C>, ctx: Parameters<typeof tableAccessChanges<C>>[2]) => tableAccessChanges(saved, draft, ctx).length > 0;
