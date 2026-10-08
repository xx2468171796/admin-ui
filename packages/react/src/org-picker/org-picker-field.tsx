"use client";
/**
 * OrgPickerField: the inline 「添加人、部门或角色」 box for small places. Picks are
 * tags (avatar / kind block + name + ×) followed by the text; focus without typing offers suggestions
 * (my department + recent), typing searches the whole organisation grouped by kind with paths; Enter
 * picks the first. 「组织架构」 (and 「从组织架构选…」 under the list) opens the full OrgPicker. Picks go
 * to the list at once (`commit="instant"`, default) or are collected first and added with 「添加 N 个」
 * (`commit="batch"`, for forms with a save button). Subjects already on the host's list (`existing`)
 * never show up in the suggestions.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info, Network, UserPlus, X } from "lucide-react";
import { Button } from "../primitives.tsx";
import { useAdminTheme } from "../theme.tsx";
import { LAYER_ATTR, layerHost, rectOf, useLayerPosition } from "../floating-layer.ts";
import { DEFAULT_SELECTABLE, groupHits, hasSubTree, sameSubject, toOutput, type OrgDataSource, type OrgPick, type OrgSearchHit, type PickedSubject, type PickerSource } from "./org-picker-core.ts";
import { listKey } from "./org-picker-nav.ts";
import { blockedReason, usePickerModel, type OrgPickOptions } from "./org-picker-model.ts";
import { Marked, SubjectMark } from "./org-picker-parts.tsx";
import { hitSub } from "./org-picker-lists.tsx";
import { OrgPicker } from "./org-picker.tsx";
import type { OrgShortcut } from "./org-picker-members.tsx";
import { useOrgSearch } from "./use-org-data.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/org-picker.css";

export type OrgPickerFieldProps = OrgPickOptions & {
  source: OrgDataSource;
  value: readonly PickedSubject[];
  onChange: (next: PickedSubject[], picks: OrgPick[]) => void;
  extraSources?: readonly PickerSource[];
  defaultFocus?: string;
  shortcuts?: readonly OrgShortcut[];
  emptyAction?: ReactNode;
  lockedHint?: string;
  placeholder?: string;
  /** instant (default): a pick goes to onChange at once · batch: collect tags, 「添加 N 个」 hands them over. */
  commit?: "instant" | "batch";
  /** Title of the big dialog (default 「组织架构」 wording). */
  dialogTitle?: string;
  dialogDescription?: ReactNode;
  /** Offered while the box is empty (my department, recent picks). */
  suggestions?: readonly PickedSubject[];
  /** Show the value as tags in the box (default true; GrantList shows its own rows and passes false). */
  chips?: boolean;
  disabled?: boolean;
  /** Accessible name of the box (default the placeholder). */
  label?: string;
  id?: string;
  /** Focus the box when it mounts (a lazy host hands over a click / typing that hit its placeholder). */
  autoFocus?: boolean;
  /** Text already in the box when it mounts (what was typed into the placeholder while the field loaded). */
  defaultQuery?: string;
};

type Option = { subject: OrgSearchHit | PickedSubject; disabled: boolean; note?: string };

export function OrgPickerField(props: OrgPickerFieldProps) {
  const { source, value, onChange, commit = "instant", suggestions = [], chips = true, disabled, extraSources, defaultFocus, shortcuts, emptyAction, lockedHint, dialogDescription } = props;
  const [staged, setStaged] = useState<PickedSubject[]>([]);
  const batch = commit === "batch";
  const tags = batch ? staged : chips ? value : [];
  const kinds = props.selectable ?? [...DEFAULT_SELECTABLE, ...(extraSources ?? []).map((s) => s.kind).filter((k) => !DEFAULT_SELECTABLE.includes(k))];
  const model = usePickerModel({ ...props, selectable: kinds, mode: props.mode ?? "multiple" }, tags, () => undefined, new Map());
  const { m } = model;
  const placeholder = props.placeholder ?? m.fieldPlaceholder;
  const base = useId();
  const listId = `${base}-list`;
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const { portal } = useAdminTheme();
  const [query, setQuery] = useState(props.defaultQuery ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [dialog, setDialog] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const search = useOrgSearch(source, open ? query : "", kinds, 30, m.networkError);
  const taken = (s: PickedSubject) => tags.some((t) => sameSubject(t, s)) || value.some((t) => sameSubject(t, s)) || Boolean(model.existingNote(s)) || model.avail(s, "availability" in s ? (s as OrgSearchHit).availability : undefined).state === "hidden";
  const pool: readonly (OrgSearchHit | PickedSubject)[] = query.trim() ? search.hits : suggestions;
  const groups = groupHits(pool.filter((s) => !taken(s)) as OrgSearchHit[], 6);
  const options: Option[] = groups.flatMap((g) => g.items).map((s) => {
    const departed = s.status === "left" || s.status === "disabled";
    const block = blockedReason(model, s, "availability" in s ? s.availability : undefined, s.status);
    return { subject: s, disabled: departed || Boolean(block), note: departed ? m.departed : block?.kind === "locked" ? block.reason : undefined };
  });
  useEffect(() => {
    if (!props.autoFocus || disabled) return;
    const el = input.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const showLayer = open && !disabled && (Boolean(query.trim()) || suggestions.length > 0);
  useLayoutEffect(() => setHost(showLayer ? layerHost(box.current, portal) : null), [showLayer, portal]);
  const { position } = useLayerPosition(Boolean(showLayer && host), layer, () => rectOf(box.current), host, { side: "bottom", align: "start", gap: 4 });

  const add = (s: PickedSubject) => {
    const subject = hasSubTree(s.kind) && s.includeSub === undefined ? { ...s, includeSub: model.includeSubDefault } : s;
    if (model.single) {
      if (batch) setStaged([subject]);
      else onChange([subject], toOutput([subject]));
    } else if (batch) setStaged([...staged, subject]);
    else {
      const next = [...value, subject];
      onChange(next, toOutput(next));
    }
    setQuery("");
    setActive(0);
    input.current?.focus();
  };
  const removeTag = (s: PickedSubject) => {
    if (batch) setStaged(staged.filter((t) => !sameSubject(t, s)));
    else {
      const next = value.filter((t) => !sameSubject(t, s));
      onChange(next, toOutput(next));
    }
  };
  const firstEnabled = (from: number) => {
    for (let i = from; i < options.length; i++) if (!options[i]?.disabled) return i;
    return -1;
  };
  const pick = (i: number) => {
    const o = options[i];
    if (o && !o.disabled) add(o.subject);
  };
  const openDialog = () => {
    setOpen(false);
    setDialog(true);
  };
  const width = box.current?.getBoundingClientRect().width ?? 360;
  let index = -1;
  const title: Record<string, string> = { person: m.groupPerson, unit: m.groupUnit, role: m.groupRole, line: m.groupLine };
  return (
    <div className="aui-orgp-field" data-disabled={disabled || undefined}>
      <div className="aui-orgp-field-box" ref={box} data-open={showLayer || undefined} onClick={() => input.current?.focus()} {...(showLayer ? { [LAYER_ATTR]: "" } : {})}>
        <UserPlus className="aui-orgp-field-icon" aria-hidden="true" />
        {tags.map((s) => (
          <span key={`${s.kind}:${s.id}`} className="aui-orgp-chip" data-gone={s.status ? true : undefined}>
            <SubjectMark kind={s.kind} id={s.id} label={s.label} size={20} gone={Boolean(s.status)} />
            <span>{s.label}</span>
            {!disabled && (
              /* admin-ui-audit-ignore raw-control: SDK 内部——标签里的小「×」（12px，IconButton 最小 24px 放不进 24px 高的标签） */
              <button type="button" className="aui-orgp-chip-x" aria-label={model.t(m.remove, { name: s.label })} onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); removeTag(s); }}>
                <X aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
        <input
          ref={input}
          id={props.id}
          className="aui-orgp-field-input"
          role="combobox"
          aria-expanded={showLayer}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showLayer && options[active] ? `${listId}-${active}` : undefined}
          aria-label={props.label ?? placeholder}
          placeholder={tags.length ? "" : placeholder}
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && showLayer) {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              return;
            }
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              if (!showLayer) return;
              e.preventDefault();
              const i = options[active]?.disabled ? firstEnabled(0) : active;
              if (i >= 0) pick(i);
              return;
            }
            if (e.key === "Backspace" && !query && batch && staged.length) {
              setStaged(staged.slice(0, -1));
              return;
            }
            if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !showLayer) {
              e.preventDefault();
              setOpen(true);
              return;
            }
            const next = showLayer ? listKey(active, e.key, options.length) : null;
            if (next !== null && e.key !== "Home" && e.key !== "End") {
              e.preventDefault();
              setActive(next);
            }
          }}
        />
      </div>
      <Button variant="outline" className="aui-orgp-field-browse" disabled={disabled} aria-haspopup="dialog" onClick={openDialog}>
        <Network aria-hidden="true" />
        {m.fieldBrowse}
      </Button>
      {batch && staged.length > 0 && (
        <Button
          onClick={() => {
            const next = model.single ? staged : [...value, ...staged.filter((s) => !value.some((v) => sameSubject(v, s)))];
            onChange(next, toOutput(next));
            setStaged([]);
          }}
        >
          {model.t(m.addN, { n: staged.length })}
        </Button>
      )}
      {showLayer && host &&
        createPortal(
          <div ref={layer} className="aui-orgp-pop" {...{ [LAYER_ATTR]: "" }} style={{ top: position?.top ?? 0, left: position?.left ?? 0, width: `min(${Math.max(width, 320)}px, calc(100vw - 16px))`, visibility: position ? "visible" : "hidden" }}>
            <div id={listId} role="listbox" aria-label={placeholder} className="aui-orgp-pop-list">
              {!query.trim() && <div className="aui-orgp-group-title" role="presentation">{m.fieldSuggest}</div>}
              {query.trim() && search.loading && !options.length && <p className="aui-orgp-pop-empty" role="status">{m.loading}</p>}
              {query.trim() && !search.loading && !options.length && (
                <p className="aui-orgp-pop-empty" role="status">
                  {model.t(m.noResult, { q: query.trim() })}
                  <small>{m.noResultTips}</small>
                </p>
              )}
              {groups.map((g) => (
                <div key={g.key} role="group" aria-label={title[g.key] ?? m.groupOther}>
                  {query.trim() && <div className="aui-orgp-group-title" role="presentation">{title[g.key] ?? m.groupOther} · {g.items.length + g.more}</div>}
                  {g.items.map((s) => {
                    index += 1;
                    const i = index;
                    const o = options[i];
                    const departed = s.status === "left" || s.status === "disabled";
                    return (
                      <div
                        key={`${s.kind}:${s.id}`}
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={i === active}
                        aria-disabled={o?.disabled || undefined}
                        className="aui-orgp-pop-option"
                        data-active={i === active || undefined}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pick(i);
                        }}
                        onMouseEnter={() => setActive(i)}
                      >
                        <SubjectMark kind={s.kind} id={s.id} label={s.label} src={s.avatar} gone={departed} size={32} />
                        <span className="aui-orgp-row-text">
                          <span className="aui-orgp-row-name"><span className="aui-orgp-row-label">{departed ? model.t(m.departedHit, { name: s.label }) : <Marked text={s.label} query={query.trim()} ranges={s.matched} />}</span></span>
                          <span className="aui-orgp-row-sub"><Marked text={hitSub(model, s)} query={query.trim()} /></span>
                        </span>
                        {o?.note && <span className="aui-orgp-note" data-tone="neutral">{o.note}</span>}
                        {!o?.note && hasSubTree(s.kind) && s.includeSub !== false && model.includeSubDefault && <span className="aui-orgp-note" data-tone="neutral">{m.includeSub}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="aui-orgp-pop-foot">
              <span>
                <Info aria-hidden="true" />
                {m.fieldFooter}
              </span>
              <Button size="sm" variant="outline" onMouseDown={(e) => e.preventDefault()} onClick={openDialog}>
                <Network aria-hidden="true" />
                {m.fieldFromTree}
              </Button>
            </div>
          </div>,
          host,
        )}
      <OrgPicker
        {...props}
        selectable={kinds}
        open={dialog}
        onClose={() => setDialog(false)}
        source={source}
        extraSources={extraSources}
        defaultFocus={defaultFocus}
        shortcuts={shortcuts}
        emptyAction={emptyAction}
        lockedHint={lockedHint}
        title={props.dialogTitle ?? m.fieldBrowse}
        description={dialogDescription}
        value={batch ? staged : chips ? value : []}
        onChange={(next) => {
          if (batch) return setStaged(next);
          // Without tags the dialog starts empty: what it returns is added to the value.
          const merged = chips || model.single ? next : [...value, ...next.filter((s) => !value.some((v) => sameSubject(v, s)))];
          onChange(merged, toOutput(merged));
        }}
      />
    </div>
  );
}
