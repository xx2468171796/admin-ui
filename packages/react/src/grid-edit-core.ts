/**
 * Pure editing model of BitableGrid: parsing typed / pasted text into field values, cell ranges,
 * clipboard TSV (Excel / WPS / Feishu compatible), paste / clear plans, the undo stack and the
 * keyboard map. No React and no DOM: unit-tested in test/grid-edit-core.test.ts.
 *
 * Flow of an edit (see INTEGRATION.md「多维表格 · 编辑」):
 *   editor / paste / clear / undo → GridCellChange[] → optimistic overlay (the grid shows the new
 *   values at once, marked 保存中) → host `onCellsChange(changes)` → resolve: kept (dropped from the
 *   overlay once the host's rows carry them) / reject or `rejected`: rolled back with the reason.
 */
import { runtimeTimeZone } from "./admin-defaults.ts";
import { roundMinor } from "./format.ts";
import { majorToMinor, optionLabel, readField, toPeople, type GridField, type GridFieldType, type GridPerson, type GridSelectOption } from "./grid-core.ts";
import { extraEmptyValue, isReadOnlyType, parseExtraInput } from "./grid-field-types.ts"; // bt/grid-b

// ---------------------------------------------------------------- changes

/** One cell edit. `row` is the record before the change, `next` the record with the change applied. */
export type GridCellChange<T> = {
  rowId: string;
  field: string;
  value: unknown;
  previous: unknown;
  row: T;
  next: T;
};
/** What caused a batch of changes (one undo step). */
export type GridEditSource = "edit" | "paste" | "clear" | "undo" | "redo" | "fill"; // bt/grid-b: fill
/**
 * A refused cell that someone else saved first: who, when, and their (kept) value. The
 * grid keeps theirs and shows 「王小明 刚改过这一格」 with 「重新填入我的」 / 「用我的覆盖」.
 */
export type GridCellConflict = { by: string; at?: string; value: unknown };
/** Host answer to a batch: nothing (all saved) or the cells it refused, with the reason shown to the user. */
export type GridSaveResult = void | { rejected?: readonly { rowId: string; field: string; error: string; conflict?: GridCellConflict }[] };

/** Can this cell be edited: the field is editable (true / predicate) and not a custom field without a parser. */
export function isCellEditable<T>(field: GridField<T>, row: T): boolean {
  const editable = field.editable;
  if (!editable || isReadOnlyType(field.type)) return false; // bt/grid-b: system / formula / lookup never
  if (field.type === "custom" && !field.parse) return false;
  return typeof editable === "function" ? editable(row) : true;
}

/** The record with one field set: `field.write`, else `{ ...row, [key]: value }` (fields with a `value` accessor need `write`). */
export function writeField<T>(field: GridField<T>, row: T, value: unknown): T {
  if (field.write) return field.write(row, value);
  if (field.value) throw new Error(`字段「${field.title}」用了 value 读取函数，可编辑时必须提供 write`);
  return { ...(row as object), [field.key]: value } as T;
}

/** Empty value of a type (what 「清空」 writes): false for checkbox, [] for multi values, null otherwise. */
export function emptyFieldValue(type: GridFieldType): unknown {
  const extra = extraEmptyValue(type); // bt/grid-b
  if (extra !== undefined) return extra;
  if (type === "checkbox") return false;
  if (type === "multiSelect") return [];
  return null;
}

const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if ((a === null || a === undefined || a === "") && (b === null || b === undefined || b === "")) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  if (typeof a === "object" && typeof b === "object" && a && b) return JSON.stringify(a, (_, v) => (typeof v === "bigint" ? String(v) : v)) === JSON.stringify(b, (_, v) => (typeof v === "bigint" ? String(v) : v));
  if ((typeof a === "bigint" || typeof b === "bigint") && a !== null && b !== null && a !== undefined && b !== undefined) return String(a) === String(b);
  return false;
};
export { sameValue as sameFieldValue };

/** A change of one cell, or null when the value does not change. */
export function makeChange<T>(field: GridField<T>, row: T, rowId: string, value: unknown): GridCellChange<T> | null {
  const previous = readField(field, row);
  if (sameValue(previous, value)) return null;
  return { rowId, field: field.key, value, previous, row, next: writeField(field, row, value) };
}

/** Undo of a batch: the same cells with value and previous swapped (rows re-derived by the caller). */
export function invertChanges<T>(changes: readonly GridCellChange<T>[]): { rowId: string; field: string; value: unknown }[] {
  return [...changes].reverse().map((change) => ({ rowId: change.rowId, field: change.field, value: change.previous }));
}

// ---------------------------------------------------------------- parsing

export type ParseResult = { ok: true; value: unknown } | { ok: false; error: string };
const ok = (value: unknown): ParseResult => ({ ok: true, value });
const fail = (error: string): ParseResult => ({ ok: false, error });

const TRUE_WORDS = new Set(["是", "√", "✓", "✔", "true", "1", "yes", "y", "x", "checked", "已勾选", "on", "对"]);
const FALSE_WORDS = new Set(["否", "", "×", "✗", "false", "0", "no", "n", "unchecked", "未勾选", "off", "错"]);
/** Splits a multi-value cell: commas (half / full width), 、, ；, newlines. */
export const splitMulti = (text: string) => text.split(/[,，、;；\n\r]+/).map((part) => part.trim()).filter(Boolean);

const pad = (n: number, width = 2) => String(n).padStart(width, "0");
/** Offset (minutes, east positive) of a time zone at a UTC instant. */
function zoneOffset(utc: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(utc));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((asUtc - utc) / 60000);
}
/** Wall-clock time in a zone → UTC epoch ms (DST-safe for the usual cases). */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, second: number, timeZone: string): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const first = guess - zoneOffset(guess, timeZone) * 60000;
  return guess - zoneOffset(first, timeZone) * 60000;
}
const DATE_RE = /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
/** "2026-09-30", "2026/9/30", "2026年9月30日", optionally " 14:05(:09)"; Excel serial days (45000) too. */
export function parseDateText(text: string): { y: number; m: number; d: number; hh: number; mm: number; ss: number; time: boolean } | null {
  const value = text.trim();
  const match = DATE_RE.exec(value);
  if (match) {
    const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const check = new Date(Date.UTC(y, m - 1, d));
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
    const hh = match[4] ? Number(match[4]) : 0;
    const mm = match[5] ? Number(match[5]) : 0;
    const ss = match[6] ? Number(match[6]) : 0;
    if (hh > 23 || mm > 59 || ss > 59) return null;
    return { y, m, d, hh, mm, ss, time: Boolean(match[4]) };
  }
  if (/^\d{5}(\.\d+)?$/.test(value)) {
    // Excel serial date (1900 system, days since 1899-12-30).
    const serial = Number(value);
    const ms = Math.round((serial - 25569) * 86400000);
    const date = new Date(ms);
    return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate(), hh: date.getUTCHours(), mm: date.getUTCMinutes(), ss: date.getUTCSeconds(), time: serial % 1 !== 0 };
  }
  return null;
}

const matchOption = (options: readonly GridSelectOption[] | undefined, text: string) => {
  const needle = text.trim().toLocaleLowerCase("zh-CN");
  return options?.find((option) => option.value.toLocaleLowerCase("zh-CN") === needle || option.label.toLocaleLowerCase("zh-CN") === needle);
};

/**
 * Text typed into an editor or pasted from a spreadsheet → a value of the field's type. Empty text
 * clears the cell (checkbox: unchecked). The format accepted is what the grid itself copies
 * (fieldText), so copy → paste round-trips, plus common spreadsheet spellings.
 * `people`: choices of a user field (names); without them any names are accepted.
 */
export function parseFieldInput<T>(field: GridField<T>, text: string, context: { row?: T; people?: readonly GridPerson[] } = {}): ParseResult {
  if (field.parse) return field.parse(text, context.row as T);
  const value = text.replace(/\r\n?/g, "\n");
  const trimmed = value.trim();
  if (field.type !== "checkbox" && trimmed === "") return ok(emptyFieldValue(field.type));
  const extra = parseExtraInput(field, value); // bt/grid-b
  if (extra) return extra;
  switch (field.type) {
    case "text":
      return ok(value.replace(/\n+/g, " ").trim());
    case "longText":
      return ok(value.trim());
    case "url": {
      const url = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) return fail("只支持 http / https 链接");
        return ok(url);
      } catch {
        return fail("不是有效的链接");
      }
    }
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? ok(trimmed) : fail("不是有效的邮箱地址");
    case "number": {
      const normalized = trimmed.replace(/[,，\s]/g, "").replace(/^＋/, "+").replace(/^－/, "-");
      const percent = normalized.endsWith("%");
      const n = Number(percent ? normalized.slice(0, -1) : normalized);
      if (!Number.isFinite(n) || normalized === "" || /[^\d.eE+-]/.test(percent ? normalized.slice(0, -1) : normalized)) return fail("请输入数字");
      const scaled = percent ? n / 100 : n;
      const digits = field.precision;
      return ok(digits === undefined ? scaled : Number(scaled.toFixed(digits)));
    }
    case "money": {
      const cleaned = trimmed.replace(/[,，\s]/g, "").replace(field.currency ?? "", "").replace(/^[¥￥$]/, "").replace(/元$/, "");
      const parsed = majorToMinor(cleaned);
      if (parsed === null) return fail("请输入金额，最多两位小数");
      // precision 0 / 1: typed amounts round like the cell shows them (half away from zero).
      const minor = field.precision === undefined ? parsed : roundMinor(parsed, field.precision);
      return ok(minor >= BigInt(Number.MIN_SAFE_INTEGER) && minor <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(minor) : String(minor));
    }
    case "date": {
      const date = parseDateText(trimmed);
      if (!date) return fail("请输入日期，如 2026-09-30");
      return ok(`${date.y}-${pad(date.m)}-${pad(date.d)}`);
    }
    case "datetime": {
      const date = parseDateText(trimmed);
      if (!date) return fail("请输入日期时间，如 2026-09-30 14:05");
      const utc = zonedTimeToUtc(date.y, date.m, date.d, date.hh, date.mm, date.ss, field.timeZone ?? runtimeTimeZone());
      return ok(new Date(utc).toISOString());
    }
    case "singleSelect": {
      const option = matchOption(field.options, trimmed);
      return option ? ok(option.value) : fail(`没有这个选项：${trimmed}`);
    }
    case "multiSelect": {
      const values: string[] = [];
      for (const part of splitMulti(value)) {
        const option = matchOption(field.options, part);
        if (!option) return fail(`没有这个选项：${part}`);
        if (!values.includes(option.value)) values.push(option.value);
      }
      return ok(values);
    }
    case "user": {
      const names = [...new Set(splitMulti(value))];
      if (!context.people?.length) return ok(names.map((name) => ({ name })));
      const out: GridPerson[] = [];
      for (const name of names) {
        const person = context.people.find((p) => p.name === name || p.key === name);
        if (!person) return fail(`没有这个人：${name}`);
        out.push(person);
      }
      return ok(out);
    }
    case "checkbox": {
      const word = trimmed.toLowerCase();
      if (TRUE_WORDS.has(word)) return ok(true);
      if (FALSE_WORDS.has(word)) return ok(false);
      return fail("请输入 是 / 否");
    }
    case "custom":
      return fail("这个字段不能直接输入");
  }
  return fail("这个字段不能直接输入"); // bt/grid-b: extra types are parsed above
}

/** Parse, then the field's own check (`required`, `validate`); the error is shown on the cell. */
export function validateFieldInput<T>(field: GridField<T>, text: string, row: T, people?: readonly GridPerson[]): ParseResult {
  const parsed = parseFieldInput(field, text, { row, people });
  if (!parsed.ok) return parsed;
  if (field.required && (parsed.value === null || parsed.value === "" || (Array.isArray(parsed.value) && parsed.value.length === 0))) return fail(`「${field.title}」不能为空`);
  const error = field.validate?.(parsed.value, row);
  return error ? fail(error) : parsed;
}

/** Text an editor starts with for the current value (round-trips through parseFieldInput). */
export function editorText<T>(field: GridField<T>, value: unknown): string {
  if (value === null || value === undefined) return "";
  switch (field.type) {
    case "money": {
      const minor = typeof value === "bigint" ? value : typeof value === "number" ? BigInt(Math.trunc(value)) : /^-?\d+$/.test(String(value)) ? BigInt(String(value)) : null;
      if (minor === null) return "";
      const negative = minor < 0n;
      const abs = negative ? -minor : minor;
      return `${negative ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
    }
    case "date":
    case "datetime": {
      const time = value instanceof Date ? value.getTime() : new Date(value as string).getTime();
      if (Number.isNaN(time)) return "";
      const zone = field.timeZone ?? runtimeTimeZone();
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(time));
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
      return field.type === "date" ? `${get("year")}-${get("month")}-${get("day")}` : `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
    }
    case "singleSelect":
      return typeof value === "string" ? optionLabel(field, value) : "";
    case "multiSelect":
      return Array.isArray(value) ? value.map((v) => optionLabel(field, String(v))).join("、") : "";
    case "user":
      return toPeople(value).map((p) => p.name).join("、");
    case "checkbox":
      return value === true ? "是" : "否";
    case "number":
      return typeof value === "number" ? String(value) : String(value);
    default:
      return typeof value === "string" ? value : String(value);
  }
}

// ---------------------------------------------------------------- ranges

/** A cell by display position: row = index in the rendered row list (group rows included), col = visible column index. */
export type GridCellRef = { row: number; col: number };
/** A rectangular selection from the anchor (where it started) to the focus (the active cell). */
export type GridRange = { anchor: GridCellRef; focus: GridCellRef };
export type GridRangeBounds = { top: number; bottom: number; left: number; right: number };

export const rangeBounds = (range: GridRange): GridRangeBounds => ({
  top: Math.min(range.anchor.row, range.focus.row),
  bottom: Math.max(range.anchor.row, range.focus.row),
  left: Math.min(range.anchor.col, range.focus.col),
  right: Math.max(range.anchor.col, range.focus.col),
});
export const rangeContains = (range: GridRange | null, cell: GridCellRef) => {
  if (!range) return false;
  const b = rangeBounds(range);
  return cell.row >= b.top && cell.row <= b.bottom && cell.col >= b.left && cell.col <= b.right;
};
export const isSingleCell = (range: GridRange | null) => !range || (range.anchor.row === range.focus.row && range.anchor.col === range.focus.col);
export const rangeCellCount = (range: GridRange) => {
  const b = rangeBounds(range);
  return (b.bottom - b.top + 1) * (b.right - b.left + 1);
};
/** Clamp a range to the data area (rows 0..rows-1, columns first..last). */
export function clampRange(range: GridRange, rows: number, firstCol: number, lastCol: number): GridRange {
  const clamp = (cell: GridCellRef) => ({ row: Math.max(0, Math.min(rows - 1, cell.row)), col: Math.max(firstCol, Math.min(lastCol, cell.col)) });
  return { anchor: clamp(range.anchor), focus: clamp(range.focus) };
}

// ---------------------------------------------------------------- clipboard

/** Cells → tab-separated text; a cell with tab / newline / quote is quoted ("" escapes a quote). */
export function toTsv(matrix: readonly (readonly string[])[]): string {
  return matrix.map((row) => row.map((cell) => (/[\t\n\r"]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join("\t")).join("\r\n");
}
/** Cells → a minimal HTML table (Excel / WPS keep the cell grid when pasting it). */
export function toHtmlTable(matrix: readonly (readonly string[])[]): string {
  const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  return `<table>${matrix.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</table>`;
}
/**
 * Tab-separated clipboard text → cells (Excel / WPS / Google Sheets / Feishu format): quoted cells may
 * hold tabs, newlines and doubled quotes; CRLF / LF / CR line ends; one trailing line end ignored.
 */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let atStart = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && atStart) { quoted = true; atStart = false; continue; }
    if (ch === "\t") { row.push(cell); cell = ""; atStart = true; continue; }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = ""; atStart = true;
      continue;
    }
    cell += ch;
    atStart = false;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.length ? rows : [[""]];
}

export type GridGridCell<T> = { row: T; rowId: string } | null;
export type PlanContext<T> = {
  /** Rendered rows by display index: the record (and id), or null for group / placeholder rows. */
  rowAt: (index: number) => { row: T; rowId: string } | null;
  rowCount: number;
  /** Field at a visible column index, or null for the row-number / actions columns. */
  fieldAt: (col: number) => GridField<T> | null;
  people?: (field: GridField<T>) => readonly GridPerson[] | undefined;
};
export type PlanSkip = { row: number; col: number; reason: string };
export type GridEditPlan<T> = { changes: GridCellChange<T>[]; skipped: PlanSkip[] };

/** Data rows of a range, skipping group / unloaded rows. */
function rangeRows<T>(bounds: GridRangeBounds, context: PlanContext<T>) {
  const out: { index: number; row: T; rowId: string }[] = [];
  for (let r = bounds.top; r <= bounds.bottom && r < context.rowCount; r++) {
    const item = context.rowAt(r);
    if (item) out.push({ index: r, ...item });
  }
  return out;
}

/**
 * Paste cells at a range: a single copied value fills the whole selected range (Excel); a block is
 * pasted from the range's top-left corner (only as far as rows / columns exist — no rows are added).
 * Group headers are skipped (the block continues on the next record); read-only cells and invalid
 * values are skipped with a reason; several edits of the same cell keep the last.
 */
export function planPaste<T>(matrix: readonly (readonly string[])[], range: GridRange, context: PlanContext<T>): GridEditPlan<T> {
  const bounds = rangeBounds(range);
  const changes = new Map<string, GridCellChange<T>>();
  const skipped: PlanSkip[] = [];
  const single = matrix.length === 1 && matrix[0]!.length === 1;
  const height = single ? bounds.bottom - bounds.top + 1 : matrix.length;
  const width = single ? bounds.right - bounds.left + 1 : Math.max(...matrix.map((row) => row.length));
  // Walk data rows from the top, skipping group rows (they take no source row).
  let source = 0;
  const rows: { index: number; row: T; rowId: string }[] = [];
  for (let r = bounds.top; r < context.rowCount && rows.length < height; r++) {
    const item = context.rowAt(r);
    if (item) rows.push({ index: r, ...item });
  }
  for (const target of rows) {
    const line = single ? matrix[0]! : matrix[source]!;
    source++;
    let current = target.row;
    for (let c = 0; c < width; c++) {
      const col = bounds.left + c;
      const field = context.fieldAt(col);
      if (!field) continue;
      const text = single ? line[0]! : line[c];
      if (text === undefined) continue;
      if (!isCellEditable(field, target.row)) { skipped.push({ row: target.index, col, reason: `「${field.title}」不能编辑` }); continue; }
      const parsed = validateFieldInput(field, text, target.row, context.people?.(field));
      if (!parsed.ok) { skipped.push({ row: target.index, col, reason: parsed.error }); continue; }
      const change = makeChange(field, target.row, target.rowId, parsed.value);
      if (!change) continue;
      current = writeField(field, current, parsed.value);
      changes.set(`${target.rowId}\u0000${field.key}`, { ...change, next: current });
    }
  }
  return { changes: [...changes.values()], skipped };
}

/** Clear every editable cell of a range (Delete / Backspace / 剪切). */
export function planClear<T>(range: GridRange, context: PlanContext<T>): GridEditPlan<T> {
  const bounds = rangeBounds(range);
  const changes: GridCellChange<T>[] = [];
  const skipped: PlanSkip[] = [];
  for (const target of rangeRows(bounds, context)) {
    let current = target.row;
    for (let col = bounds.left; col <= bounds.right; col++) {
      const field = context.fieldAt(col);
      if (!field) continue;
      if (!isCellEditable(field, target.row)) { skipped.push({ row: target.index, col, reason: `「${field.title}」不能编辑` }); continue; }
      if (field.required) { skipped.push({ row: target.index, col, reason: `「${field.title}」不能为空` }); continue; }
      const value = emptyFieldValue(field.type);
      const change = makeChange(field, target.row, target.rowId, value);
      if (!change) continue;
      current = writeField(field, current, value);
      changes.push({ ...change, next: current });
    }
  }
  return { changes, skipped };
}

/** Text of a range for the clipboard (what each cell shows as plain text). */
export function rangeText<T>(range: GridRange, context: PlanContext<T>, text: (field: GridField<T>, row: T) => string, options: { headers?: boolean } = {}): string[][] {
  const bounds = rangeBounds(range);
  const fields: GridField<T>[] = [];
  for (let col = bounds.left; col <= bounds.right; col++) {
    const field = context.fieldAt(col);
    if (field) fields.push(field);
  }
  const matrix = rangeRows(bounds, context).map((target) => fields.map((field) => text(field, target.row)));
  return options.headers ? [fields.map((field) => field.title), ...matrix] : matrix;
}

// ---------------------------------------------------------------- undo stack

export type GridHistoryEntry = { label: string; cells: readonly { rowId: string; field: string; before: unknown; after: unknown }[] };
export type GridHistory = { past: GridHistoryEntry[]; future: GridHistoryEntry[] };
export const GRID_HISTORY_LIMIT = 100;
export const emptyGridHistory = (): GridHistory => ({ past: [], future: [] });
/** Record a saved batch (clears redo). */
export function pushGridHistory<T>(history: GridHistory, label: string, changes: readonly GridCellChange<T>[], limit = GRID_HISTORY_LIMIT): GridHistory {
  if (!changes.length) return history;
  const entry: GridHistoryEntry = { label, cells: changes.map((c) => ({ rowId: c.rowId, field: c.field, before: c.previous, after: c.value })) };
  return { past: [...history.past, entry].slice(-limit), future: [] };
}
/** Step back: the entry to revert (apply each cell's `before`), and the new history. */
export function undoGridHistory(history: GridHistory): { entry: GridHistoryEntry; history: GridHistory } | null {
  const entry = history.past.at(-1);
  if (!entry) return null;
  return { entry, history: { past: history.past.slice(0, -1), future: [entry, ...history.future] } };
}
/** Step forward: the entry to re-apply (each cell's `after`). */
export function redoGridHistory(history: GridHistory): { entry: GridHistoryEntry; history: GridHistory } | null {
  const entry = history.future[0];
  if (!entry) return null;
  return { entry, history: { past: [...history.past, entry], future: history.future.slice(1) } };
}
/** Put an entry back where it was when saving its undo / redo failed. */
export function restoreGridHistory(history: GridHistory, entry: GridHistoryEntry, direction: "undo" | "redo"): GridHistory {
  return direction === "undo"
    ? { past: [...history.past, entry], future: history.future.filter((e) => e !== entry) }
    : { past: history.past.filter((e) => e !== entry), future: [entry, ...history.future] };
}

// ---------------------------------------------------------------- keyboard

export type GridKeyAction =
  | "edit" // Enter / F2: edit, or enter the cell's links / buttons, or open the record
  | "type" // a printable key on an editable cell: edit, starting with that character
  | "expand" // Space: open the record
  | "toggleRow" // Shift + Space: select the row
  | "clear" // Delete / Backspace
  | "undo"
  | "redo"
  | "selectAll"
  | "escape"
  // bt/grid-b
  | "openRecord" // Ctrl + E: open the record (always, also on the row-number column)
  | "fillDown" // Ctrl + D: copy the top row of the range down
  | "insertBelow" // Shift + Enter (only when the grid can insert rows)
  | "insertAbove"; // Ctrl + Shift + Enter
/** Navigate-mode key → action (arrows and paging are handled by moveGridCell). */
export function gridKeyAction(event: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean }): GridKeyAction | null {
  const mod = Boolean(event.ctrlKey || event.metaKey);
  const key = event.key;
  if (mod && !event.altKey) {
    const lower = key.toLowerCase();
    if (lower === "z") return event.shiftKey ? "redo" : "undo";
    if (lower === "y") return "redo";
    if (lower === "a") return "selectAll";
    if (lower === "e") return "openRecord"; // bt/grid-b
    if (lower === "d") return "fillDown"; // bt/grid-b
    if (key === "Enter" && event.shiftKey) return "insertAbove"; // bt/grid-b
    return null;
  }
  if (event.altKey) return null;
  if (key === "Enter" && event.shiftKey) return "insertBelow"; // bt/grid-b (the grid treats it as edit when it cannot insert)
  if (key === "Enter" || key === "F2") return "edit";
  if (key === " " || key === "Spacebar") return event.shiftKey ? "toggleRow" : "expand";
  if (key === "Delete" || key === "Backspace") return "clear";
  if (key === "Escape") return "escape";
  if (key.length === 1 && key !== " ") return "type";
  return null;
}
/** Edit-mode key → what happens to the editor (null = the editor handles it). */
export function editorKeyAction(event: { key: string; shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; isComposing?: boolean }, multiline: boolean, variant: "cell" | "field" = "cell"): "commitDown" | "commitUp" | "commitRight" | "commitLeft" | "cancel" | null {
  if (event.isComposing) return null; // IME candidate selection (Chinese input) owns Enter / Esc
  if (event.key === "Escape") return "cancel";
  // A field in a record detail (variant "field"): a long text box is a writing area — Enter is a new
  // line, Ctrl / ⌘ + Enter saves; Tab saves like a blur. Single-line fields save on Enter.
  if (variant === "field") {
    if (event.key === "Tab") return event.shiftKey ? "commitLeft" : "commitRight";
    if (event.key !== "Enter") return null;
    if (multiline) return event.ctrlKey || event.metaKey ? "commitDown" : null;
    return event.shiftKey || event.altKey ? null : "commitDown";
  }
  if (event.key === "Tab") return event.shiftKey ? "commitLeft" : "commitRight";
  if (event.key === "Enter") {
    if (multiline && (event.shiftKey || event.altKey)) return null; // new line
    if (event.ctrlKey || event.metaKey) return "commitDown";
    return event.shiftKey ? "commitUp" : "commitDown";
  }
  return null;
}
