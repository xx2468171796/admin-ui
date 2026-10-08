/**
 * OrgPicker pure rules (review docs/review/org-picker A–I): the data contract a host
 * implements (`OrgDataSource`), the picked-subject shape every picker returns, and the selection model —
 * pick / unpick with single / multiple / max, 「含下级」 covering (a picked department hides its loaded
 * descendants and their people), the half-checked ancestors (aria-checked="mixed"), the deduplicated
 * reach, departed people kept until removed, and the output shape `{ kind, id, label, path, includeSub }`.
 * No React / DOM; unit-tested in test/org-picker-core.test.ts.
 */

/** Tree node kinds: a group (集团) holds companies, a company holds departments. */
export type OrgUnitKind = "group" | "company" | "dept";
/** What can be picked: tree nodes, people, and pluggable kinds from extra tabs (role / line / userGroup …). */
export type SubjectKind = OrgUnitKind | "person" | "role" | "line" | (string & {});
/** Reference to a subject (what availability / existing / resolve are asked about). */
export type SubjectRef = { kind: SubjectKind; id: string };

/**
 * Whether the viewer may pick something. `locked` = grey + lock + reason (「不在你的管理范围，找王总开通」);
 * `partial` = a department the viewer may open but not pick as a whole (only some sub-departments are
 * theirs); `hidden` = not shown at all (another company the viewer can't grant to — the host decides).
 */
export type Availability = { state: "ok" } | { state: "locked" | "partial" | "hidden"; reason?: string };

/** One node of the organisation tree (lazy: children come from `loadChildren`). */
export type OrgUnit = {
  id: string;
  kind: OrgUnitKind;
  label: string;
  parentId: string | null;
  /** People in this node including every sub-department (the 「532」 after the name). */
  memberCount?: number;
  /** People directly in this node (used when 「含下级」 is off); falls back to memberCount. */
  directCount?: number;
  /** Known number of child nodes; 0 = leaf (no arrow). Undefined = ask `loadChildren` when expanded. */
  childCount?: number;
  /** Grey note after the name (「筹备中」). */
  hint?: string;
  /** Short badge (「我」) after the name. */
  badge?: string;
  /** Availability as the server computed it (the `availability` prop wins when both are given). */
  availability?: Availability;
};

/** A person in a member list. */
export type OrgPerson = {
  id: string;
  label: string;
  /** Departments the person belongs to; the first is the primary one. */
  deptIds: readonly string[];
  /** Job title (second line: 「一组组长」). */
  title?: string;
  avatar?: string;
  /** Small tags after the name (「负责人」「我」). */
  badges?: readonly string[];
  /** Right-hand note (「手上 18 / 30」); warning = full. */
  aside?: { text: string; tone?: "neutral" | "warning" };
  /** left = departed, disabled = account disabled: never pickable. */
  status?: "left" | "disabled";
  availability?: Availability;
};

/** A page of a cursor-paged list. `hiddenDeparted` = departed people the server left out (「另有 1 位已离职的不显示」). */
export type OrgPage<T> = { items: readonly T[]; nextCursor?: string; total?: number; hiddenDeparted?: number };

/** A picked subject — the value of OrgPicker / OrgPickerField. */
export type PickedSubject = {
  kind: SubjectKind;
  id: string;
  label: string;
  /** Display path of where it sits, without the group root: ["华南子公司", "销售部", "一组"]. */
  path?: readonly string[];
  /** Departments / companies: also everyone in the sub-departments, now and later (default true). */
  includeSub?: boolean;
  /** Departed / disabled: struck through on the right with a one-click remove; never dropped silently. */
  status?: "left" | "disabled";
  /** Node ids from the root down to the parent (dept) or to the person's department: drives covering and half-checks. */
  ancestors?: readonly string[];
  /** People it covers (department / role / line), for the reach line and 「· 4 人」. */
  count?: number;
  avatar?: string;
};

/** A search result: a subject plus a second line and the matched ranges of the label. */
export type OrgSearchHit = PickedSubject & { sub?: string; title?: string; matched?: readonly (readonly [number, number])[]; badges?: readonly string[]; availability?: Availability };

/** The host's adapter: platform directory, quanxian, a bastion's staff table, any backend. */
export interface OrgDataSource {
  /** Top nodes: usually the group, or the company. */
  roots(): Promise<readonly OrgUnit[]>;
  /** Children of a node (called when it is expanded). */
  loadChildren(nodeId: string): Promise<readonly OrgUnit[]>;
  /** People of a node: `deep` = include sub-departments; cursor paging for big departments. */
  loadMembers(nodeId: string, options: { deep: boolean; cursor?: string; signal?: AbortSignal }): Promise<OrgPage<OrgPerson>>;
  /** Server search across everything the viewer may see (pinyin initials, titles, company names). */
  search(query: string, options: { kinds: readonly SubjectKind[]; limit: number; signal?: AbortSignal }): Promise<readonly OrgSearchHit[]>;
  /** Fill in subjects the picker only has refs of (labels, paths, departed status). */
  resolve(refs: readonly SubjectRef[]): Promise<readonly PickedSubject[]>;
  /** Root → node chain, so `defaultFocus` can expand straight to a node that was never loaded. */
  pathOf?(nodeId: string): Promise<readonly OrgUnit[]>;
}

/** A pluggable tab after 「组织架构」: roles, business lines, companies, recent … */
export type PickerSource = {
  key: string;
  label: string;
  kind: SubjectKind;
  list(options: { query: string; signal?: AbortSignal }): Promise<readonly PickedSubject[]>;
};

/** What a picker hands back: exactly these fields (includeSub only on departments / companies). */
export type OrgPick = { kind: SubjectKind; id: string; label: string; path: readonly string[]; includeSub?: boolean };

export const subjectKey = (s: SubjectRef) => `${s.kind}:${s.id}`;
export const sameSubject = (a: SubjectRef, b: SubjectRef) => a.kind === b.kind && a.id === b.id;
/** Kinds that can carry 「含下级」. */
export const hasSubTree = (kind: SubjectKind) => kind === "dept" || kind === "company" || kind === "group";
const covering = (s: PickedSubject) => hasSubTree(s.kind) && s.includeSub !== false;

/** Loaded tree nodes by id: enough to walk up from anything that was shown. */
export type OrgIndex = ReadonlyMap<string, OrgUnit>;

/** Node ids from the root down to `id` (inclusive) as far as the index knows. */
export function chainOf(index: OrgIndex, id: string | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let at = id ?? null; at && !seen.has(at); at = index.get(at)?.parentId ?? null) {
    seen.add(at);
    out.unshift(at);
  }
  return out;
}

/** Display path of a node chain: labels without the group root (「华南子公司 › 销售部」). */
export function pathLabels(index: OrgIndex, ids: readonly string[]): string[] {
  return ids.map((id) => index.get(id)).filter((n): n is OrgUnit => Boolean(n) && n?.kind !== "group").map((n) => n.label);
}

/** The ancestors of a subject: its own `ancestors`, else walked up through the index. */
export function ancestorsOf(subject: PickedSubject, index: OrgIndex): readonly string[] {
  if (subject.ancestors) return subject.ancestors;
  if (hasSubTree(subject.kind)) return chainOf(index, index.get(subject.id)?.parentId);
  return [];
}

/** A tree node as a picked subject (path = its parents; count from includeSub). */
export function unitSubject(unit: OrgUnit, index: OrgIndex, includeSub = true): PickedSubject {
  const ancestors = chainOf(index, unit.parentId);
  const count = includeSub ? unit.memberCount : (unit.directCount ?? unit.memberCount);
  return { kind: unit.kind, id: unit.id, label: unit.label, path: pathLabels(index, ancestors), includeSub, ancestors, ...(count === undefined ? {} : { count }) };
}

/** A person as a picked subject: path and ancestors from their primary department when it is loaded, else the node they were listed under. */
export function personSubject(person: OrgPerson, index: OrgIndex, listedUnder?: string): PickedSubject {
  const home = person.deptIds.find((d) => index.has(d)) ?? listedUnder;
  const ancestors = chainOf(index, home);
  return { kind: "person", id: person.id, label: person.label, path: pathLabels(index, ancestors), ancestors, ...(person.avatar ? { avatar: person.avatar } : {}), ...(person.status ? { status: person.status } : {}) };
}

/**
 * The picked department / company that already contains `ref` (「已含在「销售部」里」), or null. A
 * department picked without 「含下级」 only contains its direct people.
 */
export function coveredBy(ref: SubjectRef & { ancestors?: readonly string[]; deptIds?: readonly string[] }, value: readonly PickedSubject[], index: OrgIndex): PickedSubject | null {
  const chain = ref.ancestors ?? (hasSubTree(ref.kind) ? chainOf(index, index.get(ref.id)?.parentId) : []);
  const up = new Set(chain);
  for (const s of value) {
    if (!hasSubTree(s.kind) || sameSubject(s, ref)) continue;
    if (covering(s) && up.has(s.id)) return s;
    if (!covering(s) && ref.kind === "person" && (ref.deptIds?.includes(s.id) || chain.at(-1) === s.id)) return s;
  }
  return null;
}

/** Node ids with something picked below them (shown half-checked, aria-checked="mixed"). */
export function mixedIds(value: readonly PickedSubject[], index: OrgIndex): Set<string> {
  const out = new Set<string>();
  for (const s of value) {
    const chain = ancestorsOf(s, index);
    for (const id of chain) out.add(id);
  }
  for (const s of value) if (hasSubTree(s.kind)) out.delete(s.id);
  return out;
}

export type CheckState = "checked" | "mixed" | "unchecked" | "covered";
/** Tick state of a tree node: picked · covered by a picked ancestor · something picked inside · nothing. */
export function nodeCheckState(unit: OrgUnit, value: readonly PickedSubject[], index: OrgIndex, mixed: ReadonlySet<string> = mixedIds(value, index)): CheckState {
  if (value.some((s) => s.kind === unit.kind && s.id === unit.id)) return "checked";
  if (coveredBy({ kind: unit.kind, id: unit.id }, value, index)) return "covered";
  return mixed.has(unit.id) ? "mixed" : "unchecked";
}

export type PickOptions = { mode?: "single" | "multiple"; max?: number };

/** Room for one more pick (multiple mode with `max`). */
export const canAdd = (value: readonly PickedSubject[], options: PickOptions = {}) => options.mode === "single" || options.max === undefined || value.length < options.max;

/**
 * Add a subject. Single mode replaces; multiple appends unless full. A covering department removes the
 * picks it now contains (its descendants and their people), so the list never says the same person twice.
 */
export function pickSubject(value: readonly PickedSubject[], subject: PickedSubject, index: OrgIndex, options: PickOptions = {}): PickedSubject[] {
  if (options.mode === "single") return [subject];
  if (value.some((s) => sameSubject(s, subject))) return [...value];
  if (!canAdd(value, options)) return [...value];
  const next = covering(subject) ? value.filter((s) => !ancestorsOf(s, index).includes(subject.id)) : [...value];
  return [...next, subject];
}

/** Remove a subject (also a departed one — that's the only way it leaves the list). */
export const unpickSubject = (value: readonly PickedSubject[], ref: SubjectRef) => value.filter((s) => !sameSubject(s, ref));

/** Pick or unpick. */
export function togglePick(value: readonly PickedSubject[], subject: PickedSubject, index: OrgIndex, options: PickOptions = {}): PickedSubject[] {
  return value.some((s) => sameSubject(s, subject)) ? unpickSubject(value, subject) : pickSubject(value, subject, index, options);
}

/** Switch 「含下级」 on a picked department / company (turning it on drops the picks it now covers). */
export function setIncludeSub(value: readonly PickedSubject[], ref: SubjectRef, on: boolean, index: OrgIndex): PickedSubject[] {
  const target = value.find((s) => sameSubject(s, ref));
  if (!target || !hasSubTree(target.kind)) return [...value];
  const updated = { ...target, includeSub: on };
  const rest = on ? value.filter((s) => !sameSubject(s, ref) && !ancestorsOf(s, index).includes(ref.id)) : value.filter((s) => !sameSubject(s, ref));
  const at = value.findIndex((s) => sameSubject(s, ref));
  const out = [...rest];
  out.splice(Math.min(at, out.length), 0, updated);
  return out;
}

/** Pick every listed person not yet picked or covered (「全选这些人」), up to `max`. */
export function pickAll(value: readonly PickedSubject[], people: readonly PickedSubject[], index: OrgIndex, options: PickOptions = {}): PickedSubject[] {
  let next = [...value];
  for (const p of people) {
    if (p.status || next.some((s) => sameSubject(s, p)) || coveredBy(p, next, index)) continue;
    if (!canAdd(next, options)) break;
    next = pickSubject(next, p, index, options);
  }
  return next;
}

/**
 * People covered, deduplicated as far as the tree allows: picked departments count their members
 * (direct ones without 「含下级」) unless an ancestor is picked too; people count once unless a picked
 * department contains them. Roles / lines / unknown kinds overlap with departments in ways only the
 * server knows → `exact: false` (show 「约 N 人」, or pass the server's number).
 */
export function reachOf(value: readonly PickedSubject[], index: OrgIndex): { count: number; exact: boolean } {
  let count = 0;
  let exact = true;
  for (const s of value) {
    if (s.status) continue;
    if (s.kind === "person") {
      if (!coveredBy(s, value, index)) count += 1;
      continue;
    }
    if (hasSubTree(s.kind)) {
      if (coveredBy(s, value, index)) continue;
      const unit = index.get(s.id);
      const n = s.includeSub === false ? (unit?.directCount ?? s.count ?? unit?.memberCount) : (unit?.memberCount ?? s.count);
      if (n === undefined) exact = false;
      count += n ?? 0;
      continue;
    }
    exact = false;
    count += s.count ?? 0;
  }
  return { count, exact };
}

/** Departed / disabled subjects still in the list: flagged on the right, kept until removed one by one. */
export const departedOf = (value: readonly PickedSubject[]) => value.filter((s) => s.status === "left" || s.status === "disabled");

/**
 * What 「确定」 changes against the value the picker opened with: added, removed (explicitly), and the
 * departed ones still kept — a permission change is always explicit, nothing disappears by itself.
 */
export function diffPicks(before: readonly PickedSubject[], after: readonly PickedSubject[]): { added: PickedSubject[]; removed: PickedSubject[]; keptDeparted: PickedSubject[] } {
  return {
    added: after.filter((a) => !before.some((b) => sameSubject(a, b))),
    removed: before.filter((b) => !after.some((a) => sameSubject(a, b))),
    keptDeparted: departedOf(after),
  };
}

/** The output shape: `{ kind, id, label, path, includeSub }` (includeSub only for departments / companies). */
export function toOutput(value: readonly PickedSubject[]): OrgPick[] {
  return value.map((s) => ({ kind: s.kind, id: s.id, label: s.label, path: [...(s.path ?? [])], ...(hasSubTree(s.kind) ? { includeSub: s.includeSub !== false } : {}) }));
}

/** Merge resolved data into the value (labels, paths, departed status) without reordering or dropping anything. */
export function mergeResolved(value: readonly PickedSubject[], resolved: readonly PickedSubject[]): PickedSubject[] {
  return value.map((s) => {
    const r = resolved.find((x) => sameSubject(x, s));
    return r ? { ...s, ...r, includeSub: s.includeSub ?? r.includeSub } : s;
  });
}

/** Right-column groups in a fixed order: people, departments, companies, roles, lines, then the rest. */
export const KIND_ORDER: readonly string[] = ["person", "dept", "company", "group", "role", "line"];
export function groupByKind<T extends { kind: SubjectKind }>(items: readonly T[]): { kind: SubjectKind; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.kind, [...(groups.get(item.kind) ?? []), item]);
  const rank = (k: string) => (KIND_ORDER.includes(k) ? KIND_ORDER.indexOf(k) : KIND_ORDER.length);
  return [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([kind, list]) => ({ kind, items: list }));
}

/** Search groups: people / departments + companies / roles / lines / others; each capped at `perGroup` unless expanded. */
export function groupHits(hits: readonly OrgSearchHit[], perGroup = 6, expanded: ReadonlySet<string> = new Set()): { key: string; items: OrgSearchHit[]; more: number }[] {
  const keyOf = (k: SubjectKind) => (k === "person" ? "person" : hasSubTree(k) ? "unit" : k);
  const order = ["person", "unit", "role", "line"];
  const groups = new Map<string, OrgSearchHit[]>();
  for (const h of hits) groups.set(keyOf(h.kind), [...(groups.get(keyOf(h.kind)) ?? []), h]);
  const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length);
  return [...groups.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([key, items]) => ({ key, items: expanded.has(key) ? items : items.slice(0, perGroup), more: expanded.has(key) ? 0 : Math.max(0, items.length - perGroup) }));
}

/** Availability of a subject: the host function first, then what the data said, else ok. */
export function availabilityOf(ref: SubjectRef, fn?: (ref: SubjectRef) => Availability | undefined, own?: Availability): Availability {
  return fn?.(ref) ?? own ?? { state: "ok" };
}

/** Which kinds the picker may return by default: people, departments, companies. */
export const DEFAULT_SELECTABLE: readonly SubjectKind[] = ["person", "dept", "company"];

/**
 * Text of the 「locked」 notice above a department's members: the host's own reason as it is (it usually already
 * says whom to ask), else the default 「不在你的可选范围」 plus `lockedHint` (「跨公司分享要集团管理员开通」).
 */
export function lockedNotice(reason: string | undefined, fallback: string, hint?: string): string {
  if (reason) return reason;
  return hint ? `${fallback}：${hint}` : fallback;
}
