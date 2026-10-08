/**
 * `@adminui/react/record-detail-spec` — the arrangement of a record detail (RecordDetail /
 * RecordLayout.cards) as plain JSON, and the pure rules that keep it valid. No React, no DOM: the
 * server validates what a user saved with the same `normalizeRecordDetailSpec` the browser uses.
 *
 * A spec is `{ preset, blocks, hidden }`:
 * - `preset` picks the drawing: `cards` (soft cards: stage + key numbers on top, wide main column,
 *   side column of section cards), `single` (one column), `split` (fields left, activity right).
 * - `blocks` in order; each sits in the `main` or `side` column. Kinds: `stage` (progress path),
 *   `keyNumbers` (up to 4 figures), `section` (a titled group of field keys), `slot` (a block the host
 *   draws: activity feed, comments, a subtable — referenced by id).
 * - `hidden` = block ids and field keys the user hid (restorable; a hidden field keeps its place).
 *
 * Unit-tested in test/record-detail-spec.test.ts.
 */

export type RecordDetailPreset = "cards" | "single" | "split";
export type RecordDetailColumn = "main" | "side";
export type RecordDetailBlockKind = "stage" | "keyNumbers" | "section" | "slot";
export type RecordDetailBlock = {
  id: string;
  kind: RecordDetailBlockKind;
  column: RecordDetailColumn;
  /** Section heading (sections); a slot may override the host's title. */
  title?: string;
  /** Field keys of a section, in order (sections only). */
  fields?: string[];
  /** Starts folded (the user can unfold it while reading). */
  collapsed?: boolean;
  /** Empty fields fold into 「N 个空字段已收起 · 显示」 (sections; default true). */
  hideEmpty?: boolean;
};
export type RecordDetailSpec = {
  preset: RecordDetailPreset;
  blocks: RecordDetailBlock[];
  hidden: string[];
  /** Keys of the key numbers to show, in order (at most 4); left out = the host's first 4. */
  keyNumbers?: string[];
};
/** Where a saved arrangement goes: everybody's default (admins) or only the current user's. */
export type RecordDetailScope = "default" | "mine";

/** What the host can draw for a record: field keys (default order), slot ids, and whether it has a stage / key numbers. */
export type RecordDetailCatalog = {
  fields: readonly string[];
  slots?: readonly string[];
  stage?: boolean;
  keyNumbers?: boolean;
  /** Keys of the key numbers the host can show (checks `spec.keyNumbers`; leave out to accept any). */
  keyNumberKeys?: readonly string[];
};
/** A starting group of fields (the host's own grouping) for defaultRecordDetailSpec. */
export type RecordDetailSectionSeed = { id: string; title: string; fields: readonly string[]; column?: RecordDetailColumn; collapsed?: boolean };

export const RECORD_DETAIL_PRESETS: readonly RecordDetailPreset[] = ["cards", "single", "split"];
export const RECORD_DETAIL_PRESET_LABELS: Readonly<Record<RecordDetailPreset, string>> = { cards: "卡片分区", single: "单栏", split: "左右分栏" };
export const RECORD_DETAIL_SCOPE_LABELS: Readonly<Record<RecordDetailScope, string>> = { default: "团队默认", mine: "只改我的" };
/** Id and title of the section that collects fields no section names. */
export const RECORD_DETAIL_OTHER_SECTION = "other";
export const RECORD_DETAIL_OTHER_TITLE = "其他字段";
export const RECORD_KEY_NUMBER_LIMIT = 4;
export const RECORD_SECTION_TITLE_MAX = 40;
const ID_MAX = 64;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const cleanId = (value: unknown) => (typeof value === "string" && value.trim() && value.length <= ID_MAX ? value.trim() : null);
const cleanTitle = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, RECORD_SECTION_TITLE_MAX) : undefined);
const KINDS: readonly RecordDetailBlockKind[] = ["stage", "keyNumbers", "section", "slot"];

/** Default column of a block kind: sections on the side, everything else in the main column. */
export const defaultRecordDetailColumn = (kind: RecordDetailBlockKind): RecordDetailColumn => (kind === "section" ? "side" : "main");

/** At most RECORD_KEY_NUMBER_LIMIT key numbers (the rest are dropped, in order). */
export const limitKeyNumbers = <K>(items: readonly K[]): K[] => items.slice(0, RECORD_KEY_NUMBER_LIMIT);

/**
 * The spec a record starts with: stage, key numbers and slots in the main column, the host's sections
 * (or one 「字段」 section with every field) on the side; then normalized (fields no section names go to
 * 「其他字段」).
 */
export function defaultRecordDetailSpec(catalog: RecordDetailCatalog & { sections?: readonly RecordDetailSectionSeed[]; preset?: RecordDetailPreset }): RecordDetailSpec {
  const blocks: RecordDetailBlock[] = [];
  if (catalog.stage) blocks.push({ id: "stage", kind: "stage", column: "main" });
  if (catalog.keyNumbers) blocks.push({ id: "keyNumbers", kind: "keyNumbers", column: "main" });
  for (const id of catalog.slots ?? []) blocks.push({ id, kind: "slot", column: "main" });
  const seeds = catalog.sections?.length ? catalog.sections : [{ id: "fields", title: "字段", fields: catalog.fields }];
  for (const seed of seeds) blocks.push({ id: seed.id, kind: "section", column: seed.column ?? "side", title: seed.title, fields: [...seed.fields], ...(seed.collapsed ? { collapsed: true } : {}) });
  return normalizeRecordDetailSpec({ preset: catalog.preset ?? "cards", blocks, hidden: [] }, catalog);
}

/**
 * Make any input (a saved JSON, an old version, garbage) a valid spec for this catalog:
 * - unknown preset → `fallback.preset` / cards; unknown kinds, duplicate / empty ids dropped; a bad
 *   column → the kind's default column;
 * - stage / key numbers only when the catalog has them, at most one each; slots only the catalog's
 *   (missing ones are appended to the main column, a missing stage / key numbers goes first);
 * - each known field in one section only (first wins), unknown keys dropped; fields no section names
 *   go to 「其他字段」 (created at the end of the side column when needed); an empty 「其他字段」 is removed;
 * - `hidden` keeps only known block ids / field keys, once each; `keyNumbers` keeps known keys, once
 *   each, at most 4 (dropped when the catalog has no key numbers or the input has none).
 * Input without any blocks starts from `fallback` (or the catalog default).
 */
export function normalizeRecordDetailSpec(input: unknown, catalog: RecordDetailCatalog, fallback?: RecordDetailSpec): RecordDetailSpec {
  const raw = isObject(input) ? input : {};
  const rawBlocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  if (!rawBlocks.length) {
    const base = fallback?.blocks.length ? fallback : defaultRecordDetailSpec(catalog);
    return normalizeRecordDetailSpec({ preset: RECORD_DETAIL_PRESETS.includes(raw.preset as RecordDetailPreset) ? raw.preset : base.preset, blocks: base.blocks, hidden: Array.isArray(raw.hidden) ? raw.hidden : base.hidden }, catalog, base);
  }
  const preset = RECORD_DETAIL_PRESETS.includes(raw.preset as RecordDetailPreset) ? (raw.preset as RecordDetailPreset) : fallback?.preset ?? "cards";
  const known = new Set(catalog.fields);
  const slots = new Set(catalog.slots ?? []);
  const ids = new Set<string>();
  const placed = new Set<string>();
  const blocks: RecordDetailBlock[] = [];
  for (const item of rawBlocks) {
    if (!isObject(item)) continue;
    const id = cleanId(item.id);
    const kind = KINDS.includes(item.kind as RecordDetailBlockKind) ? (item.kind as RecordDetailBlockKind) : null;
    if (!id || !kind || ids.has(id)) continue;
    if (kind === "stage" && (!catalog.stage || blocks.some((b) => b.kind === "stage"))) continue;
    if (kind === "keyNumbers" && (!catalog.keyNumbers || blocks.some((b) => b.kind === "keyNumbers"))) continue;
    if (kind === "slot" && !slots.has(id)) continue;
    const column = item.column === "main" || item.column === "side" ? item.column : defaultRecordDetailColumn(kind);
    const block: RecordDetailBlock = { id, kind, column };
    const title = cleanTitle(item.title);
    if (title && (kind === "section" || kind === "slot")) block.title = title;
    if (item.collapsed === true) block.collapsed = true;
    if (kind === "section") {
      const fields: string[] = [];
      for (const key of Array.isArray(item.fields) ? item.fields : []) {
        if (typeof key !== "string" || !known.has(key) || placed.has(key)) continue;
        placed.add(key);
        fields.push(key);
      }
      block.fields = fields;
      if (!block.title) block.title = id === RECORD_DETAIL_OTHER_SECTION ? RECORD_DETAIL_OTHER_TITLE : "未命名分区";
      if (item.hideEmpty === false) block.hideEmpty = false;
    }
    ids.add(id);
    blocks.push(block);
  }
  // Blocks the host has but the spec forgot.
  const lead: RecordDetailBlock[] = [];
  if (catalog.stage && !blocks.some((b) => b.kind === "stage") && !ids.has("stage")) lead.push({ id: "stage", kind: "stage", column: "main" });
  if (catalog.keyNumbers && !blocks.some((b) => b.kind === "keyNumbers") && !ids.has("keyNumbers")) lead.push({ id: "keyNumbers", kind: "keyNumbers", column: "main" });
  lead.forEach((b) => ids.add(b.id));
  blocks.unshift(...lead);
  for (const id of catalog.slots ?? []) if (!ids.has(id)) {
    ids.add(id);
    blocks.push({ id, kind: "slot", column: "main" });
  }
  // Fields no section names → 「其他字段」.
  const loose = catalog.fields.filter((key) => !placed.has(key));
  let other = blocks.find((b) => b.id === RECORD_DETAIL_OTHER_SECTION && b.kind === "section");
  if (loose.length) {
    if (!other) {
      const id = ids.has(RECORD_DETAIL_OTHER_SECTION) ? uniqueId(ids, RECORD_DETAIL_OTHER_SECTION) : RECORD_DETAIL_OTHER_SECTION;
      other = { id, kind: "section", column: "side", title: RECORD_DETAIL_OTHER_TITLE, fields: [] };
      ids.add(id);
      blocks.push(other);
    }
    other.fields = [...(other.fields ?? []), ...loose];
  } else if (other && !other.fields?.length) blocks.splice(blocks.indexOf(other), 1);
  const visibleIds = new Set([...blocks.map((b) => b.id), ...catalog.fields]);
  const hidden = [...new Set((Array.isArray(raw.hidden) ? raw.hidden : []).filter((x): x is string => typeof x === "string" && visibleIds.has(x)))];
  const spec: RecordDetailSpec = { preset, blocks, hidden };
  if (catalog.keyNumbers && Array.isArray(raw.keyNumbers)) {
    const keys = catalog.keyNumberKeys ? new Set(catalog.keyNumberKeys) : null;
    spec.keyNumbers = limitKeyNumbers([...new Set(raw.keyNumbers.filter((k): k is string => typeof k === "string" && (!keys || keys.has(k))))]);
  }
  return spec;
}

/** The key numbers to draw: in `spec.keyNumbers` order when set, else the first 4. */
export function pickKeyNumbers<K extends { key: string }>(items: readonly K[], spec: Pick<RecordDetailSpec, "keyNumbers">): K[] {
  if (!spec.keyNumbers) return limitKeyNumbers(items);
  const byKey = new Map(items.map((item) => [item.key, item]));
  return limitKeyNumbers(spec.keyNumbers.flatMap((key) => byKey.get(key) ?? []));
}

/** Choose the key numbers (order kept, unknown order = as given, at most 4). */
export const setRecordDetailKeyNumbers = (spec: RecordDetailSpec, keys: readonly string[]): RecordDetailSpec => ({ ...spec, keyNumbers: limitKeyNumbers([...new Set(keys)]) });

const uniqueId = (taken: ReadonlySet<string>, base: string) => {
  for (let i = 2; ; i += 1) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
};

/** Same arrangement (for 「完成」 without changes, dirty checks). */
export const recordDetailSpecEqual = (a: RecordDetailSpec, b: RecordDetailSpec) => JSON.stringify(a) === JSON.stringify(b);

/**
 * How a preset lays the blocks out: `top` = full-width band above the columns (stage / key numbers
 * of the main column in `cards` and `split`), then `first` / `second` = left / right columns. `cards`:
 * left = main, right = side; `split`: left = side (fields), right = main (activity); `single`: one
 * column, main then side. Phones always read top, main, side.
 */
export function recordDetailPlacement(spec: RecordDetailSpec, preset: RecordDetailPreset = spec.preset): { top: RecordDetailBlock[]; first: RecordDetailBlock[]; second: RecordDetailBlock[] } {
  const main = spec.blocks.filter((b) => b.column === "main");
  const side = spec.blocks.filter((b) => b.column === "side");
  if (preset === "single") return { top: [], first: [...main, ...side], second: [] };
  const banded = (b: RecordDetailBlock) => b.kind === "stage" || b.kind === "keyNumbers";
  const top = main.filter(banded);
  const rest = main.filter((b) => !banded(b));
  return preset === "split" ? { top, first: side, second: rest } : { top, first: rest, second: side };
}

// ---------------------------------------------------------------- edits (all return a new spec)

/** Move a block to `column`, before block `before` (null = at the end of that column). Unknown ids: unchanged. */
export function moveRecordDetailBlock(spec: RecordDetailSpec, id: string, column: RecordDetailColumn, before: string | null): RecordDetailSpec {
  const block = spec.blocks.find((b) => b.id === id);
  if (!block || before === id) return spec;
  const rest = spec.blocks.filter((b) => b.id !== id);
  const moved = { ...block, column };
  let at = before === null ? -1 : rest.findIndex((b) => b.id === before);
  if (at < 0) {
    // End of the column: after its last block (or at the end of the list).
    const last = rest.map((b) => b.column).lastIndexOf(column);
    at = last < 0 ? rest.length : last + 1;
  }
  return { ...spec, blocks: [...rest.slice(0, at), moved, ...rest.slice(at)] };
}

/**
 * One keyboard step of a block among the blocks `visible` in its column (hidden blocks are skipped):
 * -1 = above the previous one, 1 = below the next one. Null at the edge.
 */
export function stepRecordDetailBlock(spec: RecordDetailSpec, id: string, dir: -1 | 1, visible: (block: RecordDetailBlock) => boolean = () => true): RecordDetailSpec | null {
  const block = spec.blocks.find((b) => b.id === id);
  if (!block) return null;
  const column = spec.blocks.filter((b) => b.column === block.column && (b.id === id || visible(b)));
  const at = column.findIndex((b) => b.id === id);
  const neighbour = column[at + dir];
  if (!neighbour) return null;
  const before = dir === -1 ? neighbour.id : column[at + 2]?.id ?? null;
  return moveRecordDetailBlock(spec, id, block.column, before);
}

/** Move a field to section `section`, before field `before` (null = last). Unknown field / section: unchanged. */
export function moveRecordDetailField(spec: RecordDetailSpec, key: string, section: string, before: string | null): RecordDetailSpec {
  if (!spec.blocks.some((b) => b.id === section && b.kind === "section") || !spec.blocks.some((b) => b.fields?.includes(key))) return spec;
  const blocks = spec.blocks.map((b) => (b.fields?.includes(key) ? { ...b, fields: b.fields.filter((k) => k !== key) } : b));
  return {
    ...spec,
    blocks: blocks.map((b) => {
      if (b.id !== section) return b;
      const fields = [...(b.fields ?? [])];
      const at = before === null ? -1 : fields.indexOf(before);
      fields.splice(at < 0 ? fields.length : at, 0, key);
      return { ...b, fields };
    }),
  };
}

/** Hide / show a block or a field. */
export function setRecordDetailHidden(spec: RecordDetailSpec, id: string, hidden: boolean): RecordDetailSpec {
  const has = spec.hidden.includes(id);
  if (has === hidden) return spec;
  return { ...spec, hidden: hidden ? [...spec.hidden, id] : spec.hidden.filter((x) => x !== id) };
}

/** Change one block's own settings (title, collapsed, hideEmpty). Titles are trimmed and capped; an empty title is ignored. */
export function updateRecordDetailBlock(spec: RecordDetailSpec, id: string, patch: Partial<Pick<RecordDetailBlock, "title" | "collapsed" | "hideEmpty">>): RecordDetailSpec {
  return {
    ...spec,
    blocks: spec.blocks.map((b) => {
      if (b.id !== id) return b;
      const next = { ...b };
      if (patch.title !== undefined) {
        const title = cleanTitle(patch.title);
        if (title) next.title = title;
      }
      if (patch.collapsed !== undefined) {
        if (patch.collapsed) next.collapsed = true;
        else delete next.collapsed;
      }
      if (patch.hideEmpty !== undefined && b.kind === "section") {
        if (patch.hideEmpty) delete next.hideEmpty;
        else next.hideEmpty = false;
      }
      return next;
    }),
  };
}

/** A new empty section at the end of `column` (default side); returns the spec and the new id (`section-N`). */
export function addRecordDetailSection(spec: RecordDetailSpec, title = "新分区", column: RecordDetailColumn = "side"): { spec: RecordDetailSpec; id: string } {
  const id = uniqueId(new Set(spec.blocks.map((b) => b.id)), "section");
  const block: RecordDetailBlock = { id, kind: "section", column, title: cleanTitle(title) ?? "新分区", fields: [] };
  return { spec: moveRecordDetailBlock({ ...spec, blocks: [...spec.blocks, block] }, id, column, null), id };
}

/**
 * Delete a section; its fields move to the end of 「其他字段」 (created on the side when needed). The
 * 「其他字段」 section itself gives its fields to the first other section, and cannot go when it is the
 * only section with fields (null).
 */
export function removeRecordDetailSection(spec: RecordDetailSpec, id: string): RecordDetailSpec | null {
  const block = spec.blocks.find((b) => b.id === id && b.kind === "section");
  if (!block) return null;
  const fields = block.fields ?? [];
  let blocks = spec.blocks.filter((b) => b.id !== id);
  const hidden = spec.hidden.filter((x) => x !== id);
  if (!fields.length) return { ...spec, blocks, hidden };
  let heir = id === RECORD_DETAIL_OTHER_SECTION ? blocks.find((b) => b.kind === "section") : blocks.find((b) => b.id === RECORD_DETAIL_OTHER_SECTION && b.kind === "section");
  if (!heir) {
    if (id === RECORD_DETAIL_OTHER_SECTION) return null;
    heir = { id: RECORD_DETAIL_OTHER_SECTION, kind: "section", column: "side", title: RECORD_DETAIL_OTHER_TITLE, fields: [] };
    blocks = [...blocks, heir];
  }
  const target = heir.id;
  return { ...spec, hidden, blocks: blocks.map((b) => (b.id === target ? { ...b, fields: [...(b.fields ?? []), ...fields] } : b)) };
}

export const setRecordDetailPreset = (spec: RecordDetailSpec, preset: RecordDetailPreset): RecordDetailSpec => (spec.preset === preset ? spec : { ...spec, preset });

// ---------------------------------------------------------------- field tree (SortableList)

/** Sections as groups holding their fields, the shape SortableList edits (field organizer). */
export type RecordDetailFieldNode = { id: string; children?: RecordDetailFieldNode[] };
/** In reading order (recordDetailPlacement: top, left column, right column). */
export function recordDetailFieldTree(spec: RecordDetailSpec): RecordDetailFieldNode[] {
  const { top, first, second } = recordDetailPlacement(spec);
  return [...top, ...first, ...second].filter((b) => b.kind === "section").map((b) => ({ id: b.id, children: (b.fields ?? []).map((key) => ({ id: key })) }));
}
/**
 * Apply a reordered field tree: section order (kept within each column, a section never changes column
 * here) and field membership / order. Nodes that are not sections of the spec are ignored.
 */
export function applyRecordDetailFieldTree(spec: RecordDetailSpec, tree: readonly RecordDetailFieldNode[]): RecordDetailSpec {
  const sections = new Map(spec.blocks.filter((b) => b.kind === "section").map((b) => [b.id, b]));
  const order = tree.filter((n) => sections.has(n.id));
  const fieldsOf = new Map(order.map((n) => [n.id, (n.children ?? []).map((c) => c.id)]));
  const rank = new Map(order.map((n, i) => [n.id, i]));
  // Sections keep the slots they had in the block list; which section fills which slot follows the tree (per column).
  const queues: Record<RecordDetailColumn, RecordDetailBlock[]> = { main: [], side: [] };
  for (const n of order) {
    const block = sections.get(n.id)!;
    queues[block.column].push(block);
  }
  queues.main.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  queues.side.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  const blocks = spec.blocks.map((b) => {
    if (b.kind !== "section" || !fieldsOf.has(b.id)) return b;
    const next = queues[b.column].shift() ?? b;
    return { ...next, fields: fieldsOf.get(next.id) ?? next.fields ?? [] };
  });
  return { ...spec, blocks };
}

/** Field keys of a section that are hidden by the user, and the blocks the user hid (in spec order). */
export function recordDetailHiddenItems(spec: RecordDetailSpec): { blocks: RecordDetailBlock[]; fields: string[] } {
  const hidden = new Set(spec.hidden);
  const blocks = spec.blocks.filter((b) => hidden.has(b.id));
  const fields = spec.blocks.flatMap((b) => b.fields ?? []).filter((key) => hidden.has(key));
  return { blocks, fields };
}

/**
 * Split a section's field keys for reading: `shown` in order and `folded` = empty ones folded into
 * 「N 个空字段已收起 · 显示」 (when the section hides empty fields; `keep` = always stay, e.g. showEmpty).
 */
export function foldRecordDetailFields(keys: readonly string[], isEmpty: (key: string) => boolean, options: { hideEmpty?: boolean; keep?: (key: string) => boolean } = {}): { shown: string[]; folded: string[] } {
  const shown: string[] = [];
  const folded: string[] = [];
  const hide = options.hideEmpty ?? true;
  for (const key of keys) {
    if (hide && isEmpty(key) && !options.keep?.(key)) folded.push(key);
    else shown.push(key);
  }
  return { shown, folded };
}

// ---------------------------------------------------------------- stage path

/**
 * One step of a stage path (StagePath, the stage block). `kind` lost / void = an exit (丢单、作废):
 * not drawn in the path but in its trailing 「更多」 menu. `state` is only read when the path gets no
 * `current`: with `current`, steps before it are done, it is current, steps after it are todo — a stale
 * `state` (a step visited earlier, before the record moved back) never fills a later step. `days` =
 * time spent in the step (a step visited earlier keeps its days but stays todo).
 */
export type StagePathStep = {
  id: string;
  label: string;
  state?: "done" | "current" | "todo" | "lost";
  kind?: "normal" | "lost" | "void";
  days?: number;
  tone?: "brand" | "success" | "attention" | "danger";
};
export type ResolvedStageStep = StagePathStep & { state: "done" | "current" | "todo" | "lost"; kind: "normal" | "lost" | "void" };

/**
 * The path's steps with states filled in and split: `path` = normal steps, `exits` = lost / void steps;
 * `current` = the current step (an exit when the record left the path), `position` = 1-based place of
 * the current step in the path (0 when it is an exit or missing), `next` = the path step after it.
 */
export function resolveStagePath(steps: readonly StagePathStep[], current?: string | null): { path: ResolvedStageStep[]; exits: ResolvedStageStep[]; current: ResolvedStageStep | null; position: number; next: ResolvedStageStep | null } {
  const currentId = current ?? steps.find((s) => s.state === "current" || s.state === "lost")?.id ?? null;
  const pathSteps = steps.filter((s) => (s.kind ?? "normal") === "normal");
  const currentIndex = currentId === null ? -1 : pathSteps.findIndex((s) => s.id === currentId);
  // `current` given = the only truth: positions decide (a stale host `state` must not fill a step after it).
  const given = current !== undefined && current !== null;
  const derived = (s: StagePathStep, i: number): ResolvedStageStep["state"] =>
    (s.kind ?? "normal") !== "normal" ? (s.id === currentId ? "lost" : "todo") : currentIndex < 0 ? "todo" : i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";
  const resolve = (s: StagePathStep, i: number): ResolvedStageStep => ({
    ...s,
    kind: s.kind ?? "normal",
    state: given ? derived(s, i) : s.state ?? derived(s, i),
  });
  const path = pathSteps.map(resolve);
  const exits = steps.filter((s) => (s.kind ?? "normal") !== "normal").map((s) => resolve(s, -1));
  const all = [...path, ...exits];
  const cur = all.find((s) => s.id === currentId) ?? null;
  const position = currentIndex + 1;
  return { path, exits, current: cur, position, next: currentIndex >= 0 ? path[currentIndex + 1] ?? null : null };
}
