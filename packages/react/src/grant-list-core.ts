/**
 * Pure rules of GrantList (bt/records P3, demos D12 / D20): candidate search, picked-entry lookup and
 * the audience sentences (「3 个人看不到这个字段」「现在能看的共 7 人」). No React / DOM.
 */

export type GrantSubjectKind = "user" | "group" | "dept" | "role" | "everyone" | "company" | "line";
/** Someone a grant can go to. `group` is the SharePicker-era flag (same as kind "group"). */
export type GrantSubject = { id: string; name: string; hint?: string; kind?: GrantSubjectKind; group?: boolean };
/**
 * One grant; `name` / `hint` / `kind` let the host show picked subjects that are not in the candidate list.
 * From the org picker (`orgSource`): `path` (华南子公司 › 销售部), `includeSub` on departments / companies;
 * `status: "left"` marks a departed person still on the list (shown 「已离职」, removed only by hand).
 */
export type GrantEntry = { id: string; level: string; name?: string; hint?: string; kind?: GrantSubjectKind; path?: readonly string[]; includeSub?: boolean; status?: "left" | "disabled" };
export type GrantLevel = { value: string; label: string };

export const subjectKind = (s: Pick<GrantSubject, "kind" | "group">): GrantSubjectKind => s.kind ?? (s.group ? "group" : "user");

/** Candidates matching every word of the query (name + hint), minus the ones already picked / locked; at most `limit`. */
export function filterSubjects<T extends GrantSubject>(subjects: readonly T[], query: string, exclude: ReadonlySet<string> = new Set(), limit = 30): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const out: T[] = [];
  for (const s of subjects) {
    if (exclude.has(s.id)) continue;
    const hay = `${s.name} ${s.hint ?? ""}`.toLowerCase();
    if (words.every((w) => hay.includes(w))) out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Suggestions to show: local candidates are filtered by the query here; server results
 * (`searchSubjects`) already matched it (pinyin, e-mail, …), so only the excluded ids are removed.
 */
export function suggestSubjects<T extends GrantSubject>(pool: readonly T[], query: string, exclude: ReadonlySet<string>, fromServer: boolean, limit = 30): T[] {
  return fromServer ? pool.filter((s) => !exclude.has(s.id)).slice(0, limit) : filterSubjects(pool, query, exclude, limit);
}

/** Display data of a picked entry: its own name, else the candidate's, else the id. */
export function resolveEntry(entry: GrantEntry, subjects: readonly GrantSubject[]): Required<Pick<GrantEntry, "id" | "level" | "name">> & { hint?: string; kind: GrantSubjectKind; status?: GrantEntry["status"] } {
  const s = subjects.find((x) => x.id === entry.id);
  return { id: entry.id, level: entry.level, name: entry.name ?? s?.name ?? entry.id, hint: entry.hint ?? s?.hint, kind: entry.kind ?? (s ? subjectKind(s) : "user"), ...(entry.status ? { status: entry.status } : {}) };
}

/**
 * Who can / can't see the thing being granted, as the server computed it. `names` are the first few
 * (the count may be larger: 「… 等」).
 */
export type GrantAudience = {
  hidden?: { count: number; names: readonly string[]; groups?: readonly string[] };
  readers?: { count: number; names: readonly string[]; writers?: number };
};

const list = (names: readonly string[], count: number) => `${names.join("、")}${count > names.length ? " 等" : ""}`;

/**
 * The two banners of D12: warning 「销售、经理看不到这个字段」 + who exactly; info 「现在能看的共 7 人」 + names
 * + the scope note. `subject` names the thing (「这个字段」「这张表」), `where` says where it disappears.
 */
export function grantAudienceText(audience: GrantAudience, options: { subject?: string; where?: string; scopeNote?: string } = {}): { hidden?: { title: string; text: string }; readers?: { title: string; text: string } } {
  const subject = options.subject ?? "这个字段";
  const out: { hidden?: { title: string; text: string }; readers?: { title: string; text: string } } = {};
  const h = audience.hidden;
  if (h && h.count > 0) {
    const who = h.groups?.length ? h.groups.join("、") : `${h.count} 个人`;
    out.hidden = { title: `${who}看不到${subject}`, text: `${list(h.names, h.count)}${h.names.length ? "都" : ""}不在上面的名单里${options.where ? `：${options.where}` : "。"}` };
  }
  const r = audience.readers;
  if (r) {
    const writers = r.writers === undefined ? "" : `，能改的 ${r.writers} 人`;
    out.readers = { title: `现在能看的共 ${r.count} 人${writers}`, text: `${list(r.names, r.count)}${r.names.length ? "。" : ""}${options.scopeNote ?? ""}` };
  }
  return out;
}

/**
 * One change to a grant list in instant mode (GrantList `apply="instant"`, page permissions
 * apply at once, no save button): add a subject, change a level, remove one (with where it was).
 */
export type GrantChange =
  | { type: "add"; entry: GrantEntry }
  | { type: "level"; id: string; level: string; before: string }
  | { type: "remove"; entry: GrantEntry; index: number };

/** The id a change is about (its row). */
export const grantChangeId = (change: GrantChange) => (change.type === "level" ? change.id : change.entry.id);

/** The list after a change (add appends; an add of a present id or a change of a missing one is a no-op). */
export function applyGrantChange(value: readonly GrantEntry[], change: GrantChange): GrantEntry[] {
  if (change.type === "add") return value.some((g) => g.id === change.entry.id) ? [...value] : [...value, change.entry];
  if (change.type === "level") return value.map((g) => (g.id === change.id ? { ...g, level: change.level } : g));
  return value.filter((g) => g.id !== change.entry.id);
}

/**
 * Undo one change on the current list (a failed save puts the old value back; other changes made meanwhile
 * stay): add → removed again, level → the old level, remove → back at its old place.
 */
export function revertGrantChange(value: readonly GrantEntry[], change: GrantChange): GrantEntry[] {
  if (change.type === "add") return value.filter((g) => g.id !== change.entry.id);
  if (change.type === "level") return value.map((g) => (g.id === change.id ? { ...g, level: change.before } : g));
  if (value.some((g) => g.id === change.entry.id)) return [...value];
  const next = [...value];
  next.splice(Math.min(change.index, next.length), 0, change.entry);
  return next;
}

/** 「加上「阿明」」「「阿明」改成「可编辑」」「去掉「阿明」」 — the subject of 「… 没保存：原因」. */
export function grantChangeText(change: GrantChange, levels: readonly GrantLevel[], name: string): string {
  if (change.type === "add") return `加上「${name}」`;
  if (change.type === "remove") return `去掉「${name}」`;
  return `「${name}」改成「${levels.find((l) => l.value === change.level)?.label ?? change.level}」`;
}

/** Picker subject kind → grant kind (person → user; dept / company / role / line as is; anything else → group). */
export function grantKindOf(kind: string): GrantSubjectKind {
  if (kind === "person") return "user";
  if (kind === "dept" || kind === "company" || kind === "role" || kind === "line" || kind === "group") return kind;
  return "group";
}
/** Grant kind → picker subject kind (user → person). */
export const pickerKindOf = (kind: GrantSubjectKind | undefined): string => (!kind || kind === "user" ? "person" : kind);

/** A subject picked in the org picker as a grant entry at `level` (hint = path, 「· 不含下级」 when switched off). */
export function entryFromPick(pick: { kind: string; id: string; label: string; path?: readonly string[]; includeSub?: boolean; status?: "left" | "disabled" }, level: string): GrantEntry {
  const kind = grantKindOf(pick.kind);
  const path = pick.path ?? [];
  const sub = (kind === "dept" || kind === "company" || kind === "group") && pick.includeSub === false ? "不含下级" : "";
  const hint = [path.join(" › "), sub].filter(Boolean).join(" · ") || undefined;
  return { id: pick.id, level, name: pick.label, kind, ...(hint ? { hint } : {}), ...(path.length ? { path } : {}), ...(pick.includeSub === undefined ? {} : { includeSub: pick.includeSub }), ...(pick.status ? { status: pick.status } : {}) };
}

/** 「已授权 · 可读写」 per subject already on the list (and 「默认」 for locked holders): the picker greys them out. */
export function grantedNotes(entries: readonly GrantEntry[], levels: readonly GrantLevel[], locked: readonly { id: string; kind?: GrantSubjectKind; level?: string; tag?: string }[] = [], granted = "已授权"): Record<string, string> {
  const label = (v: string | undefined) => levels.find((l) => l.value === v)?.label ?? v ?? "";
  const out: Record<string, string> = {};
  for (const h of locked) out[`${pickerKindOf(h.kind)}:${h.id}`] = [granted, h.tag ?? "默认"].join(" · ");
  for (const e of entries) out[`${pickerKindOf(e.kind)}:${e.id}`] = [granted, label(e.level)].filter(Boolean).join(" · ");
  return out;
}
