"use client";
/**
 * Copying.
 * - `CopyButton`: the 24px ghost copy icon of a field row. With `reveal` it shows only while the row is hovered
 *   / focused (always on phones). Success: the icon turns into a tick + a 「已复制」 bubble for 1.5 s + a
 *   screen-reader announcement; failure: × + 「复制失败，请手动选中复制」.
 * - `CopyField`: a whole value to take away (public link, API token): monospace value + a 「复制」 text button;
 *   `secret` masks it with a 「显示」 button that reveals it for 30 s.
 */
import { useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { Button } from "./primitives.tsx";
import { tipProps, useTipFlash } from "./tooltip.tsx";
import { COPY_FEEDBACK_MS } from "./tooltip-core.ts";

export const COPY_FAILED_TEXT = "复制失败，请手动选中复制";

type CopyResult = "" | "ok" | "failed";

/** Copy `text`, flash the bubble on `anchor`, and expose the result for 1.5 s. */
export function useCopy(): { result: CopyResult; copy: (text: string, anchor: HTMLElement | null) => Promise<boolean> } {
  const flash = useTipFlash();
  const [result, setResult] = useState<CopyResult>("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (text: string, anchor: HTMLElement | null) => {
    clearTimeout(timer.current);
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = false;
    }
    setResult(ok ? "ok" : "failed");
    if (anchor) flash(anchor, ok ? "已复制" : COPY_FAILED_TEXT, { tone: ok ? "ok" : "error" });
    timer.current = setTimeout(() => setResult(""), COPY_FEEDBACK_MS);
    return ok;
  };
  return { result, copy };
}

export type CopyButtonProps = {
  /** What lands on the clipboard. */
  text: string;
  /** What it is, for the accessible name 「复制{label}」. */
  label: string;
  /** xs 24 (default: field rows, cells) · sm 28. */
  size?: "xs" | "sm";
  /** Hidden until the surrounding row (`.aui-copy-host`, record field rows, table rows) is hovered / focused; always on phones. */
  reveal?: boolean;
  onCopied?: (ok: boolean) => void;
};

/** The copy icon of a field row (24px ghost). */
export function CopyButton({ text, label, size = "xs", reveal = false, onCopied }: CopyButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const { result, copy } = useCopy();
  return (
    <>
      <button
        ref={ref}
        type="button"
        className="aui-icon-btn aui-copy-btn"
        data-size={size}
        data-reveal={reveal || undefined}
        data-result={result || undefined}
        aria-label={`复制${label}`}
        {...(result ? {} : tipProps("复制"))}
        onClick={async () => {
          const ok = await copy(text, ref.current);
          onCopied?.(ok);
        }}
      >
        {result === "ok" ? <Check aria-hidden="true" /> : result === "failed" ? <X aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </button>
      <span className="aui-sr-only" role="status">{result === "ok" ? "已复制" : result === "failed" ? COPY_FAILED_TEXT : ""}</span>
    </>
  );
}

export type CopyFieldProps = {
  value: string;
  /** What it is (「公开登记链接」「API 令牌」): accessible names and the 「已复制」 announcement. */
  label: string;
  /** Mask the value (tokens): 「显示」 reveals it for `revealMs` (30 s), then it masks itself again. */
  secret?: boolean;
  revealMs?: number;
  /** A line under the box (「60 秒后清空剪贴板（尽力而为）」, where to paste it). */
  note?: string;
  /** Called with the result of each copy (e.g. to clear the clipboard later). */
  onCopied?: (ok: boolean) => void;
  /** Button words for other languages (default 复制 / 已复制 / 显示 / 隐藏 / 秒). */
  labels?: { copy?: string; copied?: string; show?: string; hide?: string; seconds?: string };
};

/** Visible part of a masked secret: bullets + the last 4 characters. */
export function maskSecret(value: string): string {
  if (value.length <= 4) return "••••";
  return `${"•".repeat(Math.min(12, Math.max(4, value.length - 4)))}${value.slice(-4)}`;
}

/** A whole value to take away: monospace + 「复制」; secrets masked, 「显示」 for 30 s. */
export function CopyField({ value, label, secret, revealMs = 30_000, note, onCopied, labels }: CopyFieldProps) {
  const words = { copy: "复制", copied: "已复制", show: "显示", hide: "隐藏", seconds: "秒", ...labels };
  const button = useRef<HTMLButtonElement>(null);
  const { result, copy } = useCopy();
  const [shownUntil, setShownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const shown = !secret || shownUntil > now;
  useEffect(() => {
    if (!shownUntil) return;
    const tick = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= shownUntil) {
        setShownUntil(0);
        clearInterval(tick);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [shownUntil]);
  const left = Math.max(0, Math.ceil((shownUntil - now) / 1000));
  return (
    <div className="aui-copy-field-wrap">
      <div className="aui-copy-field" role="group" aria-label={label}>
        <code data-masked={shown ? undefined : ""} aria-label={shown ? undefined : `${label}（已隐藏）`}>{shown ? value : maskSecret(value)}</code>
        {secret && (
          <Button size="sm" variant="text" onClick={() => (shown ? setShownUntil(0) : (setNow(Date.now()), setShownUntil(Date.now() + revealMs)))}>
            {shown ? `${words.hide}${left ? ` · ${left} ${words.seconds}` : ""}` : words.show}
          </Button>
        )}
        <Button ref={button} size="sm" variant="text" aria-label={`${words.copy}${label}`} onClick={async () => {
            const ok = await copy(value, button.current);
            onCopied?.(ok);
          }}>
          {result === "ok" ? <Check aria-hidden="true" /> : result === "failed" ? <X aria-hidden="true" /> : null}
          {result === "ok" ? words.copied : words.copy}
        </Button>
        <span className="aui-sr-only" role="status">{result === "ok" ? `${label}已复制` : result === "failed" ? COPY_FAILED_TEXT : ""}</span>
      </div>
      {note && <p className="aui-copy-field-note">{note}</p>}
    </div>
  );
}
