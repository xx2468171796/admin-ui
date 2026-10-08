"use client";
/**
 * Middle pane of the OrgPicker: the node that is open in the tree — its path, the shortcuts (我 / 我的部门
 * / 上级), 「整个「一组」」 to pick the whole node, then its people (direct or with sub-departments) in
 * a virtual list (fixed 48px rows, cursor pages loaded while scrolling). role="listbox" +
 * aria-multiselectable with aria-activedescendant; ↑ ↓ Home End PageUp PageDown, Space / Enter ticks.
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { EyeOff, Info, Lock, MapPin } from "lucide-react";
import { Button } from "../primitives.tsx";
import { SegmentedControl } from "../choices.tsx";
import { chainOf, lockedNotice, nodeCheckState, personSubject, pickAll, unitSubject, type OrgDataSource, type OrgUnit, type PickedSubject } from "./org-picker-core.ts";
import { listKey, scrollToRow, virtualWindow } from "./org-picker-nav.ts";
import { blockedReason, type PickerModel } from "./org-picker-model.ts";
import { PickRow, SkeletonRows, SubjectMark, Tick } from "./org-picker-parts.tsx";
import { useMembers, type OrgTree } from "./use-org-data.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/org-picker.css";

/** A quick pick above the members (「我」「我的部门 · 一组」「上级 · 销售部」「整个华南子公司」). */
export type OrgShortcut = { key: string; label: string; hint?: string; subject: PickedSubject };

const ROW = 48;
/** Phone rows are 56 high (touch). */
const ROW_TOUCH = 56;
/** Above this many people 「全选这些人」 is not offered: pick the whole department instead. */
export const SELECT_ALL_LIMIT = 60;

export type MembersPaneProps = {
  model: PickerModel;
  tree: OrgTree;
  source: OrgDataSource;
  nodeId: string | null;
  deep: boolean;
  onDeep: (deep: boolean) => void;
  shortcuts?: readonly OrgShortcut[];
  /** Shown when the open node is not the viewer's own: 「回到我的位置」. */
  onBack?: () => void;
  emptyAction?: ReactNode;
  /** One line under a locked node: who to ask (「跨公司分享要集团管理员（王总）开通」). */
  lockedHint?: string;
  /** Phones: no header / whole row here (the drill list has them); the bar scrolls with the list. */
  compact?: boolean;
  /** Phones: rows above the members inside the same scroller (sub-departments, 「整个「一组」」). */
  prefix?: ReactNode;
};

function ShortcutChips({ model, shortcuts }: { model: PickerModel; shortcuts: readonly OrgShortcut[] }) {
  return (
    <div className="aui-orgp-shortcuts" role="group" aria-label={model.m.shortcuts}>
      {shortcuts.map((s) => {
        const block = blockedReason(model, s.subject);
        const picked = model.isPicked(s.subject);
        return (
          <Button key={s.key} size="sm" variant="outline" className="aui-orgp-shortcut" aria-pressed={picked} disabled={Boolean(block) && !picked} disabledReason={block && !picked ? block.reason : undefined} onClick={() => model.toggle(s.subject)}>
            <SubjectMark kind={s.subject.kind} id={s.subject.id} label={s.subject.label} size={20} />
            {s.label}
            {s.hint && <small>· {s.hint}</small>}
          </Button>
        );
      })}
    </div>
  );
}

/** 「整个「一组」」: pick the whole node (with sub-departments by default); locked / covered / granted say why. */
export function WholeRow({ model, unit, hasSub }: { model: PickerModel; unit: OrgUnit; hasSub: boolean }) {
  const a = model.avail({ kind: unit.kind, id: unit.id }, unit.availability);
  const wholeState = nodeCheckState(unit, model.value, model.index, model.mixed);
  const wholeBlock = blockedReason(model, { kind: unit.kind, id: unit.id }, unit.availability);
  const toggleWhole = () => {
    if (wholeState === "checked") return model.remove({ kind: unit.kind, id: unit.id });
    if (!wholeBlock) model.toggle(unitSubject(unit, model.index, model.includeSubDefault));
  };
  return (
    <div
      role="checkbox"
      aria-checked={wholeState === "checked" || wholeState === "covered" ? true : wholeState === "mixed" ? "mixed" : false}
      aria-disabled={(Boolean(wholeBlock) && wholeState !== "checked") || undefined}
      tabIndex={0}
      className="aui-orgp-whole"
      data-locked={a.state === "locked" || undefined}
      onClick={toggleWhole}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          toggleWhole();
        }
      }}
    >
      {a.state === "locked" ? <Lock className="aui-orgp-lock" aria-hidden="true" /> : <Tick state={wholeState === "covered" ? "checked" : wholeState} disabled={Boolean(wholeBlock) && wholeState !== "checked"} />}
      <SubjectMark kind={unit.kind} id={unit.id} label={unit.label} size={32} />
      <span className="aui-orgp-row-text">
        <span className="aui-orgp-row-name">{model.t(model.m.whole, { name: unit.label })}</span>
        <span className="aui-orgp-row-sub">
          {unit.memberCount === undefined ? "" : hasSub ? model.t(model.m.wholeHint, { n: unit.memberCount }) : model.t(model.m.people, { n: unit.memberCount })}
        </span>
      </span>
      {wholeBlock && wholeState !== "checked" && wholeBlock.kind !== "full" && (
        <span className="aui-orgp-note" data-tone={wholeBlock.kind === "existing" ? "brand" : "neutral"}>
          {wholeBlock.kind === "locked" && <Lock aria-hidden="true" />}
          {wholeBlock.reason}
        </span>
      )}
    </div>
  );
}

export function MembersPane({ model, tree, source, nodeId, deep, onDeep, shortcuts = [], onBack, emptyAction, lockedHint, compact, prefix }: MembersPaneProps) {
  const unit: OrgUnit | undefined = nodeId ? tree.index.get(nodeId) : undefined;
  const list = useMembers(source, nodeId, deep, model.m.networkError);
  const scroller = useRef<HTMLDivElement>(null);
  const listbox = useRef<HTMLDivElement>(null);
  const rowH = compact ? ROW_TOUCH : ROW;
  const [scroll, setScroll] = useState({ top: 0, height: 320 });
  const [active, setActive] = useState(0);
  const listId = `aui-orgp-members-${nodeId ?? "none"}`;
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const measure = () => setScroll({ top: node.scrollTop, height: node.clientHeight || 320 });
    measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(node);
    return () => ro?.disconnect();
  }, [nodeId]);
  useEffect(() => {
    setActive(0);
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [nodeId, deep]);
  if (!unit) return <div className="aui-orgp-members"><SkeletonRows label={model.m.loading} /></div>;
  const chain = chainOf(tree.index, unit.parentId);
  const pathText = chain.map((id) => tree.index.get(id)?.label ?? "").filter(Boolean).join(" › ");
  const a = model.avail({ kind: unit.kind, id: unit.id }, unit.availability);
  const canWhole = model.canSelect(unit.kind) && !model.single;
  const people = list.items.map((p) => ({ person: p, subject: personSubject(p, tree.index, unit.id) }));
  const total = list.total ?? (list.more ? undefined : people.length);
  const hasSub = Boolean(unit.childCount ?? tree.children.get(unit.id)?.length);
  // The listbox may sit below other rows in the same scroller (phones): window from its own top.
  const win = virtualWindow(scroll.top - (listbox.current?.offsetTop ?? 0), scroll.height, rowH, people.length);
  const pickable = people.filter(({ subject, person }) => !blockedReason(model, { ...subject, deptIds: person.deptIds }, person.availability, person.status));
  const allPicked = pickable.length > 0 && pickable.every(({ subject }) => model.isPicked(subject));
  const togglePerson = (i: number) => {
    const row = people[i];
    if (!row) return;
    if (model.isPicked(row.subject)) return model.remove(row.subject);
    if (blockedReason(model, { ...row.subject, deptIds: row.person.deptIds }, row.person.availability, row.person.status)) return;
    model.toggle(row.subject);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      togglePerson(active);
      return;
    }
    const next = listKey(active, event.key, people.length);
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    const node = scroller.current;
    const offset = listbox.current?.offsetTop ?? 0;
    const to = node ? scrollToRow(next, node.scrollTop - offset, node.clientHeight, rowH) : null;
    if (node && to !== null) node.scrollTop = to + offset;
  };
  const bar = (
    <>
      <div className="aui-orgp-members-bar">
        <b>{model.t(model.m.members, { n: total ?? people.length })}</b>
        {hasSub && (
          <SegmentedControl
            size="sm"
            label={model.m.membersLabel}
            value={deep ? "deep" : "direct"}
            options={[
              { value: "direct", label: model.m.direct },
              { value: "deep", label: model.m.includeSub },
            ]}
            onValueChange={(v) => onDeep(v === "deep")}
          />
        )}
        {!model.single && model.canSelect("person") && pickable.length > 0 && (total ?? 0) <= SELECT_ALL_LIMIT && (
          <Button size="sm" variant="text" className="aui-orgp-all" disabled={allPicked} onClick={() => model.setValue(pickAll(model.value, pickable.map((p) => p.subject), model.index, { mode: "multiple", max: model.max }))}>
            {model.m.selectAllShown}
          </Button>
        )}
      </div>
      {(total ?? 0) > SELECT_ALL_LIMIT && canWhole && (
        <p className="aui-orgp-notice" data-tone="info">
          <Info aria-hidden="true" />
          {model.t(model.m.largeDept, { n: total ?? 0, name: unit.label })}
        </p>
      )}
    </>
  );
  return (
    <div className="aui-orgp-members" data-compact={compact || undefined}>
      {!compact && (
        <div className="aui-orgp-members-head">
          <div className="aui-orgp-members-title">
            <span>
              <b>{unit.label}</b>
              {pathText && <small>{pathText}</small>}
            </span>
            {onBack && (
              <Button size="sm" variant="ghost" onClick={onBack}>
                <MapPin aria-hidden="true" />
                {model.m.backToMine}
              </Button>
            )}
          </div>
          {shortcuts.length > 0 && <ShortcutChips model={model} shortcuts={shortcuts} />}
          {canWhole && <WholeRow model={model} unit={unit} hasSub={hasSub} />}
          {a.state === "locked" && (
            <p className="aui-orgp-notice">
              <Lock aria-hidden="true" />
              {lockedNotice(a.reason, model.m.locked, lockedHint)}
            </p>
          )}
        </div>
      )}
      {!compact && bar}
      <div className="aui-orgp-members-list" ref={scroller} onScroll={(e) => {
        const node = e.currentTarget;
        setScroll({ top: node.scrollTop, height: node.clientHeight });
        if (list.more && node.scrollTop + node.clientHeight > node.scrollHeight - rowH * 4) list.loadMore();
      }}>
        {prefix}
        {compact && bar}
        {list.error && !people.length ? (
          <div className="aui-orgp-empty" role="alert">
            {model.t(model.m.loadFailed, { reason: list.error })}
            <Button size="sm" variant="outline" onClick={list.retry}>{model.m.retry}</Button>
          </div>
        ) : list.loading && !people.length ? (
          <SkeletonRows label={model.m.loading} />
        ) : !people.length ? (
          <div className="aui-orgp-empty">
            <span>{model.t(model.m.emptyDept, { name: unit.label })}</span>
            {emptyAction}
          </div>
        ) : (
          <div
            role="listbox"
            id={listId}
            aria-label={`${unit.label} ${model.m.membersLabel}`}
            aria-multiselectable={!model.single || undefined}
            aria-activedescendant={`${listId}-${active}`}
            tabIndex={0}
            ref={listbox}
            className="aui-orgp-listbox"
            style={{ height: people.length * rowH }}
            onKeyDown={onKey}
          >
            <div style={{ height: win.before }} aria-hidden="true" />
            {people.slice(win.start, win.end).map(({ person, subject }, offset) => {
              const i = win.start + offset;
              const ref = { ...subject, deptIds: person.deptIds };
              const picked = model.isPicked(subject);
              const block = picked ? null : blockedReason(model, ref, person.availability, person.status);
              const covered = block?.kind === "covered";
              return (
                <PickRow
                  key={person.id}
                  optionId={`${listId}-${i}`}
                  id={person.id}
                  kind="person"
                  name={person.label}
                  label={person.label}
                  badges={person.badges}
                  sub={person.title}
                  mark={<SubjectMark kind="person" id={person.id} label={person.label} src={person.avatar} gone={Boolean(person.status)} size={32} />}
                  tick={covered || picked || block?.kind === "existing" ? "checked" : "unchecked"}
                  round={model.single}
                  disabled={Boolean(block)}
                  lockReason={block?.kind === "locked" ? block.reason : undefined}
                  note={block && block.kind !== "locked" && block.kind !== "full" && block.kind !== "kind" ? block.reason : undefined}
                  noteTone={block?.kind === "existing" ? "brand" : "neutral"}
                  aside={person.aside}
                  active={i === active}
                  style={{ height: rowH }}
                  onHover={() => setActive(i)}
                  onToggle={() => togglePerson(i)}
                />
              );
            })}
            <div style={{ height: win.after }} aria-hidden="true" />
          </div>
        )}
        {list.hiddenDeparted > 0 && (
          <p className="aui-orgp-departed">
            <EyeOff aria-hidden="true" />
            {model.t(model.m.departedHidden, { n: list.hiddenDeparted })}
          </p>
        )}
      </div>
    </div>
  );
}
