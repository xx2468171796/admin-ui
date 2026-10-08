"use client";
/**
 * ViewOverrideBar (bt/grid-a G14, demo D01): the slim bar under a grid's toolbar when the user's own
 * settings differ from the shared view — 「你的个人设置：筛选 3 条（含 1 个条件组）、按「阶段」分组、调过
 * 3 列的列宽。只对你生效，已自动保存。」 + 恢复共享设置 / 保存给所有人 (only with the right) / 另存为新视图.
 * Renders nothing while the two views are the same. Put it in BitableGrid's `banner`.
 */
import { Info } from "lucide-react";
import { Button } from "./primitives.tsx";
import { describeViewDiff, viewDiffText } from "./view-diff-core.ts";
import type { GridField, GridView } from "./grid-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

export type ViewOverrideBarProps<T> = {
  /** The shared view (what everyone sees). */
  base: GridView;
  /** This user's view. */
  view: GridView;
  fields: readonly GridField<T>[];
  /** 恢复: drop the personal copy. */
  onReset: () => void;
  /** 保存给所有人: give it only when the user may change the shared view. */
  onSaveForAll?: () => void;
  /** 另存为我的视图. */
  onSaveAsNew?: () => void;
  /** Name of the standard / shared view the user changed: 「你改了「我的客户」的筛选（阶段 = 报价），只对你生效…」. */
  viewName?: string;
  /** Lead text without `viewName` (default 「你的个人设置」). */
  title?: string;
  /** Tail without `viewName` (default 「只对你生效，已自动保存。」). */
  note?: string;
};

/**
 * One line under the view tabs / toolbar: attention-soft bar, what changed, 「只对你生效」, then
 * text buttons 恢复 · 另存为我的视图 · 保存给所有人 (the last only for maintainers). Nothing while nothing differs.
 */
export function ViewOverrideBar<T>({ base, view, fields, onReset, onSaveForAll, onSaveAsNew, viewName, title = "你的个人设置", note = "只对你生效，已自动保存。" }: ViewOverrideBarProps<T>) {
  const items = describeViewDiff(base, view, fields);
  if (!items.length) return null;
  const diff = <span data-tip={items.map((item) => item.text).join("、")}>{viewDiffText(items)}</span>;
  return (
    <div className="aui-view-override" role="status">
      <Info className="aui-view-override-icon" aria-hidden="true" />
      <p className="aui-view-override-text">
        {viewName ? (
          <>你改了「{viewName}」的{diff}，<strong>只对你生效</strong>，别人看到的还是原样</>
        ) : (
          <><strong>{title}：</strong>{diff}。{note}</>
        )}
      </p>
      <span className="aui-view-override-actions">
        <Button variant="ghost" size="sm" onClick={onReset}>恢复</Button>
        {onSaveAsNew && <Button variant="ghost" size="sm" onClick={onSaveAsNew}>另存为我的视图</Button>}
        {onSaveForAll && <Button variant="ghost" size="sm" data-strong="" onClick={onSaveForAll}>保存给所有人</Button>}
      </span>
    </div>
  );
}
