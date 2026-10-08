/**
 * Personal add / deny targets beyond a permission code (D15 「加什么：操作 / 数据范围 / 字段 / 指定记录」).
 * The draft the form edits, its validation into an `OverrideTarget`, and a human label for lists.
 * Pure; unit-tested in test/access-profile-core.test.ts. The server decides whether the editor may
 * grant it (never more than the editor holds) and writes the audit.
 */
import { SCOPE_TIER_LABEL, type MatrixAction, type MatrixResource, type RecordLevel, type ScopeTier } from "./contracts.ts";
import type { OverrideTarget } from "./console-contracts.ts";

export type OverrideTargetKind = OverrideTarget["kind"];
export const OVERRIDE_TARGET_LABEL: Readonly<Record<OverrideTargetKind, string>> = { action: "操作", scope: "数据范围", field: "字段", record: "指定记录" };

/** Everything the form may hold; only the parts of the chosen kind are used. */
export type OverrideTargetDraft = {
  kind: OverrideTargetKind;
  code: string;
  tier: ScopeTier;
  resource: string;
  field: string;
  ability: "read" | "write";
  recordId: string;
  recordLabel: string;
  level: Extract<RecordLevel, "viewer" | "editor">;
};
export const EMPTY_TARGET_DRAFT: OverrideTargetDraft = { kind: "action", code: "", tier: "own", resource: "", field: "", ability: "read", recordId: "", recordLabel: "", level: "viewer" };

/** Draft → target, or the reason it is not complete yet. */
export function draftToTarget(draft: OverrideTargetDraft): { target: OverrideTarget } | { error: string } {
  switch (draft.kind) {
    case "action":
      return draft.code ? { target: { kind: "action", code: draft.code } } : { error: "请选择权限" };
    case "scope":
      if (!draft.code) return { error: "请选择哪个动作的数据范围" };
      if (draft.tier === "custom") return { error: "单独加的数据范围只能选档位，指定部门请在角色里配" };
      return { target: { kind: "scope", code: draft.code, scope: { tier: draft.tier } } };
    case "field":
      if (!draft.resource || !draft.field) return { error: "请选择字段" };
      return { target: { kind: "field", resource: draft.resource, field: draft.field, ability: draft.ability } };
    case "record":
      if (!draft.resource || !draft.recordId) return { error: "请选择记录" };
      return { target: { kind: "record", resource: draft.resource, recordId: draft.recordId, ...(draft.recordLabel ? { recordLabel: draft.recordLabel } : {}), level: draft.level } };
  }
}

/** 「字段 · 客户.成交价 可读写」 / 「指定记录 · 张家豪 · 可读写」 / 「数据范围 · 查看客户 本部门」. */
export function targetLabel(target: OverrideTarget, resources: readonly MatrixResource[] = [], codeLabel: (code: string) => string = (c) => c): string {
  const res = (id: string) => resources.find((r) => r.id === id);
  switch (target.kind) {
    case "action":
      return codeLabel(target.code);
    case "scope":
      return `${OVERRIDE_TARGET_LABEL.scope} · ${codeLabel(target.code)} ${SCOPE_TIER_LABEL[target.scope.tier]}`;
    case "field": {
      const r = res(target.resource);
      const f = r?.fields?.find((x) => x.id === target.field);
      return `${OVERRIDE_TARGET_LABEL.field} · ${r?.label ?? target.resource}.${f?.label ?? target.field} ${target.ability === "write" ? "可读写" : "可读"}`;
    }
    case "record":
      return `${OVERRIDE_TARGET_LABEL.record} · ${target.recordLabel ?? target.recordId} · ${target.level === "editor" ? "可读写" : "可读"}`;
  }
}

/** Which kinds the form offers: action always; the others only when the adapter and catalog support them. */
export function targetKinds(opts: { targeted: boolean; scoped: boolean; fields: boolean; records: boolean }): OverrideTargetKind[] {
  if (!opts.targeted) return ["action"];
  return (["action", "scope", "field", "record"] as const).filter((k) => k === "action" || (k === "scope" && opts.scoped) || (k === "field" && opts.fields) || (k === "record" && opts.records));
}

/** An existing override back into the form (targeted ones keep their target; classic ones are `action`). */
export function targetToDraft(target: OverrideTarget | undefined, code: string): OverrideTargetDraft {
  if (!target) return { ...EMPTY_TARGET_DRAFT, kind: "action", code };
  switch (target.kind) {
    case "action":
      return { ...EMPTY_TARGET_DRAFT, kind: "action", code: target.code };
    case "scope":
      return { ...EMPTY_TARGET_DRAFT, kind: "scope", code: target.code, tier: target.scope.tier };
    case "field":
      return { ...EMPTY_TARGET_DRAFT, kind: "field", resource: target.resource, field: target.field, ability: target.ability };
    case "record":
      return { ...EMPTY_TARGET_DRAFT, kind: "record", resource: target.resource, recordId: target.recordId, recordLabel: target.recordLabel ?? "", level: target.level };
  }
}

/** Do two drafts name the same target (only the chosen kind's parts count; a record's display label does not)? */
export function sameTargetDraft(a: OverrideTargetDraft, b: OverrideTargetDraft): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "action":
      return a.code === b.code;
    case "scope":
      return a.code === b.code && a.tier === b.tier;
    case "field":
      return a.resource === b.resource && a.field === b.field && a.ability === b.ability;
    case "record":
      return a.resource === b.resource && a.recordId === b.recordId && a.level === b.level;
  }
}

/** Codes whose action carries a data scope (「customer:read」 with action `read` scoped). */
export function scopedCodeOptions<O extends { value: string }>(options: readonly O[], actions: readonly MatrixAction[]): O[] {
  const scoped = new Set(actions.filter((a) => a.scoped).map((a) => a.id));
  return options.filter((o) => {
    const cut = o.value.search(/[.:](?=[^.:]*$)/);
    return cut > 0 && scoped.has(o.value.slice(cut + 1));
  });
}
