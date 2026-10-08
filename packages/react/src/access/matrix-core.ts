/**
 * Pure logic for PermissionMatrix / DataScopeDialog: scope wording and validation, field-policy
 * normal form, cell / row toggles and the diff against the saved value (for highlighting and for a
 * ChangeList in the save confirmation). No React / DOM.
 */
import {
  type AssignScope,
  type DimFilter,
  FIELD_ABILITY_LABEL,
  SCOPE_TIER_LABEL,
  SCOPE_TIER_ORDER,
  type DataScope,
  type EffectiveAccessRow,
  type FieldAbility,
  type FieldPolicy,
  type MatrixAction,
  type MatrixCell,
  type MatrixResource,
  type PermissionMatrixValue,
  type ScopeTier,
} from "./contracts.ts";

export const NO_FIELD_ACCESS: FieldPolicy = Object.freeze({ read: false, write: false, export: false, mask: false });

/** Names for dimensions and their values (quanxian 2.2): `dim(id)` →「业务线」, `value(dim, id)` →「A 线」. Ids are shown when left out. */
export type DimNamer = { dim?: (id: string) => string; value?: (dim: string, id: string) => string };

/** 「我的业务线」/「业务线：A 线、B 线」/「我的业务线（含没填的）」; several dimensions joined with「 ∩ 」. */
export function describeDims(dims: Readonly<Record<string, DimFilter>> | null | undefined, names: DimNamer = {}): string {
  const label = (d: string) => names.dim?.(d) ?? d;
  return Object.keys(dims ?? {})
    .filter((d) => Object.hasOwn(dims!, d))
    .map((d) => {
      const f = dims![d]!;
      const parts = [...(f.mine ? [`我的${label(d)}`] : []), ...(f.values?.length ? [`${label(d)}：${f.values.map((v) => names.value?.(d, v) ?? v).join("、")}`] : [])];
      const text = parts.join(" 或 ") || `${label(d)}为空的`;
      return f.includeNull && parts.length ? `${text}（含没填的）` : text;
    })
    .join(" ∩ ");
}

/** 「本部门及以下 + 无部门」/「指定部门（3 个）」/「未授予」/「本部门 ∩ 我的业务线」. `deptName` turns ids into names (up to 3). */
export function describeScope(scope: DataScope | null | undefined, deptName?: (id: string) => string, dimNames?: DimNamer): string {
  if (!scope) return "未授予";
  if (scope.label) return scope.label;
  let text = SCOPE_TIER_LABEL[scope.tier] ?? scope.tier;
  if (scope.tier === "custom") {
    const ids = scope.deptIds ?? [];
    if (!ids.length) text = "指定部门（未选，只有自己名下的）";
    else if (deptName && ids.length <= 3) text = `指定部门：${ids.map(deptName).join("、")}`;
    else text = `指定部门（${ids.length} 个）`;
  }
  const base = scope.includeUnassigned && scope.tier !== "all" ? `${text} + 无部门的记录` : text;
  const dims = describeDims(scope.dims, dimNames);
  return dims ? `${base} ∩ ${dims}` : base;
}

/** Where an assignment applies:「仅 A 线 · 一部」; no scope =「不限」. */
export function describeAssignScope(scope: AssignScope | null | undefined, names: DimNamer & { dept?: (id: string) => string } = {}): string {
  if (!scope || (!scope.dim && !scope.deptId)) return "不限";
  const parts = [...(scope.dim && scope.value !== undefined ? [`${names.dim?.(scope.dim) ?? scope.dim}「${names.value?.(scope.dim, scope.value) ?? scope.value}」`] : []), ...(scope.deptId ? [`部门「${names.dept?.(scope.deptId) ?? scope.deptId}」`] : [])];
  return `仅${parts.join(" · ")}`;
}

/** Same place? (row keys / exclusions of scoped assignments) */
export function sameAssignScope(a: AssignScope | null | undefined, b: AssignScope | null | undefined): boolean {
  return (a?.dim ?? "") === (b?.dim ?? "") && (a?.value ?? "") === (b?.value ?? "") && (a?.deptId ?? "") === (b?.deptId ?? "");
}

/** Stable key of an assignment row: role + where it applies. */
export const assignKey = (a: { roleId: string; scope?: AssignScope | null }) => `${a.roleId}|${a.scope?.dim ?? ""}=${a.scope?.value ?? ""}|${a.scope?.deptId ?? ""}`;

/** Normal form of dimension filters: drop empty ones, dedupe and sort values. */
export function normalizeDims(dims: Readonly<Record<string, DimFilter>> | null | undefined): Record<string, DimFilter> | undefined {
  const out: Record<string, DimFilter> = {};
  for (const d of Object.keys(dims ?? {}).sort()) {
    if (!Object.hasOwn(dims!, d)) continue;
    const f = dims![d]!;
    const values = [...new Set(f.values ?? [])].sort();
    const next: DimFilter = { ...(f.mine ? { mine: true } : {}), ...(values.length ? { values } : {}), ...(f.includeNull ? { includeNull: true } : {}) };
    if (next.mine || next.values?.length || next.includeNull) out[d] = next;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Wider-or-equal check for the ordered tiers; custom is not comparable (returns null). */
export function compareTier(a: ScopeTier, b: ScopeTier): number | null {
  if (a === "custom" || b === "custom") return a === b ? 0 : null;
  return SCOPE_TIER_ORDER.indexOf(a) - SCOPE_TIER_ORDER.indexOf(b);
}

/** A problem with a scope the user is about to save, or null. */
export function validateScope(scope: DataScope): string | null {
  if (scope.tier === "custom" && !(scope.deptIds?.length)) return "请至少选择一个部门；只看自己名下的请选「仅本人」";
  for (const d of Object.keys(scope.dims ?? {})) {
    const f = scope.dims![d]!;
    if (!f.mine && !f.values?.length && !f.includeNull) return "指定值时至少选一个；不过滤请选「不限」";
  }
  return null;
}

/** Normal form for a scope value: drop dept ids outside custom, dedupe, drop a false flag. */
export function normalizeScope(scope: DataScope): DataScope {
  const out: DataScope = { tier: scope.tier };
  if (scope.tier === "custom") out.deptIds = [...new Set(scope.deptIds ?? [])];
  if (scope.includeUnassigned && scope.tier !== "all") out.includeUnassigned = true;
  const dims = normalizeDims(scope.dims);
  if (dims) out.dims = dims;
  return out;
}

export function sameScope(a: DataScope | null | undefined, b: DataScope | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  const x = normalizeScope(a);
  const y = normalizeScope(b);
  if (x.tier !== y.tier || !!x.includeUnassigned !== !!y.includeUnassigned) return false;
  const dx = [...(x.deptIds ?? [])].sort();
  const dy = [...(y.deptIds ?? [])].sort();
  return dx.length === dy.length && dx.every((d, i) => d === dy[i]) && JSON.stringify(x.dims ?? null) === JSON.stringify(y.dims ?? null);
}

/**
 * Field policy normal form: write / export / mask need read; without read everything is off.
 * Applying it after each click keeps impossible combinations out of the value.
 */
export function normalizeFieldPolicy(policy: FieldPolicy): FieldPolicy {
  if (!policy.read) return { ...NO_FIELD_ACCESS };
  return { read: true, write: policy.write, export: policy.export, mask: policy.mask };
}

/** Toggle one ability: turning on write / export / mask also turns on read; turning off read clears all. */
export function toggleFieldAbility(policy: FieldPolicy, ability: FieldAbility): FieldPolicy {
  const on = !policy[ability];
  const next = { ...policy, [ability]: on };
  if (on && ability !== "read") next.read = true;
  return normalizeFieldPolicy(next);
}

export const cellKey = (resource: string, action: string) => `${resource}:${action}`;
export const fieldKey = (resource: string, field: string) => `${resource}.${field}`;

export function fieldPolicyOf(value: PermissionMatrixValue, resource: MatrixResource, field: string): FieldPolicy {
  return value.fields?.[fieldKey(resource.id, field)] ?? resource.fields?.find((f) => f.id === field)?.defaultPolicy ?? NO_FIELD_ACCESS;
}

/** Default scope when a scoped cell is switched on: the narrowest offered tier. */
export function defaultScopeFor(action: MatrixAction): DataScope {
  const tiers = action.tiers ?? SCOPE_TIER_ORDER;
  return { tier: tiers.find((t) => t !== "custom") ?? tiers[0] ?? "own" };
}

/** Grant or revoke one cell. */
export function setCell(value: PermissionMatrixValue, resource: string, action: MatrixAction, on: boolean, scope?: DataScope): PermissionMatrixValue {
  const key = cellKey(resource, action.id);
  const grants = { ...value.grants };
  if (!on) delete grants[key];
  else grants[key] = action.scoped ? { scope: normalizeScope(scope ?? grants[key]?.scope ?? defaultScopeFor(action)) } : {};
  return { ...value, grants };
}

/** Tri-state of a resource row (or any set of cells): all / none / some granted. */
export function rowState(value: PermissionMatrixValue, resource: MatrixResource): "checked" | "unchecked" | "indeterminate" {
  const on = resource.actions.filter((a) => value.grants[cellKey(resource.id, a)]).length;
  return on === 0 ? "unchecked" : on === resource.actions.length ? "checked" : "indeterminate";
}

/** Toggle every applicable action of some resources: all on unless all are already on. */
export function toggleRows(value: PermissionMatrixValue, resources: readonly MatrixResource[], actions: readonly MatrixAction[]): PermissionMatrixValue {
  const all = resources.every((r) => rowState(value, r) === "checked");
  let next = value;
  for (const r of resources)
    for (const id of r.actions) {
      const action = actions.find((a) => a.id === id);
      if (action && !!next.grants[cellKey(r.id, id)] === all) next = setCell(next, r.id, action, !all);
    }
  return next;
}

export type MatrixChange =
  | { kind: "cell"; key: string; resource: string; action: string; label: string; before: MatrixCell | null; after: MatrixCell | null }
  | { kind: "field"; key: string; resource: string; field: string; label: string; before: FieldPolicy; after: FieldPolicy };

/** Every difference between the saved value and the draft, in matrix order. */
export function diffMatrix(
  saved: PermissionMatrixValue,
  draft: PermissionMatrixValue,
  resources: readonly MatrixResource[],
  actions: readonly MatrixAction[],
): MatrixChange[] {
  const changes: MatrixChange[] = [];
  for (const r of resources) {
    for (const id of r.actions) {
      const key = cellKey(r.id, id);
      const before = saved.grants[key] ?? null;
      const after = draft.grants[key] ?? null;
      if (!!before !== !!after || (before && after && !sameScope(before.scope, after.scope)))
        changes.push({ kind: "cell", key, resource: r.id, action: id, label: `${r.label} · ${actions.find((a) => a.id === id)?.label ?? id}`, before, after });
    }
    for (const f of r.fields ?? []) {
      const before = fieldPolicyOf(saved, r, f.id);
      const after = fieldPolicyOf(draft, r, f.id);
      if ((Object.keys(FIELD_ABILITY_LABEL) as FieldAbility[]).some((a) => before[a] !== after[a]))
        changes.push({ kind: "field", key: fieldKey(r.id, f.id), resource: r.id, field: f.id, label: `${r.label} · 字段「${f.label}」`, before, after });
    }
  }
  return changes;
}

/** 「读、写、脱敏」/「无」. */
export function describeFieldPolicy(policy: FieldPolicy): string {
  const on = (Object.keys(FIELD_ABILITY_LABEL) as FieldAbility[]).filter((a) => policy[a]).map((a) => FIELD_ABILITY_LABEL[a]);
  return on.length ? on.join("、") : "无";
}

/** Changes as ChangeList rows (字段 · 原值 → 新值 · 生效方式). */
export function matrixChangeItems(changes: readonly MatrixChange[], deptName?: (id: string) => string, effect = "保存后立即生效") {
  return changes.map((c) => ({
    label: c.label,
    from: c.kind === "cell" ? describeCell(c.before, deptName) : describeFieldPolicy(c.before),
    to: c.kind === "cell" ? describeCell(c.after, deptName) : describeFieldPolicy(c.after),
    effect,
  }));
}

function describeCell(cell: MatrixCell | null, deptName?: (id: string) => string): string {
  if (!cell) return "未授予";
  return cell.scope ? `已授予（${describeScope(cell.scope, deptName)}）` : "已授予";
}

/**
 * The 范围 cell of an effective-access row (quanxian 2.2). Held only through scoped assignments: one line per
 * (tier, place) — 「本部门及以下（仅在业务线「A」）」「仅本人（仅在业务线「B」）」 — never the widest tier next to the union of
 * places (that would claim 本部门及以下 in B too). A source that gives nothing directly on this kind of record (no 业务线 field)
 * shows as following its parent. Otherwise one line, as before.
 */
export function effectiveScopeLines(row: Pick<EffectiveAccessRow, "scope" | "within" | "sources" | "allowed">, deptName?: (id: string) => string, dimNames?: DimNamer): string[] {
  const scoped = row.sources.filter((s) => s.within);
  // 服务端在来源说明里写了跟随谁（「只跟随所属的客户」）：照它说；没写就泛称「上级记录」
  const follow = (s: { detail?: string }) => /只跟随所属的([^，；。\s]+)/.exec(s.detail ?? "")?.[0] ?? "只跟随上级记录";
  if (row.within?.length && scoped.length) {
    const lines = new Map<string, string>();
    for (const s of scoped) {
      const text = s.scope ? `${describeScope(s.scope, deptName, dimNames)}（仅在${s.within!.label}）` : `${follow(s)}（${s.within!.label}在这类记录上不直接给）`;
      lines.set(text, text);
    }
    return [...lines.values()];
  }
  const blind = scoped.find((s) => !s.scope);
  if (row.allowed && !row.scope && blind) return [follow(blind)];
  return [row.scope ? describeScope(row.scope, deptName, dimNames) : "—"];
}
