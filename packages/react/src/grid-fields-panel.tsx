"use client";
/**
 * 字段配置 panel v2 (bt/grid-a G6, demo D05): 「显示 13 / 15」, search, 全部显示 / 全部隐藏, drag to
 * reorder (the primary field is locked first), collapsible field groups with a group eye, a lock on
 * restricted fields, 新建字段 / 新建字段编组 from the host. Order and groups are part of the view.
 * The body (grid-fields-body.tsx) loads on first open.
 */
import { useState, type ReactNode } from "react";
import { Columns3, FolderPlus, Plus } from "lucide-react";
import { Button } from "./primitives.tsx";
import { ToolbarPanel, type GridToolContext } from "./grid-toolbar-panel.tsx";
import { lazyPart } from "./lazy-part.ts";
import type { GridFieldsBodyProps } from "./grid-fields-body.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

const body = lazyPart(() => import("./grid-fields-body.tsx").then((m) => m.GridFieldsBody));
const FieldsBody = body.Part as <T>(props: GridFieldsBodyProps<T>) => ReactNode;
/** Fetch the panel body ahead of the first open (GridToolbar calls it when the browser is idle). */
export const preloadFieldsPanel = body.preload;

export type GridFieldsToolProps = {
  /** 「+ 新建字段」 (host opens its field dialog). */
  onCreateField?: () => void;
  /** 「新建字段编组」 (host asks for a name, then applies `addFieldGroup`). */
  onCreateGroup?: () => void;
};

export function GridFieldsTool<T>({ fields, view, apply, onCreateField, onCreateGroup }: GridToolContext<T> & GridFieldsToolProps) {
  const [query, setQuery] = useState("");
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const shown = view.order.length - view.hidden.length;
  const label = "字段";
  return (
    <ToolbarPanel icon={<Columns3 />} preload={body.preload} label={label} badge={view.hidden.length} badgeLabel={`已隐藏 ${view.hidden.length} 个字段`} active={view.hidden.length > 0} title="字段配置" width="field"
      help="勾掉眼睛隐藏字段（只是不在这个视图里显示，数据还在）；拖动左边的把手调整列的顺序，可以拖进或拖出字段编组。主字段固定在第一列，不能隐藏。"
      headerExtra={<span className="aui-grid-panel-count">显示 {shown} / {view.order.length}</span>}
      footer={(onCreateField || onCreateGroup) ? (
        <div className="aui-grid-panel-foot">
          {onCreateField && <Button variant="ghost" size="sm" onClick={onCreateField}><Plus />新建字段</Button>}
          {onCreateGroup && <Button variant="ghost" size="sm" onClick={onCreateGroup}><FolderPlus />新建字段编组</Button>}
        </div>
      ) : undefined}>
      {() => <FieldsBody fields={fields} view={view} apply={apply} query={query} onQueryChange={setQuery} folded={folded} onFoldedChange={setFolded} />}
    </ToolbarPanel>
  );
}
