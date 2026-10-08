/**
 * describeViewDiff (bt/grid-a G14, demo D01 「你的个人设置」 bar): what a user's own copy of a shared
 * BitableGrid view changed, as short Chinese phrases — 「筛选 3 条（含 1 个条件组）」「按「阶段」分组」
 * 「调过 3 列的列宽」… Search text and collapsed groups are not settings and are ignored; ids of
 * conditions do not count. Pure; unit-tested in test/grid-view-v2.test.ts.
 */
import { conditionTreeKey, countConditionGroups, countConditions } from "./condition-core.ts";
import { activeFilterCount } from "./grid-core.ts";
import { ROW_HEIGHT_LABELS } from "./table-rows.ts";
import type { GridField, GridView } from "./grid-core.ts";

export type ViewDiffKind = "filter" | "group" | "sort" | "hidden" | "order" | "widths" | "rowHeight" | "summary" | "colors" | "fieldGroups" | "emptyGroups" | "autoSort" | "frozen";
export type ViewDiffItem = { kind: ViewDiffKind; text: string };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function describeViewDiff<T>(base: GridView, mine: GridView, fields: readonly GridField<T>[]): ViewDiffItem[] {
  const title = (key: string) => fields.find((field) => field.key === key)?.title ?? key;
  const out: ViewDiffItem[] = [];
  if (conditionTreeKey(base.filter) !== conditionTreeKey(mine.filter)) {
    const n = activeFilterCount(mine, fields);
    const groups = countConditionGroups(mine.filter);
    out.push({ kind: "filter", text: n ? `筛选 ${n} 条${groups ? `（含 ${groups} 个条件组）` : ""}` : countConditions(mine.filter) ? "筛选条件还没填完" : "去掉了筛选" });
  }
  if (!same(base.groupBy, mine.groupBy))
    out.push({ kind: "group", text: mine.groupBy.length ? `按「${mine.groupBy.map((level) => title(level.field)).join(" → ")}」分组` : "取消了分组" });
  if (!same(base.sort, mine.sort)) out.push({ kind: "sort", text: mine.sort.length ? `排序 ${mine.sort.length} 级` : "取消了排序" });
  const hiddenMore = mine.hidden.filter((key) => !base.hidden.includes(key)).length;
  const shownMore = base.hidden.filter((key) => !mine.hidden.includes(key)).length;
  if (hiddenMore || shownMore) out.push({ kind: "hidden", text: [hiddenMore ? `隐藏 ${hiddenMore} 个字段` : "", shownMore ? `显示 ${shownMore} 个隐藏字段` : ""].filter(Boolean).join("、") });
  if (!same(base.order, mine.order)) out.push({ kind: "order", text: "调了字段顺序" });
  if (!same(base.fieldGroups, mine.fieldGroups)) out.push({ kind: "fieldGroups", text: "改了字段编组" });
  const widthKeys = new Set([...Object.keys(base.widths), ...Object.keys(mine.widths)]);
  const widths = [...widthKeys].filter((key) => base.widths[key] !== mine.widths[key]).length;
  if (widths) out.push({ kind: "widths", text: `调过 ${widths} 列的列宽` });
  if (base.rowHeight !== mine.rowHeight) out.push({ kind: "rowHeight", text: `行高改为「${ROW_HEIGHT_LABELS[mine.rowHeight]}」` });
  const summaryKeys = new Set([...Object.keys(base.summary), ...Object.keys(mine.summary)]);
  const summaries = [...summaryKeys].filter((key) => (base.summary[key] ?? "none") !== (mine.summary[key] ?? "none")).length;
  if (summaries) out.push({ kind: "summary", text: `改了 ${summaries} 列的统计` });
  if (!same(base.colors, mine.colors)) out.push({ kind: "colors", text: mine.colors.length ? `填色 ${mine.colors.length} 条规则` : "去掉了填色" });
  if (base.showEmptyGroups !== mine.showEmptyGroups) out.push({ kind: "emptyGroups", text: mine.showEmptyGroups ? "显示空分组" : "不显示空分组" });
  if (base.frozen !== mine.frozen) out.push({ kind: "frozen", text: mine.frozen === undefined ? "冻结列恢复默认" : mine.frozen ? `冻结前 ${mine.frozen} 列` : "取消了冻结" }); // bt/grid-b GridView.frozen
  if (base.autoSort !== mine.autoSort) out.push({ kind: "autoSort", text: mine.autoSort ? "打开自动排序" : "关闭自动排序" });
  return out;
}

/** 「筛选 3 条、按「阶段」分组、调过 3 列的列宽」 (at most `max` items, then 「等 N 项」). */
export function viewDiffText(items: readonly ViewDiffItem[], max = 4): string {
  const shown = items.slice(0, max).map((item) => item.text).join("、");
  return items.length > max ? `${shown} 等 ${items.length} 项` : shown;
}
