/**
 * 权限按模块组织（ModulePermissionEditor / PermissionDiff / EffectiveAccessView）的数据形状和纯规则。
 *
 * 一个角色在一个模块上 = 档位（全平台统一 5 档）+ 能看到的数据（范围）+ 细调（加 / 去掉 / 字段三态）。
 * 档位由模块清单声明：每档包含哪些动作键（含低档，逐级包含）；宿主把自己的目录（例如宿主的
 * `GET /access/catalog` → `CatalogModule`）转成 `ModuleAccessDef`，把角色存的值（`RoleModuleState`）转成
 * `ModuleGrant`。这里只有类型和纯函数，不碰 React / DOM；服务端照样要再算一遍。
 */
import type { ReactNode } from "react";
import { SCOPE_TIER_LABEL, type ScopeTier } from "./contracts.ts";

// ---- 档位 ---------------------------------------------------------------------------------

/** 统一档位 id，从低到高、逐级包含。 */
export type AccessLevelId = "none" | "viewer" | "member_own" | "member_all" | "admin";
export const ACCESS_LEVEL_ORDER = ["none", "viewer", "member_own", "member_all", "admin"] as const satisfies readonly AccessLevelId[];
/** 默认显示名（「成员·看全部」改名「成员·按范围看」）；模块可在 `ModuleLevel.label` 里改。 */
export const ACCESS_LEVEL_LABEL: Readonly<Record<AccessLevelId, string>> = {
  none: "无",
  viewer: "只看",
  member_own: "成员·只看自己的",
  member_all: "成员·按范围看",
  admin: "管理员",
};
export const ACCESS_LEVEL_HINT: Readonly<Record<AccessLevelId, string>> = {
  none: "看不到这个模块",
  viewer: "能看，不能改",
  member_own: "能加、能改自己负责的",
  member_all: "能加、能改范围内所有人的",
  admin: "全部操作，含模块设置",
};
/** 角色现在的勾选对不上任何一档时显示的名字。 */
export const CUSTOM_LEVEL_LABEL = "自定义";

// ---- 模块清单（宿主给） ----------------------------------------------------------------------

/** 一个可勾的动作。`key` 是动作键（例如 `资源:动作`，分范围的码去掉档位后缀）。 */
export type ModuleAction = {
  key: string;
  label: string;
  /** 高危：标 ⚠，改动清单里也标出来。 */
  risk?: "high";
  /** 用的时候要再验证一次（「需二次验证」）。 */
  stepUp?: boolean;
  /** 低于这一档不能单独加（例：表结构 → 「管理员」档才有）。 */
  minLevel?: AccessLevelId;
  /** 编辑人能不能授出：true / 不写 = 能；字符串 = 不能的原因（勾不上，灰掉）。 */
  grantable?: true | string;
  /** 权限码（只显示用，例如诊断明细）。 */
  code?: string;
};
export type FieldMode = "hidden" | "read" | "write";
export const FIELD_MODE_LABEL: Readonly<Record<FieldMode, string>> = { hidden: "隐藏", read: "只读", write: "可编辑" };
export type ModuleField = { id: string; label: string; icon?: ReactNode; /** 没设置时的状态（默认可编辑）。 */ defaultMode?: FieldMode };
/** 模块里的一类对象（记录 / 导入 / 视图 / 字段 / 表结构 / 分享 …）。 */
export type ModuleResource = {
  id: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
  /** 分数据范围：细调里这一行显示范围选择（和模块的「能看到的数据」是同一个值）。 */
  scoped?: boolean;
  actions: readonly ModuleAction[];
  /** 细调里能设 隐藏 / 只读 / 可编辑 的字段。键 = `ModuleField.id`。 */
  fields?: readonly ModuleField[];
  /** 字段区的小字（例：「按表设置 · 下面是「客户」表」）。 */
  fieldsNote?: string;
};
/** 模块声明了的一档。`actions` = 这一档的全部动作键（含低档）。没声明的档不列出（「无」总在）。 */
export type ModuleLevel = {
  id: Exclude<AccessLevelId, "none">;
  label?: string;
  hint?: string;
  actions: readonly string[];
  /** 选这一档时的默认范围；不写：成员·只看自己的 = 本人，其它 = 全部。 */
  defaultScope?: ScopeTier | null;
  /** 编辑人能不能把这一档授出：true / 不写 = 能；字符串 = 原因（灰掉 + 钥匙图标）。 */
  grantable?: true | string;
};
export type ModuleAccessDef = {
  id: string;
  label: string;
  /** 名字下面的一句话（「表格、视图、表单、看板」）。 */
  description?: string;
  icon?: ReactNode;
  /** system = 进「系统管理」小节（权限管理、组织管理）。 */
  section?: "business" | "system";
  levels: readonly ModuleLevel[];
  resources: readonly ModuleResource[];
  /** 「能看到的数据」可选的档（默认五档）。 */
  tiers?: readonly ScopeTier[];
  /** 不能选的范围档 + 原因（例：「不能宽于你自己的范围」）。 */
  disabledTiers?: Partial<Record<ScopeTier, string>>;
  /** 范围不由角色决定时显示这句、不给选（知识库：「按空间成员决定」）。 */
  scopeNote?: string;
  /** 模块用不了：整行灰，写原因（「本公司未开通」「套餐不含」）+ 可选的去处。 */
  unavailable?: { label: string; action?: { label: string; onSelect: () => void } };
  /** 档位下拉底部的小字（「知识库没有「成员·只看自己的」这一档」）；不写自动生成。 */
  levelsNote?: string;
};

// ---- 角色的值 ----------------------------------------------------------------------------

/** 字段规则：隐藏 = read false；只读 = write false。 */
export type FieldRule = { read?: boolean; write?: boolean; export?: boolean };
/**
 * 一个角色在一个模块上的值。`level: null` = 自定义（直接给的动作 `raw`）。
 * add = 档位外单独加的动作键；mute = 档位里手动去掉的（升级也不会加回）；pending = 新版本带来、等确认的高危动作。
 */
export type ModuleGrant = {
  level: AccessLevelId | null;
  /** null / 不写 = 用档位默认。`custom` 时 `deptIds` 是指定的部门。 */
  scope?: ScopeTier | null;
  deptIds?: readonly string[];
  add?: readonly string[];
  mute?: readonly string[];
  pending?: readonly string[];
  fields?: Readonly<Record<string, FieldRule>>;
  raw?: readonly string[];
};
/** 模块 id → 值；没有的模块 = 无。 */
export type ModuleGrants = Readonly<Record<string, ModuleGrant>>;

export const NO_GRANT: ModuleGrant = Object.freeze({ level: "none" });

export type ModuleLabels = { scope?: Partial<Record<ScopeTier, string>> };

// ---- 基础查询 ----------------------------------------------------------------------------

export const levelRank = (level: AccessLevelId) => ACCESS_LEVEL_ORDER.indexOf(level);
const grantOf = (grants: ModuleGrants, id: string): ModuleGrant => (Object.hasOwn(grants, id) ? grants[id]! : NO_GRANT);
export { grantOf as moduleGrantOf };

/** 模块列出的档（「无」+ 声明了的，从低到高）。 */
export function moduleLevels(def: ModuleAccessDef): AccessLevelId[] {
  const declared = new Set(def.levels.map((l) => l.id));
  return ACCESS_LEVEL_ORDER.filter((id) => id === "none" || declared.has(id));
}
export function moduleLevel(def: ModuleAccessDef, id: AccessLevelId): ModuleLevel | undefined {
  return def.levels.find((l) => l.id === id);
}
export function levelLabel(def: ModuleAccessDef | undefined, id: AccessLevelId | null): string {
  if (id === null) return CUSTOM_LEVEL_LABEL;
  return (def && id !== "none" ? moduleLevel(def, id)?.label : undefined) ?? ACCESS_LEVEL_LABEL[id];
}
export function levelHint(def: ModuleAccessDef, id: AccessLevelId): string {
  return (id !== "none" ? moduleLevel(def, id)?.hint : undefined) ?? ACCESS_LEVEL_HINT[id];
}
/** 档位不能授出的原因（能授出 = null）。 */
export function levelBlocked(def: ModuleAccessDef, id: AccessLevelId): string | null {
  if (id === "none") return null;
  const g = moduleLevel(def, id)?.grantable;
  return typeof g === "string" ? g : null;
}
/** 档位下拉底部的说明：没声明的中间档（不含管理员以上）。 */
export function levelsNote(def: ModuleAccessDef): string | null {
  if (def.levelsNote !== undefined) return def.levelsNote || null;
  const missing = ACCESS_LEVEL_ORDER.filter((id) => id !== "none" && !moduleLevel(def, id));
  return missing.length ? `${def.label}没有${missing.map((id) => `「${ACCESS_LEVEL_LABEL[id]}」`).join("")}这一档，所以不列出。` : null;
}
export function levelActions(def: ModuleAccessDef, id: AccessLevelId | null): ReadonlySet<string> {
  if (id === null || id === "none") return new Set();
  return new Set(moduleLevel(def, id)?.actions ?? []);
}
export function allActions(def: ModuleAccessDef): ModuleAction[] {
  return def.resources.flatMap((r) => r.actions);
}
export function actionOf(def: ModuleAccessDef, key: string): ModuleAction | undefined {
  return allActions(def).find((a) => a.key === key);
}
const actionLabel = (def: ModuleAccessDef, key: string) => actionOf(def, key)?.label ?? key;
const without = (list: readonly string[] | undefined, drop: (k: string) => boolean) => (list ?? []).filter((k) => !drop(k));
const uniq = (list: readonly string[]) => [...new Set(list)];

/** 这个模块的范围是不是由角色选（有分范围的对象、没写 scopeNote）。 */
export const moduleScoped = (def: ModuleAccessDef) => !def.scopeNote && def.resources.some((r) => r.scoped);

/** 「能看到的数据」这一格显示什么：none = —；note = scopeNote；fixed = 固定本人；select = 下拉。 */
export type ScopeMode = "none" | "note" | "fixed" | "select";
export function scopeMode(def: ModuleAccessDef, grant: ModuleGrant): ScopeMode {
  if (def.unavailable || grant.level === "none") return "none";
  if (def.scopeNote) return "note";
  if (!moduleScoped(def)) return "none";
  // 「成员·只看自己的」范围固定本人，不给选。
  if (grant.level === "member_own") return "fixed";
  return "select";
}
/** 生效的范围：显式值，否则档位默认（成员·只看自己的 = 本人，其它 = 全部）。 */
export function effectiveScope(def: ModuleAccessDef, grant: ModuleGrant): ScopeTier | null {
  const mode = scopeMode(def, grant);
  if (mode === "none" || mode === "note") return null;
  if (mode === "fixed") return "own";
  if (grant.scope) return grant.scope;
  const fromLevel = grant.level ? moduleLevel(def, grant.level)?.defaultScope : undefined;
  return fromLevel ?? "all";
}
export function scopeText(tier: ScopeTier | null, labels: ModuleLabels = {}, deptCount?: number): string {
  if (!tier) return "—";
  const base = labels.scope?.[tier] ?? SCOPE_TIER_LABEL[tier];
  return tier === "custom" && deptCount ? `${base}（${deptCount} 个）` : base;
}

// ---- 动作状态与修改 -----------------------------------------------------------------------

/** 动作在细调里的样子。origin：level = 档位自带；added = 手动加；muted = 手动去掉；pending = 待确认；none = 没给。 */
export type ActionState = {
  checked: boolean;
  origin: "level" | "added" | "muted" | "pending" | "none";
  /** 勾不动的原因（档位不够 / 编辑人自己没有）；勾着的、不能授出的动作仍能去掉。 */
  locked: string | null;
};
export function grantedActions(def: ModuleAccessDef, grant: ModuleGrant): Set<string> {
  if (grant.level === null) return new Set(grant.raw ?? []);
  const base = levelActions(def, grant.level);
  const mute = new Set(grant.mute ?? []);
  const pending = new Set(grant.pending ?? []);
  const out = new Set([...base].filter((k) => !mute.has(k) && !pending.has(k)));
  if (grant.level !== "none") for (const k of grant.add ?? []) out.add(k);
  return out;
}
export function actionState(def: ModuleAccessDef, grant: ModuleGrant, action: ModuleAction): ActionState {
  const granted = grantedActions(def, grant);
  const checked = granted.has(action.key);
  const inLevel = levelActions(def, grant.level).has(action.key);
  const origin: ActionState["origin"] =
    grant.level === null ? (checked ? "level" : "none")
    : (grant.pending ?? []).includes(action.key) ? "pending"
    : inLevel ? ((grant.mute ?? []).includes(action.key) ? "muted" : "level")
    : checked ? "added" : "none";
  let locked: string | null = null;
  if (!checked) {
    if (grant.level === "none") locked = "先选档位";
    else if (action.minLevel && grant.level !== null && levelRank(grant.level) < levelRank(action.minLevel)) locked = `「${levelLabel(def, action.minLevel)}」档才有`;
    else if (typeof action.grantable === "string") locked = action.grantable;
  }
  return { checked, origin, locked };
}
/** 勾 / 取消一个动作：档位里的记成去掉（mute），档位外的记成加（add）；自定义改 raw。 */
export function toggleAction(def: ModuleAccessDef, grant: ModuleGrant, key: string, on: boolean): ModuleGrant {
  if (grant.level === "none") return grant;
  if (grant.level === null) {
    const raw = new Set(grant.raw ?? []);
    if (on) raw.add(key);
    else raw.delete(key);
    return { ...grant, raw: [...raw] };
  }
  const inLevel = levelActions(def, grant.level).has(key);
  const pending = without(grant.pending, (k) => k === key);
  if (inLevel) {
    const mute = on ? without(grant.mute, (k) => k === key) : uniq([...(grant.mute ?? []), key]);
    return { ...grant, mute, pending };
  }
  const add = on ? uniq([...(grant.add ?? []), key]) : without(grant.add, (k) => k === key);
  return { ...grant, add, pending };
}
/** 处理待确认的高危动作：给 = 不再挂起（档位里的直接生效，档位外的记成加）；不给 = 记成去掉。 */
export function resolvePending(def: ModuleAccessDef, grant: ModuleGrant, key: string, give: boolean): ModuleGrant {
  const pending = without(grant.pending, (k) => k === key);
  const inLevel = levelActions(def, grant.level).has(key);
  if (give) return { ...grant, pending, add: inLevel ? grant.add ?? [] : uniq([...(grant.add ?? []), key]) };
  return { ...grant, pending, mute: inLevel ? uniq([...(grant.mute ?? []), key]) : grant.mute ?? [], add: without(grant.add, (k) => k === key) };
}
/** 换档位：范围回到新档默认；加 / 去掉里和新档重复或无意义的去掉；待确认只留新档里的。选「无」清空。 */
export function setLevel(def: ModuleAccessDef, grant: ModuleGrant, level: AccessLevelId): ModuleGrant {
  if (level === "none") return { level: "none" };
  const actions = levelActions(def, level);
  return {
    level,
    scope: null,
    add: without(grant.level === null ? [] : grant.add, (k) => actions.has(k)),
    mute: without(grant.level === null ? [] : grant.mute, (k) => !actions.has(k)),
    pending: without(grant.pending, (k) => !actions.has(k)),
    ...(grant.fields ? { fields: grant.fields } : {}),
  };
}
/** 「恢复成档位默认」：去掉所有加 / 去掉和字段设置（待确认保留）。 */
export function resetToLevel(grant: ModuleGrant): ModuleGrant {
  return { level: grant.level, scope: grant.scope ?? null, ...(grant.deptIds ? { deptIds: grant.deptIds } : {}), add: [], mute: [], pending: grant.pending ?? [], ...(grant.raw ? { raw: grant.raw } : {}) };
}
export function setScope(grant: ModuleGrant, tier: ScopeTier, deptIds?: readonly string[]): ModuleGrant {
  return { ...grant, scope: tier, ...(tier === "custom" ? { deptIds: deptIds ?? [] } : { deptIds: undefined }) };
}

// ---- 字段三态 ----------------------------------------------------------------------------

export function fieldModeOf(rule: FieldRule | undefined, fallback: FieldMode = "write"): FieldMode {
  if (!rule) return fallback;
  if (rule.read === false) return "hidden";
  if (rule.write === false) return "read";
  if (rule.read === true || rule.write === true) return "write";
  return fallback;
}
/** 设一个字段的三态；等于默认就去掉这一条（存得越少越好）。 */
export function setFieldMode(grant: ModuleGrant, field: ModuleField, mode: FieldMode): ModuleGrant {
  const fields: Record<string, FieldRule> = { ...(grant.fields ?? {}) };
  if (mode === (field.defaultMode ?? "write")) delete fields[field.id];
  else fields[field.id] = mode === "hidden" ? { read: false } : mode === "read" ? { read: true, write: false } : { read: true, write: true };
  return { ...grant, fields };
}
export function fieldCounts(resource: ModuleResource, grant: ModuleGrant, saved?: ModuleGrant) {
  const counts = { write: 0, read: 0, hidden: 0, changed: 0 };
  for (const f of resource.fields ?? []) {
    const mode = fieldModeOf(grant.fields?.[f.id], f.defaultMode);
    counts[mode] += 1;
    if (saved && fieldModeOf(saved.fields?.[f.id], f.defaultMode) !== mode) counts.changed += 1;
  }
  return counts;
}

// ---- 档位推断（「自定义」） ---------------------------------------------------------------

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((k) => b.has(k));
/** 一组动作正好是哪一档；对不上任何一档 = "custom"（编辑器显示「自定义」）。 */
export function levelOf(def: ModuleAccessDef, actions: Iterable<string>): AccessLevelId | "custom" {
  const set = new Set(actions);
  if (!set.size) return "none";
  for (const id of moduleLevels(def)) if (id !== "none" && sameSet(levelActions(def, id), set)) return id;
  return "custom";
}
/** 离一组动作最近的一档（差得最少，平手取低档）：「比「只看自己的」多 1 项」。 */
export function nearestLevel(def: ModuleAccessDef, actions: Iterable<string>): { level: AccessLevelId; extra: string[]; missing: string[] } {
  const set = new Set(actions);
  let best: { level: AccessLevelId; extra: string[]; missing: string[] } = { level: "none", extra: [...set], missing: [] };
  for (const id of moduleLevels(def)) {
    const base = levelActions(def, id);
    const extra = [...set].filter((k) => !base.has(k));
    const missing = [...base].filter((k) => !set.has(k));
    if (extra.length + missing.length < best.extra.length + best.missing.length) best = { level: id, extra, missing };
  }
  return best;
}
/** 宿主的值是自定义（level null）但正好是某一档时，转成那一档（保存时就按档位存）。 */
export function normalizeGrant(def: ModuleAccessDef, grant: ModuleGrant): ModuleGrant {
  if (grant.level !== null) return grant;
  const found = levelOf(def, grant.raw ?? []);
  return found === "custom" ? grant : { level: found, scope: grant.scope ?? null, ...(grant.fields ? { fields: grant.fields } : {}) };
}

// ---- 细调摘要 / 改动 ---------------------------------------------------------------------

export type GrantChip = { kind: "add" | "mute" | "pending" | "default" | "custom" | "fields"; text: string };
/** 「细调情况」一格：加 X / 去掉 X / N 项待确认 / 按档位默认 / 比「X」多 N 项。 */
export function grantChips(def: ModuleAccessDef, grant: ModuleGrant): GrantChip[] {
  if (def.unavailable || grant.level === "none") return [];
  if (grant.level === null) {
    const near = nearestLevel(def, grant.raw ?? []);
    const parts = [near.extra.length ? `多 ${near.extra.length} 项` : "", near.missing.length ? `少 ${near.missing.length} 项` : ""].filter(Boolean);
    return [{ kind: "custom", text: `比「${levelLabel(def, near.level)}」${parts.join("、") || "一样"}` }];
  }
  const chips: GrantChip[] = [];
  const add = grant.add ?? [];
  const mute = grant.mute ?? [];
  const many = (list: readonly string[]) => (list.length > 2 ? `${list.length} 项` : list.map((k) => actionLabel(def, k)).join("、"));
  if (add.length) chips.push({ kind: "add", text: `加 ${many(add)}` });
  if (mute.length) chips.push({ kind: "mute", text: `去掉 ${many(mute)}` });
  const fieldsSet = Object.keys(grant.fields ?? {}).length;
  if (fieldsSet) chips.push({ kind: "fields", text: `字段 ${fieldsSet} 个` });
  if (grant.pending?.length) chips.push({ kind: "pending", text: `${grant.pending.length} 项待确认` });
  if (!chips.length) chips.push({ kind: "default", text: "按档位默认" });
  return chips;
}

export type ModuleChangeLine = {
  kind: "change" | "add" | "remove";
  /** 改的是什么：「档位」「能看到的数据」「导出记录」「字段「成交价」」。 */
  what: string;
  from?: string;
  to?: string;
  /** 一句人话（灰字）。 */
  note?: string;
  risk?: boolean;
  stepUp?: boolean;
};
export type ModuleChange = { moduleId: string; label: string; section: "business" | "system"; icon?: ReactNode; lines: ModuleChangeLine[] };

const sameList = (a: readonly string[] | undefined, b: readonly string[] | undefined) => sameSet(new Set(a ?? []), new Set(b ?? []));
/** 两个值在界面上有没有区别（范围按生效值比，字段按三态比）。 */
export function grantChanged(def: ModuleAccessDef, saved: ModuleGrant, draft: ModuleGrant): boolean {
  return diffModuleGrant(def, saved, draft).length > 0;
}
function actionLine(def: ModuleAccessDef, key: string, kind: "add" | "remove", note: string): ModuleChangeLine {
  const a = actionOf(def, key);
  return { kind, what: a?.label ?? key, note, ...(a?.risk === "high" ? { risk: true } : {}), ...(a?.stepUp ? { stepUp: true } : {}) };
}
/** 一个模块的改动（人话）：档位、范围、加 / 去掉、待确认的决定、字段。 */
export function diffModuleGrant(def: ModuleAccessDef, saved: ModuleGrant, draft: ModuleGrant, labels: ModuleLabels = {}): ModuleChangeLine[] {
  const lines: ModuleChangeLine[] = [];
  if (saved.level !== draft.level)
    lines.push({ kind: "change", what: "档位", from: levelLabel(def, saved.level), to: levelLabel(def, draft.level), ...(draft.level ? { note: levelHint(def, draft.level) } : {}) });
  const s0 = effectiveScope(def, saved);
  const s1 = effectiveScope(def, draft);
  const deptsChanged = s1 === "custom" && s0 === "custom" && !sameList(saved.deptIds, draft.deptIds);
  const levelLine = lines[0];
  // 从「无」/ 不分范围到有范围：并进档位那一行（「档位 无 → 只看，范围 部门及下级」）。
  if (s1 && !s0 && levelLine) levelLine.to = `${levelLine.to}，范围 ${scopeText(s1, labels, draft.deptIds?.length)}`;
  else if (s1 && (s0 !== s1 || deptsChanged)) lines.push({ kind: "change", what: "能看到的数据", from: scopeText(s0, labels, saved.deptIds?.length), to: scopeText(s1, labels, draft.deptIds?.length) });
  if (draft.level === "none") return lines;
  const wasPending = new Set(saved.pending ?? []);
  const isPending = new Set(draft.pending ?? []);
  const granted = grantedActions(def, draft);
  for (const key of wasPending)
    if (!isPending.has(key)) lines.push(granted.has(key) ? actionLine(def, key, "add", "新版本带来的高危权限，确认给这个角色") : actionLine(def, key, "remove", "新版本带来的高危权限，不给（记为去掉）"));
  if (draft.level === null || saved.level === null) {
    const before = grantedActions(def, saved);
    if (draft.level === null && saved.level === null) {
      for (const k of granted) if (!before.has(k) && !wasPending.has(k)) lines.push(actionLine(def, k, "add", "直接勾的"));
      for (const k of before) if (!granted.has(k) && !wasPending.has(k)) lines.push(actionLine(def, k, "remove", "直接去掉的"));
    }
  } else {
    const add0 = new Set(saved.add ?? []);
    const mute0 = new Set(saved.mute ?? []);
    const add1 = new Set(draft.add ?? []);
    const mute1 = new Set(draft.mute ?? []);
    for (const k of add1) if (!add0.has(k) && !wasPending.has(k)) lines.push(actionLine(def, k, "add", "档位里没有，单独加的"));
    for (const k of add0) if (!add1.has(k) && !levelActions(def, draft.level).has(k)) lines.push(actionLine(def, k, "remove", "取消单独加的"));
    for (const k of mute1) if (!mute0.has(k) && !wasPending.has(k)) lines.push(actionLine(def, k, "remove", "记为「已手动去掉」，以后升级也不会加回"));
    for (const k of mute0) if (!mute1.has(k) && levelActions(def, draft.level).has(k)) lines.push(actionLine(def, k, "add", "恢复成档位自带"));
  }
  for (const r of def.resources)
    for (const f of r.fields ?? []) {
      const a = fieldModeOf(saved.fields?.[f.id], f.defaultMode);
      const b = fieldModeOf(draft.fields?.[f.id], f.defaultMode);
      if (a !== b) lines.push({ kind: "change", what: `字段「${f.label}」`, from: FIELD_MODE_LABEL[a], to: FIELD_MODE_LABEL[b] });
    }
  return lines;
}
/** 整个角色的改动，按模块（业务在前、系统管理在后）；PermissionDiff 和改动条都用它。 */
export function diffModuleGrants(defs: readonly ModuleAccessDef[], saved: ModuleGrants, draft: ModuleGrants, labels: ModuleLabels = {}): ModuleChange[] {
  const out: ModuleChange[] = [];
  for (const section of ["business", "system"] as const)
    for (const def of defs) {
      if ((def.section ?? "business") !== section || def.unavailable) continue;
      const lines = diffModuleGrant(def, grantOf(saved, def.id), grantOf(draft, def.id), labels);
      if (lines.length) out.push({ moduleId: def.id, label: section === "system" ? `系统管理 · ${def.label}` : def.label, section, ...(def.icon ? { icon: def.icon } : {}), lines });
    }
  return out;
}
/** 改动条的一行字：「多维表格：只看自己的 → 按范围看、加导出记录 · 组织管理：无 → 只看」。 */
export function changeSummaryText(changes: readonly ModuleChange[]): string {
  return changes
    .map((c) => `${c.label.replace(/^系统管理 · /, "")}：${c.lines.map((l) => (l.kind === "change" ? `${l.from} → ${l.to}` : `${l.kind === "add" ? "加" : "去掉"}${l.what}`)).join("、")}`)
    .join(" · ");
}
/** 所有模块里等确认的高危动作数（「角色与权限」菜单上的数字）。 */
export function pendingCount(grants: ModuleGrants | readonly ModuleGrants[]): number {
  const list = Array.isArray(grants) ? (grants as readonly ModuleGrants[]) : [grants as ModuleGrants];
  return list.reduce((n, g) => n + Object.values(g).reduce((m, v) => m + (v.pending?.length ?? 0), 0), 0);
}

// ---- 影响 / 诊断 -------------------------------------------------------------------------

/** 一项影响：字符串，或带说明 / 高危标的一项。 */
export type ImpactItem = string | { label: string; note?: string; risk?: boolean };
export type ImpactPerson = {
  id: string;
  name: string;
  /** 部门 · 岗位（「销售一部 · 一组」）。 */
  hint?: string;
  gains: readonly ImpactItem[];
  losses: readonly ImpactItem[];
  /** 不变的项及原因（「导入记录 —— 他有个人加」）。 */
  unchanged?: readonly ImpactItem[];
};
/** 保存前试算的影响（服务端试算的 `roleImpact`：holders / affected / people / truncated）。 */
export type PermissionImpact = { total: number; people: readonly ImpactPerson[]; truncated?: boolean };
export function impactCounts(people: readonly ImpactPerson[]) {
  const gain = people.filter((p) => p.gains.length).length;
  const lose = people.filter((p) => p.losses.length).length;
  const same = people.filter((p) => !p.gains.length && !p.losses.length).length;
  return { gain, lose, same };
}
export function impactSentence(impact: PermissionImpact): string {
  const { gain, lose, same } = impactCounts(impact.people);
  const parts = [gain ? `${gain} 人多了权限` : "", lose ? `${lose} 人少了` : "", same ? `${same} 人不变` : ""].filter(Boolean);
  return parts.join("、") || "没有人的权限会变";
}

/** 诊断里一条来源（服务端的 `accessSource.kind`：role / group_role / template / override_allow / override_deny / superuser）。 */
export type ModuleSourceKind = "role" | "group_role" | "template" | "personal_add" | "personal_remove" | "superuser" | "unavailable" | "pending" | "none";
export type ModuleSource = { kind: ModuleSourceKind; label: string; expiresAt?: string };
export const MODULE_SOURCE_TONE: Readonly<Record<ModuleSourceKind, "brand" | "info" | "danger" | "muted" | "attention">> = {
  role: "brand",
  template: "brand",
  group_role: "info",
  personal_add: "brand",
  personal_remove: "danger",
  superuser: "attention",
  unavailable: "muted",
  pending: "attention",
  none: "muted",
};
