"use client";
/**
 * ShareDialog (bt/share S1, demo D20): share one object (record, view, form, file, document,
 * secret) as a link. 600 wide, one column, no cards: header (object, link state, ⋯) → company policy bar →
 * link row (URL + password, QR button → popover, the one solid button 「复制链接和密码」) → one sentence
 * that follows the settings → who can open (option cards; 「指定的人」 = GrantList) → flat settings list
 * (permission, visible fields, download, copy, watermark · password, expiry, open count) → footer
 * (access log, void, 「保存中… → 已保存，立即生效」, 完成 outline). Phones: full-height bottom sheet.
 *
 * Saving has no button. Either the host saves (`onChange` + `saveState`), or `onApply` saves each change and
 * the dialog shows progress itself: a failure puts the old value back and the footer says why + 重试.
 * The server re-checks policy, password, expiry and counts on every open.
 */
import { useAdminDefaults } from "./admin-defaults-context.tsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, CircleAlert, CircleCheck, Copy, Download, History, KeyRound, Link2, Link2Off, LoaderCircle, CirclePause, QrCode as QrIcon, Share2, ShieldCheck } from "lucide-react";
import { Button } from "./primitives.tsx";
import { ConfirmDialog, Dialog } from "./forms.tsx";
import { HelpTip } from "./help-tip.tsx";
import { Count, IconBlock } from "./kit.tsx";
import { type MenuItem } from "./menu.tsx";
import { PopoverPanel } from "./popover-panel.tsx";
import { QrCode, downloadQrPng } from "./qr-code.tsx";
import { formatHours, randomPin, shareChangeLabel, shareCopyText, shareSentence, type ShareAudience, type ShareCapability, type SharePolicy, type ShareSettings } from "./share-core.ts";
import { AudienceSection, CapabilityRow, ExpiryRow, FieldsRow, OpensRow, PasswordRow, SectionTitle, SwitchRow, type ShareFieldChoice, type SharePeople } from "./share-dialog-sections.tsx";
import { IconButton, MoreMenu } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/share.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/share.css";

/** Save progress in the footer; `onRetry` adds 「重试」 to an error. */
export type ShareSaveState = { kind: "saved" | "saving" | "error"; text?: string; onRetry?: () => void };

export type ShareDialogProps = {
  open: boolean;
  onClose: () => void;
  /** The shared object (「李承恩（信义豪宅）」); the heading reads 「分享「…」」. */
  title: string;
  /** Type before the meta line (「客户记录」). */
  objectLabel?: string;
  /** Icon of the object type (lucide element). */
  objectIcon?: ReactNode;
  /** Grey line under the title (「小王 10-05 创建 · 改了立刻生效」). */
  meta?: ReactNode;
  /** The link: full URL; `token` (the random part at the end) is emphasised. */
  link: { url: string; token?: string };
  settings: ShareSettings;
  /**
   * Every change. Without `onApply` the host saves it at once and reports `saveState`; with `onApply` it is
   * called after the save succeeded (update `settings` here).
   */
  onChange?: (next: ShareSettings) => void;
  /** Host-reported save state (used when there is no `onApply`). */
  saveState?: ShareSaveState;
  /**
   * Instant apply: save one change (the whole next settings, and the ones before); reject with an Error whose
   * message is the reason. The dialog shows 「保存中… → 已保存，立即生效」 and, on failure, puts the old value
   * back with 「「30 天」没保存：网络中断 · 重试」 in the footer (no dialog).
   */
  onApply?: (next: ShareSettings, before: ShareSettings) => Promise<void>;
  /** Fields the sharer may offer (already limited to what the sharer can see). Omit for objects without fields. */
  fields?: readonly ShareFieldChoice[];
  policy?: SharePolicy;
  /** Audiences offered (default all three) and capabilities (default view / comment / edit; files: view). */
  audiences?: readonly ShareAudience[];
  capabilities?: readonly ShareCapability[];
  /** Default picker for 「指定的人」: GrantList mode "picked" (search to add + picked people); or render your own in `peoplePicker`. */
  people?: SharePeople;
  peoplePicker?: ReactNode;
  /** Times the link has been opened (open-count meter). */
  opened?: number;
  maxOpens?: number;
  /** Link state; pause / resume via `onPausedChange` (in ⋯ and on the paused bar). */
  paused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  /** ⋯ 「重新生成」: a new link, the old one stops at once (the host confirms if it wants). */
  onRegenerate?: () => void;
  /** Void the link (confirmed first; cannot be undone). */
  onVoid?: () => Promise<void> | void;
  /** Footer 「访问记录」 + count. */
  onOpenLog?: () => void;
  logCount?: number;
  /** ⋯ 「以访客身份预览」; `previewText` (a string) is its grey note. */
  onPreview?: () => void;
  previewText?: ReactNode;
  passwordLength?: number;
  /** Make a new PIN (default: crypto random from an unambiguous alphabet). */
  generatePassword?: () => string;
  /** Grey hint of the password row (「连错 3 次要过滑块验证；密码和链接分开发更安全」). */
  passwordHint?: string;
  /** Expiry presets (default 1 / 7 / 30 days, no hours) + 永久 + 自定义. */
  expiryHours?: readonly number[];
  expiryDays?: readonly number[];
  /** ⋯ 「到期前提醒我」 choices in hours (default 1 / 24 / 72). */
  remindOptions?: readonly number[];
  watermarkHint?: string;
  /** Note of ⋯ 「有人打开时通知我」 (「站内通知 + LINE」). */
  notifyHint?: string;
  /** Copy text to the clipboard (default navigator.clipboard): the link, or link + password + expiry. */
  onCopy?: (text: string, what: "link" | "bundle") => Promise<void> | void;
  /** Download the QR (default: PNG via downloadQrPng). */
  onDownloadQr?: () => void;
  /** Small mark in the QR centre (brand letter). */
  qrMark?: ReactNode;
  timeZone?: string;
  now?: () => number;
};

/** Instant-apply state: the optimistic settings while a save runs and the footer state (see `onApply`). */
function useInstantApply(settings: ShareSettings, onApply: ShareDialogProps["onApply"], onChange: ShareDialogProps["onChange"]) {
  const [draft, setDraft] = useState<ShareSettings | null>(null);
  const [state, setState] = useState<ShareSaveState>({ kind: "saved" });
  const ticket = useRef(0);
  const saving = useRef(false);
  useEffect(() => {
    if (!saving.current) setDraft(null);
  }, [settings]);
  const shown = draft ?? settings;
  const change = (next: ShareSettings, before: ShareSettings = shown) => {
    if (!onApply) return onChange?.(next);
    const mine = ++ticket.current;
    saving.current = true;
    setDraft(next);
    setState({ kind: "saving" });
    onApply(next, before).then(
      () => {
        if (mine !== ticket.current) return;
        saving.current = false;
        setState({ kind: "saved" });
        onChange?.(next);
      },
      (error: unknown) => {
        if (mine !== ticket.current) return;
        saving.current = false;
        setDraft(before);
        const reason = error instanceof Error && error.message ? error.message : "网络中断";
        setState({ kind: "error", text: `${shareChangeLabel(before, next)}没保存：${reason}`, onRetry: () => change(next, before) });
      },
    );
  };
  return { shown, change, state };
}

/** The share dialog (D20). */
export function ShareDialog(props: ShareDialogProps) {
  const {
    open,
    onClose,
    title,
    objectIcon,
    link,
    fields = [],
    policy,
    audiences = ["anyone", "org", "people"],
    capabilities = ["view", "comment", "edit"],
    opened = 0,
    maxOpens = 999,
    paused = false,
    passwordLength = 4,
    generatePassword = () => randomPin(passwordLength),
    expiryHours = [],
    expiryDays = [1, 7, 30],
    remindOptions = [1, 24, 72],
    watermarkHint = "访客 IP 后两段打码 + 打开时间，铺在页面上",
    notifyHint = "站内通知",
    timeZone: timeZoneProp,
    now = Date.now,
  } = props;
  const fallbackZone = useAdminDefaults().timeZone;
  const timeZone = timeZoneProp ?? fallbackZone;
  const [confirmVoid, setConfirmVoid] = useState(false);
  const { shown: settings, change, state } = useInstantApply(props.settings, props.onApply, props.onChange);
  const saveState = props.onApply ? state : props.saveState ?? { kind: "saved" };
  const set = (patch: Partial<ShareSettings>) => change({ ...settings, ...patch });
  const sentence = shareSentence(settings, { now: now(), timeZone, opened, peopleCount: props.people ? props.people.value.length : undefined, fieldCount: fields.length });
  const meta = [props.objectLabel, typeof props.meta === "string" ? props.meta : null].filter(Boolean).join(" · ");
  const remind = settings.remindBeforeHours;
  const more: MenuItem[] = [
    ...(props.onPausedChange ? [{ key: "pause", label: paused ? "恢复链接" : "暂停链接", hint: paused ? "访客又能打开" : "随时可以恢复", onSelect: () => props.onPausedChange?.(!paused) }] : []),
    ...(props.onRegenerate ? [{ key: "regen", label: "重新生成", hint: "旧的立刻失效", onSelect: props.onRegenerate }] : []),
    ...(props.onPreview ? [{ key: "preview", label: "以访客身份预览", hint: typeof props.previewText === "string" ? props.previewText : undefined, onSelect: props.onPreview }] : []),
  ];
  const notify: MenuItem[] = [
    { key: "notify", label: "有人打开时通知我", hint: notifyHint, checked: settings.notifyOnOpen, onSelect: () => set({ notifyOnOpen: !settings.notifyOnOpen }) },
    {
      key: "remind",
      label: remind === null ? "到期前提醒我" : `到期前 ${formatHours(remind)}提醒我`,
      checked: remind !== null,
      disabled: settings.expiresAt === null,
      disabledReason: settings.expiresAt === null ? "永久有效的链接不用提醒" : undefined,
      items: [{ items: [...remindOptions.map((h) => ({ key: `r${h}`, label: `提前 ${formatHours(h)}`, checked: remind === h, onSelect: () => set({ remindBeforeHours: h }) })), { key: "off", label: "不提醒", checked: remind === null, onSelect: () => set({ remindBeforeHours: null }) }] }],
    },
  ];
  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={`分享${title}`}
        size="md"
        className="aui-share-dialog"
        bodyClassName="aui-share-body"
        header={(close) => (
          <header className="aui-dialog-header aui-share-head">
            <IconBlock>{objectIcon ?? <Share2 />}</IconBlock>
            <div className="aui-share-title">
              <h2>分享「{title}」</h2>
              {(meta || props.meta) && <div className="aui-share-meta">{meta || props.meta}</div>}
            </div>
            <span className="aui-share-state" data-state={paused ? "paused" : "on"} role="status">
              {paused ? "已暂停" : "链接有效"}
            </span>
            <MoreMenu label="更多分享操作" sections={[{ key: "link", items: more }, { key: "notify", title: "提醒", items: notify }].filter((s) => s.items.length)} />
            {close}
          </header>
        )}
        footer={
          <div className="aui-share-foot">
            {props.onOpenLog && (
              <Button size="sm" variant="ghost" onClick={props.onOpenLog}>
                <History />
                访问记录
                {props.logCount !== undefined && <Count>{props.logCount}</Count>}
              </Button>
            )}
            {props.onVoid && (
              <Button size="sm" variant="ghost" className="aui-share-void" data-tip="作废后链接立刻失效，不能恢复" onClick={() => setConfirmVoid(true)}>
                <Link2Off />
                作废
              </Button>
            )}
            <SaveState state={saveState} />
            <Button variant="outline" onClick={onClose}>完成</Button>
          </div>
        }
      >
        {paused && (
          <div className="aui-share-bar" data-tone="warning" role="note">
            <CirclePause aria-hidden="true" />
            <span>链接暂停中，访客打开会看到「链接已失效」。设置都留着。</span>
            {props.onPausedChange && <Button size="sm" variant="outline" onClick={() => props.onPausedChange?.(false)}>恢复链接</Button>}
          </div>
        )}
        {policy && <PolicyBar policy={policy} />}
        <LinkRow title={title} link={link} settings={settings} paused={paused} props={props} />
        <p className="aui-share-sentence" aria-live="polite">
          {sentence.map((part, i) => (
            <span key={part.key}>
              {i > 0 && " · "}
              {part.key === "audience" ? <b>{part.text}</b> : part.text}
            </span>
          ))}
        </p>
        <AudienceSection settings={settings} set={set} policy={policy} audiences={audiences} people={props.people} peoplePicker={props.peoplePicker} generate={generatePassword} />
        <section className="aui-share-block" aria-label="访客能做什么">
          <SectionTitle>访客能做什么</SectionTitle>
          <div className="aui-share-rows">
            <CapabilityRow settings={settings} set={set} policy={policy} capabilities={capabilities} hasFields={fields.length > 0} />
            {fields.length > 0 && <FieldsRow settings={settings} set={set} fields={fields} />}
            <SwitchRow label="允许下载附件" hint="关掉后图片只能在线看" checked={settings.allowDownload} onChange={(allowDownload) => set({ allowDownload })} />
            <SwitchRow label="允许复制文字" checked={settings.allowCopy} onChange={(allowCopy) => set({ allowCopy })} />
            <SwitchRow label="水印" hint={watermarkHint} checked={settings.watermark} onChange={(watermark) => set({ watermark })} />
          </div>
        </section>
        <section className="aui-share-block" aria-label="安全">
          <SectionTitle>安全</SectionTitle>
          <div className="aui-share-rows">
            <PasswordRow settings={settings} set={set} policy={policy} length={passwordLength} generate={generatePassword} hint={props.passwordHint} />
            <ExpiryRow settings={settings} set={set} policy={policy} hours={expiryHours} days={expiryDays} now={now} timeZone={timeZone} />
            <OpensRow settings={settings} set={set} opened={opened} maxOpens={maxOpens} />
          </div>
        </section>
      </Dialog>
      {props.onVoid && (
        <ConfirmDialog
          open={confirmVoid}
          title="作废这个分享链接？"
          impact={`「${title}」的链接会立刻失效，已经拿到链接的人再打开只会看到「链接已失效」。作废不能恢复，要再分享得重新生成链接。`}
          destructive
          confirmLabel="作废链接"
          onConfirm={async () => {
            await props.onVoid?.();
          }}
          onClose={() => setConfirmVoid(false)}
        />
      )}
    </>
  );
}

function SaveState({ state }: { state: ShareSaveState }) {
  const icon = state.kind === "saving" ? <LoaderCircle /> : state.kind === "error" ? <CircleAlert /> : <CircleCheck />;
  const text = state.text ?? (state.kind === "saving" ? "保存中…" : state.kind === "error" ? "没保存上，请重试" : "已保存，立即生效");
  return (
    <span className="aui-share-saved" data-kind={state.kind} role={state.kind === "error" ? "alert" : "status"}>
      {icon}
      <span>{text}</span>
      {state.kind === "error" && state.onRetry && (
        <Button size="sm" variant="outline" onClick={state.onRetry}>
          重试
        </Button>
      )}
    </span>
  );
}

function PolicyBar({ policy }: { policy: SharePolicy }) {
  return (
    <div className="aui-share-bar" data-tone="info" role="note">
      <ShieldCheck aria-hidden="true" />
      <span>
        <b>{policy.owner}要求：</b>
        {policy.summary}
      </span>
      <span className="aui-share-policy-who">
        谁定的？
        <HelpTip label="分享策略是谁定的">{policy.contact ?? `管理员在「分享策略」里为${policy.owner}设置；有疑问找管理员。`}</HelpTip>
      </span>
    </div>
  );
}

function useCopy(onCopy: ShareDialogProps["onCopy"]) {
  const [done, setDone] = useState<"" | "copied" | "failed">("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const copy = async (text: string, what: "link" | "bundle") => {
    clearTimeout(timer.current);
    try {
      if (onCopy) await onCopy(text, what);
      else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else throw Error("clipboard unavailable");
      setDone("copied");
    } catch {
      setDone("failed");
    }
    timer.current = setTimeout(() => setDone(""), 2000);
  };
  return { done, copy };
}

function LinkRow({ title, link, settings, paused, props }: { title: string; link: ShareDialogProps["link"]; settings: ShareSettings; paused: boolean; props: ShareDialogProps }) {
  const { done, copy } = useCopy(props.onCopy);
  const fallbackZone = useAdminDefaults().timeZone;
  const qrButton = useRef<HTMLButtonElement>(null);
  const qrBox = useRef<HTMLDivElement>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const token = link.token && link.url.endsWith(link.token) ? link.token : "";
  const prefix = (token ? link.url.slice(0, -token.length) : link.url).replace(/^https?:\/\//, "");
  const bundle = shareCopyText({ title, url: link.url, password: settings.password, expiresAt: settings.expiresAt, openLimit: settings.openLimit, timeZone: props.timeZone ?? fallbackZone });
  const withPassword = Boolean(settings.password);
  return (
    <>
      <div className="aui-share-link" data-paused={paused || undefined}>
        <div className="aui-share-urlbox">
          <Link2 aria-hidden="true" />
          <span className="aui-share-urltext" data-tip={link.url}>
            <span>{prefix}</span>
            {token && <b>{token}</b>}
          </span>
          {settings.password && (
            <span className="aui-share-pw">
              <KeyRound aria-hidden="true" />
              密码 {settings.password}
            </span>
          )}
        </div>
        <IconButton label="二维码" ref={qrButton} variant="outline" aria-expanded={qrOpen} disabled={paused} onClick={() => setQrOpen((v) => !v)} icon={<QrIcon />} />
        <Button className="aui-share-copy" disabled={paused} onClick={() => void copy(withPassword ? bundle : link.url, withPassword ? "bundle" : "link")} data-tip={withPassword ? "链接 + 密码 + 有效期，一段话直接发给对方" : undefined}>
          {done === "copied" ? <Check /> : <Copy />}
          {done === "copied" ? "已复制" : withPassword ? "复制链接和密码" : "复制链接"}
        </Button>
      </div>
      {done === "failed" && (
        <p className="aui-share-error" role="alert">
          复制失败，请手动选中链接复制
        </p>
      )}
      <PopoverPanel open={qrOpen} anchor={qrButton.current} onClose={() => setQrOpen(false)} label="二维码" width={240} align="end">
        <div ref={qrBox} className="aui-share-qr">
          <QrCode value={link.url} size={168} label={`${title} 的分享二维码`} mark={props.qrMark} />
          <small>{withPassword ? "扫码打开 · 密码另外告诉对方" : "扫码打开"}</small>
          <Button size="sm" variant="outline" onClick={() => (props.onDownloadQr ? props.onDownloadQr() : void downloadQrPng(link.url, `分享二维码-${title}`, qrBox.current))}>
            <Download />
            下载 PNG
          </Button>
        </div>
      </PopoverPanel>
    </>
  );
}
