import type { DashboardWidget } from "./dashboard-builder-core.ts";

/** Grid placement of one widget in the read-only view. */
export type ViewPlacement = { gridColumn: string; gridRow: string };
export type HuggedRows = {
  /** `grid-template-rows` of the view: fixed layout rows, `auto` for a number-card band. */
  templateRows: string;
  place: ReadonlyMap<string, ViewPlacement>;
};

/**
 * 8.6: number cards (kind "kpi", and "group" = a row of number cards) hug their content in the read-only view. A band of number cards that start on the
 * same layout row and that nothing else overlaps folds its layout rows (h × 28px) into one `auto` row: the band is as
 * tall as its tallest card (label, number, optional delta / sub-line) and every card in it stretches to that height.
 * Everything below moves up. Bands that share rows with a chart or table keep the stored layout.
 */
export function hugNumberRows(widgets: readonly DashboardWidget[], rowSize = "var(--aui-dbb-row, 28px)"): HuggedRows {
  const total = widgets.reduce((n, w) => Math.max(n, w.layout.y + w.layout.h), 0);
  const folded = new Map<number, number>(); // band start row → band height (layout rows)
  const isNumber = (w: DashboardWidget) => w.kind === "kpi" || w.kind === "group";
  const starts = new Set(widgets.filter(isNumber).map((w) => w.layout.y));
  for (const y of starts) {
    const band = widgets.filter((w) => isNumber(w) && w.layout.y === y);
    const h = Math.max(...band.map((w) => w.layout.h));
    const clash = widgets.some((w) => !band.includes(w) && w.layout.y < y + h && w.layout.y + w.layout.h > y);
    if (!clash) folded.set(y, h);
  }
  const map: number[] = [];
  const sizes: string[] = [];
  for (let row = 0; row < total; ) {
    const h = folded.get(row);
    if (h) {
      for (let i = 0; i < h; i += 1) map[row + i] = sizes.length;
      sizes.push("auto");
      row += h;
    } else {
      map[row] = sizes.length;
      sizes.push(rowSize);
      row += 1;
    }
  }
  const place = new Map<string, ViewPlacement>();
  for (const w of widgets) {
    const start = map[w.layout.y] ?? w.layout.y;
    const end = map[w.layout.y + w.layout.h - 1] ?? start;
    place.set(w.id, { gridColumn: `${w.layout.x + 1} / span ${w.layout.w}`, gridRow: `${start + 1} / span ${end - start + 1}` });
  }
  return { templateRows: sizes.join(" "), place };
}
