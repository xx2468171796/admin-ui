"use client";
/**
 * The OrgPicker on phones (≤ 760px): the same dialog full screen, the tree turned
 * into a drill-down list (breadcrumb you can tap back up, 「›」 to go into a department, the tick picks the
 * whole department), and the selection folded into a bottom bar — tap it and the selected list rises
 * from the bottom (remove, 「含下级」, 「收起 / 确定」).
 */
import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, ChevronUp } from "lucide-react";
import { Button } from "../primitives.tsx";
import { IconButton } from "../buttons.tsx";
import { chainOf, groupByKind, nodeCheckState, unitSubject, type OrgDataSource, type OrgUnit } from "./org-picker-core.ts";
import { selectionSummary } from "./org-picker-text.ts";
import { blockedReason, isHidden, type PickerModel } from "./org-picker-model.ts";
import { MembersPane, WholeRow, type OrgShortcut } from "./org-picker-members.tsx";
import { PickRow, SkeletonRows, SubjectMark } from "./org-picker-parts.tsx";
import { ReachLine, SelectedList } from "./org-picker-selected.tsx";
import type { OrgTree } from "./use-org-data.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/org-picker.css";

export type MobileOrgProps = {
  model: PickerModel;
  tree: OrgTree;
  source: OrgDataSource;
  current: string | null;
  onOpen: (id: string) => void;
  shortcuts: readonly OrgShortcut[];
  emptyAction?: ReactNode;
};

/** Breadcrumb + 「整个「X」」 + sub-departments (tick = pick, 「›」 = go in) + the people of the node. */
export function MobileOrg({ model, tree, source, current, onOpen, shortcuts, emptyAction }: MobileOrgProps) {
  const [deep, setDeep] = useState(false);
  useEffect(() => {
    if (current) tree.expand(current);
    setDeep(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);
  if (!tree.roots || !current) return <SkeletonRows label={model.m.loading} />;
  const unit = tree.index.get(current);
  const chain = chainOf(tree.index, current);
  const kids = (tree.children.get(current) ?? []).filter((u) => !isHidden(model, u));
  const hasSub = Boolean(unit?.childCount ?? kids.length);
  const unitRow = (u: OrgUnit) => {
    const ref = { kind: u.kind, id: u.id };
    const state = nodeCheckState(u, model.value, model.index, model.mixed);
    const block = state === "checked" ? null : blockedReason(model, ref, u.availability);
    const selectable = model.canSelect(u.kind) && !model.single;
    return (
      <PickRow
        key={u.id}
        id={u.id}
        kind={u.kind}
        name={u.label}
        label={u.label}
        sub={u.memberCount === undefined ? u.hint : model.t(model.m.people, { n: u.memberCount })}
        mark={<SubjectMark kind={u.kind} id={u.id} label={u.label} size={32} />}
        tick={selectable ? (state === "covered" ? "checked" : state) : null}
        disabled={!selectable || Boolean(block)}
        lockReason={block?.kind === "locked" ? block.reason : undefined}
        note={block && block.kind !== "locked" && block.kind !== "full" && block.kind !== "kind" ? block.reason : undefined}
        onToggle={() => (state === "checked" ? model.remove(ref) : model.toggle(unitSubject(u, model.index, model.includeSubDefault)))}
        trailing={<IconButton size="md" className="aui-orgp-drill" label={`${model.m.expand} ${u.label}`} icon={<ChevronRight />} onClick={(e) => { e.stopPropagation(); onOpen(u.id); }} />}
      />
    );
  };
  return (
    <div className="aui-orgp-m-org">
      {shortcuts.length > 0 && (
        <div className="aui-orgp-shortcuts" data-scroll role="group" aria-label={model.m.shortcuts}>
          {shortcuts.map((s) => (
            <Button key={s.key} size="sm" variant="outline" className="aui-orgp-shortcut" aria-pressed={model.isPicked(s.subject)} onClick={() => model.toggle(s.subject)}>
              <SubjectMark kind={s.subject.kind} id={s.subject.id} label={s.subject.label} size={20} />
              {s.label}
              {s.hint && <small>· {s.hint}</small>}
            </Button>
          ))}
        </div>
      )}
      <nav className="aui-orgp-crumbs" aria-label={model.m.treeLabel}>
        {chain.map((id, i) => (
          <span key={id}>
            {i > 0 && <ChevronRight aria-hidden="true" />}
            {i === chain.length - 1 ? (
              <b aria-current="location">{tree.index.get(id)?.label}</b>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => onOpen(id)}>{tree.index.get(id)?.label}</Button>
            )}
          </span>
        ))}
      </nav>
      <MembersPane
        model={model}
        tree={tree}
        source={source}
        nodeId={current}
        deep={deep}
        onDeep={setDeep}
        compact
        emptyAction={emptyAction}
        prefix={
          <div role="listbox" aria-label={model.m.treeLabel} aria-multiselectable={!model.single || undefined} className="aui-orgp-m-units">
            {unit && model.canSelect(unit.kind) && !model.single && <WholeRow model={model} unit={unit} hasSub={hasSub} />}
            {tree.loading.has(current) && !kids.length ? <SkeletonRows rows={2} label={model.m.loading} /> : kids.map(unitRow)}
          </div>
        }
      />
    </div>
  );
}

/** Bottom bar: marks of the first picks · 「已选 2 人、1 个部门」 · 「确定 (3)」. Tap to open the list. */
export function MobileBar({ model, onOpenSheet, onConfirm, confirmText }: { model: PickerModel; onOpenSheet: () => void; onConfirm: () => void; confirmText: string }) {
  const counts = groupByKind(model.value).map((g) => ({ kind: g.kind, count: g.items.length }));
  const first = model.value[0];
  const summary = model.single ? (first ? first.label : model.m.noneSelected) : model.value.length ? model.t(model.m.barSummary, { summary: selectionSummary(model.m, counts, model.locale) }) : model.m.noneSelected;
  return (
    <div className="aui-orgp-bar">
      <button type="button" className="aui-orgp-bar-open" aria-haspopup="dialog" aria-label={`${summary}，${model.m.barHint}`} disabled={!model.value.length || model.single} onClick={onOpenSheet}>
        <span className="aui-orgp-bar-marks" aria-hidden="true">
          {model.value.slice(0, 3).map((s) => (
            <SubjectMark key={`${s.kind}:${s.id}`} kind={s.kind} id={s.id} label={s.label} size={24} />
          ))}
        </span>
        <span className="aui-orgp-bar-text">
          <b>{summary}</b>
          {!model.single && model.value.length > 0 && <small>{model.m.barHint}</small>}
        </span>
        {!model.single && model.value.length > 0 && <ChevronUp aria-hidden="true" />}
      </button>
      <Button onClick={onConfirm}>{confirmText}</Button>
    </div>
  );
}

/** The selected list rising from the bottom over the picker. */
export function MobileSheet({ model, onClose, onConfirm, confirmText }: { model: PickerModel; onClose: () => void; onConfirm: () => void; confirmText: string }) {
  return (
    <div className="aui-orgp-sheet-wrap" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}>
      <div className="aui-orgp-sheet-scrim" onClick={onClose} aria-hidden="true" />
      <section className="aui-orgp-sheet" role="dialog" aria-label={model.m.selectedLabel}>
        <span className="aui-orgp-sheet-grab" aria-hidden="true" />
        <header className="aui-orgp-side-head">
          <b>{model.t(model.m.selected, { n: model.value.length })}</b>
          {model.value.length > 0 && <Button size="sm" variant="text" onClick={() => model.setValue([])}>{model.m.clear}</Button>}
        </header>
        <div className="aui-orgp-sheet-list">
          <SelectedList model={model} />
        </div>
        <ReachLine model={model} />
        <footer className="aui-orgp-sheet-foot">
          <Button variant="outline" onClick={onClose} autoFocus>{model.m.sheetClose}</Button>
          <Button onClick={onConfirm}>{confirmText}</Button>
        </footer>
      </section>
    </div>
  );
}
