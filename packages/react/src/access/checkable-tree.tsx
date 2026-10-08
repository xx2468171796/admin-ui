"use client";
/**
 * CheckableTree — tri-state checkbox tree for menus / permissions / departments (antd Tree checkable +
 * checkStrictly, RuoYi menu_check_strictly). Controlled and presentational: the host owns `value`.
 * WAI-ARIA tree: one Tab stop (roving tabindex), ↑ ↓ Home End move, → expands / enters, ← collapses /
 * goes to the parent, Space or Enter toggles. Rows are flat with aria-level / setsize / posinset.
 */
import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronRight, Minus, Search } from "lucide-react";
import { Button, Checkbox, Input, Switch } from "../primitives.tsx";
import type { TreeNode } from "./contracts.ts";
import {
  branchIds,
  checkStates,
  halfChecked,
  indexTree,
  setAll,
  toggleNode,
  treeKey,
  visibleIds,
  visibleRows,
  type CheckState,
} from "./tree-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type CheckableTreeProps = {
  nodes: readonly TreeNode[];
  /** Checked ids (multiple) or the picked id (single, 0–1 items). */
  value: readonly string[];
  onValueChange?: (value: string[], info: { halfChecked: string[] }) => void;
  /** Accessible name, e.g.「菜单权限」「部门」. */
  label: string;
  /** `single` picks one node (radio look, aria-selected) — used by OrgTreePicker. */
  mode?: "multiple" | "single";
  /** Parent/child linkage (default true). Off = every node independent (RuoYi check_strictly off). */
  linked?: boolean;
  /** Pass to show the「父子联动」switch in the toolbar. */
  onLinkedChange?: (linked: boolean) => void;
  /** Search box (default true). */
  searchable?: boolean;
  /** Expand / collapse all, select all / none and「只看已选」(default true). */
  toolbar?: boolean;
  /** Extra toolbar content on the right. */
  actions?: ReactNode;
  readOnly?: boolean;
  disabled?: boolean;
  /** Initially expanded: "all", "none" or ids. Default: all when ≤ 50 nodes, else the first level + paths to checked nodes. */
  defaultExpanded?: "all" | "none" | readonly string[];
  /** Single mode: nodes that may be picked (others only expand). */
  isSelectable?: (node: TreeNode) => boolean;
  /** Bounded scroll height of the tree body (default 360px). */
  maxHeight?: number | string;
  emptyLabel?: string;
  /** Grey text after the label (default node.hint). */
  renderHint?: (node: TreeNode) => ReactNode;
};

function highlight(text: string, query: string): ReactNode {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return text;
  const lower = text.toLowerCase();
  const marks: [number, number][] = [];
  for (const w of words) {
    let at = lower.indexOf(w);
    while (at >= 0) {
      marks.push([at, at + w.length]);
      at = lower.indexOf(w, at + w.length);
    }
  }
  if (!marks.length) return text;
  marks.sort((a, b) => a[0] - b[0]);
  const out: ReactNode[] = [];
  let pos = 0;
  for (const [s, e] of marks) {
    if (e <= pos) continue;
    const start = Math.max(s, pos);
    if (start > pos) out.push(text.slice(pos, start));
    out.push(<mark key={start} className="aui-access-mark">{text.slice(start, e)}</mark>);
    pos = e;
  }
  out.push(text.slice(pos));
  return out;
}

/** The visual (non-focusable) tri-state box used inside tree items and matrix cells. */
export function CheckMark({ state, disabled }: { state: CheckState; disabled?: boolean }) {
  return (
    <span className="aui-checkbox aui-access-checkmark" data-state={state} data-disabled={disabled || undefined} aria-hidden="true">
      {state === "checked" ? <Check size={13} /> : state === "indeterminate" ? <Minus size={13} /> : null}
    </span>
  );
}

export function CheckableTree({
  nodes,
  value,
  onValueChange,
  label,
  mode = "multiple",
  linked: linkedProp = true,
  onLinkedChange,
  searchable = true,
  toolbar = true,
  actions,
  readOnly = false,
  disabled = false,
  defaultExpanded,
  isSelectable,
  maxHeight = 360,
  emptyLabel = "没有节点",
  renderHint,
}: CheckableTreeProps) {
  const single = mode === "single";
  const linked = !single && linkedProp;
  const index = useMemo(() => indexTree(nodes), [nodes]);
  const checkedSet = useMemo(() => new Set(value), [value]);
  const states = useMemo(() => checkStates(index, checkedSet, linked), [index, checkedSet, linked]);
  const [query, setQuery] = useState("");
  const [onlyChecked, setOnlyChecked] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (defaultExpanded === "all") return new Set(branchIds(index));
    if (defaultExpanded === "none") return new Set();
    if (defaultExpanded) {
      // Expanding a node implies its ancestors.
      const set = new Set<string>();
      for (const id of defaultExpanded) for (const a of [...(index.byId.get(id)?.ancestors ?? []), id]) set.add(a);
      return set;
    }
    // Default: small trees (≤ 50 nodes) fully open; larger ones show the first level plus the path to
    // every checked node, so what is selected is always visible.
    if (index.order.length <= 50) return new Set(branchIds(index));
    const set = new Set(index.roots.filter((id) => index.byId.get(id)!.childIds.length));
    for (const id of value) for (const a of index.byId.get(id)?.ancestors ?? []) set.add(a);
    return set;
  });
  // While searching every kept branch opens; collapsing during a search is remembered until the query changes.
  const [filterCollapsed, setFilterCollapsed] = useState<Set<string>>(new Set());
  useEffect(() => setFilterCollapsed(new Set()), [query, onlyChecked]);
  const keep = useMemo(() => visibleIds(index, { query, onlyChecked, states }), [index, query, onlyChecked, states]);
  const effectiveExpanded = useMemo(
    () => (keep ? new Set(branchIds(index).filter((id) => !filterCollapsed.has(id))) : expanded),
    [keep, index, filterCollapsed, expanded],
  );
  const rows = useMemo(() => visibleRows(index, effectiveExpanded, keep), [index, effectiveExpanded, keep]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const tabStop = rows.some((r) => r.id === focusId) ? focusId : (rows.find((r) => checkedSet.has(r.id))?.id ?? rows[0]?.id ?? null);
  const refs = useRef(new Map<string, HTMLDivElement>());
  const moveFocus = useRef(false);
  useEffect(() => {
    if (!moveFocus.current || !focusId) return;
    moveFocus.current = false;
    refs.current.get(focusId)?.focus();
  }, [focusId, rows]);

  const interactive = !readOnly && !disabled && !!onValueChange;
  const selectable = (node: TreeNode) => !node.disabled && (!single || !isSelectable || isSelectable(node));
  const emit = (next: string[]) => onValueChange?.(next, { halfChecked: halfChecked(index, next, linked) });
  const toggle = (id: string) => {
    if (!interactive) return;
    const node = index.byId.get(id)?.node;
    if (!node || !selectable(node)) return;
    if (single) emit(checkedSet.has(id) ? [] : [id]);
    else emit(toggleNode(index, value, id, linked));
  };
  const setOpen = (id: string, open: boolean) => {
    if (keep) {
      setFilterCollapsed((prev) => {
        const next = new Set(prev);
        if (open) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (open) next.add(id);
        else next.delete(id);
        return next;
      });
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, id: string) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      toggle(id);
      return;
    }
    const result = treeKey(rows, index, id, event.key);
    if (!result) return;
    event.preventDefault();
    if (result.expand) setOpen(result.expand, true);
    if (result.collapse) setOpen(result.collapse, false);
    if (result.focus) {
      moveFocus.current = true;
      setFocusId(result.focus);
    }
  };
  const total = index.order.length;
  const pickedCount = single ? value.length : value.filter((id) => index.byId.has(id)).length;
  const allBranches = branchIds(index);
  const hasBranches = allBranches.length > 0;

  return (
    <div className="aui-access-tree" data-disabled={disabled || undefined}>
      {(searchable || toolbar || onLinkedChange || actions) && (
        <div className="aui-access-tree-toolbar">
          {searchable && (
            <label className="aui-access-search">
              <Search size={15} aria-hidden="true" />
              <Input type="search" clearable value={query} placeholder="搜索名称或编码" aria-label={`搜索${label}`} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
            </label>
          )}
          {toolbar && hasBranches && (
            <>
              <Button size="sm" variant="ghost" onClick={() => (keep ? setFilterCollapsed(new Set()) : setExpanded(new Set(allBranches)))}>展开全部</Button>
              <Button size="sm" variant="ghost" onClick={() => (keep ? setFilterCollapsed(new Set(allBranches)) : setExpanded(new Set()))}>收起全部</Button>
            </>
          )}
          {toolbar && !single && interactive && (
            <>
              <Button size="sm" variant="ghost" onClick={() => emit(setAll(index, value, true, linked))}>全选</Button>
              <Button size="sm" variant="ghost" onClick={() => emit(setAll(index, value, false, linked))}>全不选</Button>
            </>
          )}
          {toolbar && (
            <label className="aui-access-toggle">
              <Checkbox checked={onlyChecked} onCheckedChange={(c) => setOnlyChecked(c === true)} aria-label="只看已选" />
              <span>只看已选</span>
            </label>
          )}
          {onLinkedChange && !single && (
            <label className="aui-access-toggle">
              <Switch checked={linkedProp} disabled={readOnly || disabled} onCheckedChange={onLinkedChange} aria-label="父子联动" />
              <span>父子联动</span>
            </label>
          )}
          {toolbar && <span className="aui-access-tree-count aui-note" aria-live="polite">
            {single ? (pickedCount ? "已选 1 项" : "未选择") : `已选 ${pickedCount} / ${total}`}
          </span>}
          {actions && <div className="aui-access-tree-actions">{actions}</div>}
        </div>
      )}
      <div className="aui-access-tree-body" style={{ maxHeight }}>
        {rows.length === 0 ? (
          <div className="aui-access-empty aui-note" role="status">
            {query || onlyChecked ? (
              <>
                <span>{onlyChecked && !query ? "还没有选中任何节点" : "没有匹配的节点"}</span>
                <Button size="sm" variant="outline" onClick={() => { setQuery(""); setOnlyChecked(false); }}>清除筛选</Button>
              </>
            ) : (
              emptyLabel
            )}
          </div>
        ) : (
          <div role="tree" aria-label={label} aria-readonly={readOnly || undefined} aria-disabled={disabled || undefined} aria-multiselectable={single ? false : undefined} className="aui-access-tree-list">
            {rows.map((row) => {
              const entry = index.byId.get(row.id)!;
              const node = entry.node;
              const state = states.get(row.id) ?? "unchecked";
              const canPick = selectable(node);
              const hint = renderHint ? renderHint(node) : node.hint;
              return (
                <div
                  key={row.id}
                  ref={(el) => {
                    if (el) refs.current.set(row.id, el);
                    else refs.current.delete(row.id);
                  }}
                  role="treeitem"
                  aria-level={row.depth + 1}
                  aria-setsize={row.setSize}
                  aria-posinset={row.posInSet}
                  aria-expanded={row.hasChildren ? row.expanded : undefined}
                  aria-checked={single ? undefined : state === "indeterminate" ? "mixed" : state === "checked"}
                  aria-selected={single ? checkedSet.has(row.id) : undefined}
                  aria-disabled={!canPick || disabled || undefined}
                  tabIndex={row.id === tabStop ? 0 : -1}
                  className="aui-access-tree-row"
                  data-depth={row.depth}
                  data-picked={single && checkedSet.has(row.id) ? true : undefined}
                  style={{ ["--aui-tree-depth" as string]: row.depth }}
                  onFocus={() => setFocusId(row.id)}
                  onKeyDown={(e) => onKeyDown(e, row.id)}
                  onClick={() => {
                    setFocusId(row.id);
                    if (canPick) toggle(row.id);
                    else if (row.hasChildren) setOpen(row.id, !row.expanded);
                  }}
                >
                  <span
                    className="aui-access-tree-twist"
                    data-open={row.expanded || undefined}
                    data-leaf={!row.hasChildren || undefined}
                    aria-hidden="true"
                    onClick={(e) => {
                      if (!row.hasChildren) return;
                      e.stopPropagation();
                      setFocusId(row.id);
                      setOpen(row.id, !row.expanded);
                    }}
                  >
                    {row.hasChildren && <ChevronRight size={14} />}
                  </span>
                  {single ? (
                    canPick ? <span className="aui-access-radio" data-state={checkedSet.has(row.id) ? "checked" : "unchecked"} aria-hidden="true" /> : null
                  ) : (
                    <CheckMark state={state} disabled={node.disabled || disabled} />
                  )}
                  <span className="aui-access-tree-label">
                    {highlight(node.label, query)}
                    {hint !== undefined && hint !== null && hint !== "" && (
                      <Fragment>
                        {" "}
                        <span className="aui-access-hint">{typeof hint === "string" ? highlight(hint, query) : hint}</span>
                      </Fragment>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
