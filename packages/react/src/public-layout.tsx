"use client";
/**
 * PublicPageLayout + PublicResult (bt/templates, page template T16 公开页, demos D18 / D18m / D18s):
 * pages people open from a link without an account — fill a form, see a shared record, type a
 * password, read a one-time secret, see 「提交成功」. No AdminShell: a brand band and one centred column
 * (form 688px, narrow 440px) on the canvas, a footer line under it. Phones: the column is the whole
 * width, the brand band sticks to the top with the progress (「已填 4 / 7 题」), and every control is a
 * touch size (≥ 44px, --aui-control-height-touch). Shared records / password gates / secrets use
 * SharedPageShell (variant page / narrow) — same template, same rules. No illustrations.
 * the band is white (logo square + name + small note), 「已填 2 / 5 题」 on the right and a
 * thin progress line along its bottom edge; sign-in pages use AuthLayout + LoginForm (auth-layout.tsx).
 */
import { useId, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/workspace.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/workspace.css";

export type PublicProgress = { done: number; total: number; /** Default 「已填 {done} / {total} 题」. */ label?: string };
export type PublicPageLayoutProps = {
  /** Name in the band (「Acme」); may still carry its own logo. */
  brand: ReactNode;
  /** Logo square before the name (「安」, an svg) — white band + logo + name + small note. */
  logo?: ReactNode;
  /** Small line under the brand (「智能家居」). */
  brandNote?: ReactNode;
  /** Page heading (the form's name). Public pages show it: there is no shell around them. */
  title?: string;
  /** One or two lines under the heading (links allowed). */
  description?: ReactNode;
  /** Right of the heading (「带 * 的是必填」). */
  aside?: ReactNode;
  /** How far the visitor is; shown in the band (sticky on phones). */
  progress?: PublicProgress;
  /** Column width: "form" 688px (default) · "narrow" 440px (result pages, short forms). */
  width?: "form" | "narrow";
  /** Under the card (「由 Acme 多维表格 提供 · 你的信息仅用于联系你」). */
  footer?: ReactNode;
  children: ReactNode;
};
const progressText = (p: PublicProgress) => p.label ?? `已填 ${p.done} / ${p.total} 题`;

/** See the module comment. */
export function PublicPageLayout({ brand, logo, brandNote, title, description, aside, progress, width = "form", footer, children }: PublicPageLayoutProps) {
  const ratio = progress && progress.total > 0 ? Math.min(1, Math.max(0, progress.done / progress.total)) : null;
  return (
    <div className="aui-public" data-variant="form" data-width={width}>
      <div className="aui-pubform">
        <div className="aui-pubform-card">
          <header className="aui-pubform-band">
            {logo && <span className="aui-pubform-logo" aria-hidden="true">{logo}</span>}
            <div className="aui-pubform-brand">
              <span className="aui-pubform-brand-name">{brand}</span>
              {brandNote && <small>{brandNote}</small>}
            </div>
            {progress && (
              <span className="aui-pubform-progress" role="status" aria-label={progressText(progress)}>
                {progress.label ?? <>已填 <b>{progress.done}</b> / {progress.total} 题</>}
              </span>
            )}
            {ratio !== null && <span className="aui-pubform-bar" aria-hidden="true" style={{ width: `${ratio * 100}%` }} />}
          </header>
          <div className="aui-pubform-body">
            {(title || aside) && (
              <div className="aui-pubform-head">
                {title && <h1>{title}</h1>}
                {aside && <span className="aui-pubform-aside">{aside}</span>}
              </div>
            )}
            {description && <div className="aui-pubform-desc">{description}</div>}
            {children}
          </div>
        </div>
        {footer && <footer className="aui-pubform-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export type PublicResultProps = {
  /** success (default) · info · warning · danger (「链接已失效」). */
  tone?: "success" | "info" | "warning" | "danger";
  /** Replaces the tone's icon. */
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Grey line (「官网咨询表单 · 2026-10-05 14:32 提交」). */
  meta?: ReactNode;
  /** Summary (DescriptionList / CompactTable in a card). */
  children?: ReactNode;
  /** Buttons under it (「再填一份」), full width on phones. */
  actions?: ReactNode;
  /** Small line at the end (「可以关闭这个页面了」). */
  note?: ReactNode;
};
const RESULT_ICONS = { success: CircleCheck, info: Info, warning: TriangleAlert, danger: CircleAlert } as const;

/** The result of a public action (提交成功、已失效、已撤回): a big status icon, a heading, what happens next. */
export function PublicResult({ tone = "success", icon, title, description, meta, children, actions, note }: PublicResultProps) {
  const Icon = RESULT_ICONS[tone];
  const id = useId();
  return (
    <section className="aui-pubresult" data-tone={tone} aria-labelledby={id}>
      <span className="aui-pubresult-icon" aria-hidden="true">{icon ?? <Icon />}</span>
      <h1 id={id}>{title}</h1>
      {description && <p className="aui-pubresult-text">{description}</p>}
      {meta && <p className="aui-pubresult-meta">{meta}</p>}
      {children && <div className="aui-pubresult-body">{children}</div>}
      {actions && <div className="aui-pubresult-actions">{actions}</div>}
      {note && <p className="aui-pubresult-note">{note}</p>}
    </section>
  );
}
