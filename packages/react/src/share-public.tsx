"use client";
/**
 * Public share pages (bt/share S2, demo D21; used by D21m / D21s too): SharedPageShell is the page frame
 * outside AdminShell — brand, who shared it, verified mark, expiry / opens left, watermark, safety footer;
 * `narrow` is the centred phone column for the password gate and the secret page. SharedRecordCard is
 * the visitor's record card (only the fields the sharer allowed; editable ones edit in place) and
 * SharedMediaCard the attachments next to it (AttachmentGallery + MediaLightbox).
 * Touch size on phones: controls ≥ 44px. No illustrations (item 1).
 */
import { useAdminDefaults } from "./admin-defaults-context.tsx";
import { useId, useState, type ReactNode } from "react";
import { Ban, Check, Download, Hourglass, Paperclip, Pencil, ShieldCheck } from "lucide-react";
import { Button, Input, Textarea } from "./primitives.tsx";
import { DatePicker } from "./date-picker.tsx";
import { IconBlock } from "./kit.tsx";
import { Watermark } from "./atoms.tsx";
import { AttachmentGallery } from "./media-gallery.tsx";
import type { MediaItem } from "./media-parts.tsx";
import { avatarTone } from "./avatar-core.ts";
import { shareWatermarkText } from "./share-core.ts";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/share.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/share.css";

export type SharedBy = { name: string; /** Avatar letter (default first character). */ avatar?: string; /** 「分享给你的客户记录」 */ text?: ReactNode; /** 「智能家居业务 · 华南子公司」 */ org?: ReactNode };

export type SharedPageShellProps = {
  /** Brand block (logo + name); the host's, not the SDK's. */
  brand: ReactNode;
  /** page = top bar + wide content (visitor page) · narrow = centred phone column (password gate, secret). */
  variant?: "page" | "narrow";
  sharedBy?: SharedBy;
  /** 「已验证」: the password was checked for this visit. A string is the hover text. */
  verified?: boolean | string;
  /** Expiry / opens summary (「7 天后失效 · 还能打开 17 次」) with an optional hover text. */
  status?: { text: ReactNode; title?: string };
  /** Top-right buttons (「下载全部附件」). */
  actions?: ReactNode;
  /**
   * Watermark over the whole page (on by default for `variant="page"`; light, diagonal,
   * tiled, never blocks clicks). Default text = 「访客 {masked visitor.ip} · {visitor.at}」 (shareWatermarkText);
   * a string / lines replace it; `false` turns it off. The narrow variant (password gate) has none unless given.
   */
  watermark?: boolean | string | readonly string[];
  /** Who is looking, for the default watermark: IP (masked here) and open time (epoch ms, default now). */
  visitor?: { ip?: string | null; at?: number };
  /** Zone of the watermark time (default: AdminProvider `defaults.timeZone`, else the browser's). */
  timeZone?: string;
  /** Footer: product name and what is recorded; `onReport` adds 「内容有问题？告诉我们」. */
  product?: string;
  footerNote?: ReactNode;
  onReport?: () => void;
  children: ReactNode;
};

/** The frame of a public share page (outside AdminShell, still inside AdminProvider). */
export function SharedPageShell({ brand, variant = "page", sharedBy, verified, status, actions, watermark = variant === "page", visitor, timeZone, product = "安全分享", footerNote, onReport, children }: SharedPageShellProps) {
  const [openedAt] = useState(() => visitor?.at ?? Date.now());
  const fallbackZone = useAdminDefaults().timeZone;
  const footer = (
    <footer className="aui-public-foot">
      <span>
        <ShieldCheck aria-hidden="true" />
        由 <b>{product}</b> 安全分享
      </span>
      {footerNote && <span>{footerNote}</span>}
      {onReport && (
        <button type="button" className="aui-public-link" onClick={onReport}>
          内容有问题？告诉我们
        </button>
      )}
    </footer>
  );
  const page =
    variant === "narrow" ? (
      <div className="aui-public" data-variant="narrow">
        <div className="aui-public-narrow">
          <div className="aui-public-brand">{brand}</div>
          {children}
          {footer}
        </div>
      </div>
    ) : (
      <div className="aui-public" data-variant="page">
        <header className="aui-public-top">
          <div className="aui-public-brand">{brand}</div>
          {sharedBy && (
            <>
              <span className="aui-public-vr" aria-hidden="true" />
              <div className="aui-public-who">
                <span className="aui-avatar" data-size="24" data-tone={avatarTone(sharedBy.name)} aria-hidden="true">{sharedBy.avatar ?? sharedBy.name.slice(0, 1)}</span>
                <span>
                  <b>{sharedBy.name}</b> {sharedBy.text}
                  {sharedBy.org && <small>{sharedBy.org}</small>}
                </span>
              </div>
            </>
          )}
          <div className="aui-public-top-right">
            {verified && (
              <span className="aui-public-pill" data-tone="ok" data-tip={typeof verified === "string" ? verified : "密码已验证，这次打开有效"}>
                <ShieldCheck aria-hidden="true" />
                已验证
              </span>
            )}
            {status && (
              <span className="aui-public-pill" data-tip={status.title}>
                <Hourglass aria-hidden="true" />
                {status.text}
              </span>
            )}
            {actions}
          </div>
        </header>
        <main className="aui-public-main">{children}</main>
        {footer}
      </div>
    );
  if (watermark === false || watermark === "") return page;
  const text = watermark === true ? shareWatermarkText({ ip: visitor?.ip, at: visitor?.at ?? openedAt, timeZone: timeZone ?? fallbackZone }) : watermark;
  return <Watermark text={text}>{page}</Watermark>;
}

// ---------------------------------------------------------------- SharedRecordCard

export type SharedFieldEdit = {
  kind?: "text" | "textarea" | "date";
  /** Current raw value for the editor. */
  value: string;
  maxLength?: number;
  /** Save; reject with an Error whose message is shown (the editor stays open). */
  onSave: (value: string) => Promise<void> | void;
  /** Under the editor (「你的修改会通知 小王」). */
  note?: ReactNode;
};
export type SharedField = {
  key: string;
  label: string;
  icon?: ReactNode;
  /** Display value (already masked by the server when `masked`). */
  value: ReactNode;
  /** Grey text after the value (「非常有意向」「你 19:07 改过（原 10-09）」). */
  sub?: ReactNode;
  masked?: boolean;
  /** Present = the visitor may edit it. */
  edit?: SharedFieldEdit;
  span?: "full";
};
export type SharedPermission = { key: string; icon?: ReactNode; text: ReactNode; /** Shown struck as 「已关闭」. */ denied?: boolean };
export type SharedRecordCardProps = {
  title: string;
  /** Avatar letter / icon in the head block. */
  avatar?: ReactNode;
  /** Status tag after the title (a CellTags / Tag). */
  status?: ReactNode;
  meta?: ReactNode;
  fields: readonly SharedField[];
  /** 「在这个页面你可以：」 row. */
  permissions?: readonly SharedPermission[];
  /** Contact row at the bottom (「有问题直接找 小王」 + LINE / 电话 buttons). */
  contact?: { name: string; avatar?: string; hint?: ReactNode; actions?: ReactNode };
};

/** The visitor's record: allowed fields as tiles, editable ones with an edit button and an inline editor. */
export function SharedRecordCard({ title, avatar, status, meta, fields, permissions, contact }: SharedRecordCardProps) {
  const editable = fields.filter((f) => f.edit);
  return (
    <section className="aui-public-card aui-shared-record" aria-label={title}>
      <header className="aui-shared-record-head">
        <IconBlock size="lg">{avatar ?? title.slice(0, 1)}</IconBlock>
        <div className="aui-shared-record-title">
          <h1>
            {title}
            {status}
          </h1>
          {meta && <div className="aui-shared-record-meta">{meta}</div>}
        </div>
        {editable.length > 0 && (
          <span className="aui-shared-can" data-tip={`你可以修改：${editable.map((f) => f.label).join("、")}`}>
            <Pencil aria-hidden="true" />
            你可以改 {editable.length} 个字段
          </span>
        )}
      </header>
      <div className="aui-shared-tiles">
        {fields.map((f) => (
          <SharedFieldTile key={f.key} field={f} />
        ))}
      </div>
      {permissions && permissions.length > 0 && (
        <div className="aui-shared-perm">
          在这个页面你可以：
          <ul>
            {permissions.map((p) => (
              <li key={p.key} data-denied={p.denied || undefined}>
                {p.denied ? <Ban aria-hidden="true" /> : p.icon}
                {p.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {contact && (
        <div className="aui-shared-contact">
          <span className="aui-avatar" data-size="40" data-tone={avatarTone(contact.name)} aria-hidden="true">{contact.avatar ?? contact.name.slice(0, 1)}</span>
          <span className="aui-shared-contact-text">
            <b>有问题直接找 {contact.name}</b>
            {contact.hint && <small>{contact.hint}</small>}
          </span>
          {contact.actions && <span className="aui-shared-contact-actions">{contact.actions}</span>}
        </div>
      )}
    </section>
  );
}

function SharedFieldTile({ field }: { field: SharedField }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  const edit = field.edit;
  const start = () => {
    if (!edit) return;
    setDraft(edit.value);
    setError("");
    setEditing(true);
  };
  const save = async () => {
    if (!edit || busy) return;
    setBusy(true);
    setError("");
    try {
      await edit.onSave(draft);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const span = field.span ?? (editing && edit?.kind === "textarea" ? "full" : undefined);
  return (
    <div className="aui-shared-tile" data-span={span} data-edit={edit ? (editing ? "editing" : "can") : undefined}>
      <div className="aui-shared-tile-label" id={`${id}-label`}>
        {field.icon}
        {field.label}
        {edit && <em>{editing ? "编辑中" : "可改"}</em>}
      </div>
      {editing && edit ? (
        <div className="aui-shared-editor">
          {edit.kind === "textarea" ? (
            <Textarea aria-labelledby={`${id}-label`} value={draft} maxLength={edit.maxLength} rows={3} autoFocus onChange={(e) => setDraft(e.currentTarget.value)} />
          ) : edit.kind === "date" ? (
            <DatePicker aria-labelledby={`${id}-label`} size="touch" value={draft} autoFocus onChange={setDraft} />
          ) : (
            <Input aria-labelledby={`${id}-label`} value={draft} maxLength={edit.maxLength} autoFocus onChange={(e) => setDraft(e.currentTarget.value)} onKeyDown={(e) => e.key === "Enter" && void save()} />
          )}
          {error && (
            <p className="aui-share-error" role="alert">
              {error}
            </p>
          )}
          <div className="aui-shared-editor-row">
            {edit.note && <span className="aui-shared-editor-note">{edit.note}</span>}
            {edit.maxLength !== undefined && (
              <span className="aui-shared-editor-count">
                {draft.length} / {edit.maxLength}
              </span>
            )}
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(false)}>
              取消
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void save()}>
              <Check />
              保存
            </Button>
          </div>
        </div>
      ) : (
        <div className="aui-shared-tile-value" data-masked={field.masked || undefined}>
          {field.value}
          {(field.sub || field.masked) && <small>{field.sub ?? "已打码"}</small>}
        </div>
      )}
      {edit && !editing && (
        <IconButton label={`修改${field.label}`} tooltip="修改" variant="outline" className="aui-shared-tile-edit" onClick={start} icon={<Pencil />} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- SharedMediaCard

export type SharedMediaCardProps = {
  title?: string;
  /** 「视频 1 · 图片 2 · PDF 1 · 语音 1」 */
  summary?: ReactNode;
  items: readonly MediaItem[];
  /** Downloads allowed by the share; omit to hide every download button. */
  onDownload?: (items: MediaItem[]) => void;
  /** 「全部下载 · 38 MB」 */
  downloadAllLabel?: string;
};
/** Attachments on a share page: header + AttachmentGallery (opens MediaLightbox). */
export function SharedMediaCard({ title = "附件", summary, items, onDownload, downloadAllLabel = "全部下载" }: SharedMediaCardProps) {
  return (
    <section className="aui-public-card aui-shared-media" aria-label={title}>
      <header className="aui-shared-media-head">
        <IconBlock size="sm">
          <Paperclip />
        </IconBlock>
        <h2>{title}</h2>
        {summary && <small>{summary}</small>}
        {onDownload && items.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => onDownload(items.filter((i) => !i.lock?.denied))}>
            <Download />
            {downloadAllLabel}
          </Button>
        )}
      </header>
      <AttachmentGallery items={items} label={title} toolbar={false} onDownload={onDownload} />
    </section>
  );
}
