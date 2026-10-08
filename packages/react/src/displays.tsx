"use client";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "./primitives.tsx";
import { CopyButton, COPY_FAILED_TEXT, useCopy } from "./copy-button.tsx";
import { tipProps } from "./tooltip.tsx";
import { useAdminDefaults } from "./admin-defaults-context.tsx";
import { currencySymbol } from "./number-input-core.ts";
import { formatDateTime, formatMinorMoney, relativeTime, toTime, type DateInput } from "./format.ts";
export function NumberDisplay({
  value,
  unit = "",
  locale = "zh-CN",
}: {
  value: number | bigint | null;
  unit?: string;
  locale?: string;
}) {
  return (
    <span className="aui-number">
      {value === null || (typeof value === "number" && !Number.isFinite(value))
        ? "—"
        : `${value.toLocaleString(locale)}${unit ? ` ${unit}` : ""}`}
    </span>
  );
}
/**
 * An amount in minor units (bigint): `1,234.56`; the symbol defaults to AdminProvider `defaults.currency`
 * (`currency: "CNY"` → `CN¥1,234.56`), `symbol="¥"` sets one here, `unit="元"` writes `1,234.56 元`;
 * `digits={0}` shows whole units (rounded half away from zero, display only).
 */
export function MoneyDisplay({
  value,
  unit = "",
  symbol: symbolProp,
  digits,
}: {
  value: bigint | null;
  unit?: string;
  symbol?: string;
  /** Fraction digits shown, 0–2 (default 2). */
  digits?: number;
}) {
  const fallback = currencySymbol(useAdminDefaults().currency);
  const symbol = symbolProp ?? fallback;
  return <span className="aui-number">{formatMinorMoney(value, { symbol, unit, digits })}</span>;
}
type DateValue = DateInput | null | undefined;
/** One `<time>` for every date display: text from format.ts, the full time + zone on hover. */
function TimeText({ value, text, timeZone, cell }: { value: DateValue; text: (time: number) => string | null; timeZone: string; cell?: boolean }) {
  const time = toTime(value);
  const shown = time === null ? null : text(time);
  if (time === null || shown === null) return <span className={cell ? "aui-cell-empty" : undefined}>—</span>;
  return (
    <time className={cell ? "aui-cell-date" : undefined} dateTime={new Date(time).toISOString()} data-tip={`${formatDateTime(time, { seconds: true, timeZone })}（${timeZone}）`}>
      {shown}
    </time>
  );
}
/**
 * A date or date-time in a table cell, one line (`2026-09-30` / `2026-09-30 14:05`); hover shows the
 * full time with its time zone. null / invalid shows —. Details pages use DateTimeDisplay.
 */
export function CellDate({ value, time = false, timeZone: zone }: { value: DateValue; time?: boolean; timeZone?: string }) {
  const fallbackZone = useAdminDefaults().timeZone;
  const timeZone = zone ?? fallbackZone;
  return <TimeText cell value={value} timeZone={timeZone} text={(t) => formatDateTime(t, { time, timeZone })} />;
}
/** A full date-time for details pages and sentences: `2026-09-30 14:05:09` (`seconds={false}` drops seconds). */
export function DateTimeDisplay({ value, timeZone: zone, seconds = true }: { value: DateValue; timeZone?: string; seconds?: boolean }) {
  const fallbackZone = useAdminDefaults().timeZone;
  const timeZone = zone ?? fallbackZone;
  return <TimeText value={value} timeZone={timeZone} text={(t) => formatDateTime(t, { time: true, seconds, timeZone })} />;
}
/**
 * 刚刚 / 5 分钟前 / 3 小时前 / 昨天 14:05 … (same words as ActivityFeed); hover shows the full time.
 * Re-renders every 30 s while the tab is visible.
 */
export function RelativeTime({ value, timeZone: zone }: { value: DateValue; timeZone?: string }) {
  const fallbackZone = useAdminDefaults().timeZone;
  const timeZone = zone ?? fallbackZone;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "hidden") setNow(Date.now());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);
  return <TimeText value={value} timeZone={timeZone} text={(t) => relativeTime(t, now, timeZone)} />;
}
export type CopyableValueProps = {
  value: string | null;
  /**
   * "default": value + a「复制」text button + visible status (detail pages, dialogs).
   * "inline": for dense table cells — one line as tall as plain text, truncated with the full value
   * as a tooltip, a small copy icon; the result shows as an icon change plus a screen-reader status.
   */
  variant?: "default" | "inline";
  /** What is being copied, for the icon button's name: 「复制{label}」. Default: the value itself. */
  label?: string;
};
export function CopyableValue({ value, variant = "default", label }: CopyableValueProps) {
  if (variant === "inline") return <InlineCopy value={value} label={label} />;
  return <CopyableValueDefault value={value} label={label} />;
}
function InlineCopy({ value, label }: { value: string | null; label?: string }) {
  if (value === null) return <span className="aui-copy-inline">—</span>;
  return (
    <span className="aui-copy-inline">
      <span className="aui-copy-inline-value" data-tip-target="" {...tipProps(value, undefined, { truncated: true })}>{value}</span>
      <CopyButton text={value} label={label ?? value} reveal />
    </span>
  );
}
function CopyableValueDefault({ value, label }: { value: string | null; label?: string }) {
  const button = useRef<HTMLButtonElement>(null);
  const { result, copy } = useCopy();
  return (
    <span className="aui-copy-value aui-copy-host">
      {value ?? "—"}
      <Button ref={button} size="sm" variant="text" disabled={value === null} aria-label={label ? `复制${label}` : undefined} onClick={() => void copy(value ?? "", button.current)}>
        {result === "ok" ? "已复制" : "复制"}
      </Button>
      <span className="aui-sr-only" role="status">{result === "ok" ? "已复制" : result === "failed" ? COPY_FAILED_TEXT : ""}</span>
    </span>
  );
}
/** Shared state of an audited reveal (SensitiveValue, record field tiles with `reveal`). */
export type SensitiveRevealOptions = {
  /** Host callback: checks permission, writes the audit entry, resolves with the plain value. */
  reveal?: () => Promise<string>;
  /** Hide again after this many ms (default 30 s for audited reveals; 0 = stay until 「隐藏」). */
  remaskAfter?: number;
  /**
   * Whose value this is (record key, row object). When it changes the plain value is dropped at once and
   * a reveal still in flight for the old one is discarded — another record never shows this one's value.
   */
  scope?: unknown;
};
/**
 * Plain value after an audited reveal, hidden again after `remaskAfter`; `secondsLeft` counts down for
 * the 「N 秒后隐藏」 note. The plain value lives only in this component's memory.
 */
export function useSensitiveReveal({ reveal, remaskAfter = 30_000, scope }: SensitiveRevealOptions) {
  const [value, setValue] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [seenScope, setSeenScope] = useState(scope);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const fresh = Object.is(seenScope, scope);
  if (!fresh) {
    // Another record: forget the old plain value during render (never painted under the new owner).
    setSeenScope(scope);
    setValue(undefined);
    setUntil(null);
    setBusy(false);
    setError("");
  }
  useEffect(() => {
    if (until === null) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) {
        setValue(undefined);
        setUntil(null);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [until]);
  const hide = () => {
    setValue(undefined);
    setUntil(null);
  };
  const toggle = async () => {
    if (!reveal) return;
    if (value !== undefined) return hide();
    const asked = scopeRef.current;
    const stale = () => !Object.is(scopeRef.current, asked);
    setBusy(true);
    setError("");
    try {
      const plain = await reveal();
      if (stale()) return;
      setValue(plain);
      if (remaskAfter > 0) {
        const t = Date.now();
        setNow(t);
        setUntil(t + remaskAfter);
      }
    } catch (caught) {
      if (stale()) return;
      setError(caught instanceof Error && caught.message ? caught.message : "无权查看或加载失败");
    } finally {
      if (!stale()) setBusy(false);
    }
  };
  const shownValue = fresh ? value : undefined;
  const secondsLeft = !fresh || until === null ? null : Math.max(0, Math.ceil((until - now) / 1000));
  return { value: shownValue, shown: shownValue !== undefined, busy: fresh && busy, error: fresh ? error : "", toggle, hide, secondsLeft };
}

/**
 * A masked value (`masked`: 「0955-***-781」) the user may reveal. `onReveal` (audited: the host checks
 * permission and records who looked) resolves with the plain value; it hides again after `remaskAfter`
 * (default 30 s). `reveal` is the older name (no automatic re-mask unless `remaskAfter` is given).
 * `variant="icon"` = an eye button (field tiles, table cells). No unmasked value is accepted until the
 * authorized host callback resolves.
 */
export function SensitiveValue({
  masked,
  reveal,
  onReveal,
  remaskAfter,
  variant = "text",
  label,
  auditNote,
}: {
  masked: string;
  reveal?: () => Promise<string>;
  onReveal?: () => Promise<string>;
  remaskAfter?: number;
  variant?: "text" | "icon";
  /** What the value is (「手机」): names the button 「查看手机」. */
  label?: string;
  /** Tooltip of the reveal button (default for onReveal: 「查看会被记录」). */
  auditNote?: string;
}) {
  const callback = onReveal ?? reveal;
  const state = useSensitiveReveal({ reveal: callback, remaskAfter: remaskAfter ?? (onReveal ? 30_000 : 0) });
  const note = auditNote ?? (onReveal ? "查看会被记录" : undefined);
  const what = label ?? "";
  return (
    <span className="aui-copy-value aui-sensitive" data-shown={state.shown || undefined}>
      <span className="aui-sensitive-text">{state.value ?? masked}</span>
      {callback && (variant === "icon" ? (
        <button type="button" className="aui-icon-button" aria-pressed={state.shown} aria-label={state.shown ? `隐藏${what}` : `查看${what}`} data-tip={state.shown ? "隐藏" : note ?? "查看"} disabled={state.busy} onClick={() => void state.toggle()}>
          {state.shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      ) : (
        <Button variant="ghost" disabled={state.busy} tooltip={state.shown ? undefined : note} aria-label={what ? (state.shown ? `隐藏${what}` : `查看${what}`) : undefined} onClick={() => void state.toggle()}>
          {state.shown ? "隐藏" : "查看"}
        </Button>
      ))}
      {state.secondsLeft !== null && <small className="aui-sensitive-left">{state.secondsLeft} 秒后隐藏</small>}
      {state.error && <span role="alert">{state.error}</span>}
    </span>
  );
}
