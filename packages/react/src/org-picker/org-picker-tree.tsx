"use client";
/**
 * Left pane of the OrgPicker: the organisation tree (group ▸ companies ▸ departments), loaded lazily.
 * WAI-ARIA tree: role="tree" / treeitem with aria-level, aria-expanded, aria-checked (true / false /
 * mixed when something below is picked) and aria-selected (the node whose people are in the middle);
 * roving tabindex; ↑ ↓ ← → Home End, Space ticks, Enter opens. Locked nodes are grey with a lock and the
 * reason in a bubble; hidden ones are left out with a count at the bottom.
 */
import { useEffect, useRef, type KeyboardEvent } from "react";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";
import { Button } from "../primitives.tsx";
import { tipProps } from "../tooltip.tsx";
import { nodeCheckState, unitSubject, type OrgUnit } from "./org-picker-core.ts";
import { treeKey, visibleTreeRows } from "./org-picker-nav.ts";
import { blockedReason, isHidden, type PickerModel } from "./org-picker-model.ts";
import { SkeletonRows, SubjectMark, Tick } from "./org-picker-parts.tsx";
import type { OrgTree } from "./use-org-data.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/org-picker.css";

export type OrgTreePaneProps = {
  model: PickerModel;
  tree: OrgTree;
  current: string | null;
  focusId: string | null;
  onFocusId: (id: string) => void;
  onOpen: (id: string) => void;
  /** Bumped to scroll the current node into view (defaultFocus / 「回到我的位置」). */
  scrollKey?: number;
};

export function OrgTreePane({ model, tree, current, focusId, onFocusId, onOpen, scrollKey }: OrgTreePaneProps) {
  const box = useRef<HTMLDivElement>(null);
  const hidden = (u: OrgUnit) => isHidden(model, u);
  const rows = tree.roots ? visibleTreeRows(tree.roots, tree.children, tree.expanded, hidden) : [];
  const hiddenCount = tree.roots ? [...tree.roots, ...[...tree.children.values()].flat()].filter(hidden).length : 0;
  const active = rows.some((r) => r.unit.id === focusId) ? focusId : (current ?? rows[0]?.unit.id ?? null);
  useEffect(() => {
    if (!current) return;
    box.current?.querySelector(`[data-node-id="${CSS.escape(current)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [scrollKey, current, rows.length]);
  const toggle = (unit: OrgUnit) => {
    const ref = { kind: unit.kind, id: unit.id };
    if (model.isPicked(ref)) return model.remove(ref);
    if (blockedReason(model, ref, unit.availability)) return;
    model.toggle(unitSubject(unit, model.index, model.includeSubDefault));
  };
  const onKey = (event: KeyboardEvent) => {
    const action = treeKey(rows, active, event.key);
    if (!action) return;
    event.preventDefault();
    const row = rows.find((r) => r.unit.id === action.id);
    if (action.type === "focus") {
      onFocusId(action.id);
      requestAnimationFrame(() => box.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(action.id)}"]`)?.focus());
    } else if (action.type === "expand") tree.expand(action.id);
    else if (action.type === "collapse") tree.collapse(action.id);
    else if (action.type === "toggle" && row) toggle(row.unit);
    else if (action.type === "open") onOpen(action.id);
  };
  if (tree.error && !tree.roots) {
    return (
      <div className="aui-orgp-tree" role="alert">
        <p className="aui-orgp-empty">{model.t(model.m.loadFailed, { reason: tree.error })}</p>
        <Button size="sm" variant="outline" onClick={tree.retry}>{model.m.retry}</Button>
      </div>
    );
  }
  if (!tree.roots) return <div className="aui-orgp-tree"><SkeletonRows rows={7} label={model.m.loading} /></div>;
  return (
    <div className="aui-orgp-tree" ref={box}>
      <div role="tree" aria-label={model.m.treeLabel} aria-multiselectable={!model.single || undefined} onKeyDown={onKey}>
        {rows.map((row) => {
          const { unit } = row;
          const ref = { kind: unit.kind, id: unit.id };
          const a = model.avail(ref, unit.availability);
          const locked = a.state === "locked";
          const state = nodeCheckState(unit, model.value, model.index, model.mixed);
          const block = blockedReason(model, ref, unit.availability);
          const selectable = model.canSelect(unit.kind) && !model.single;
          const tickDisabled = state === "covered" || (Boolean(block) && state !== "checked");
          const count = unit.memberCount;
          const loading = tree.loading.has(unit.id);
          return (
            <div
              key={unit.id}
              role="treeitem"
              data-node-id={unit.id}
              aria-level={row.level}
              aria-expanded={row.hasChildren ? row.expanded : undefined}
              aria-selected={current === unit.id}
              aria-checked={selectable ? (state === "checked" || state === "covered" ? true : state === "mixed" ? "mixed" : false) : undefined}
              aria-disabled={locked || undefined}
              aria-busy={loading || undefined}
              aria-label={[unit.label, count === undefined ? "" : model.t(model.m.people, { n: count }), locked ? (a.reason ?? model.m.locked) : ""].filter(Boolean).join("，")}
              tabIndex={active === unit.id ? 0 : -1}
              className="aui-orgp-node"
              data-current={current === unit.id || undefined}
              data-locked={locked || undefined}
              style={{ paddingLeft: 8 + (row.level - 1) * 20 }}
              onFocus={() => onFocusId(unit.id)}
              onClick={() => {
                onFocusId(unit.id);
                // Locked nodes still open: the middle says why and who to ask, the people show their locks.
                onOpen(unit.id);
              }}
            >
              <span
                className="aui-orgp-caret"
                data-hidden={!row.hasChildren || undefined}
                aria-hidden="true"
                onClick={(event) => {
                  event.stopPropagation();
                  if (row.expanded) tree.collapse(unit.id);
                  else tree.expand(unit.id);
                }}
              >
                {row.expanded ? <ChevronDown /> : <ChevronRight />}
              </span>
              {locked ? (
                <Lock className="aui-orgp-lock" aria-hidden="true" {...tipProps(a.reason ?? model.m.locked)} />
              ) : selectable ? (
                <span {...tipProps(block && state !== "checked" && block.kind !== "full" ? block.reason : null)}>
                  <Tick state={state === "covered" ? "checked" : state} disabled={tickDisabled} onToggle={() => toggle(unit)} />
                </span>
              ) : null}
              <SubjectMark kind={unit.kind} id={unit.id} label={unit.label} size={20} />
              <span className="aui-orgp-node-label" {...tipProps(unit.label, undefined, { truncated: true })}>{unit.label}</span>
              {unit.hint && <span className="aui-orgp-node-hint">{unit.hint}</span>}
              {unit.badge && <span className="aui-orgp-badge">{unit.badge}</span>}
              {count !== undefined && !locked && <span className="aui-orgp-node-count">{new Intl.NumberFormat(model.locale).format(count)}</span>}
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 && <p className="aui-orgp-tree-hidden">{model.t(model.m.hiddenCount, { n: hiddenCount })}</p>}
    </div>
  );
}
