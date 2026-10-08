"use client";
/**
 * The parts of ShareDialog (bt/share S1, demo D20): who can open (option cards + the
 * picked-people GrantList), then a flat settings list — one row per setting, title + grey hint on the
 * left, the control on the right, a line between rows (no cards). Policy limits stay visible: locked
 * options carry a lock and say why on hover / focus.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CalendarDays, ChevronDown, Eye, Flame, Hourglass, KeyRound, Lock, MessageSquare, Pencil, RefreshCw, X } from "lucide-react";
import { Button, Checkbox, Switch } from "./primitives.tsx";
import { DateTimePicker } from "./date-picker.tsx";
import { ChoiceTiles } from "./page-templates.tsx";
import type { ShareGrant, ShareSubject } from "./kit.tsx";
import { GrantList, type GrantHolder } from "./grant-list.tsx";
import type { GrantOrgPickerOptions } from "./grant-org-field.tsx";
import type { OrgDataSource } from "./org-picker/org-picker-core.ts";
import type { GrantChange, GrantEntry, GrantLevel, GrantSubject } from "./grant-list-core.ts";
import { CodeInput, NumberStepper } from "./atoms.tsx";
import { datePresetKey, datePresetMs, type DatePresetKey } from "./choice-core.ts";
import {
  AUDIENCE_LABELS,
  audiencePatch,
  CAPABILITY_LABELS,
  expiryPhrase,
  expiryPresetBlocked,
  formatHours,
  fromZonedInput,
  openLimitMax,
  passwordForced,
  toZonedInput,
  type ShareAudience,
  type ShareCapability,
  type ShareFieldAccess,
  type ShareFieldOption,
  type SharePolicy,
  type ShareSettings,
} from "./share-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/share.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/share.css";

/** A field the visitor may get, with its type icon. */
export type ShareFieldChoice = ShareFieldOption & { icon?: ReactNode };
export type SetShare = (patch: Partial<ShareSettings>) => void;

/**
 * 「指定的人」 for the default picker (GrantList mode "picked"): candidates, the picked people and their
 * levels; optional locked holders (owner), the grey summary bar, server search and instant apply.
 */
export type SharePeople = {
  subjects: readonly ShareSubject[];
  value: readonly ShareGrant[];
  onChange: (next: ShareGrant[]) => void;
  levels?: readonly { value: string; label: string }[];
  locked?: readonly GrantHolder[];
  /** 「共 9 人能打开 · 阿明看不到「预计金额」」 */
  summary?: ReactNode;
  searchSubjects?: (query: string, signal: AbortSignal) => Promise<readonly GrantSubject[]>;
  /** Apply each change at once (GrantList apply="instant"). */
  onApply?: (change: GrantChange, next: GrantEntry[]) => Promise<void>;
  addPlaceholder?: string;
  /** pick people / departments / roles with the OrgPicker (lazy) instead of the plain search. */
  orgSource?: OrgDataSource;
  /** OrgPicker options (extra tabs, availability, defaultFocus, shortcuts, suggestions, messages …). */
  orgPicker?: GrantOrgPickerOptions;
};

/** One settings row: title (+ icon) and grey hint on the left, the control on the right; `below` spans the row. */
export function SettingRow({ title, icon, hint, children, below, wide }: { title: string; icon?: ReactNode; hint?: ReactNode; children?: ReactNode; below?: ReactNode; /** Control takes the row's width on phones (segmented). */ wide?: boolean }) {
  return (
    <div className="aui-share-row" data-row={title}>
      <div className="aui-share-row-main">
        <div className="aui-share-row-lab">
          <b>
            {icon}
            {title}
          </b>
          {hint && <small>{hint}</small>}
        </div>
        {children && <div className="aui-share-row-ctl" data-wide={wide || undefined}>{children}</div>}
      </div>
      {below}
    </div>
  );
}

/** A switch row (下载 / 复制 / 水印). */
export function SwitchRow({ label, hint, checked, onChange, disabled }: { label: string; hint?: ReactNode; checked: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <SettingRow title={label} hint={hint}>
      <Switch checked={checked} disabled={disabled} aria-label={label} onCheckedChange={onChange} />
    </SettingRow>
  );
}

/** A segmented option; `locked` = forbidden by the policy, with the reason (shown with a lock, focusable, does nothing). */
export type ShareSegment<V extends string> = { value: V; label: string; icon?: ReactNode; locked?: string };
/** The approved segmented control with policy-locked options (one tab stop, arrows move, Enter / Space picks). */
export function ShareSegmented<V extends string>({ label, value, options, onPick }: { label: string; value: V | null; options: readonly ShareSegment<V>[]; onPick: (value: V) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const reasonId = useId();
  const selected = options.findIndex((o) => o.value === value);
  const stop = selected >= 0 ? selected : 0;
  const move = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    refs.current[(index + step + options.length) % options.length]?.focus();
  };
  return (
    <div role="group" aria-label={label} className="aui-segmented aui-share-seg">
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          className="aui-segmented-item"
          aria-pressed={o.value === value}
          aria-disabled={o.locked ? true : undefined}
          aria-describedby={o.locked ? `${reasonId}-${i}` : undefined}
          data-blocked={o.locked ? true : undefined}
          data-tip={o.locked}
          tabIndex={i === stop ? 0 : -1}
          onClick={() => !o.locked && o.value !== value && onPick(o.value)}
          onKeyDown={(event) => move(event, i)}
        >
          {o.locked ? <Lock aria-hidden="true" /> : o.icon}
          {o.label}
          {o.locked && <span id={`${reasonId}-${i}`} className="aui-sr-only">（{o.locked}）</span>}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="aui-share-sec">{children}</h3>;
}

// ---------------------------------------------------------------- who can open

const AUDIENCE_HINTS: Record<ShareAudience, (forced: boolean) => string> = {
  anyone: (forced) => (forced ? "拿到链接和密码" : "拿到链接就能打开"),
  org: () => "登录的同事",
  people: () => "选人或部门",
};

export function AudienceSection({ settings, set, policy, audiences, people, peoplePicker, generate }: { settings: ShareSettings; set: SetShare; policy?: SharePolicy; audiences: readonly ShareAudience[]; people?: SharePeople; peoplePicker?: ReactNode; /** Makes the password the policy forces for the new audience. */ generate: () => string }) {
  const options = audiences.map((value) => {
    const blocked = policy?.audiences?.[value];
    return { value, label: AUDIENCE_LABELS[value], disabled: Boolean(blocked), hint: blocked ?? AUDIENCE_HINTS[value](Boolean(passwordForced(policy, value))) };
  });
  const levels: readonly GrantLevel[] = people?.levels ?? [{ value: "view", label: "可看" }];
  return (
    <section className="aui-share-block" aria-label="谁能打开">
      <SectionTitle>谁能打开</SectionTitle>
      <ChoiceTiles label="谁能打开" options={options} value={settings.audience} onValueChange={(audience) => set(audiencePatch(settings, audience, policy, generate))} columns={options.length === 2 ? 2 : 3} />
      {settings.audience === "people" && (
        <div className="aui-share-people">
          {peoplePicker ??
            (people ? (
              <GrantList
                mode="picked"
                subjects={people.subjects}
                value={people.value}
                onChange={people.onChange}
                levels={levels}
                levelPicker={levels.length > 2 ? "menu" : "segmented"}
                locked={people.locked}
                summary={people.summary}
                searchSubjects={people.searchSubjects}
                apply={people.onApply ? "instant" : "draft"}
                onApply={people.onApply}
                label="指定的人"
                addPlaceholder={people.addPlaceholder ?? "添加人、部门或角色"}
                orgSource={people.orgSource}
                orgPicker={people.orgPicker}
              />
            ) : null)}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- what they can do

const CAPABILITY_ICONS: Record<ShareCapability, ReactNode> = { view: <Eye />, comment: <MessageSquare />, edit: <Pencil /> };
export function CapabilityRow({ settings, set, policy, capabilities, hasFields }: { settings: ShareSettings; set: SetShare; policy?: SharePolicy; capabilities: readonly ShareCapability[]; hasFields: boolean }) {
  if (capabilities.length < 2) return null;
  return (
    <SettingRow title="权限" hint={hasFields ? "可编辑只开放下面勾了「可改」的字段" : undefined} wide>
      <ShareSegmented
        label="访客能做什么"
        value={settings.capability}
        options={capabilities.map((c) => ({ value: c, label: CAPABILITY_LABELS[c], icon: CAPABILITY_ICONS[c], locked: policy?.capabilities?.[c] }))}
        onPick={(capability) => set({ capability, fields: capability === "edit" ? settings.fields : Object.fromEntries(Object.entries(settings.fields).map(([k, a]) => [k, a === "edit" ? "view" : a])) })}
      />
    </SettingRow>
  );
}

// ---------------------------------------------------------------- visible fields

export function FieldsRow({ settings, set, fields }: { settings: ShareSettings; set: SetShare; fields: readonly ShareFieldChoice[] }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const shared = fields.filter((f) => settings.fields[f.key] && !f.forbidden);
  const editCount = shared.filter((f) => settings.fields[f.key] === "edit").length;
  const forbidden = fields.filter((f) => f.forbidden);
  const setAccess = (key: string, access: ShareFieldAccess | "none") => {
    const next = { ...settings.fields };
    if (access === "none") delete next[key];
    else next[key] = access;
    set({ fields: next });
  };
  const canEdit = settings.capability === "edit";
  return (
    <SettingRow
      title="访客能看到的字段"
      hint={`${shared.length} / ${fields.length} 个 · 可改 ${editCount} 个${forbidden.length ? ` · ${forbidden.map((f) => f.label).join("、")}不能对外` : ""}`}
      below={
        open && (
          <ul id={listId} className="aui-share-fields" aria-label="访客能看到的字段">
            {fields.map((f) => {
              const access = f.forbidden ? undefined : settings.fields[f.key];
              const name = `${f.label}${f.masked ? "（打码）" : ""}`;
              return (
                <li key={f.key} data-off={f.forbidden ? true : undefined}>
                  <label className="aui-share-field-name">
                    <Checkbox checked={Boolean(access)} disabled={Boolean(f.forbidden)} aria-label={`给访客看 ${f.label}`} onCheckedChange={(on) => setAccess(f.key, on === true ? "view" : "none")} />
                    <span>{name}</span>
                  </label>
                  {f.forbidden ? (
                    <small className="aui-share-field-reason" data-tip={f.forbidden} tabIndex={0}>
                      <Lock aria-hidden="true" />
                      不能对外
                      <span className="aui-sr-only">：{f.forbidden}</span>
                    </small>
                  ) : access && f.editable ? (
                    <span className="aui-share-field-edit" data-tip={canEdit ? undefined : "权限选「可编辑」后才能改"}>
                      可改
                      <Switch size="sm" checked={access === "edit"} disabled={!canEdit} aria-label={`访客可改 ${f.label}`} onCheckedChange={(on) => setAccess(f.key, on ? "edit" : "view")} />
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )
      }
    >
      <Button size="sm" variant="outline" aria-expanded={open} aria-controls={open ? listId : undefined} onClick={() => setOpen((v) => !v)}>
        调整
        <ChevronDown aria-hidden="true" data-open={open || undefined} />
      </Button>
    </SettingRow>
  );
}

// ---------------------------------------------------------------- password

export function PasswordRow({ settings, set, policy, length, generate, hint }: { settings: ShareSettings; set: SetShare; policy?: SharePolicy; length: number; generate: () => string; hint?: string }) {
  const forced = passwordForced(policy, settings.audience);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const on = settings.password !== null || typing;
  const toggle = <Switch checked={on} disabled={Boolean(forced) && on} aria-label={forced ? `密码（${forced}，不能关）` : "密码"} onCheckedChange={(next) => { setTyping(false); set({ password: next ? generate() : null }); }} />;
  return (
    <SettingRow title="密码" icon={<KeyRound aria-hidden="true" />} hint={on ? hint ?? "和链接分开发更安全" : "不设密码：拿到链接就能打开"}>
      {typing ? (
        <span className="aui-share-pin">
          <CodeInput
            label="分享密码"
            length={length}
            value={draft}
            autoFocus
            onChange={setDraft}
            onComplete={(v) => {
              setTyping(false);
              set({ password: v });
            }}
            error={draft.length > 0 && draft.length < length ? `还差 ${length - draft.length} 位` : undefined}
          />
          <button type="button" className="aui-icon-button" aria-label="不改了" data-tip="不改了" onClick={() => setTyping(false)}>
            <X aria-hidden="true" />
          </button>
        </span>
      ) : (
        settings.password !== null && (
          <>
            <span className="aui-share-code" role="img" aria-label={`分享密码 ${settings.password}`}>
              {Array.from(settings.password).map((c, i) => (
                <span key={i}>{c}</span>
              ))}
            </span>
            <button type="button" className="aui-icon-button" aria-label="换一个" data-tip="换一个" onClick={() => set({ password: generate() })}>
              <RefreshCw aria-hidden="true" />
            </button>
            <button type="button" className="aui-icon-button" aria-label="自己填" data-tip="自己填" onClick={() => { setDraft(""); setTyping(true); }}>
              <Pencil aria-hidden="true" />
            </button>
          </>
        )
      )}
      {forced ? (
        <span className="aui-share-locked" data-tip={forced} tabIndex={0} aria-label={`必须设密码：${forced}`}>
          {toggle}
        </span>
      ) : (
        toggle
      )}
    </SettingRow>
  );
}

// ---------------------------------------------------------------- expiry

export function ExpiryRow({ settings, set, policy, hours, days, now, timeZone }: { settings: ShareSettings; set: SetShare; policy?: SharePolicy; hours: readonly number[]; days: readonly number[]; now: () => number; timeZone: string }) {
  const [custom, setCustom] = useState(settings.expiryPreset === "custom");
  const [error, setError] = useState("");
  const [customAt, setCustomAt] = useState(settings.expiresAt ? toZonedInput(settings.expiresAt, timeZone) : "");
  useEffect(() => {
    if (settings.expiryPreset !== "custom") setCustom(false);
  }, [settings.expiryPreset]);
  const max = policy?.maxExpiryHours;
  const presets: DatePresetKey[] = [...hours.map((h) => datePresetKey(h, "h")), ...days.map((d) => datePresetKey(d, "d")), "permanent"];
  const label = (key: DatePresetKey) => (key === "permanent" ? "永久" : key.endsWith("h") ? `${Number.parseFloat(key)} 小时` : `${Number.parseFloat(key)} 天`);
  const value = custom ? "custom" : settings.expiryPreset === "custom" ? null : settings.expiryPreset;
  return (
    <SettingRow
      title="有效期"
      icon={<Hourglass aria-hidden="true" />}
      hint={expiryPhrase(settings.expiresAt, now(), timeZone)}
      wide
      below={
        custom && (
          <div className="aui-share-custom">
            <DateTimePicker
              aria-label="失效时间"
              value={customAt}
              onChange={(next) => {
                setCustomAt(next);
                // Read in `timeZone` (the zone the hint shows), not the browser's; bounds are checked here so a
                // too-late time says which policy forbids it.
                const at = next ? fromZonedInput(next, timeZone) : Number.NaN;
                if (!Number.isFinite(at) || at <= now()) return setError("请选一个以后的时间");
                if (max !== undefined && at > now() + max * 3_600_000) return setError(`${policy?.owner ?? "公司"}要求最长 ${formatHours(max)}`);
                setError("");
                set({ expiresAt: at, expiryPreset: "custom" });
              }}
            />
            {error && <span className="aui-share-error" role="alert">{error}</span>}
          </div>
        )
      }
    >
      <ShareSegmented<DatePresetKey | "custom">
        label="有效期"
        value={value}
        options={[...presets.map((key) => ({ value: key, label: label(key), locked: expiryPresetBlocked(policy, key) })), { value: "custom" as const, label: "自定义", icon: <CalendarDays aria-hidden="true" /> }]}
        onPick={(key) => {
          if (key === "custom") return setCustom(true);
          const ms = datePresetMs(key);
          setCustom(false);
          setError("");
          set({ expiresAt: ms === null ? null : now() + ms, expiryPreset: key });
        }}
      />
    </SettingRow>
  );
}

// ---------------------------------------------------------------- open count

export function OpensRow({ settings, set, opened, maxOpens }: { settings: ShareSettings; set: SetShare; opened: number; maxOpens: number }) {
  const limit = settings.openLimit;
  const max = openLimitMax(limit);
  const lastMax = useRef(limit.mode === "max" ? limit.max : 20);
  if (limit.mode === "max") lastMax.current = limit.max;
  const hint =
    limit.mode === "burn" ? (
      "访客看完就失效，再打开显示「链接已失效」"
    ) : (
      <>
        已打开 {opened} 次
        {max !== null && (
          <span className="aui-share-meter" role="meter" aria-label="已打开次数" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(opened, max)}>
            <span>
              <i style={{ width: `${Math.min(100, (opened / max) * 100)}%` }} />
            </span>
            {opened} / {max}
          </span>
        )}
      </>
    );
  return (
    <SettingRow title="打开次数" icon={<Eye aria-hidden="true" />} hint={hint} wide>
      <ShareSegmented
        label="打开次数"
        value={limit.mode}
        options={[
          { value: "unlimited", label: "不限" },
          { value: "max", label: "最多" },
          { value: "burn", label: "阅后即焚", icon: <Flame aria-hidden="true" /> },
        ]}
        onPick={(mode) => set({ openLimit: mode === "max" ? { mode, max: Math.max(lastMax.current, opened, 1) } : { mode } })}
      />
      {limit.mode === "max" && <NumberStepper label="最多打开次数" value={limit.max} min={Math.max(1, opened)} max={maxOpens} onChange={(v) => v !== null && set({ openLimit: { mode: "max", max: v } })} />}
    </SettingRow>
  );
}
