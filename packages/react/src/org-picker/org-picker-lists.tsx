"use client";
/**
 * Flat lists of the OrgPicker: search results (people / departments + companies / roles / lines, six
 * each with 「还有 N 个，显示全部」, full path on every row, the matched characters marked; departed people
 * are named 「「X」已离职」 and can't be picked; out-of-scope rows carry a lock and the reason) and the
 * list of a pluggable tab (roles, lines, companies …). Both are role="listbox" with arrow keys.
 */
import { useState, type KeyboardEvent } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "../primitives.tsx";
import { groupHits, hasSubTree, type OrgSearchHit, type PickedSubject } from "./org-picker-core.ts";
import { listKey } from "./org-picker-nav.ts";
import { blockedReason, type PickerModel } from "./org-picker-model.ts";
import { Marked, PickRow, SkeletonRows, SubjectMark } from "./org-picker-parts.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/org-picker.css";

/** Second line of a hit: its own `sub`, else title · path (· N 人 for groups of people). */
export function hitSub(model: PickerModel, h: OrgSearchHit | PickedSubject): string {
  if ("sub" in h && h.sub) return h.sub;
  const title = "title" in h ? h.title : undefined;
  const path = (h.path ?? []).join(" › ");
  const count = h.kind !== "person" && h.count !== undefined ? model.t(model.m.people, { n: h.count }) : "";
  return [title, path, count].filter(Boolean).join(" · ");
}

function hitRowProps(model: PickerModel, h: OrgSearchHit | PickedSubject, query: string) {
  const own = "availability" in h ? h.availability : undefined;
  const picked = model.isPicked(h);
  const departed = h.status === "left" || h.status === "disabled";
  const block = picked ? null : blockedReason(model, h, own, h.status);
  const name = departed ? model.t(model.m.departedHit, { name: h.label }) : h.label;
  const ranges = "matched" in h ? h.matched : undefined;
  return {
    picked,
    block,
    row: {
      id: h.id,
      kind: h.kind,
      name,
      label: departed ? name : <Marked text={h.label} query={query} ranges={ranges} />,
      sub: <Marked text={hitSub(model, h)} query={query} />,
      badges: "badges" in h ? h.badges : undefined,
      mark: <SubjectMark kind={h.kind} id={h.id} label={h.label} src={h.avatar} gone={departed} size={32} />,
      tick: (picked || block?.kind === "covered" || block?.kind === "existing" ? "checked" : "unchecked") as "checked" | "unchecked",
      round: model.single,
      disabled: Boolean(block) || departed,
      lockReason: block?.kind === "locked" ? block.reason : undefined,
      note: block && !["locked", "full", "kind", "left"].includes(block.kind) ? block.reason : undefined,
      noteTone: (block?.kind === "existing" ? "brand" : "neutral") as "brand" | "neutral",
      struck: departed,
    },
  };
}

function useListKeys(count: number, onPick: (i: number) => void) {
  const [active, setActive] = useState(0);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onPick(active);
      return;
    }
    const next = listKey(active, event.key, count);
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    event.currentTarget.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
  };
  return { active: Math.min(active, Math.max(0, count - 1)), setActive, onKeyDown };
}

export type SearchPaneProps = {
  model: PickerModel;
  query: string;
  hits: readonly OrgSearchHit[];
  loading: boolean;
  error: string | null;
  /** Show a department / company in the tree (clears the search). */
  onLocate?: (hit: OrgSearchHit) => void;
};

export function SearchPane({ model, query, hits: all, loading, error, onLocate }: SearchPaneProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  // Hidden = not shown at all (another company the viewer can't grant to), even if the server returned it.
  const hits = all.filter((h) => model.avail(h, h.availability).state !== "hidden");
  const groups = groupHits(hits, 6, expanded);
  const flat = groups.flatMap((g) => g.items);
  const toggle = (h: OrgSearchHit | undefined) => {
    if (!h) return;
    if (model.isPicked(h)) return model.remove(h);
    if (blockedReason(model, h, h.availability, h.status) || h.status) return;
    model.toggle(h);
  };
  const keys = useListKeys(flat.length, (i) => toggle(flat[i]));
  const title: Record<string, string> = { person: model.m.groupPerson, unit: model.m.groupUnit, role: model.m.groupRole, line: model.m.groupLine };
  if (loading && !hits.length) return <div className="aui-orgp-results"><SkeletonRows label={model.m.loading} /></div>;
  if (error) return <div className="aui-orgp-results"><p className="aui-orgp-empty" role="alert">{model.t(model.m.loadFailed, { reason: error })}</p></div>;
  if (!hits.length) {
    return (
      <div className="aui-orgp-results">
        <div className="aui-orgp-noresult" role="status">
          <b>{model.t(model.m.noResult, { q: query })}</b>
          <span>{model.m.noResultTips}</span>
        </div>
      </div>
    );
  }
  let index = -1;
  return (
    <div className="aui-orgp-results">
      <div className="aui-orgp-results-head">
        <b role="status">{model.t(model.m.searchCount, { n: hits.length })}</b>
      </div>
      <div role="listbox" aria-label={model.t(model.m.searchCount, { n: hits.length })} aria-multiselectable={!model.single || undefined} tabIndex={0} aria-activedescendant={flat.length ? `aui-orgp-hit-${keys.active}` : undefined} onKeyDown={keys.onKeyDown} className="aui-orgp-listbox">
        {groups.map((g) => (
          <div key={g.key} role="group" aria-label={title[g.key] ?? model.m.groupOther}>
            <div className="aui-orgp-group-title" role="presentation">
              {title[g.key] ?? model.m.groupOther} · {hits.filter((h) => (g.key === "unit" ? hasSubTree(h.kind) : g.key === "person" ? h.kind === "person" : h.kind === g.key)).length}
            </div>
            {g.items.map((h) => {
              index += 1;
              const i = index;
              const { row } = hitRowProps(model, h, query);
              return (
                <div key={`${h.kind}:${h.id}`} data-index={i}>
                  <PickRow
                    {...row}
                    optionId={`aui-orgp-hit-${i}`}
                    active={keys.active === i}
                    onHover={() => keys.setActive(i)}
                    onToggle={() => toggle(h)}
                    trailing={
                      hasSubTree(h.kind) && onLocate ? (
                        <Button size="sm" variant="ghost" className="aui-orgp-locate" onClick={(e) => { e.stopPropagation(); onLocate(h); }}>
                          {model.m.locate}
                          <ChevronRight aria-hidden="true" />
                        </Button>
                      ) : undefined
                    }
                  />
                </div>
              );
            })}
            {g.more > 0 && (
              <Button size="sm" variant="text" className="aui-orgp-more" onClick={() => setExpanded(new Set([...expanded, g.key]))}>
                {model.t(model.m.showAll, { n: g.more })}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export type SourcePaneProps = { model: PickerModel; label: string; items: readonly PickedSubject[]; loading: boolean; error: string | null; query: string };

/** A pluggable tab's list: tick to pick a role / line / company. */
export function SourcePane({ model, label, items, loading, error, query }: SourcePaneProps) {
  const toggle = (s: PickedSubject | undefined) => {
    if (!s) return;
    if (model.isPicked(s)) return model.remove(s);
    if (blockedReason(model, s, undefined, s.status)) return;
    model.toggle(s);
  };
  const keys = useListKeys(items.length, (i) => toggle(items[i]));
  if (loading && !items.length) return <div className="aui-orgp-results"><SkeletonRows label={model.m.loading} /></div>;
  if (error) return <div className="aui-orgp-results"><p className="aui-orgp-empty" role="alert">{model.t(model.m.loadFailed, { reason: error })}</p></div>;
  if (!items.length) return <div className="aui-orgp-results"><p className="aui-orgp-empty">{query ? model.t(model.m.noResult, { q: query }) : model.m.noneSelected}</p></div>;
  return (
    <div className="aui-orgp-results">
      <div role="listbox" aria-label={label} aria-multiselectable={!model.single || undefined} tabIndex={0} aria-activedescendant={`aui-orgp-src-${keys.active}`} onKeyDown={keys.onKeyDown} className="aui-orgp-listbox">
        {items.map((s, i) => {
          const { row } = hitRowProps(model, s, query);
          return (
            <div key={`${s.kind}:${s.id}`} data-index={i}>
              <PickRow {...row} optionId={`aui-orgp-src-${i}`} active={keys.active === i} onHover={() => keys.setActive(i)} onToggle={() => toggle(s)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
