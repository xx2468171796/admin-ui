"use client";
/**
 * Public share gates (bt/share S3 / S4): PasswordGate (demo D21m) — the PIN boxes a visitor fills before
 * a protected share opens, with attempt dots, the burn-after-reading warning and a captcha slot after N
 * failures (the captcha itself comes from your captcha provider); SecretReveal (demo D21s) — the page version of
 * OneTimeSecretDialog: copy fields, a countdown ring that hides everything, clipboard clearing and
 * 「立即销毁」. Mobile first: inside SharedPageShell variant="narrow", controls ≥ 44px on phones.
 * The server checks the PIN, counts attempts, voids burn-after-reading links; this is only the face.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, Eye, EyeOff, Flame, Hourglass, KeyRound, Link2Off, Lock, ShieldCheck, Timer, TriangleAlert } from "lucide-react";
import { Button } from "./primitives.tsx";
import { IconBlock } from "./kit.tsx";
import { CodeInput, Countdown } from "./atoms.tsx";
import { attemptState, createClipboardClearer, sharedByText } from "./share-core.ts";
import type { SharedBy } from "./share-public.tsx";
import { avatarTone } from "./avatar-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/share.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/share.css";

function SharerChip({ by }: { by: SharedBy }) {
  return (
    <span className="aui-gate-who">
      <span className="aui-avatar" data-size="24" data-tone={avatarTone(by.name)} aria-hidden="true">{by.avatar ?? by.name.slice(0, 1)}</span>
      {by.name}
      {by.org && <> · {by.org}</>}
    </span>
  );
}

// ---------------------------------------------------------------- PasswordGate

export type PasswordGateProps = {
  sharedBy: SharedBy;
  /** 「郑主管 分享给你一个密码」 */
  title: ReactNode;
  /** 「输入郑主管另外告诉你的 4 位密码」 */
  hint?: ReactNode;
  /** Burn-after-reading warning card (「打开后只显示一次，关闭即销毁」 + detail). */
  burn?: { title: ReactNode; text?: ReactNode };
  length?: number;
  charset?: "numeric" | "alnum";
  /** Right of the 「密码」 label (default 「不区分大小写」 for alnum). */
  caseNote?: string;
  /** Failed attempts so far and the maximum (dots + 「还能试 N 次」). */
  failed?: number;
  maxAttempts?: number;
  /** Error text; default 「密码不对，还能试 N 次」 after a failure. */
  error?: string;
  /** Captcha required from this many failures (default 3); `captcha` is your captcha widget, `captchaDone` unlocks submit. */
  captchaAfter?: number;
  captcha?: ReactNode;
  captchaDone?: boolean;
  /** Under the boxes (「密码不在这条链接里，问问郑主管（LINE 或电话）」). */
  contactHint?: ReactNode;
  /** Small lines under the card (「10-06 20:30 前有效」); the captcha rule is added automatically. */
  expiresText?: ReactNode;
  /** Out of attempts / locked by the server: the reason, input disabled. */
  locked?: ReactNode;
  submitLabel?: string;
  /** Check the PIN on the server. Resolve = opened (host navigates); reject = host updates failed / error. */
  onSubmit: (code: string) => Promise<void> | void;
};

/** The PIN gate before a protected share (mobile first). */
export function PasswordGate({ sharedBy, title, hint, burn, length = 4, charset = "alnum", caseNote, failed = 0, maxAttempts = 5, error, captchaAfter = 3, captcha, captchaDone, contactHint, expiresText, locked, submitLabel = "查看", onSubmit }: PasswordGateProps) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const state = attemptState(failed, maxAttempts, captchaAfter);
  const message = error ?? (failed > 0 && !state.locked ? `密码不对，还能试 ${state.left} 次` : undefined);
  const needCaptcha = state.captcha && Boolean(captcha);
  const blocked = Boolean(locked) || state.locked;
  const ready = code.length === length && !busy && !blocked && (!needCaptcha || captchaDone);
  const submit = async (value = code) => {
    if (value.length !== length || busy || blocked || (needCaptcha && !captchaDone)) return;
    setBusy(true);
    try {
      await onSubmit(value);
    } catch {
      // The host reports the failure through `failed` / `error`.
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="aui-gate">
      <div className="aui-gate-hero">
        <span className="aui-gate-icon">
          <IconBlock size="lg" round>
            <Lock />
          </IconBlock>
          {burn && (
            <span className="aui-gate-burn-badge" data-tip="阅后即焚">
              <Flame aria-hidden="true" />
            </span>
          )}
        </span>
        <SharerChip by={sharedBy} />
        <h1>{title}</h1>
        {hint && <p>{hint}</p>}
      </div>
      <form
        className="aui-public-card aui-gate-card"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {burn && (
          <div className="aui-gate-burn" role="note">
            <Flame aria-hidden="true" />
            <span>
              <b>{burn.title}</b>
              {burn.text && <small>{burn.text}</small>}
            </span>
          </div>
        )}
        <div className="aui-gate-label">
          <span>密码</span>
          <small>{caseNote ?? (charset === "alnum" ? "不区分大小写" : "")}</small>
        </div>
        {/* error only turns the borders red + shakes once; the gate's own status row below says it. */}
        <CodeInput label="分享密码" length={length} charset={charset} value={code} onChange={setCode} onComplete={(v) => !needCaptcha && void submit(v)} disabled={blocked || busy} invalid={!blocked && Boolean(message)} shakeKey={failed} autoFocus />
        <div className="aui-gate-status">
          {(message || locked) && (
            <span className="aui-gate-error" role="alert">
              <TriangleAlert aria-hidden="true" />
              {locked ?? message}
            </span>
          )}
          <span className="aui-gate-dots" role="img" aria-label={`已试 ${Math.min(failed, maxAttempts)} 次，共 ${maxAttempts} 次`}>
            {state.dots.map((d, i) => (
              <i key={i} data-state={d} />
            ))}
          </span>
        </div>
        {contactHint && <p className="aui-gate-hint">{contactHint}</p>}
        {needCaptcha && (
          <div className="aui-gate-captcha" aria-label="人机验证">
            {captcha}
          </div>
        )}
        <Button type="submit" className="aui-gate-submit" disabled={!ready} aria-busy={busy || undefined}>
          <Eye />
          {busy ? "正在验证…" : submitLabel}
        </Button>
      </form>
      <div className="aui-gate-meta">
        {expiresText && (
          <span>
            <Hourglass aria-hidden="true" />
            {expiresText}
          </span>
        )}
        {captcha !== undefined && (
          <span>
            <ShieldCheck aria-hidden="true" />
            连错 {captchaAfter} 次要过滑块验证
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- SecretReveal

export type SecretField = {
  key: string;
  label: string;
  icon?: ReactNode;
  value: string;
  /** A password / key: monospace, can be hidden, copying it starts the clipboard clear. */
  secret?: boolean;
  /** Open link (login URL). */
  href?: string;
};
export type SecretRevealProps = {
  /** 「LINE 官方账号后台」 */
  title: string;
  /** Small line above the title (default 「密码 · 只显示这一次」). */
  kindLabel?: string;
  sharedBy: SharedBy;
  /** When it was shared, just the time: 「10-05 20:30」 (the line reads 「郑主管 · 10-05 20:30 分享」). */
  sharedAt?: ReactNode;
  fields: readonly SecretField[];
  /** The sharer's note at the bottom of the card. */
  memo?: ReactNode;
  /** Burn notice on top (「这个链接已作废，刷新后无法再看」). */
  voided?: { title: ReactNode; text?: ReactNode };
  /** Hide everything this long after the page opened (default 60 s); 0 = never. */
  hideAfterMs?: number;
  /** Clear the clipboard this long after copying a secret (default 60 s, best effort); 0 = never. */
  clipboardClearMs?: number;
  /** The values were hidden (time up / destroyed): the host may also tell the server. */
  onHidden?: (why: "timeout" | "destroyed") => void;
  /** 「我已记好，立即销毁」: tell the server (resolve), then the page clears. */
  onDestroy?: () => Promise<void> | void;
  now?: () => number;
};

/** 「郑主管 · 10-05 20:30 分享」; a non-text time (a <time> element) goes in the same place. */
function sharedByLine(name: string, sharedAt?: ReactNode): ReactNode {
  if (sharedAt === undefined || sharedAt === null || typeof sharedAt === "string") return sharedByText(name, sharedAt);
  return <>{name} · {sharedAt} 分享</>;
}

/** A one-time secret on a share page: copy, auto-hide countdown, clipboard clear, destroy now. */
export function SecretReveal({ title, kindLabel = "密码 · 只显示这一次", sharedBy, sharedAt, fields, memo, voided, hideAfterMs = 60_000, clipboardClearMs = 60_000, onHidden, onDestroy, now = Date.now }: SecretRevealProps) {
  const [until] = useState(() => (hideAfterMs > 0 ? now() + hideAfterMs : 0));
  const [left, setLeft] = useState(hideAfterMs);
  const [gone, setGone] = useState<"" | "timeout" | "destroyed">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hiddenRef = useRef(onHidden);
  hiddenRef.current = onHidden;
  // One clipboard-clear timer for the page: hiding the fields (rows unmount) must not cancel it; leaving
  // the page clears at once if a clear is still pending.
  const [clipboard] = useState(() => createClipboardClearer((text) => navigator.clipboard?.writeText(text)));
  useEffect(() => () => clipboard.flush(), [clipboard]);
  useEffect(() => {
    if (!until || gone) return;
    const tick = () => setLeft(Math.max(0, until - now()));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [until, gone, now]);
  const goneRef = useRef<"" | "timeout" | "destroyed">("");
  const hide = (why: "timeout" | "destroyed") => {
    if (goneRef.current === why || goneRef.current === "destroyed") return;
    const first = !goneRef.current;
    goneRef.current = why;
    setGone(why);
    if (first) hiddenRef.current?.(why);
  };
  const destroy = async () => {
    setBusy(true);
    setError("");
    try {
      await onDestroy?.();
      hide("destroyed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "没销毁成功，请重试");
    } finally {
      setBusy(false);
    }
  };
  const seconds = Math.ceil(left / 1000);
  return (
    <div className="aui-secret-page">
      {voided && (
        <div className="aui-secret-voided" role="note">
          <Link2Off aria-hidden="true" />
          <span>
            <b>{voided.title}</b>
            {voided.text && <small>{voided.text}</small>}
          </span>
        </div>
      )}
      <section className="aui-public-card aui-secret-card" aria-label={title}>
        <header className="aui-secret-head">
          <IconBlock size="lg">
            <KeyRound />
          </IconBlock>
          <div className="aui-secret-title">
            <small>{kindLabel}</small>
            <h1>{title}</h1>
            <span className="aui-secret-by">
              <span className="aui-avatar" data-size="24" data-tone={avatarTone(sharedBy.name)} aria-hidden="true">{sharedBy.avatar ?? sharedBy.name.slice(0, 1)}</span>
              {sharedByLine(sharedBy.name, sharedAt)}
            </span>
          </div>
          {until > 0 && !gone && <Countdown variant="ring" until={until} totalMs={hideAfterMs} label="自动隐藏" onExpire={() => hide("timeout")} now={now} />}
        </header>
        {gone ? (
          <div className="aui-secret-gone" role="status">
            <EyeOff aria-hidden="true" />
            <b>{gone === "destroyed" ? "已销毁" : "已自动隐藏"}</b>
            <small>{gone === "destroyed" ? "内容已从这个页面和服务器上删掉，再打开链接也看不到了。" : "为了安全，内容已从页面清除；刷新或再打开链接也看不到了。"}</small>
          </div>
        ) : (
          <div className="aui-secret-fields">
            {fields.map((f) => (
              <SecretFieldRow key={f.key} field={f} clearMs={clipboardClearMs} onCopied={() => clipboard.schedule(clipboardClearMs)} />
            ))}
            {memo && <div className="aui-secret-memo">{memo}</div>}
          </div>
        )}
      </section>
      {until > 0 && !gone && (
        <div className="aui-secret-count">
          <div className="aui-secret-count-row">
            <Timer aria-hidden="true" />
            <b>{Math.round(hideAfterMs / 1000)} 秒后自动隐藏</b>
            <span>还剩 {seconds} 秒</span>
          </div>
          <span className="aui-secret-track" aria-hidden="true">
            <i style={{ width: `${(left / hideAfterMs) * 100}%` }} />
          </span>
        </div>
      )}
      {onDestroy && gone !== "destroyed" && (
        <Button variant="outline" className="aui-secret-destroy" disabled={busy} onClick={() => void destroy()}>
          <Flame />
          {busy ? "正在销毁…" : "我已记好，立即销毁"}
        </Button>
      )}
      {error && (
        <p className="aui-share-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function SecretFieldRow({ field, clearMs, onCopied }: { field: SecretField; clearMs: number; onCopied: () => void }) {
  const [shown, setShown] = useState(true);
  const [copied, setCopied] = useState<"" | "ok" | "failed">("");
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw Error("clipboard unavailable");
      await navigator.clipboard.writeText(field.value);
      setCopied("ok");
      if (field.secret && clearMs > 0) onCopied();
    } catch {
      setCopied("failed");
    }
  };
  return (
    <div className="aui-secret-field">
      <div className="aui-secret-label">
        {field.icon}
        {field.label}
      </div>
      <div className="aui-secret-value" data-secret={field.secret || undefined}>
        <span className="aui-secret-text" aria-label={field.label}>
          {field.secret && !shown ? "•".repeat(Math.min(12, field.value.length)) : field.value}
        </span>
        <span className="aui-secret-actions">
          {field.href ? (
            <Button size="sm" variant="outline" asChild>
              <a href={field.href} target="_blank" rel="noreferrer">
                <ExternalLink />
                打开
              </a>
            </Button>
          ) : (
            <Button size="sm" variant={field.secret ? "default" : "outline"} aria-label={`复制${field.label}`} onClick={() => void copy()}>
              {copied === "ok" ? <Check /> : <Copy />}
              {copied === "ok" ? "已复制" : "复制"}
            </Button>
          )}
          {field.secret && (
            <Button size="sm" variant="outline" aria-pressed={!shown} onClick={() => setShown((v) => !v)}>
              {shown ? <EyeOff /> : <Eye />}
              {shown ? "隐藏" : "显示"}
            </Button>
          )}
        </span>
      </div>
      {copied === "ok" && field.secret && (
        <p className="aui-secret-copied" role="status">
          <Check aria-hidden="true" />
          已复制{clearMs > 0 && <span>剪贴板尽量在 {Math.round(clearMs / 1000)} 秒后清空</span>}
        </p>
      )}
      {copied === "failed" && (
        <p className="aui-share-error" role="alert">
          复制失败，请长按选中后复制
        </p>
      )}
    </div>
  );
}
