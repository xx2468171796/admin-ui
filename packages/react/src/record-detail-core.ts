/**
 * Pure model of the record-detail standard (record-detail.tsx): the three levels, which fields each
 * level shows, the URL parameter that deep-links an open record, and the keyboard shortcuts. No
 * React runtime and no DOM: unit-tested in test/record-detail-core.test.ts.
 *
 * Levels (see INTEGRATION.md「记录详情」):
 * - `peek`: small centered dialog (≈480px), the record's key fields at a glance + 1–2 actions.
 * - `expanded`: large centered dialog (50–92vw × up to 88dvh): header with status / highlights /
 *   prev-next / open-as-page, tabs, sectioned fields in a grid, a meta rail on the right.
 * - `page`: the record's own route, full screen (RecordPage): highlights as KPI cards, charts,
 *   related tables, timeline. Reached through `layout.href`.
 */
import type { ReactNode } from "react";
import type { RecordDetailScope, RecordDetailSpec, StagePathStep } from "./record-detail-spec.ts";
import type { OptionTone } from "./option-tone.ts";
/** Tone of StatusBadge. */
export type RecordTone = "neutral" | "success" | "warning" | "danger" | "brand";
/** A coloured tag next to the title; `tone` = an option colour (10 hues + solid, old 7 names too). */
export type RecordBadge = { key?: string; label: string; tone?: OptionTone; title?: string };
/** One part of the header's meta line: text / a node, or a person (small initial avatar + name + optional 「负责」). */
export type RecordMetaPart = string | { person: string; suffix?: string } | { node: ReactNode; key: string };

export type RecordDetailLevel = "peek" | "expanded" | "page";
export const RECORD_DETAIL_LEVELS: readonly RecordDetailLevel[] = ["peek", "expanded", "page"];
export const RECORD_LEVEL_LABELS: Readonly<Record<RecordDetailLevel, string>> = { peek: "简要", expanded: "详情", page: "整页" };

/** One labelled value of a record. */
export type RecordField<T> = {
  key: string;
  label: string;
  /** Display value (null / undefined / "" show as —). */
  value: (row: T) => ReactNode;
  /** Plain text: copy button, emptiness test and the peek-level summary (default: value when it is a string / number). */
  text?: (row: T) => string;
  /** Take the whole row of the section grid (long text, JSON, tags, addresses). */
  full?: boolean;
  /** Show a copy button next to the value (needs `text` or a string value). */
  copy?: boolean;
  hint?: ReactNode;
  /** Part of the peek level (when no field of the layout sets it, the first PEEK_FIELD_LIMIT filled fields are used). */
  peek?: boolean;
  /** Leave the field out when empty, not even in the 「未填写」 line. */
  hideEmpty?: boolean;
  /** Keep the field in place with — when empty (default: empty fields move to one 「未填写：…」 line at the end of the section). */
  showEmpty?: boolean;
  /** Small icon before the label (lucide icon element) — not for descriptions (use `description`). */
  icon?: ReactNode;
  /**
   * What the field means (the user-written field description): a hover tooltip on the label and read
   * by screen readers — never an ⓘ icon or an extra line in the detail.
   */
  description?: string;
  /** attention = due soon / check it; danger = missing or wrong (tinted tile; never a colour bar). */
  tone?: (row: T) => "attention" | "danger" | null | undefined;
  /** Monospace value (accounts, ids, keys, commands). */
  mono?: boolean;
  /** Link target: the value shows as a link with an 「打开」 button. */
  href?: (row: T) => string | null | undefined;
  /** Tile width in the expanded dialog / page (`full` also implies the whole row). */
  span?: 2;
  /**
   * One small icon button on the tile, next to the copy / open buttons (「已续费」 on a due date, 「+」
   * on an empty price that opens the form at that field). Never closes the record dialog. Return null
   * to leave it out for this record.
   */
  action?: (row: T) => RecordFieldAction | null | undefined;
  /**
   * More small buttons on the tile (bt/records R4): each `{ label, icon, onSelect }` or a link `{ label,
   * icon, href }`. Shown in order after `action`, before the built-in reveal / call / copy / open.
   */
  actions?: (row: T) => readonly RecordFieldAction[] | null | undefined;
  /**
   * Masked value with an audited reveal (bt/records R6): `value` shows the masked text (「0955-***-781」),
   * an eye button calls this (the host checks permission, records who looked, resolves with the plain
   * value), the plain value shows for `remaskAfter` ms (default 30 s) and is masked again. Return
   * null / undefined from a row-level check by leaving the field without `reveal`.
   */
  reveal?: (row: T) => Promise<string>;
  remaskAfter?: number;
  /** Phone number to call: a 「拨打」 button (tel: link) on the tile. Null = no button for this record. */
  tel?: (row: T) => string | null | undefined;
  /**
   * In-place editing (list display, the default): clicking the value — or the 「编辑」 button that shows
   * on hover / focus — turns the value cell into `render(context)` (full width of the row; the value is
   * hidden meanwhile), or runs `onActivate` for fields with their own UI (checkbox toggle, attachment
   * panel, link picker). The host saves and calls `context.done()`; on failure it keeps its editor open
   * with the reason. Return null for a record the viewer may not change: a lock shows on hover. An
   * editable empty field stays in place (so it can be filled) instead of folding into 「未填写」.
   */
  edit?: (row: T) => RecordFieldEdit | null | undefined;
  /** Tooltip of the read-only lock (default 「没有修改权限」). */
  lockedReason?: string;
};
/** What clicking an editable field's value does (RecordField.edit). */
export type RecordFieldEdit =
  | { render: (context: RecordFieldEditContext) => ReactNode; onActivate?: never }
  | { onActivate: (anchor: HTMLElement) => void; render?: never };
export type RecordFieldEditContext = {
  /** The value cell the editor sits in: anchor option lists / calendars here. */
  anchor: HTMLElement;
  /** Close the editor (after the save resolved, or on cancel); focus goes back to the value. */
  done: () => void;
  /** Field label (for aria-labels). */
  label: string;
};
/** The icon button of a field tile (RecordField.action). */
export type RecordFieldAction = { label: string; icon?: ReactNode; onSelect?: () => void; /** A link instead of a callback (opens in a new window unless it is tel: / mailto:). */ href?: string };
export type RecordSection<T> = {
  key: string;
  /** Section heading (leave out for the first, untitled block). */
  title?: string;
  /** Icon in the section card's header. */
  icon?: ReactNode;
  /** Show 「已填 n / m」 with a small bar in the header (forms-like sections: 价格、客户…). */
  progress?: boolean;
  /** 「补全」 after the 「未填写」 list (opens the edit form). */
  onFill?: (row: T) => void;
  description?: ReactNode;
  /**
   * The fields, or a function of the record for fields that differ per record (custom / template
   * fields: an AI account has 订阅 / 价格 / 客户 fields, a key has none). A section whose fields are all
   * missing and has no `render` is not shown.
   */
  fields?: readonly RecordField<T>[] | ((row: T) => readonly RecordField<T>[]);
  /** Buttons in the section's header bar (1–2: 「查看全部」「编辑这一块」); keepOpen by default. */
  actions?: (row: T) => readonly RecordAction[];
  /** Free content instead of / after the fields (a small table, a chart, a code block); `context.setTab` switches the record's tab (「查看全部 12 条操作记录 →」). */
  render?: (row: T, context: RecordSectionContext) => ReactNode;
  /** Grid columns of the fields at full width (default 2; narrow dialogs and phones use 1). */
  columns?: 1 | 2 | 3;
  /** Labels on the left of values (default, like a property sheet) or stacked above them. */
  fieldLayout?: "inline" | "stacked";
  /** Users can fold the section; `collapsed` = folded at first. */
  collapsible?: boolean;
  collapsed?: boolean;
  /**
   * Fields of this section the viewer may not see (field permissions): the card footer shows the pill
   * 「N 个字段你看不到」 (HiddenFieldsPill). 0 / null = no pill. Never send the hidden fields themselves.
   */
  hiddenFields?: (row: T) => number | null | undefined;
  /** Tooltip of that pill (default: 管理员设置了字段权限 … 找上级申请). */
  hiddenHint?: string;
  /**
   * Draw the whole block yourself instead of a SectionCard (bt/records R4): an embedded subtable
   * (SubTableSection), a comment thread (CommentThread). `fields` / `title` are ignored for drawing.
   */
  block?: (row: T, context: RecordSectionContext) => ReactNode;
};
/** What section content gets besides the row: the level and a way to switch the record's tab. */
export type RecordSectionContext = { level: RecordDetailLevel; setTab: (tab: string) => void };
export type RecordTabContext<T> = { row: T; level: RecordDetailLevel; close: () => void; setTab: (tab: string) => void };
export type RecordTab<T> = {
  key: string;
  label: string;
  /** Count shown after the label (e.g. related records). */
  count?: (row: T) => number | string | null | undefined;
  /** The count means "something to fix" (e.g. 「6 未填」): shown in the danger colour. */
  countTone?: "neutral" | "danger";
  icon?: ReactNode;
  /** Free content of the tab. Leave out when the tab is made of `sections`. */
  render?: (row: T, context: RecordTabContext<T>) => ReactNode;
  /**
   * The tab as section cards with field tiles, drawn like 「详情」 (the right rail stays). A tab whose
   * sections have nothing to show for a record (no fields, no `render`) is left out for that record.
   */
  sections?: readonly RecordSection<T>[];
  /** Count = empty fields across `sections` (「6 未填」, danger colour; nothing when all are filled). Ignored when `count` is given. */
  countUnfilled?: boolean;
  /** Leave the tab out for this record (nothing to show, no permission). */
  hidden?: (row: T) => boolean;
  /** Only on the full page (heavy charts, big related tables); the expanded dialog links there instead. */
  pageOnly?: boolean;
};
/** A key fact in the header strip (expanded) / a KPI card (page). */
export type RecordHighlight = { key: string; label: string; value: ReactNode; hint?: ReactNode; tone?: RecordTone; icon?: ReactNode };
/** A banner above the sections: 「预算没填：超没超预算算不出来」 + one action. */
/** `icon`: in a round tinted badge before the text (default: a warning sign for attention / danger, an info sign otherwise; `null` = none). */
export type RecordAlert = { key: string; tone: "attention" | "danger" | "info" | "brand"; title: ReactNode; text?: ReactNode; icon?: ReactNode; action?: { label: string; onSelect: () => void } };
export type RecordStatus = { label: string; tone: RecordTone };
export type RecordAction = {
  key: string;
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  /** Shown as a button (at most 2 primary actions); the rest go into the 「更多」 menu. */
  primary?: boolean;
  /**
   * attention = an amber soft button for the one thing that is due (「已续费」). It is always a button
   * (one such action besides the 2 primary ones), placed in layout order.
   */
  tone?: "attention";
  /** Keep the record dialog open after the action (default: it closes, e.g. before opening a page or a confirm dialog). */
  keepOpen?: boolean;
};

/**
 * Everything a record's detail shows, defined once and rendered at every level. The table that lists
 * the records (DataTable / BitableGrid) builds a default layout from its columns; give one to group
 * fields into sections, add tabs, highlights, actions and the full-page link.
 */
export type RecordLayout<T> = {
  title: (row: T) => string;
  /** Under the title: a short identifier, the parent, the type. */
  subtitle?: (row: T) => ReactNode;
  /**
   * Big square left of the title in the expanded dialog / page: an icon or 1–2 letters. With `cards`
   * the default is the title's first character (return null for none).
   */
  avatar?: (row: T) => ReactNode;
  /** Small plain tags under the title (type, project). */
  tags?: (row: T) => readonly ReactNode[];
  /** Coloured chips right after the title (「跟进中」, 「A 类」): short states / grades of the record. */
  badges?: (row: T) => readonly RecordBadge[];
  /**
   * The grey line under the title as parts joined by 「·」 (「智能家居客户 · 👤 小王 负责 · 官网表单 · 建档 2 天」);
   * a `{ person }` part shows a small initial avatar. Replaces `subtitle` in the header (peek keeps `subtitle`).
   */
  meta?: (row: T) => readonly (RecordMetaPart | null | undefined | false)[];
  /** Breadcrumb above the title (「设置 / 订阅」). */
  crumb?: ReactNode;
  /** Banners above the sections (missing price, failing check …). */
  alerts?: (row: T) => readonly RecordAlert[];
  status?: (row: T) => RecordStatus | null | undefined;
  /** 2–5 key facts: a strip under the expanded header, KPI cards on the page. */
  highlights?: (row: T) => readonly RecordHighlight[];
  sections: readonly RecordSection<T>[];
  /** Right-hand meta rail of the expanded dialog and the page (owner, created / updated, ids). */
  aside?: readonly RecordSection<T>[];
  /** Extra tabs after 「详情」 (活动, 关联记录, 评论 …). */
  tabs?: readonly RecordTab<T>[];
  /** Rename / add an icon to the first tab (default 「详情」, e.g. 「概览」 with a grid icon); its key stays `details`. */
  overview?: { label?: string; icon?: ReactNode };
  actions?: (row: T) => readonly RecordAction[];
  /** URL of the record's own page (level `page`); enables 「在新页面打开」. */
  href?: (row: T) => string;
  /**
   * The arranged detail (RecordDetail): the 「详情」 tab of the expanded dialog and the
   * page become soft cards — stage, key numbers, host blocks, section cards — laid out by a saved
   * spec the user can rearrange (「编辑布局」). Leave out for plain field rows (grey label left, value right, hover tools, in-place editing).
   */
  cards?: RecordCardsLayout<T>;
};

// ---------------------------------------------------------------- arranged detail (RecordDetail)

/** The stage block / StagePath of a record. */
export type RecordStage = {
  steps: readonly StagePathStep[];
  /** Id of the current step (else the step whose state is current / lost). */
  current?: string;
  /** Click a step (keyboard: Tab to it, Enter). Leave out or `readOnly` = the path is not clickable. */
  onSelect?: (stepId: string) => void;
  readOnly?: boolean;
  /** Primary button 「进入<下一阶段>」 (hidden at the last step and after an exit). */
  onAdvance?: () => void;
  /** Quiet button for leaving the path (default label 「标记失败」, e.g. 「标记丢单」). */
  onMarkLost?: () => void;
  labels?: { advance?: string; markLost?: string; /** Name of the path for assistive tech (default 「阶段」). */ path?: string; /** The overflow menu of exits (default 「更多」). */ more?: string };
};
/** One of up to 4 key figures (RecordDetail key numbers). */
export type RecordKeyNumber = { key: string; label: string; value: ReactNode; hint?: ReactNode; tone?: "attention" | "danger" };
/** A block the host draws (activity feed, comments, subtable, attachments), placed by id. */
export type RecordDetailSlot = {
  /** Card heading (the user may rename it in the spec); plain text also names it in 「编辑布局」. */
  title?: string;
  /** Small grey count after the title. */
  count?: ReactNode;
  /** Quiet buttons on the right of the card header (「只看跟进」). */
  actions?: ReactNode;
  render: () => ReactNode;
};
/** The quiet star 「关注」 in the header. */
export type RecordFollow = { on: boolean; onToggle: () => void; /** Default 「关注」 / 「已关注」. */ label?: string };
/** Lets the user rearrange the detail (「编辑布局」); the host persists the spec. */
export type RecordLayoutEditor = {
  /** 「完成」: the edited spec and where to keep it. Reject (Error message) to stay in edit mode. */
  onSave: (spec: RecordDetailSpec, scope: RecordDetailScope) => void | Promise<void>;
  /** 「恢复团队默认」: drop the user's own arrangement. */
  onReset?: () => void | Promise<void>;
  /** The user may change the shared default (shows 「团队默认 / 只改我的」). */
  canEditDefault?: boolean;
  /** Words of the scope switch and the reset button (default RECORD_DETAIL_SCOPE_LABELS / 「恢复团队默认」), e.g. `{ default: "公司默认", reset: "恢复公司默认" }`. */
  labels?: Partial<Record<RecordDetailScope | "reset", string>>;
  /** Scope picked when edit mode opens (default 「只改我的」). */
  scope?: RecordDetailScope;
};
/** RecordLayout.cards: what the arranged detail draws for a record. */
export type RecordCardsLayout<T> = {
  /** The saved arrangement (any JSON; normalized against what the host can draw). */
  spec: unknown;
  /** Fields that sections may hold (default: every field of `sections` and `aside`). */
  fields?: (row: T) => readonly RecordField<T>[];
  /** Stage path on top (with nothing saved, `sections` / `aside` become the starting section cards). */
  stage?: (row: T) => RecordStage | null | undefined;
  keyNumbers?: (row: T) => readonly RecordKeyNumber[];
  /** Host blocks by id; the same ids for every record (a slot with nothing to show can render a quiet note). */
  slots?: (row: T, context: RecordSectionContext) => Readonly<Record<string, RecordDetailSlot>>;
  follow?: (row: T) => RecordFollow | null | undefined;
  editor?: RecordLayoutEditor;
};

export const PEEK_FIELD_LIMIT = 8;
export const RECORD_PRIMARY_ACTIONS = 2;

/** Placeholders tables render for "no value" (—, -, –): empty in a record detail too. */
const PLACEHOLDER = /^[\s—–-]*$/;
const isBlank = (value: unknown) => value === null || value === undefined || (typeof value === "string" && PLACEHOLDER.test(value)) || (Array.isArray(value) && value.length === 0);
/** Plain text of a field for copy / emptiness: `text`, else the value when it is a string or number. */
export function recordFieldText<T>(field: RecordField<T>, row: T): string | null {
  if (field.text) return field.text(row);
  const value = field.value(row);
  return typeof value === "string" ? value : typeof value === "number" || typeof value === "bigint" ? String(value) : null;
}
/** Empty = nothing to show: null / undefined / "" / [] (or empty plain text). */
export function isRecordFieldEmpty<T>(field: RecordField<T>, row: T): boolean {
  if (field.text) return PLACEHOLDER.test(field.text(row));
  return isBlank(field.value(row));
}

/** The fields of a section for one record (static list or per-record function). */
export function sectionFields<T>(section: Pick<RecordSection<T>, "fields">, row: T): readonly RecordField<T>[] {
  const fields = section.fields;
  return typeof fields === "function" ? fields(row) : fields ?? [];
}

/** Fields of a section that are shown for this row (hideEmpty ones dropped when empty). */
export function visibleRecordFields<T>(section: Pick<RecordSection<T>, "fields">, row: T): RecordField<T>[] {
  return sectionFields(section, row).filter((field) => !(field.hideEmpty && isRecordFieldEmpty(field, row)));
}

/**
 * How a section shows its fields for one row (expanded dialog and page): `shown` in order; `empty` =
 * labels of empty fields, listed once as 「未填写：…」 instead of a column of dashes (hideEmpty ones
 * are dropped, showEmpty ones stay in place); fields whose plain text repeats the record title are
 * left out — the header already says it.
 */
export function arrangeRecordFields<T>(fields: readonly RecordField<T>[], row: T, options: { title?: string; keepEmpty?: (field: RecordField<T>) => boolean } = {}): { shown: RecordField<T>[]; empty: string[] } {
  const shown: RecordField<T>[] = [];
  const empty: string[] = [];
  const title = options.title?.trim();
  for (const field of fields) {
    if (isRecordFieldEmpty(field, row)) {
      if (field.showEmpty || (!field.hideEmpty && options.keepEmpty?.(field))) shown.push(field);
      else if (!field.hideEmpty) empty.push(field.label);
      continue;
    }
    if (title && recordFieldText(field, row)?.trim() === title) continue;
    shown.push(field);
  }
  return { shown, empty };
}

/** Editable for this record (RecordField.edit returns something); `locked` = has `edit` but not for this record. */
export function recordFieldEditState<T>(field: RecordField<T>, row: T): "editable" | "locked" | "none" {
  if (!field.edit) return "none";
  return field.edit(row) ? "editable" : "locked";
}

/**
 * The progress line above a list section: filled / total (hideEmpty fields not counted) and the empty
 * fields in layout order, each with whether it can be filled in place.
 */
export function recordFillSummary<T>(fields: readonly RecordField<T>[], row: T): { filled: number; total: number; empty: { key: string; label: string; editable: boolean }[] } {
  const counted = fields.filter((field) => !field.hideEmpty);
  const empty = counted.filter((field) => isRecordFieldEmpty(field, row)).map((field) => ({ key: field.key, label: field.label, editable: recordFieldEditState(field, row) === "editable" }));
  return { filled: counted.length - empty.length, total: counted.length, empty };
}

/**
 * Fields of the peek level: those marked `peek` (in layout order), else the first `limit` filled
 * fields of the sections — long ones included, since the peek is where a clamped cell is read in full;
 * a field that repeats `title` (the dialog title) is skipped.
 */
export function peekRecordFields<T>(layout: Pick<RecordLayout<T>, "sections"> & Partial<Pick<RecordLayout<T>, "tabs">>, row: T, limit = PEEK_FIELD_LIMIT, title?: string): RecordField<T>[] {
  const repeat = title?.trim();
  const sections = [...layout.sections, ...(layout.tabs ?? []).flatMap((tab) => tab.sections ?? [])];
  const all = sections.flatMap((section) => sectionFields(section, row)).filter((field) => !repeat || recordFieldText(field, row)?.trim() !== repeat);
  const marked = all.filter((field) => field.peek);
  if (marked.length) return marked.filter((field) => !(field.hideEmpty && isRecordFieldEmpty(field, row)));
  return all.filter((field) => !isRecordFieldEmpty(field, row)).slice(0, limit);
}

/** Field count of a layout, used to pick a default level (see suggestRecordLevel). */
export const recordFieldCount = <T,>(layout: Pick<RecordLayout<T>, "sections" | "aside">) =>
  [...layout.sections, ...(layout.aside ?? [])].reduce((sum, section) => sum + (typeof section.fields === "function" ? 6 : section.fields?.length ?? 0) + (section.render || section.block ? 3 : 0), 0);

/**
 * Default level for opening a record: peek for small records (≤ 8 fields, no tabs, no sections with
 * free content), expanded otherwise. The page level is never a default — it is a route the user
 * opens on purpose (「在新页面打开」 / a link).
 */
export function suggestRecordLevel<T>(layout: Pick<RecordLayout<T>, "sections" | "aside" | "tabs">): Exclude<RecordDetailLevel, "page"> {
  const tabs = (layout.tabs ?? []).filter((tab) => !tab.pageOnly).length;
  const free = layout.sections.some((section) => section.render || section.block);
  return !tabs && !free && recordFieldCount(layout) <= 8 ? "peek" : "expanded";
}

/**
 * Split actions into the visible buttons and the 「更多」 menu: primary ones (at most `max`) plus one
 * attention-toned action, in layout order.
 */
export function splitRecordActions(actions: readonly RecordAction[], max = RECORD_PRIMARY_ACTIONS): { buttons: RecordAction[]; menu: RecordAction[] } {
  const primary = actions.filter((action) => action.primary && action.tone !== "attention").slice(0, max);
  const attention = actions.find((action) => action.tone === "attention");
  const buttons = actions.filter((action) => primary.includes(action) || action === attention);
  return { buttons, menu: actions.filter((action) => !buttons.includes(action)) };
}

/** Empty fields across sections (hideEmpty ones not counted): the 「n 未填」 of a sections tab. */
export function unfilledRecordFields<T>(sections: readonly RecordSection<T>[], row: T): number {
  return sections.reduce((sum, section) => sum + sectionFields(section, row).filter((field) => !field.hideEmpty && isRecordFieldEmpty(field, row)).length, 0);
}

/** A sections tab with nothing to show for this row (no fields in any section, no free content). */
const emptySectionsTab = <T,>(tab: RecordTab<T>, row: T | undefined) =>
  !tab.render && tab.sections !== undefined && row !== undefined && !tab.sections.some((section) => section.render || section.block || visibleRecordFields(section, row).length > 0);

/**
 * Tabs available at a level: 「详情」 first (key `details`, label from `layout.overview`), page-only
 * tabs only on the page; with a row, tabs that are hidden or have nothing to show are left out.
 */
export function recordTabs<T>(layout: Pick<RecordLayout<T>, "tabs"> & Partial<Pick<RecordLayout<T>, "overview">>, level: RecordDetailLevel, row?: T): { key: string; label: string; pageOnly?: boolean }[] {
  const extra = (layout.tabs ?? []).filter((tab) => (level === "page" || !tab.pageOnly) && !(row !== undefined && tab.hidden?.(row)) && !emptySectionsTab(tab, row));
  return [{ key: "details", label: layout.overview?.label ?? "详情" }, ...extra.map((tab) => ({ key: tab.key, label: tab.label, pageOnly: tab.pageOnly }))];
}

/** The count after a tab label: `count`, else 「n 未填」 for `countUnfilled` (danger); undefined = none. */
export function recordTabCount<T>(tab: RecordTab<T>, row: T): { value: number | string; tone?: "neutral" | "danger" } | undefined {
  if (tab.count) {
    const value = tab.count(row);
    return value === null || value === undefined ? undefined : { value, tone: tab.countTone };
  }
  if (tab.countUnfilled && tab.sections) {
    const n = unfilledRecordFields(tab.sections, row);
    return n > 0 ? { value: `${n} 未填`, tone: "danger" } : undefined;
  }
  return undefined;
}

// ---------------------------------------------------------------- URL deep link

/** Default query parameter of an open record: `?record=<id>` (level: `&recordView=peek|expanded`). */
export const RECORD_PARAM = "record";
export const RECORD_VIEW_PARAM = "recordView";

export type RecordLocation = { key: string; level: Exclude<RecordDetailLevel, "page"> } | null;
/** Read the open record from a query string ("?a=1&record=42&recordView=peek"). */
export function readRecordParam(search: string, param = RECORD_PARAM): RecordLocation {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const key = query.get(param);
  if (!key) return null;
  const view = query.get(param === RECORD_PARAM ? RECORD_VIEW_PARAM : `${param}View`);
  return { key, level: view === "peek" ? "peek" : "expanded" };
}
/** The query string with the open record set (or removed when `location` is null); other params kept. */
export function writeRecordParam(search: string, location: RecordLocation, param = RECORD_PARAM): string {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const viewParam = param === RECORD_PARAM ? RECORD_VIEW_PARAM : `${param}View`;
  if (location) {
    query.set(param, location.key);
    if (location.level === "peek") query.set(viewParam, "peek");
    else query.delete(viewParam);
  } else {
    query.delete(param);
    query.delete(viewParam);
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

// ---------------------------------------------------------------- keyboard

const TYPING = /^(input|textarea|select)$/i;
/**
 * Record navigation of an open detail: Alt + ↑ / ↓ anywhere, J / K when focus is not in a text
 * field (Linear / Gmail convention). Returns -1 (previous), 1 (next) or null.
 */
export function recordNavDelta(event: { key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }, target?: { tagName?: string; isContentEditable?: boolean } | null): -1 | 1 | null {
  if (event.altKey && !event.ctrlKey && !event.metaKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) return event.key === "ArrowUp" ? -1 : 1;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  if (target && (TYPING.test(target.tagName ?? "") || target.isContentEditable)) return null;
  if (event.key === "k" || event.key === "K") return -1;
  if (event.key === "j" || event.key === "J") return 1;
  return null;
}
