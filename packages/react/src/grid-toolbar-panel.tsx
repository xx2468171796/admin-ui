"use client";
/**
 * A BitableGrid toolbar button with its PopoverPanel (bt/grid-a): 字段配置 / 筛选 / 分组 / 排序 / 填色.
 * The label carries the state like the demos (「筛选 3」「分组 3 级」「已隐藏 2 个字段」); the panel
 * has a title with 「?」, a count on the right and a footer (另存为新视图 …).
 */
import { Suspense, useRef, useState, type ReactNode } from "react";
import { Copy } from "lucide-react";
import { Button } from "./primitives.tsx";
import { PopoverPanel, type PopoverPanelProps } from "./popover-panel.tsx";
import { ContentSkeleton } from "./loading.tsx";
import type { DynamicToken } from "./condition-core.ts";
import type { GridField, GridSelectOption, GridView, GridViewAction, GridViewLimits } from "./grid-core.ts";

import { VIEW_PANEL_WIDTHS, type ViewPanelWidth } from "./grid-view-v2.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

export { VIEW_PANEL_WIDTHS, type ViewPanelWidth } from "./grid-view-v2.ts";

export type ToolbarPanelProps = {
  icon: ReactNode;
  /** Button text (「筛选」); a number in `badge` shows how many are in effect. */
  label: string;
  /** In-effect count as a small primary badge after the label (「筛选 3」 → label 「筛选」 + badge 3). */
  badge?: number;
  /** What the badge means for screen readers (default 「N 项生效」), e.g. 「已隐藏 2 个字段」. */
  badgeLabel?: string;
  active?: boolean;
  title: string;
  help?: ReactNode;
  headerExtra?: ReactNode | ((close: () => void) => ReactNode);
  footer?: ReactNode | ((close: () => void) => ReactNode);
  /** A tier of VIEW_PANEL_WIDTHS (condition / list / field) or a PopoverPanel width. */
  width?: PopoverPanelProps["width"] | ViewPanelWidth;
  disabled?: boolean;
  /**
   * Load the panel body early (hover / focus of the button). The bodies of the built-in panels are lazy modules,
   * so the grid's first paint does not carry the condition / sort / field editors; the body renders inside a
   * Suspense with a skeleton while it loads.
   */
  preload?: () => void;
  children: (close: () => void) => ReactNode;
};

export function ToolbarPanel({ icon, label, badge, badgeLabel, active, title, help, headerExtra, footer, width = "md", disabled, preload, children }: ToolbarPanelProps) {
  const px = width === "condition" || width === "list" || width === "field" ? VIEW_PANEL_WIDTHS[width] : width;
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  };
  const done = () => close(true);
  return (
    <>
      <Button ref={trigger} variant="ghost" size="sm" className="aui-grid-tool" data-active={active || undefined} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={() => setOpen((v) => !v)}
        onPointerEnter={preload} onFocus={preload}>
        {icon}
        <span className="aui-grid-tool-label">{label}</span>
        {badge ? <span className="aui-grid-tool-badge" aria-label={badgeLabel ?? `${badge} 项生效`}>{badge}</span> : null}
      </Button>
      <PopoverPanel open={open} anchor={trigger.current} onClose={close} title={title} help={help} width={px} sheet
        headerExtra={typeof headerExtra === "function" ? headerExtra(done) : headerExtra}
        footer={typeof footer === "function" ? footer(done) : footer}>
        {open && <Suspense fallback={<ContentSkeleton rows={3} />}>{children(done)}</Suspense>}
      </PopoverPanel>
    </>
  );
}

/** Footer of the view panels: the host's note (「只改你的个人设置，自动保存」) and 「另存为新视图」. */
export function PanelFooter({ note, onSaveAsView, children }: { note?: string; onSaveAsView?: () => void; children?: ReactNode }) {
  if (!note && !onSaveAsView && !children) return null;
  return (
    <div className="aui-grid-panel-foot">
      {children}
      {note && <span className="aui-grid-panel-note">{note}</span>}
      {onSaveAsView && <Button variant="outline" size="sm" className="aui-grid-panel-save" onClick={onSaveAsView}><Copy />另存为新视图</Button>}
    </div>
  );
}

/** What every view panel gets from GridToolbar. */
export type GridToolContext<T> = {
  fields: readonly GridField<T>[];
  view: GridView;
  apply: (action: GridViewAction) => void;
  limits: GridViewLimits;
  /** Choices of user fields (filters). */
  valueOptions?: Readonly<Record<string, readonly GridSelectOption[]>>;
  /** Dynamic values for people filters (default 我 / 我的下属). */
  dynamicTokens?: readonly DynamicToken[];
  timeZone?: string;
  /** 「另存为新视图」 in the panels' footers. */
  onSaveAsView?: () => void;
  /** Note next to it (「只改你的个人设置，自动保存」). */
  panelNote?: string;
  /** Server data: 自动排序 does not apply. */
  server?: boolean;
  /** All / matching records of the current data (the filter panel's 「符合 5 / 168 条」). */
  counts?: { total?: number; matched?: number };
};
