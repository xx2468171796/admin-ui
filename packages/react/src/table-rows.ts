/**
 * Row-height model of DataTable (3.0). Pure: no React/DOM, unit-tested in test/table-rows.test.ts.
 *
 * Every row of a table has the same fixed height; cell content is clamped to the row's line budget
 * and never grows the row (Feishu Bitable / Airtable / Teable style). `"auto"` is the escape hatch
 * that restores the 2.x "row height is a minimum" behaviour for small lists.
 */

/** Bitable-style presets (BitableGrid): short 32px 1 line, medium 56px 2 lines, tall 88px 3 lines, extraTall 120px 5 lines. */
export type TableRowHeight = "short" | "medium" | "tall" | "extraTall" | "auto";
export type TableRowHeightPreset = Exclude<TableRowHeight, "auto">;

export const ROW_HEIGHT_PRESETS: Readonly<Record<TableRowHeightPreset, number>> = {
  short: 32,
  medium: 56,
  tall: 88,
  extraTall: 120,
};
/**
 * DataTable / CompactTable presets (lists use compact 40 / loose 48 / two-line 56): short = compact
 * 40px (1 line), medium = two-line 56px (the only height that shows CellText's second line), tall 88 / extraTall 120
 * for long text. Loose 48px is the default density. BitableGrid keeps ROW_HEIGHT_PRESETS (32px short rows).
 */
export const TABLE_ROW_HEIGHTS: Readonly<Record<TableRowHeightPreset, number>> = {
  short: 40,
  medium: 56,
  tall: 88,
  extraTall: 120,
};
/** Labels used by TablePreferencesMenu (行高：矮 / 中 / 高 / 超高). */
export const ROW_HEIGHT_LABELS: Readonly<Record<TableRowHeightPreset, string>> = {
  short: "矮",
  medium: "中",
  tall: "高",
  extraTall: "超高",
};
/** Base line height of a table cell in px at font scale ≤ 1.15 (CSS: max(20px, 17px × font scale)). */
export const CELL_LINE_HEIGHT = 20;
/** Rows shorter than this drop CellText's second line (it moves into the hover title): only two-line 56px and up show it. */
export const TWO_LINE_MIN_HEIGHT = 56;

export function isTableRowHeight(value: unknown): value is TableRowHeight {
  return value === "auto" || (typeof value === "string" && Object.hasOwn(ROW_HEIGHT_PRESETS, value));
}

/** Vertical padding of a body cell: none at ≤ 32px, then half of the extra height, at most 8px. */
export function cellPadding(height: number): number {
  return Math.min(8, Math.max(0, (height - 32) / 2));
}

/** Lines of text a row of `height` px holds: floor((height − 2 × padding) / lineHeight), at least 1. */
export function rowLineBudget(height: number, lineHeight = CELL_LINE_HEIGHT): number {
  if (!Number.isFinite(height) || !(lineHeight > 0)) return 1;
  return Math.max(1, Math.floor((height - 2 * cellPadding(height)) / lineHeight));
}

export type RowLayoutInput = {
  /** User choice saved in TablePreferences.rowHeight (TablePreferencesMenu rowHeightControl). */
  preference?: TableRowHeight;
  /** DataTable `rowHeight` prop (host default). */
  rowHeight?: TableRowHeight;
  /** TablePreferences.density of this table. */
  tableDensity?: "compact" | "comfortable";
  /** AdminProvider density. */
  providerDensity?: "compact" | "comfortable";
};
export type RowLayout = {
  /** Which input decided the height. */
  source: "preference" | "rowHeight" | "density";
  /** Preset name, or undefined when a density decided. */
  preset?: TableRowHeight;
  /** Base row height in px; undefined for "auto". */
  height?: number;
  /** Line budget for clamped content; Infinity for "auto" (content grows the row). */
  lines: number;
  /** false only for "auto". */
  clamped: boolean;
};

/**
 * Precedence: the user's saved preference > `rowHeight` prop > table density
 * preference > AdminProvider density (compact 40px, comfortable 48px).
 */
export function resolveRowLayout(input: RowLayoutInput): RowLayout {
  const preset = isTableRowHeight(input.preference) ? input.preference : isTableRowHeight(input.rowHeight) ? input.rowHeight : undefined;
  if (preset) {
    const source = isTableRowHeight(input.preference) ? "preference" : "rowHeight";
    if (preset === "auto") return { source, preset, lines: Number.POSITIVE_INFINITY, clamped: false };
    const height = TABLE_ROW_HEIGHTS[preset];
    return { source, preset, height, lines: rowLineBudget(height), clamped: true };
  }
  const height = input.tableDensity === "compact" ? 40 : input.tableDensity === "comfortable" ? 48 : input.providerDensity === "comfortable" ? 48 : 40;
  return { source: "density", height, lines: rowLineBudget(height), clamped: true };
}

export type ChipFit = {
  /** How many chips to show before the `+N` chip (N = total − visible). */
  visible: number;
  /** The last visible chip must shrink (ellipsis) so the `+N` chip fits beside it. */
  squeezeLast: boolean;
  /** Width (px) the squeezed last chip may use. */
  lastWidth?: number;
};

/**
 * Greedy chip layout (multi-select / people / linked records): chips flow left to right over at
 * most `lines` lines of `available` px; a chip wider than a line is truncated to the line. Returns
 * the largest prefix that fits together with a `+N` chip (width `plusWidth(N)`). The chip right
 * before `+N` may shrink down to `minChip` px so at least one chip stays visible where possible.
 */
export function fitChips(
  widths: readonly number[],
  available: number,
  lines: number,
  options: { gap?: number; plusWidth?: (hidden: number) => number; minChip?: number } = {},
): ChipFit {
  const total = widths.length;
  if (!total) return { visible: 0, squeezeLast: false };
  if (!Number.isFinite(lines)) return { visible: total, squeezeLast: false };
  const gap = options.gap ?? 4;
  const plusWidth = options.plusWidth ?? (() => 32);
  const minChip = options.minChip ?? 40;
  const maxLines = Math.max(1, Math.floor(lines));
  const room = Math.max(0, available);
  const attempt = (count: number): ChipFit | null => {
    let line = 1;
    let x = 0;
    let lastOnLine = -1;
    for (let i = 0; i < count; i++) {
      const width = Math.min(widths[i]!, room);
      if (x > 0 && x + gap + width > room) {
        line++;
        x = 0;
        lastOnLine = -1;
      }
      if (line > maxLines) return null;
      x = (x > 0 ? x + gap : 0) + width;
      lastOnLine = i;
    }
    if (count === total) return { visible: count, squeezeLast: false };
    const plus = Math.min(plusWidth(total - count), room);
    if (x === 0 || x + gap + plus <= room) return { visible: count, squeezeLast: false };
    if (line < maxLines) return { visible: count, squeezeLast: false };
    // Last line is full: shrink the chip just before +N if it stays readable.
    if (lastOnLine === count - 1) {
      const over = x + gap + plus - room;
      const shrunk = Math.min(widths[lastOnLine]!, room) - over;
      if (shrunk >= minChip) return { visible: count, squeezeLast: true, lastWidth: Math.floor(shrunk) };
    }
    return null;
  };
  for (let count = total; count >= 0; count--) {
    const fit = attempt(count);
    if (fit) return fit;
  }
  return { visible: 0, squeezeLast: false };
}
