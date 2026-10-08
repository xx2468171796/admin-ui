/**
 * Pure rules of DataTable's phone card list, the shared bulk bar and the pagination footer (* review 05). No React / DOM — unit-tested in test/data-card-core.test.ts.
 */

/** Where a column goes on a phone card: the bold title, a chip next to it, the grey meta line, or nowhere. */
export type ColumnMobileRole = "primary" | "status" | "meta" | "hidden";

export type CardColumnInput = { key: string; kind?: "data" | "actions"; mobile?: ColumnMobileRole };

export type CardLayout = {
  /** Column shown as the card title (bold). */
  primary?: string;
  /** Columns shown as chips right after the title (stage / status). */
  status: string[];
  /** Columns on the grey line under the title (owner · money · next follow-up). */
  meta: string[];
  /** The actions column (rendered as ⋯ on the card). */
  actions?: string;
};

/** Meta columns picked automatically when no column says `mobile: "meta"` (explicit ones are always shown). */
export const DEFAULT_CARD_META = 3;
/** Column keys treated as the status chip when no column sets `mobile: "status"`. */
const STATUS_KEYS: ReadonlySet<string> = new Set(["status", "stage", "state"]);

/**
 * Which column goes where on a phone card. Explicit `mobile` hints win; otherwise: title = first data
 * column, chip = the column keyed status / stage / state (at most one), meta = the next data columns in
 * order up to `maxMeta`, ⋯ = the `kind: "actions"` column. `hidden` columns only appear in the record view.
 */
export function cardLayout(columns: readonly CardColumnInput[], maxMeta = DEFAULT_CARD_META): CardLayout {
  const visible = columns.filter((c) => c.mobile !== "hidden");
  const actions = visible.find((c) => c.kind === "actions")?.key;
  const data = visible.filter((c) => c.kind !== "actions");
  const primary = (data.find((c) => c.mobile === "primary") ?? data.find((c) => c.mobile === undefined))?.key;
  const explicitStatus = data.filter((c) => c.mobile === "status" && c.key !== primary).map((c) => c.key);
  const status = explicitStatus.length
    ? explicitStatus
    : data.filter((c) => c.mobile === undefined && c.key !== primary && STATUS_KEYS.has(c.key)).slice(0, 1).map((c) => c.key);
  const taken = new Set([primary, ...status]);
  const explicitMeta = data.filter((c) => c.mobile === "meta" && !taken.has(c.key)).map((c) => c.key);
  const room = Math.max(0, Math.floor(maxMeta) - explicitMeta.length);
  const auto = data.filter((c) => c.mobile === undefined && !taken.has(c.key)).slice(0, room).map((c) => c.key);
  // Keep the table's column order on the meta line.
  const metaSet = new Set([...explicitMeta, ...auto]);
  const meta = data.filter((c) => metaSet.has(c.key)).map((c) => c.key);
  return { primary, status, meta, actions };
}

/** 「已显示 21–40 条」 range of a cursor page (1-based page index); null when the page is empty. */
export function cursorRange(pageIndex: number, pageSize: number, count: number): { from: number; to: number } | null {
  if (!(count > 0) || !(pageSize > 0)) return null;
  const from = Math.max(0, Math.floor(pageIndex) - 1) * Math.floor(pageSize) + 1;
  return { from, to: from + Math.floor(count) - 1 };
}

/** Left side of the page footer: 「共 168 条」, with a selection 「已选 2 / 共 168 条」; loading → 「—」. */
export function footerCountText(total: number | null, selected = 0): string {
  const all = total === null ? "—" : total.toLocaleString("zh-CN");
  return selected > 0 ? `已选 ${selected.toLocaleString("zh-CN")} / 共 ${all} 条` : `共 ${all} 条`;
}

/** Bulk bar: the first `maxVisible` actions are buttons, the rest go into ⋯ (none hidden when they all fit). */
export function splitBulkActions<A>(actions: readonly A[], maxVisible: number): { visible: A[]; overflow: A[] } {
  const limit = Math.max(0, Math.floor(Number.isFinite(maxVisible) ? maxVisible : actions.length));
  if (actions.length <= limit) return { visible: [...actions], overflow: [] };
  return { visible: actions.slice(0, limit), overflow: actions.slice(limit) };
}
