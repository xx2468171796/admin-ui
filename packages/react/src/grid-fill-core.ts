/**
 * Fill handle of BitableGrid (bt/grid-b, G10): drag the small square at the corner of the selection
 * (or Ctrl + D) to copy values into neighbouring cells. Pure: the target area from the pointer cell,
 * and the plan of cell changes (applied through the grid's normal change pipeline with
 * `source: "fill"`, so saving, rollback and undo work like a paste). Unit-tested in
 * test/grid-fill-core.test.ts.
 *
 * Rules: one source cell → copy it. Two or more cells of a number / money / rating / progress / date /
 * datetime field with a constant step (1, 2, 3 · 2026-10-01, 2026-10-08) → continue the series in
 * the fill direction (up / left continue backwards); otherwise the source cells repeat in order.
 * Rows fill per column with raw values; columns fill per row through the text of each cell, so a
 * value is only written where the target field accepts it. Read-only cells and invalid values are
 * skipped with a reason; group header rows are skipped.
 */
import { fieldText, readField, toMinor, type GridField } from "./grid-core.ts";
import { coreType, toProgress, toRating } from "./grid-field-types.ts";
import {
  isCellEditable,
  makeChange,
  rangeBounds,
  validateFieldInput,
  writeField,
  type GridCellChange,
  type GridCellRef,
  type GridEditPlan,
  type GridRange,
  type GridRangeBounds,
  type PlanContext,
  type PlanSkip,
} from "./grid-edit-core.ts";

export type GridFillDirection = "down" | "up" | "right" | "left";
export type GridFillTarget = { direction: GridFillDirection; range: GridRange };

/**
 * Area a fill drag covers when the pointer is over `cell`: the extension of the source bounds
 * towards the pointer along the axis it moved further on (rows win ties), clamped to the data area;
 * null while the pointer is still inside the source.
 */
export function fillTarget(bounds: GridRangeBounds, cell: GridCellRef, limits: { rows: number; firstCol: number; lastCol: number }): GridFillTarget | null {
  const row = Math.max(0, Math.min(limits.rows - 1, cell.row));
  const col = Math.max(limits.firstCol, Math.min(limits.lastCol, cell.col));
  const dy = row > bounds.bottom ? row - bounds.bottom : row < bounds.top ? row - bounds.top : 0;
  const dx = col > bounds.right ? col - bounds.right : col < bounds.left ? col - bounds.left : 0;
  if (!dy && !dx) return null;
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy > 0
      ? { direction: "down", range: { anchor: { row: bounds.bottom + 1, col: bounds.left }, focus: { row, col: bounds.right } } }
      : { direction: "up", range: { anchor: { row, col: bounds.left }, focus: { row: bounds.top - 1, col: bounds.right } } };
  }
  return dx > 0
    ? { direction: "right", range: { anchor: { row: bounds.top, col: bounds.right + 1 }, focus: { row: bounds.bottom, col } } }
    : { direction: "left", range: { anchor: { row: bounds.top, col }, focus: { row: bounds.bottom, col: bounds.left - 1 } } };
}

/** The selection after a fill: source and target together. */
export function filledRange(source: GridRange, target: GridFillTarget): GridRange {
  const a = rangeBounds(source);
  const b = rangeBounds(target.range);
  return { anchor: { row: Math.min(a.top, b.top), col: Math.min(a.left, b.left) }, focus: { row: Math.max(a.bottom, b.bottom), col: Math.max(a.right, b.right) } };
}

type Series = (step: number) => unknown;
const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dayMs = (value: unknown) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00Z`) : NaN);
const timeMs = (value: unknown) => (value instanceof Date ? value.getTime() : typeof value === "string" || typeof value === "number" ? new Date(value).getTime() : NaN);
const cleanNumber = (n: number, digits: number) => Number(n.toFixed(Math.max(0, Math.min(20, digits))));
/** Decimal places a number is written with (1.25 → 2, 1e-7 → 7). */
function decimalsOf(n: number): number {
  const [mantissa = "", exponent = "0"] = String(n).toLowerCase().split("e");
  const fraction = mantissa.split(".")[1]?.length ?? 0;
  return Math.max(0, fraction - Number(exponent));
}

/** A constant step between consecutive values (null when there is none). */
function constantStep<N extends number | bigint>(values: readonly N[]): N | null {
  if (values.length < 2) return null;
  const step = (values[1]! - values[0]!) as N;
  for (let i = 2; i < values.length; i++) if (values[i]! - values[i - 1]! !== step) return null;
  return step;
}

/**
 * Series that continues `values` (k = 1 is the first cell beyond the source in the fill direction;
 * `backwards` for up / left), or null when the values do not form one.
 */
export function fillSeries<T>(field: GridField<T>, values: readonly unknown[], backwards: boolean): Series | null {
  if (values.length < 2) return null;
  const type = coreType(field);
  if (type === "date") {
    const days = values.map(dayMs);
    if (days.some(Number.isNaN)) return null;
    const step = constantStep(days.map((ms) => Math.round(ms / DAY)));
    if (step === null) return null;
    const base = backwards ? days[0]! : days.at(-1)!;
    return (k) => isoDay(base + (backwards ? -k : k) * step * DAY);
  }
  if (type === "datetime") {
    const times = values.map(timeMs);
    if (times.some(Number.isNaN)) return null;
    const step = constantStep(times);
    if (step === null) return null;
    const base = backwards ? times[0]! : times.at(-1)!;
    return (k) => new Date(base + (backwards ? -k : k) * step).toISOString();
  }
  if (type === "money") {
    const minors = values.map(toMinor);
    if (minors.some((v) => v === null)) return null;
    const step = constantStep(minors as bigint[]);
    if (step === null) return null;
    const base = backwards ? minors[0]! : minors.at(-1)!;
    return (k) => {
      const minor = base + BigInt(backwards ? -k : k) * step;
      return minor >= BigInt(Number.MIN_SAFE_INTEGER) && minor <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(minor) : String(minor);
    };
  }
  if (type === "number") {
    const numbers = values.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : NaN));
    if (numbers.some(Number.isNaN)) return null;
    const scaled = numbers.map((n) => Math.round(n * 1e10));
    const step = constantStep(scaled);
    if (step === null) return null;
    const base = backwards ? numbers[0]! : numbers.at(-1)!;
    // Without a precision, round to the most decimals the source values have (no 12345679.000000002).
    const digits = field.precision ?? Math.max(...numbers.map(decimalsOf));
    const raw = (k: number) => cleanNumber(base + ((backwards ? -k : k) * step) / 1e10, digits);
    if (field.type === "rating") return (k) => toRating(raw(k), field.max ?? 5);
    if (field.type === "progress") return (k) => toProgress(raw(k));
    return raw;
  }
  return null;
}

/** Data rows (index + record) of a row span, in fill order (nearest the source first). */
function dataRows<T>(top: number, bottom: number, context: PlanContext<T>, reverse: boolean) {
  const out: { index: number; row: T; rowId: string }[] = [];
  for (let r = top; r <= bottom && r < context.rowCount; r++) {
    const item = context.rowAt(r);
    if (item) out.push({ index: r, ...item });
  }
  return reverse ? out.reverse() : out;
}

/**
 * Plan a fill from `source` into `target` (fillTarget's result). Several changes of one record are
 * chained so `next` carries all of them (same as planPaste).
 */
export function planFill<T>(source: GridRange, target: GridFillTarget, context: PlanContext<T>): GridEditPlan<T> {
  const src = rangeBounds(source);
  const dst = rangeBounds(target.range);
  const changes = new Map<string, GridCellChange<T>>();
  const current = new Map<string, T>();
  const skipped: PlanSkip[] = [];
  const write = (index: number, col: number, rowId: string, row: T, field: GridField<T>, value: unknown) => {
    if (!isCellEditable(field, row)) return void skipped.push({ row: index, col, reason: `「${field.title}」不能编辑` });
    if (field.required && (value === null || value === "" || (Array.isArray(value) && !value.length))) return void skipped.push({ row: index, col, reason: `「${field.title}」不能为空` });
    const message = field.validate?.(value, row) ?? null;
    if (message) return void skipped.push({ row: index, col, reason: message });
    const base = current.get(rowId) ?? row;
    const change = makeChange(field, row, rowId, value);
    if (!change) return;
    const next = writeField(field, base, value);
    current.set(rowId, next);
    changes.set(`${rowId}\u0000${field.key}`, { ...change, next });
  };

  if (target.direction === "down" || target.direction === "up") {
    const backwards = target.direction === "up";
    const sources = dataRows(src.top, src.bottom, context, false);
    const targets = dataRows(dst.top, dst.bottom, context, backwards);
    if (!sources.length) return { changes: [], skipped };
    for (let col = src.left; col <= src.right; col++) {
      const field = context.fieldAt(col);
      if (!field) continue;
      const values = sources.map((item) => readField(field, item.row));
      const series = fillSeries(field, values, backwards);
      const n = values.length;
      targets.forEach((item, i) => {
        const k = i + 1;
        const value = series ? series(k) : backwards ? values[(((n - (k % n)) % n) + n) % n] : values[(k - 1) % n];
        write(item.index, col, item.rowId, item.row, field, value);
      });
    }
    return { changes: [...changes.values()], skipped };
  }

  // Left / right: per row, the source cells' text repeats across the target columns.
  const backwards = target.direction === "left";
  const sourceCols: number[] = [];
  for (let col = src.left; col <= src.right; col++) if (context.fieldAt(col)) sourceCols.push(col);
  const targetCols: number[] = [];
  for (let col = dst.left; col <= dst.right; col++) if (context.fieldAt(col)) targetCols.push(col);
  if (backwards) targetCols.reverse();
  const n = sourceCols.length;
  if (!n) return { changes: [], skipped };
  for (const item of dataRows(src.top, src.bottom, context, false)) {
    // Masked sources (phone 0755-***-456) show text that is not the value: never copy it.
    const sourceFields = sourceCols.map((col) => context.fieldAt(col)!);
    const texts = sourceFields.map((field) => (field.mask ? null : fieldText(field, item.row)));
    targetCols.forEach((col, i) => {
      const k = i + 1;
      const field = context.fieldAt(col)!;
      const at = backwards ? (((n - (k % n)) % n) + n) % n : (k - 1) % n;
      const text = texts[at];
      if (text === null || text === undefined) return void skipped.push({ row: item.index, col, reason: `「${sourceFields[at]!.title}」已打码，不能填充` });
      if (!isCellEditable(field, item.row)) return void skipped.push({ row: item.index, col, reason: `「${field.title}」不能编辑` });
      const parsed = validateFieldInput(field, text, item.row, context.people?.(field));
      if (!parsed.ok) return void skipped.push({ row: item.index, col, reason: parsed.error });
      write(item.index, col, item.rowId, item.row, field, parsed.value);
    });
  }
  return { changes: [...changes.values()], skipped };
}

/** Ctrl + D: the top row of the range copied into the rows below it (null = nothing to fill). */
export function fillDownTarget(range: GridRange): { source: GridRange; target: GridFillTarget } | null {
  const b = rangeBounds(range);
  if (b.bottom <= b.top) return null;
  return {
    source: { anchor: { row: b.top, col: b.left }, focus: { row: b.top, col: b.right } },
    target: { direction: "down", range: { anchor: { row: b.top + 1, col: b.left }, focus: { row: b.bottom, col: b.right } } },
  };
}
