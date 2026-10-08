"use client";
/**
 * GrantList (bt/records P3, demos D12 / D20): one component for 「分享给 / 授权给」 with two modes.
 *
 * - `mode="list"` (default; SharePicker is this mode): every candidate in a searchable list, tick to
 *   share, a level per ticked subject.
 * - `mode="picked"`: a search box that adds from the host's candidates (only people the actor may grant
 *   to: the host / server limits `subjects`), then only the chosen subjects — avatar (per-person colour) /
 *   group icon, name + hint, a level (SegmentedControl, or a compact menu with `levelPicker="menu"`:
 *   可查看 / 可编辑 / 可管理), remove (shows on hover, always on touch). `locked` holders (the default
 *   chain: owner, you, your managers) can't be removed: with a `level` they are rows with a lock tag,
 *   without one chips above. `summary` is the grey 「共 9 人能打开 · 阿明看不到…」 bar; `audience` the
 *   two banners.
 *
 * Saving: by default every change goes to `onChange` (a draft the host saves). `apply="instant"` +
 * `onApply` applies each change at once (page permissions): the row shows a spinner,
 * a failure puts the old value back and says why with 「重试」 in the row, the list ends with
 * 「保存中… → 已保存，立即生效」. The server re-checks every grant.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Building2, ChevronDown, CircleAlert, CircleCheck, Globe, LoaderCircle, Lock, Route, Search, Shield, UserPlus, Users, X } from "lucide-react";
import { Button, Checkbox, Input } from "./primitives.tsx";
import { SegmentedControl } from "./choices.tsx";
import { InlineAlert } from "./layout.tsx";
import { MenuButton } from "./menu.tsx";
import { SuggestLayer, suggestOptionId, suggestStep } from "./suggest-layer.tsx";
import { LAYER_ATTR } from "./floating-layer.ts";
import {
  applyGrantChange,
  grantAudienceText,
  grantChangeId,
  grantChangeText,
  resolveEntry,
  revertGrantChange,
  subjectKind,
  suggestSubjects,
  type GrantAudience,
  type GrantChange,
  type GrantEntry,
  type GrantLevel,
  type GrantSubject,
  type GrantSubjectKind,
} from "./grant-list-core.ts";
import { avatarTone } from "./avatar-core.ts";
import { GrantOrgField, type GrantOrgPickerOptions } from "./grant-org-field.tsx";
import type { OrgDataSource } from "./org-picker/org-picker-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grants.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grants.css";

/**
 * A holder that is always there (default chain). Without `level`: a locked chip above the list; with
 * `level`: a locked row in the list (「小王 🔒负责人 · 可编辑」, no remove).
 */
export type GrantHolder = { id: string; name: string; kind?: GrantSubjectKind; /** 「你 · 可读写」「销售一组 · 默认能看，去不掉」 */ hint?: string; /** Level value shown on the locked row. */ level?: string; /** Lock tag text on the row (default 「默认」; 「负责人」). */ tag?: string };

type Common = {
  subjects: readonly GrantSubject[];
  value: readonly GrantEntry[];
  /** Every change (draft mode), or the list after a change the server accepted (instant mode: update `value` here). */
  onChange: (next: GrantEntry[]) => void;
  levels: readonly GrantLevel[];
  /** Accessible name of the whole control (default 「分享给」 / 「授权给」). */
  label?: string;
  disabled?: boolean;
};
export type GrantListProps =
  | (Common & { mode?: "list" })
  | (Common & {
      mode: "picked";
      /** Default holders and the sentence above the chips (「默认：你和你的上级可看可改…」). */
      locked?: readonly GrantHolder[];
      lockedNote?: ReactNode;
      /** Heading of the picked list and its grey note (「再给下级或其他角色授权」「可读 / 可读写 / 管理（能再分给别人）」). */
      title?: ReactNode;
      levelsHint?: ReactNode;
      /** How a row picks its level: segmented buttons (default) or a compact menu (「可编辑 ⌄」, 4+ levels / narrow places). */
      levelPicker?: "segmented" | "menu";
      /** Level of a newly added subject (default: the first level). */
      defaultLevel?: string;
      addPlaceholder?: string;
      /** Shown when the search finds nothing (「没有匹配的；只能授给你管得着的人」). */
      noMatch?: ReactNode;
      /** Search on the server instead of filtering `subjects` (debounced, older answers dropped). */
      searchSubjects?: (query: string, signal: AbortSignal) => Promise<readonly GrantSubject[]>;
      /** Grey bar under the list (「共 9 人能打开 · 阿明看不到「预计金额」」). */
      summary?: ReactNode;
      /** Who can't / can see, as the server computed it for this draft (two banners). */
      audience?: GrantAudience;
      /** Words of the banners: 「这个字段」, where it disappears, the scope note. */
      audienceText?: { subject?: string; where?: string; scopeNote?: string };
      /** draft (default): changes go to onChange · instant: each change goes to onApply at once. */
      apply?: "draft" | "instant";
      /** Instant mode: save one change; reject with an Error whose message is shown (the old value comes back). */
      onApply?: (change: GrantChange, next: GrantEntry[]) => Promise<void>;
      /**
       * the add box becomes the OrgPicker field (search the whole organisation with paths,
       * 「组织架构」 opens the tree dialog), loaded lazily. Already granted subjects show 「已授权 · 档位」.
       */
      orgSource?: OrgDataSource;
      /** OrgPicker options: extra tabs (角色 / 业务线 / 公司), availability, defaultFocus, shortcuts, suggestions, messages … */
      orgPicker?: GrantOrgPickerOptions;
    });
type PickedProps = Extract<GrantListProps, { mode: "picked" }>;

function SubjectMark({ kind, name, size = "sm" }: { kind: GrantSubjectKind; name: string; size?: "sm" | "xs" }) {
  if (kind === "user") return <span className="aui-avatar" data-size={size} data-tone={avatarTone(name)} aria-hidden="true">{Array.from(name.trim())[0] ?? "?"}</span>;
  const Icon = kind === "role" ? Shield : kind === "dept" || kind === "company" ? Building2 : kind === "line" ? Route : kind === "everyone" ? Globe : Users;
  return (
    <span className="aui-icon-block" data-tone="brand" data-size="sm" data-round aria-hidden="true">
      <Icon />
    </span>
  );
}

const KIND_LABEL: Record<GrantSubjectKind, string> = { user: "人", group: "组", dept: "部门", role: "角色", everyone: "所有人", company: "公司", line: "业务线" };

/** See the module comment. */
export function GrantList(props: GrantListProps) {
  return props.mode === "picked" ? <PickedGrants {...props} /> : <ListGrants {...props} />;
}

// ---------------------------------------------------------------- list mode (SharePicker)

function ListGrants({ subjects, value, onChange, levels, label = "分享给", disabled }: Common) {
  const [q, setQ] = useState("");
  const words = q.trim().toLowerCase();
  const shown = subjects.filter((s) => !words || `${s.name} ${s.hint ?? ""}`.toLowerCase().includes(words));
  const levelOf = (id: string) => value.find((g) => g.id === id)?.level;
  const toggle = (id: string) => onChange(levelOf(id) ? value.filter((g) => g.id !== id) : [...value, { id, level: levels[0]?.value ?? "" }]);
  const setLevel = (id: string, level: string) => onChange(value.map((g) => (g.id === id ? { ...g, level } : g)));
  return (
    <div className="aui-share" role="group" aria-label={label}>
      <label className="aui-share-search"><Search aria-hidden="true" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜人名 / 组名" aria-label="搜人名或组名" /></label>
      <ul className="aui-share-list">
        {shown.map((s) => {
          const level = levelOf(s.id);
          return (
            <li key={s.id} data-on={level ? true : undefined}>
              <label className="aui-share-who">
                <Checkbox checked={Boolean(level)} disabled={disabled} aria-label={s.name} onCheckedChange={() => toggle(s.id)} />
                <SubjectMark kind={subjectKind(s)} name={s.name} />
                <span><b>{s.name}</b>{s.hint && <small>{s.hint}</small>}</span>
              </label>
              {level && levels.length > 1 && (
                <span className="aui-share-levels" role="radiogroup" aria-label={`${s.name} 的权限`}>
                  {levels.map((l) => (
                    <button key={l.value} type="button" role="radio" aria-checked={level === l.value} disabled={disabled} onClick={() => setLevel(s.id, l.value)}>{l.label}</button>
                  ))}
                </span>
              )}
            </li>
          );
        })}
        {!shown.length && <li className="aui-note">没有匹配的人或组</li>}
      </ul>
      <p className="aui-note">已选 {value.length} 个</p>
    </div>
  );
}

// ---------------------------------------------------------------- picked mode

function useCandidates(query: string, open: boolean, local: readonly GrantSubject[], search?: (q: string, signal: AbortSignal) => Promise<readonly GrantSubject[]>) {
  const [remote, setRemote] = useState<{ query: string; items: readonly GrantSubject[] } | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!search || !open) return;
    const abort = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      search(query.trim(), abort.signal)
        .then((items) => !abort.signal.aborted && setRemote({ query, items }))
        .catch(() => undefined)
        .finally(() => !abort.signal.aborted && setLoading(false));
    }, 200);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query, open, search]);
  return search ? { pool: remote?.items ?? [], loading } : { pool: local, loading: false };
}

type Failure = { change: GrantChange; name: string; reason: string };
const without = <T,>(all: Readonly<Record<string, T>>, id: string): Record<string, T> => Object.fromEntries(Object.entries(all).filter(([key]) => key !== id));
/**
 * Instant-apply state of the picked list: the optimistic list while saves run, which rows are saving,
 * which failed (with the change to retry) and the 「已保存」 line. Draft mode passes changes straight on.
 */
function useInstantGrants(props: PickedProps) {
  const { value, onChange, onApply } = props;
  const instant = props.apply === "instant" && Boolean(onApply);
  const [local, setLocal] = useState<GrantEntry[] | null>(null);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<Readonly<Record<string, Failure>>>({});
  const [saved, setSaved] = useState(false);
  const live = useRef({ value, local, pending: new Set<string>() });
  live.current.value = value;
  live.current.local = local;
  const commit = (change: GrantChange, name: string) => {
    if (!instant || !onApply) return onChange(applyGrantChange(value, change));
    const id = grantChangeId(change);
    const next = applyGrantChange(live.current.local ?? live.current.value, change);
    live.current.local = next;
    live.current.pending.add(id);
    setLocal(next);
    setPending(new Set(live.current.pending));
    setFailed((all) => without(all, id));
    const settle = () => {
      live.current.pending.delete(id);
      setPending(new Set(live.current.pending));
      if (!live.current.pending.size) {
        live.current.local = null;
        setLocal(null);
      }
    };
    onApply(change, next).then(
      () => {
        onChange(applyGrantChange(live.current.value, change));
        setSaved(true);
        settle();
      },
      (error: unknown) => {
        const back = revertGrantChange(live.current.local ?? live.current.value, change);
        live.current.local = back;
        setLocal(back);
        setFailed((all) => ({ ...all, [id]: { change, name, reason: error instanceof Error && error.message ? error.message : "网络中断" } }));
        settle();
      },
    );
  };
  const dismiss = (id: string) => setFailed((all) => without(all, id));
  return { instant, shown: local ?? value, pending, failed, saved, commit, dismiss };
}

function LevelPicker({ name, level, levels, picker, disabled, onPick }: { name: string; level: string; levels: readonly GrantLevel[]; picker: "segmented" | "menu"; disabled?: boolean; onPick: (level: string) => void }) {
  if (levels.length < 2) return null;
  if (picker === "segmented") return <SegmentedControl size="sm" label={`${name} 的权限`} value={level} disabled={disabled} options={levels.map((l) => ({ value: l.value, label: l.label }))} onValueChange={onPick} />;
  const current = levels.find((l) => l.value === level)?.label ?? level;
  return (
    <MenuButton
      size="sm"
      variant="ghost"
      className="aui-grant-level"
      label={`${name} 的权限`}
      aria-label={`${name} 的权限：${current}`}
      disabled={disabled}
      sections={[{ items: levels.map((l) => ({ key: l.value, label: l.label, checked: l.value === level, onSelect: () => l.value !== level && onPick(l.value) })) }]}
    >
      {current}
      <ChevronDown aria-hidden="true" />
    </MenuButton>
  );
}

function PickedGrants(props: PickedProps) {
  const { subjects, levels, label = "授权给", disabled, locked = [], lockedNote, title, levelsHint, levelPicker = "segmented", defaultLevel, addPlaceholder = "添加人、组或角色（只列你管得着的）", noMatch = "没有匹配的；只能授给你管得着的人", searchSubjects, summary, audience, audienceText } = props;
  const base = useId();
  const listId = `${base}-suggest`;
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { instant, shown, pending, failed, saved, commit, dismiss } = useInstantGrants(props);
  const { pool, loading } = useCandidates(query, open, subjects, searchSubjects);
  const exclude = new Set([...shown.map((g) => g.id), ...locked.map((h) => h.id)]);
  const matches = suggestSubjects(pool, query, exclude, Boolean(searchSubjects));
  const entries = shown.map((g) => resolveEntry(g, subjects));
  const chips = locked.filter((h) => h.level === undefined);
  const lockedRows = locked.filter((h) => h.level !== undefined);
  const failedAdds = Object.values(failed).filter((f) => f.change.type === "add" && !shown.some((g) => g.id === grantChangeId(f.change)));
  const close = () => {
    setOpen(false);
    setActive(0);
  };
  const add = (s: GrantSubject | undefined) => {
    if (!s || disabled) return;
    commit({ type: "add", entry: { id: s.id, level: defaultLevel ?? levels[0]?.value ?? "", name: s.name, hint: s.hint, kind: subjectKind(s) } }, s.name);
    setQuery("");
    close();
    input.current?.focus();
  };
  const addMany = (added: GrantEntry[]) => {
    if (disabled) return;
    if (instant) for (const entry of added) commit({ type: "add", entry }, entry.name ?? entry.id);
    else props.onChange(added.reduce((list, entry) => applyGrantChange(list, { type: "add", entry }), [...shown]));
  };
  const remove = (entry: GrantEntry, name: string, index: number) => {
    commit({ type: "remove", entry, index }, name);
    requestAnimationFrame(() => {
      const rows = document.querySelectorAll<HTMLButtonElement>(`[data-grant-list="${CSS.escape(base)}"] .aui-grant-remove`);
      (rows[Math.min(index, rows.length - 1)] ?? input.current)?.focus();
    });
  };
  const levelLabel = (v: string) => levels.find((l) => l.value === v)?.label ?? v;
  const errorLine = (f: Failure | undefined) =>
    f && (
      <span className="aui-grant-error" role="alert">
        <CircleAlert aria-hidden="true" />
        {grantChangeText(f.change, levels, f.name)}没保存：{f.reason}
        <Button size="sm" variant="outline" onClick={() => commit(f.change, f.name)}>重试</Button>
      </span>
    );
  const text = audience ? grantAudienceText(audience, audienceText) : {};
  const busy = pending.size > 0;
  return (
    <div className="aui-grants" role="group" aria-label={label} data-grant-list={base} data-picker={levelPicker}>
      {(chips.length > 0 || lockedNote) && (
        <div className="aui-grant-defaults">
          {lockedNote && <p>{lockedNote}</p>}
          {chips.length > 0 && (
            <ul className="aui-grant-chips" aria-label="默认就有权限、不能去掉的人">
              {chips.map((h) => (
                <li key={h.id} className="aui-grant-chip" data-tip="默认就有，不能去掉">
                  <SubjectMark kind={h.kind ?? "user"} name={h.name} size="xs" />
                  <span>{h.name}</span>
                  {h.hint && <small>{h.hint}</small>}
                  <Lock aria-label="不能去掉" />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {(title || levelsHint) && (
        <div className="aui-grant-title">
          {title && <b>{title}</b>}
          {levelsHint && <small>· {levelsHint}</small>}
        </div>
      )}
      {props.orgSource ? (
        <div className="aui-grant-add">
          <GrantOrgField source={props.orgSource} options={props.orgPicker} entries={shown} locked={locked} levels={levels} level={defaultLevel ?? levels[0]?.value ?? ""} placeholder={addPlaceholder} disabled={disabled} onAdd={addMany} />
        </div>
      ) : (
        <div className="aui-grant-add" {...(open ? { [LAYER_ATTR]: "" } : {})}>
          <label className="aui-grant-search">
            <UserPlus aria-hidden="true" />
            <Input
              ref={input}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open && matches.length ? suggestOptionId(listId, active) : undefined}
              aria-label={addPlaceholder}
              placeholder={addPlaceholder}
              value={query}
              disabled={disabled}
              onChange={(event) => {
                setQuery(event.currentTarget.value);
                setActive(0);
                setOpen(event.currentTarget.value.trim().length > 0);
              }}
              onBlur={close}
              onKeyDown={(event) => {
                if (event.key === "Escape" && open) {
                  event.preventDefault();
                  event.stopPropagation();
                  close();
                  return;
                }
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  if (!open) return;
                  event.preventDefault();
                  add(matches[active]);
                  return;
                }
                if (event.key === "ArrowDown" && !open) {
                  event.preventDefault();
                  setOpen(true);
                  return;
                }
                const next = open ? suggestStep(active, event.key, matches.length) : null;
                if (next !== null) {
                  event.preventDefault();
                  setActive(next);
                }
              }}
            />
          </label>
          <SuggestLayer
            open={open}
            anchor={input.current?.closest(".aui-grant-search") as HTMLElement | null}
            id={listId}
            label="可以授权的人、组和角色"
            active={active}
            onActive={setActive}
            onPick={(index) => add(matches[index])}
            empty={loading ? "正在搜索…" : noMatch}
            items={matches.map((s) => ({
              key: s.id,
              content: (
                <>
                  <SubjectMark kind={subjectKind(s)} name={s.name} />
                  <span className="aui-grant-who"><b>{s.name}</b><small>{KIND_LABEL[subjectKind(s)]}{s.hint ? ` · ${s.hint}` : ""}</small></span>
                </>
              ),
            }))}
          />
        </div>
      )}
      {(entries.length > 0 || lockedRows.length > 0 || failedAdds.length > 0) && (
        <ul className="aui-grant-rows aui-grant-box" aria-label="已授权">
          {lockedRows.map((h) => (
            <li key={h.id} className="aui-grant-row" data-locked>
              <SubjectMark kind={h.kind ?? "user"} name={h.name} />
              <span className="aui-grant-who">
                <b>
                  {h.name}
                  <span className="aui-grant-tag" data-tip="默认就有，不能去掉">
                    <Lock aria-hidden="true" />
                    {h.tag ?? "默认"}
                  </span>
                </b>
                {h.hint && <small>{h.hint}</small>}
              </span>
              <span className="aui-grant-fixed">{levelLabel(h.level ?? "")}</span>
              <span className="aui-grant-spacer" aria-hidden="true" />
            </li>
          ))}
          {entries.map((g, index) => {
            const saving = pending.has(g.id);
            const fail = failed[g.id];
            return (
              <li key={g.id} className="aui-grant-row" data-pending={saving || undefined} data-failed={fail ? true : undefined}>
                <SubjectMark kind={g.kind} name={g.name} />
                <span className="aui-grant-who" data-gone={g.status ? true : undefined}>
                  <b>
                    {g.name}
                    {g.status && <span className="aui-grant-tag" data-tone="warning">{g.status === "left" ? "已离职" : "已停用"}</span>}
                  </b>
                  <small>{KIND_LABEL[g.kind]}{g.hint ? ` · ${g.hint}` : ""}</small>
                  {fail?.change.type !== "add" && errorLine(fail)}
                </span>
                <LevelPicker name={g.name} level={g.level} levels={levels} picker={levelPicker} disabled={disabled || saving} onPick={(level) => commit({ type: "level", id: g.id, level, before: g.level }, g.name)} />
                {saving ? (
                  <span className="aui-grant-saving" role="status" aria-label={`正在保存 ${g.name}`}>
                    <LoaderCircle aria-hidden="true" />
                  </span>
                ) : (
                  <button type="button" className="aui-icon-button aui-grant-remove" aria-label={`去掉 ${g.name}`} data-tip="去掉" disabled={disabled} onClick={() => remove(shown[index] ?? g, g.name, index)}>
                    <X aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
          {failedAdds.map((f) => (
            <li key={grantChangeId(f.change)} className="aui-grant-row" data-failed>
              <SubjectMark kind={f.change.type === "add" ? f.change.entry.kind ?? "user" : "user"} name={f.name} />
              <span className="aui-grant-who">
                <b>{f.name}</b>
                {errorLine(f)}
              </span>
              <span />
              <button type="button" className="aui-icon-button aui-grant-remove" aria-label={`不加 ${f.name}`} data-tip="不加了" onClick={() => dismiss(grantChangeId(f.change))}>
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {summary && (
        <p className="aui-grant-summary">
          <Users aria-hidden="true" />
          <span>{summary}</span>
        </p>
      )}
      {instant && (busy || saved) && (
        <p className="aui-grant-status" role="status" data-kind={busy ? "saving" : "saved"}>
          {busy ? <LoaderCircle aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
          {busy ? "保存中…" : "已保存，立即生效"}
        </p>
      )}
      {text.hidden && <InlineAlert tone="warning" title={text.hidden.title}>{text.hidden.text}</InlineAlert>}
      {text.readers && <InlineAlert tone="info" title={text.readers.title}>{text.readers.text}</InlineAlert>}
    </div>
  );
}
