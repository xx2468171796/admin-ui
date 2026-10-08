"use client";
/**
 * Small atoms (bt/foundations F0.5), each a one-liner in the approved bitable demos:
 * AvatarStack (presence in the title bar, members), Rating (intent stars, warning colour per decision
 * #76 item 5), SplitButton (「添加记录 ▾」), CodeInput (share PIN), NumberStepper (open count),
 * Countdown (text chip or ring; claim pool, secret auto-hide) and Watermark (shared pages).
 * Rules live in atoms-core.ts. Colours only from tokens; everything keyboard-operable.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { Button } from "./primitives.tsx";
import { tipProps } from "./tooltip.tsx";
import { Menu, openFocus, type MenuSection } from "./menu.tsx";
import {
  cleanCode,
  clearCodeBox,
  countdownProgress,
  countdownText,
  fillCode,
  parseStepper,
  stepNumber,
  watermarkTiles,
  type CodeCharset,
} from "./atoms-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/atoms.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/atoms.css";

// AvatarStack moved to avatar.tsx (per-person colours, 「+k」 opens a list).

// Rating moved to rating.tsx (solid stars, words); re-exported here for old imports.
export { Rating, type RatingProps } from "./rating.tsx";

// ---------------------------------------------------------------- SplitButton

export type SplitButtonProps = {
  /** The main action. */
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  /** The ▾ menu: other ways to do it (「从表单添加」「批量导入」…). */
  sections: readonly MenuSection[];
  /** Accessible name of the ▾ button (default 「更多{label}方式」). */
  menuLabel?: string;
  variant?: "default" | "secondary" | "outline";
  size?: "default" | "sm";
  disabled?: boolean;
};
/** Primary action + ▾ menu as one control (「添加记录 ▾」); the menu lines up under the whole control. */
export function SplitButton({ label, icon, onClick, sections, menuLabel, variant = "default", size = "sm", disabled }: SplitButtonProps) {
  const group = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<false | "first" | "last" | "menu">(false);
  const name = menuLabel ?? `更多${label}方式`;
  const buttonSize = size === "sm" ? "sm" : "default";
  return (
    <div ref={group} className="aui-split-button" role="group" aria-label={label} data-variant={variant}>
      <Button variant={variant} size={buttonSize} disabled={disabled} onClick={onClick}>
        {icon}
        {label}
      </Button>
      <Button
        ref={toggle}
        variant={variant}
        size={buttonSize}
        className="aui-split-toggle"
        aria-label={name}
        aria-haspopup="menu"
        aria-expanded={Boolean(open)}
        disabled={disabled}
        onClick={(event) => setOpen((v) => (v ? false : openFocus(event)))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(event.key === "ArrowDown" ? "first" : "last");
          }
        }}
      >
        <ChevronDown />
      </Button>
      <Menu open={Boolean(open)} anchor={group.current} returnFocus={toggle.current} sections={sections} label={name} initialFocus={open || "first"} onClose={() => setOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------- CodeInput

export type CodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Called once all boxes are filled. */
  onComplete?: (value: string) => void;
  /** Number of boxes (default 4). */
  length?: number;
  /** numeric = digits only (number keyboard); alnum = letters + digits (default). */
  charset?: CodeCharset;
  /** Uppercase letters as typed (default true; the share PIN is case-insensitive). */
  uppercase?: boolean;
  /** Accessible name of the group (「密码」). */
  label: string;
  /** Error text under the boxes (「密码不对，还能试 4 次」); boxes turn danger. */
  error?: string;
  disabled?: boolean;
  /** Show dots instead of the characters. */
  mask?: boolean;
  autoFocus?: boolean;
  /** Remaining-tries dots right of the error line: `maxTries` dots, the used ones (maxTries − triesLeft) in danger colour. */
  triesLeft?: number;
  /** Red borders without a message line under the boxes (the host says why elsewhere, e.g. PasswordGate's status row). */
  invalid?: boolean;
  /** Change it (failed-attempt count) to shake again even when the error text stays the same. */
  shakeKey?: string | number;
  maxTries?: number;
};
/**
 * PIN / verification code boxes (44 × 52, radius 10, mono 22px): typing moves on, Backspace
 * moves back, paste fills them all. A new `error` turns only the borders red and shakes the row once (no motion
 * when reduced motion is on).
 */
export function CodeInput({ value, onChange, onComplete, length = 4, charset = "alnum", uppercase = true, label, error, disabled, mask, autoFocus, triesLeft, maxTries, invalid, shakeKey }: CodeInputProps) {
  const errorId = useId();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  // Shake once per new error text (alternating names restart the CSS animation).
  const [shake, setShake] = useState(0);
  const bad = Boolean(error) || Boolean(invalid);
  const trigger = bad ? `${error ?? ""}|${shakeKey ?? ""}` : "";
  const lastTrigger = useRef(trigger);
  useEffect(() => {
    if (trigger && trigger !== lastTrigger.current) setShake((n) => n + 1);
    lastTrigger.current = trigger;
  }, [trigger]);
  const used = maxTries != null ? Math.max(0, Math.min(maxTries, maxTries - (triesLeft ?? maxTries))) : 0;
  const chars = Array.from(value);
  // bt/share: the value just set, before the parent re-renders — focus() below fires onFocus synchronously.
  const latest = useRef(value);
  latest.current = value;
  const focus = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  };
  const set = (next: string, focusAt: number) => {
    if (next !== value) onChange(next);
    latest.current = next;
    focus(focusAt);
    if (next.length === length && next !== value) onComplete?.(next);
  };
  return (
    <div className="aui-code-input">
      <div role="group" aria-label={label} aria-describedby={error ? errorId : undefined} className="aui-code-boxes" data-invalid={bad || undefined} data-shake={shake ? (shake % 2 ? "a" : "b") : undefined}>
        {Array.from({ length }, (_, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="aui-code-box"
            value={chars[i] ?? ""}
            type={mask ? "password" : "text"}
            inputMode={charset === "numeric" ? "numeric" : "text"}
            autoComplete={i === 0 ? "one-time-code" : "off"}
            autoCapitalize={uppercase ? "characters" : "off"}
            spellCheck={false}
            maxLength={length}
            aria-label={`${label}第 ${i + 1} 位，共 ${length} 位`}
            aria-invalid={bad || undefined}
            disabled={disabled}
            autoFocus={autoFocus && i === 0}
            onFocus={(event) => {
              // Never leave a gap: focus the first empty box instead of one further on.
              const filled = Array.from(latest.current).length;
              if (i > filled) focus(filled);
              else event.currentTarget.select();
            }}
            onChange={(event) => {
              // The inserted text (typing / IME / insertText); autofill and the like give the whole value.
              // Emptied without a Backspace keydown (cut, IME, context-menu delete): truncate like Backspace.
              if (event.currentTarget.value === "") {
                const r = clearCodeBox(value, i);
                set(r.value, r.focus);
                return;
              }
              const inserted = (event.nativeEvent as InputEvent).data;
              const fresh = inserted ?? event.currentTarget.value;
              const r = fillCode(value, i, fresh, length, charset, uppercase);
              set(r.value, r.focus);
            }}
            onPaste={(event) => {
              event.preventDefault();
              const r = fillCode(value, i, event.clipboardData.getData("text"), length, charset, uppercase);
              set(r.value, r.focus);
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace") {
                event.preventDefault();
                if (chars[i]) {
                  const r = clearCodeBox(value, i);
                  set(r.value, r.focus);
                }
                else if (i > 0) set(chars.slice(0, i - 1).join(""), i - 1);
              } else if (event.key === "ArrowLeft" && i > 0) {
                event.preventDefault();
                focus(i - 1);
              } else if (event.key === "ArrowRight" && i < chars.length) {
                event.preventDefault();
                focus(i + 1);
              } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !cleanCode(event.key, 1, charset, uppercase)) {
                event.preventDefault();
              }
            }}
          />
        ))}
      </div>
      {(error || maxTries != null) && (
        <div className="aui-code-foot">
          {error ? (
            <p id={errorId} className="aui-code-error" role="alert">
              {error}
            </p>
          ) : (
            <span />
          )}
          {maxTries != null && (
            <span className="aui-code-tries" role="img" aria-label={`还能试 ${maxTries - used} 次，共 ${maxTries} 次`}>
              {Array.from({ length: maxTries }, (_, i) => (
                <i key={i} data-used={i < used || undefined} />
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- NumberStepper

export type NumberStepperProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Accessible name (「最多打开次数」). */
  label: string;
  min?: number;
  max?: number;
  /** Step of − / + and ↑ ↓ (default 1); PageUp / PageDown step ×10. */
  step?: number;
  /** Unit after the number inside the box (「次」「天」). */
  unit?: string;
  disabled?: boolean;
  /** sm 28px (default) · default 36px. */
  size?: "sm" | "default";
};
/**
 * − 20 次 + in one box (same border as text boxes): the − / + are ghost buttons inside
 * both ends (28px, 22px at sm) that grey out at the bounds; typing is allowed, the value clamps on blur /
 * Enter. Only for small integers (1–30: 次数、天数); amounts and quantities use NumberInput.
 */
export function NumberStepper({ value, onChange, label, min, max, step = 1, unit, disabled, size = "sm" }: NumberStepperProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const lo = min ?? Number.NEGATIVE_INFINITY;
  const hi = max ?? Number.POSITIVE_INFINITY;
  const commit = () => {
    if (draft === null) return;
    const parsed = parseStepper(draft, lo, hi);
    setDraft(null);
    if (parsed !== undefined && parsed !== value) onChange(parsed);
  };
  const bump = (times: number) => {
    const next = stepNumber(value, step, times, lo, hi);
    setDraft(null);
    if (next !== value) onChange(next);
  };
  return (
    <span className="aui-stepper" data-size={size} role="group" aria-label={label} data-disabled={disabled || undefined}>
      <button type="button" className="aui-stepper-button" aria-label={`减少${label}`} {...tipProps(`减 ${step}`)} disabled={disabled || (value !== null && value <= lo)} onClick={() => bump(-1)}>
        <Minus aria-hidden="true" />
      </button>
      <span className="aui-stepper-field">
        <input
          className="aui-stepper-input"
          role="spinbutton"
          inputMode="decimal"
          aria-label={label}
          aria-valuenow={value ?? undefined}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={value === null ? "未填" : `${value}${unit ?? ""}`}
          disabled={disabled}
          value={draft ?? (value === null ? "" : String(value))}
          size={Math.max(2, String(draft ?? value ?? "").length + 1)}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            const times = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : event.key === "PageUp" ? 10 : event.key === "PageDown" ? -10 : 0;
            if (times) {
              event.preventDefault();
              bump(times);
            } else if (event.key === "Home" && min !== undefined) {
              event.preventDefault();
              setDraft(null);
              onChange(min);
            } else if (event.key === "End" && max !== undefined) {
              event.preventDefault();
              setDraft(null);
              onChange(max);
            } else if (event.key === "Enter") commit();
            else if (event.key === "Escape" && draft !== null) {
              event.preventDefault();
              setDraft(null);
            }
          }}
        />
        {unit && <span className="aui-stepper-unit" aria-hidden="true">{unit}</span>}
      </span>
      <button type="button" className="aui-stepper-button" aria-label={`增加${label}`} {...tipProps(`加 ${step}`)} disabled={disabled || (value !== null && value >= hi)} onClick={() => bump(1)}>
        <Plus aria-hidden="true" />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------- Countdown

export type CountdownProps = {
  /** Deadline (epoch ms or Date). */
  until: number | Date;
  /** text = 「52 秒」 inline (put it in a chip / sentence); ring = circle with the number inside. */
  variant?: "text" | "ring";
  /** Full duration in ms: the ring shows what is left of it (default: the time left when mounted). */
  totalMs?: number;
  /** auto: 52 秒 / 4:59 / 2:04:59 / 3 天 4 小时 (default) · clock: always m:ss / h:mm:ss. */
  format?: "auto" | "clock";
  /** Called once when it reaches zero. */
  onExpire?: () => void;
  /** Accessible prefix (「自动隐藏」→ 「自动隐藏：还剩 52 秒」). */
  label?: string;
  /** Turn to the attention colour below this many ms (default: never for text, always for ring). */
  warnBelowMs?: number;
  /** Clock for tests / server-synced time (default Date.now). */
  now?: () => number;
};
/** A live countdown (1 s ticks, aligned to the second). Expired shows 「0 秒」 and calls onExpire once. */
export function Countdown({ until, variant = "text", totalMs, format = "auto", onExpire, label, warnBelowMs, now = Date.now }: CountdownProps) {
  const deadline = typeof until === "number" ? until : until.getTime();
  const [left, setLeft] = useState(() => Math.max(0, deadline - now()));
  const [total] = useState(() => totalMs ?? Math.max(1, deadline - now()));
  // The deadline onExpire already fired for: a new `now` / onExpire identity per render must not re-fire it.
  const expiredFor = useRef<number | null>(null);
  const expire = useRef(onExpire);
  expire.current = onExpire;
  const clock = useRef(now);
  clock.current = now;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const ms = Math.max(0, deadline - clock.current());
      setLeft(ms);
      if (ms <= 0) {
        if (expiredFor.current !== deadline) {
          expiredFor.current = deadline;
          expire.current?.();
        }
        return;
      }
      timer = setTimeout(tick, (ms % 1000) + 5);
    };
    tick();
    return () => clearTimeout(timer);
  }, [deadline]);
  const text = countdownText(left, format);
  const warn = warnBelowMs !== undefined ? left <= warnBelowMs : variant === "ring";
  const name = label ? `${label}：还剩 ${text}` : `还剩 ${text}`;
  if (variant === "text")
    return (
      <span className="aui-countdown" role="timer" aria-label={name} data-tone={warn ? "warning" : undefined} data-expired={left <= 0 || undefined}>
        {text}
      </span>
    );
  const r = 20;
  const c = 2 * Math.PI * r;
  const progress = countdownProgress(left, totalMs ?? total);
  const parts = text.split(" ");
  return (
    <span className="aui-countdown-ring" role="timer" aria-label={name} data-tone={warn ? "warning" : undefined}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle className="aui-countdown-track" cx="24" cy="24" r={r} />
        <circle className="aui-countdown-arc" cx="24" cy="24" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - progress)} />
      </svg>
      <span className="aui-countdown-ring-text" aria-hidden="true">
        <b>{parts[0]}</b>
        {parts[1] && <small>{parts.slice(1).join(" ")}</small>}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------- Watermark

export type WatermarkProps = {
  /** One or two short lines (「访客 203.0.**.18」「2026-10-05 20:16」). */
  text: string | readonly string[];
  /** Wrap content (the mark covers it); omit to overlay the nearest positioned ancestor. */
  children?: ReactNode;
  /** Distance between marks in px (default [240, 150]). */
  gap?: readonly [number, number];
  /** Rotation in degrees (default −20). */
  rotate?: number;
};
/**
 * Tiled, faint, rotated text over content (shared pages, exports). Not a security measure — a hint
 * that leaks are traceable; the server still decides what a visitor gets. Token colour, never blocks
 * clicks or text selection of the content, hidden from screen readers, printed too.
 */
export function Watermark({ text, children, gap = [240, 150], rotate = -20 }: WatermarkProps) {
  const layer = useRef<HTMLDivElement>(null);
  const [grid, setGrid] = useState({ cols: 6, rows: 8 });
  const lines = typeof text === "string" ? [text] : text;
  useLayoutEffect(() => {
    const node = layer.current;
    if (!node) return;
    const measure = () => {
      const next = watermarkTiles(node.clientWidth, node.clientHeight, gap[0], gap[1]);
      setGrid((old) => (old.cols === next.cols && old.rows === next.rows ? old : next));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [gap[0], gap[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const mark = (
    <div ref={layer} className="aui-watermark" aria-hidden="true" style={{ "--aui-wm-x": `${gap[0]}px`, "--aui-wm-y": `${gap[1]}px`, "--aui-wm-rotate": `${rotate}deg` } as CSSProperties}>
      {Array.from({ length: grid.rows }, (_, row) => (
        <div key={row} className="aui-watermark-row" data-odd={row % 2 || undefined}>
          {Array.from({ length: grid.cols }, (_, col) => (
            <span key={col} className="aui-watermark-mark">
              {lines.map((line, i) => (
                <span key={i}>{line}</span>
              ))}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
  if (children === undefined) return mark;
  return (
    <div className="aui-watermark-host">
      {children}
      {mark}
    </div>
  );
}
