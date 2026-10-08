"use client";
import {
  cloneElement,
  createContext,
  Fragment,
  isValidElement,
  useEffect,
  useContext,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, CircleAlert, CircleHelp, Copy, Info, TriangleAlert, Type } from "lucide-react";
import { Button, Checkbox, Choice, countLevel, Input, Textarea } from "./primitives.tsx";
import { HelpTip } from "./help-tip.tsx";
import { ChoiceTags, MultiChoice } from "./select.tsx";
import { RadioGroup } from "./choices.tsx";
import type { ChangeItem } from "./confirm-core.ts";
import { FONT_SIZE_PRESETS, useAdminTheme } from "./theme.tsx";
import { DialogFrame, DiscardPrompt, type DialogSize, type DialogPlacement, type SheetWidth } from "./dialog-frame.tsx";
export { DialogFooter, type DialogSize, type DialogPlacement, type SheetWidth } from "./dialog-frame.tsx";
import { isFormFieldErrors, pruneFieldErrors, revealFirstProblem, unplacedFieldErrors, type FieldErrorMap } from "./form-errors-core.ts";
import { IconButton } from "./buttons.tsx";
export { FormFieldErrors, isFormFieldErrors, revealFirstProblem, type FieldErrorMap } from "./form-errors-core.ts";
/** Field messages of the surrounding FormDialog, keyed by control id (FormField reads its own). */
const FieldErrorContext = /* @__PURE__ */ createContext<FieldErrorMap>({});
/** FormField labels register here so the error summary can name each field (「客户名称：请填写」). */
const FieldLabelContext = /* @__PURE__ */ createContext<Map<string, string> | null>(null);
/**
 * Label + control + one line under it: the label is 13px secondary, required gets a
 * red *, it may carry a 「?」 (`help`) or 「选填」; under the control the hint OR the error (the error replaces
 * the hint: icon + reason + how to fix, in one sentence) and, on the right, a character count. When the child
 * is a single element its `aria-describedby` and `aria-invalid` are wired automatically unless it sets them
 * itself; a Choice / MultiChoice / ChoiceTags / RadioGroup child is also named by the visible label.
 */
export function FormField({
  label,
  htmlFor,
  required,
  optional,
  help,
  hint,
  error: ownError,
  changed,
  count,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  /** 「选填」 after the label (forms where most fields are required). */
  optional?: boolean;
  /** A 「?」 after the label with this explanation (HelpTip). */
  help?: ReactNode;
  hint?: ReactNode;
  /** The message under the control; inside a FormDialog it defaults to that dialog's `fieldErrors[htmlFor]`. Write reason + how to fix. */
  error?: string;
  /** Changed but not saved yet (settings pages): 「已改」 after the label (not for switches that take effect at once). */
  changed?: boolean;
  /** 「12/20」 on the right of the line under the control. */
  count?: { value: number; max: number };
  children: ReactNode;
}) {
  const fromForm = useContext(FieldErrorContext)[htmlFor];
  const labels = useContext(FieldLabelContext);
  if (labels) labels.set(htmlFor, label);
  const error = ownError || fromForm || undefined;
  const labelId = `${htmlFor}-label`;
  const hintId = hint && !error ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  let control = children;
  if (isValidElement(children) && children.type !== Fragment) {
    const own = children.props as Record<string, unknown>;
    const extra: Record<string, unknown> = {};
    if (own["aria-describedby"] === undefined && describedBy)
      extra["aria-describedby"] = describedBy;
    if (own["aria-invalid"] === undefined && error) extra["aria-invalid"] = true;
    if (children.type === Choice || children.type === MultiChoice || children.type === ChoiceTags || children.type === RadioGroup) {
      // These render a button / group, not an input: name them by the visible label, not their own aria-label.
      if (own["aria-labelledby"] === undefined) extra["aria-labelledby"] = labelId;
      if (own.id === undefined && (children.type === Choice || children.type === MultiChoice)) extra.id = htmlFor;
    }
    if (Object.keys(extra).length) control = cloneElement(children, extra);
  }
  const level = count ? countLevel(count.value, count.max) : undefined;
  return (
    <div className="aui-field" data-changed={changed || undefined} data-field={htmlFor}>
      <label id={labelId} htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="aui-required" aria-hidden="true">
            {" "}
            *
          </span>
        )}
        {optional && !required && <span className="aui-field-optional">（选填）</span>}
        {help && <HelpTip label={`${label}说明`}>{help}</HelpTip>}
        {changed && <span className="aui-field-changed">已改</span>}
      </label>
      {control}
      {(hint || error || count) && (
        <div className="aui-field-under">
          {error ? (
            <p id={errorId} className="aui-field-msg aui-error" data-error="" role="alert">
              <CircleAlert aria-hidden="true" />
              <span>{error}</span>
            </p>
          ) : hint ? (
            <p id={hintId} className="aui-field-msg aui-note">
              {hint}
            </p>
          ) : (
            <span />
          )}
          {count && (
            <span className="aui-input-count" data-level={level}>
              {count.value}/{count.max}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
export function FormSection({
  title,
  description,
  layout = "stack",
  labels = "top",
  children,
}: {
  /** Leave out inside a titled Panel / SectionCard (the card already names the group). */
  title?: string;
  /** One sentence under the title (settings pages). */
  description?: ReactNode;
  /** stack (default: title above two columns) · side (settings pages: title + description on the left, fields on the right). */
  layout?: "stack" | "side";
  /** top (default) · side = labels 112px on the left (details, narrow settings); phones stack them. */
  labels?: "top" | "side";
  children: ReactNode;
}) {
  return (
    <section className="aui-form-section" aria-label={title} data-layout={layout === "side" ? "side" : undefined}>
      {(title || description) && (
        <header>
          {title && <h3>{title}</h3>}
          {description && <p>{description}</p>}
        </header>
      )}
      <div className="aui-form-grid" data-label={labels === "side" ? "side" : undefined}>{children}</div>
    </section>
  );
}

export type FormErrorItem = { id: string; label?: string; message: string };
/** Move to one field: scroll it to the middle, focus it, flash its border. */
export function jumpToField(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const field = el.closest<HTMLElement>(".aui-field");
  el.scrollIntoView({ block: "center" });
  const target = el.matches("input,textarea,select,button,[tabindex]") ? el : (el.querySelector<HTMLElement>("input,textarea,select,button,[tabindex]") ?? el);
  target.focus({ preventScroll: true });
  if (field) {
    field.removeAttribute("data-flash");
    void field.offsetWidth;
    field.setAttribute("data-flash", "");
    setTimeout(() => field.removeAttribute("data-flash"), 900);
  }
}
/**
 * The error summary at the top of a form after a failed submit: 「有 2 项要改」 and one
 * link per field that jumps to it (each field also turns red and focus goes to the first). No coloured side bar.
 */
export function FormErrorSummary({ errors, title }: { errors: readonly FormErrorItem[]; title?: string }) {
  if (!errors.length) return null;
  return (
    <div className="aui-form-summary" role="alert">
      <TriangleAlert aria-hidden="true" />
      <div>
        <b>{title ?? `有 ${errors.length} 项要改`}</b>
        <ul>
          {errors.map((e) => (
            <li key={e.id}>
              <a
                href={`#${e.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  jumpToField(e.id);
                }}
              >
                {e.label ? `${e.label}：` : ""}
                {e.message}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
export type DialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  size?: DialogSize;
  /** Buttons in the header, left of the close button (record prev / next, open as page …). */
  headerActions?: ReactNode;
  /** A full-width block at the bottom of the header (record highlights, tabs). */
  headerExtra?: ReactNode;
  /** Right after the title on the same line (a status badge). */
  titleAdornment?: ReactNode;
  /**
   * Replace the whole header (e.g. RecordHeader in the record detail dialog); gets the close button
   * to place. `title` still names the dialog for assistive tech.
   */
  header?: (close: ReactNode) => ReactNode;
  /** Class on the body (e.g. no padding when the content brings its own layout). */
  bodyClassName?: string;
  /** Where focus goes on open: the first control (default) or the dialog itself (long read-only content). */
  initialFocus?: "first" | "dialog";
  /**
   * center (default) · side = right-anchored full-height sheet (SideSheet: tool panels, trial runs,
   * assignment steps — never record detail, which stays centered) · bottom = bottom sheet (BottomSheet,
   * phones). Same focus trap, Esc, overlay and portal in every placement.
   */
  placement?: DialogPlacement;
  /** placement side: md 480 · lg 640 · xl 800 px (full width on phones). */
  sheetWidth?: SheetWidth;
  /** false = no overlay and the page behind stays usable (SideSheet `modal={false}`: comments, attachments). */
  modal?: boolean;
  /** Extra class on the dialog box. */
  className?: string;
};
/** Non-form overlay: results, reports, pickers, read-only detail. No implied save action. */
export function Dialog({
  open,
  title,
  description,
  children,
  onClose,
  footer,
  size,
  headerActions,
  headerExtra,
  titleAdornment,
  header,
  bodyClassName,
  initialFocus,
  placement,
  sheetWidth,
  modal,
  className,
}: DialogProps) {
  return (
    <DialogFrame
      open={open}
      title={title}
      description={description}
      size={size}
      modal={modal}
      className={className}
      onRequestClose={onClose}
      headerActions={headerActions}
      headerExtra={headerExtra}
      titleAdornment={titleAdornment}
      header={header}
      initialFocus={initialFocus}
      placement={placement}
      sheetWidth={sheetWidth}
    >
      <div className={bodyClassName ? `aui-dialog-body ${bodyClassName}` : "aui-dialog-body"}>{children}</div>
      {footer && <footer className="aui-dialog-footer">{footer}</footer>}
    </DialogFrame>
  );
}
export type FormDialogProps = {
  open: boolean;
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  dirty?: boolean;
  busy?: boolean;
  submitLabel?: string;
  error?: string;
  /**
   * Messages under the fields, keyed by control id (`FormField htmlFor`). Usually thrown instead:
   * `throw new FormFieldErrors({ [nameId]: "请填客户名称" })` from `onSubmit`. Either way the fields turn
   * red and focus + scroll go to the first one; editing a field clears its thrown message.
   */
  fieldErrors?: FieldErrorMap;
  destructive?: boolean;
  size?: DialogSize;
  /** A destructive action of the record being edited (删除客户): far left of the footer as a red ghost button. */
  dangerAction?: ReactNode;
  /** Secondary actions (保存并新建): between 取消 and the submit button, which is always far right. */
  secondaryActions?: ReactNode;
  /** One line at the footer's left (default 「带 * 的为必填项」); `false` = none. */
  hint?: ReactNode;
};
/**
 * Host validates and persists; rejection is displayed and never silently closes the form. Reject with
 * `FormFieldErrors` to mark fields (per-field messages, `aria-invalid`, focus on the first); any other
 * Error is a form-level message, scrolled into view.
 */
export function FormDialog({
  open,
  title,
  description,
  children,
  onClose,
  onSubmit,
  dirty = false,
  busy = false,
  submitLabel = "保存",
  error,
  fieldErrors,
  destructive,
  size,
  dangerAction,
  secondaryActions,
  hint,
}: FormDialogProps) {
  const id = useId();
  const [discard, setDiscard] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  const [thrown, setThrown] = useState<FieldErrorMap>({});
  // Bumped after a failed submit: once the errors are rendered, focus / scroll to the first problem.
  const [reveal, setReveal] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const inFlight = useRef(false);
  const labels = useRef(new Map<string, string>());
  const locked = busy || pending;
  const fields = fieldErrors ? { ...thrown, ...fieldErrors } : thrown;
  const summary: FormErrorItem[] = Object.entries(fields)
    .filter(([, message]) => Boolean(message))
    .map(([key, message]) => ({ id: key, label: labels.current.get(key), message }));
  useEffect(() => {
    if (!open) {
      setDiscard(false);
      setFailure("");
      setThrown({});
    }
  }, [open]);
  useEffect(() => {
    const form = formRef.current;
    if (!reveal || !form) return;
    // A message whose control isn't in the form would be lost: show it as the form-level line.
    const lost = unplacedFieldErrors(thrown, (key) => {
      const control = form.ownerDocument.getElementById(key);
      return control !== null && form.contains(control);
    });
    if (lost.length) setFailure(lost.join("；"));
    revealFirstProblem(form);
  }, [reveal]); // eslint-disable-line react-hooks/exhaustive-deps
  const requestClose = () => {
    if (locked) return;
    if (discard) {
      setDiscard(false);
      return;
    }
    if (dirty) setDiscard(true);
    else onClose();
  };
  const problem = error || failure;
  return (
    <DialogFrame
      open={open}
      title={title}
      description={description}
      size={size}
      closeDisabled={locked}
      onRequestClose={requestClose}
    >
      <form
        id={id}
        className="aui-dialog-body"
        noValidate
        aria-busy={locked}
        ref={formRef}
        onChange={(e) => {
          const key = (e.target as HTMLElement).id;
          if (key && thrown[key]) setThrown((old) => pruneFieldErrors(old, key));
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (locked || inFlight.current) return;
          inFlight.current = true;
          setPending(true);
          setFailure("");
          setThrown({});
          try {
            await onSubmit();
            onClose();
          } catch (err) {
            if (isFormFieldErrors(err)) setThrown(pruneFieldErrors(err.fields));
            else setFailure(err instanceof Error ? err.message : "保存失败，请重试");
            setReveal((n) => n + 1);
          } finally {
            inFlight.current = false;
            setPending(false);
          }
        }}
      >
        {/* a failure is one alert line at the top of the dialog; every input is kept. */}
        {problem && (
          <p role="alert" className="aui-error aui-dialog-alert">
            <CircleAlert aria-hidden="true" />
            {problem}
          </p>
        )}
        {/* after a failed submit the summary sits on top with links to each field. */}
        {summary.length > 1 && <FormErrorSummary errors={summary} />}
        <fieldset disabled={locked} className="aui-form-content">
          <FieldLabelContext.Provider value={labels.current}>
            <FieldErrorContext.Provider value={fields}>{children}</FieldErrorContext.Provider>
          </FieldLabelContext.Provider>
        </fieldset>
      </form>
      <footer className="aui-dialog-footer">
        {(dangerAction || summary.length || hint !== false) && (
          <div className="aui-dialog-footer-start">
            {dangerAction}
            {summary.length ? (
              <button type="button" className="aui-form-errors-jump" onClick={() => summary[0] && jumpToField(summary[0].id)}>
                <CircleAlert aria-hidden="true" />
                {summary.length} 项要改
              </button>
            ) : hint === false ? null : (
              <span className="aui-note">
                {hint ?? (
                  <>
                    <CircleHelp size={14} />带 * 的为必填项
                  </>
                )}
              </span>
            )}
          </div>
        )}
        <Button variant="outline" disabled={locked} onClick={requestClose}>
          取消
        </Button>
        {secondaryActions}
        <Button type="submit" form={id} disabled={busy} loading={pending} loadingText="提交中…" variant={destructive ? "destructive" : "default"}>
          {submitLabel}
        </Button>
      </footer>
      <DiscardPrompt
        open={discard}
        title="放弃未保存的内容？"
        description="关闭后不会保留当前填写的内容。"
        keepLabel="继续填写"
        discardLabel="放弃修改"
        onKeep={() => setDiscard(false)}
        onDiscard={() => {
          setDiscard(false);
          onClose();
        }}
      />
    </DialogFrame>
  );
}

const isEmptyValue = (value: ReactNode) =>
  value === null || value === undefined || value === "" || value === "—";
/** 字段 · 原值 → 新值 · 生效方式. Put it inside ConfirmDialog for draft → diff → reason → save. */
export function ChangeList({
  items,
  caption = "改动清单",
}: {
  items: readonly ChangeItem[];
  /** Screen-reader caption. */
  caption?: string;
}) {
  if (!items.length) return <p className="aui-change-empty aui-note">没有改动</p>;
  const hasEffect = items.some((item) => item.effect);
  const withUnit = (value: ReactNode, unit?: string) =>
    isEmptyValue(value) ? (
      "—"
    ) : (
      <>
        {value}
        {unit && <span className="aui-change-unit">{unit}</span>}
      </>
    );
  return (
    <div className="aui-change-list-wrap">
      <table className="aui-change-list">
        <caption className="aui-sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">字段</th>
            <th scope="col">原值 → 新值</th>
            {hasEffect && <th scope="col">生效方式</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.label}-${index}`}>
              <th scope="row">{item.label}</th>
              <td>
                <span className="aui-change-from">{withUnit(item.from, item.unit)}</span>
                <span className="aui-change-arrow" aria-hidden="true">
                  →
                </span>
                <span className="aui-sr-only">改为</span>
                <strong className="aui-change-to">{withUnit(item.to, item.unit)}</strong>
              </td>
              {hasEffect && <td className="aui-change-effect">{item.effect ?? "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type ConfirmDialogProps = {
  open: boolean;
  /** Ask the question with the object: 「删除客户『赵静怡』？」 */
  title: string;
  /** One sentence: the consequence (shown under the title). */
  description?: ReactNode;
  /**
   * What it affects, in a grey box (「168 位客户」「两个仪表盘」「分享链接失效」): a list (array) or one block
   * (e.g. 「将停用 3 个账号，他们会立刻被登出」). No impact, no children, no reason → no body at all.
   */
  impact?: ReactNode | readonly ReactNode[];
  /** Extra content, typically a ChangeList. */
  children?: ReactNode;
  destructive?: boolean;
  /** Icon block colour: info (blue) · warning (amber) · danger (terracotta, default when `destructive`). */
  tone?: "info" | "warning" | "danger";
  /** The icon in the 36px block (default: a warning sign for warning / danger, an info sign for info). */
  icon?: ReactNode;
  /**
   * Name the action — a verb (「删除」「转交 23 位」「删除业务线」). Without it the button says
   * 「确定」 (8.0.2; was 「确认」): a neutral fallback only, always pass the verb.
   */
  confirmLabel?: string;
  /** Ask for a reason (audit). A required reason blocks confirmation until filled. */
  reason?: { label: string; required?: boolean; placeholder?: string };
  /** The user must type exactly this text (shown as a red code chip, click selects it) before the button enables. */
  typeToConfirm?: string;
  /** Receives the trimmed reason ("" when not asked). Reject to keep the dialog open with the message. */
  onConfirm: (reason: string) => Promise<void> | void;
  onClose: () => void;
  /** Default sm (420). */
  size?: DialogSize;
};
/**
 * Confirmation for consequential actions that cannot simply be undone (reversible
 * single actions use `useUndoToast` instead). Left a 36px icon block, the question as the title, one line of
 * consequence; the body only when there is an impact list / reason / typed name. Focus starts on 「取消」
 * (Enter never deletes by accident; a reason / name box takes focus when present). Busy-locked (no double
 * submit, cannot close while running); a rejected onConfirm keeps the dialog with the reason at the top.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  impact,
  children,
  destructive = false,
  tone,
  icon,
  confirmLabel = "确定",
  reason,
  typeToConfirm,
  onConfirm,
  onClose,
  size = "sm",
}: ConfirmDialogProps) {
  const id = useId();
  const [text, setText] = useState("");
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [discard, setDiscard] = useState(false);
  const inFlight = useRef(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!open) return;
    setText("");
    setTyped("");
    setFailure("");
    setReasonError("");
    setDiscard(false);
  }, [open]);
  const typedOk = typeToConfirm === undefined || typed === typeToConfirm;
  const look = tone ?? (destructive ? "danger" : "info");
  const requestClose = () => {
    if (pending || inFlight.current) return;
    if (discard) {
      setDiscard(false);
      return;
    }
    if (reason && text.trim()) setDiscard(true);
    else onClose();
  };
  const submit = async () => {
    if (pending || inFlight.current || !typedOk) return;
    const value = text.trim();
    if (reason?.required && !value) {
      setReasonError(`请填写${reason.label}`);
      reasonRef.current?.focus();
      return;
    }
    inFlight.current = true;
    setPending(true);
    setFailure("");
    try {
      await onConfirm(value);
      onClose();
    } catch (err) {
      setFailure(err instanceof Error && err.message ? err.message : "操作失败，请重试");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };
  const impactList = Array.isArray(impact) ? (impact as readonly ReactNode[]) : null;
  const hasBody = Boolean(impact || children || reason || typeToConfirm !== undefined || failure);
  const header = (close: ReactNode) => (
    <header className="aui-dialog-header aui-confirm-header">
      <span className="aui-confirm-icon" data-tone={look} aria-hidden="true">
        {icon ?? (look === "info" ? <Info /> : <TriangleAlert />)}
      </span>
      <div className="aui-header-text">
        {/* The dialog is named by the (screen-reader) Title of the frame; this is the visible copy. */}
        <div className="aui-dialog-title" aria-hidden="true">
          {title}
        </div>
        {description && <div className="aui-note">{description}</div>}
      </div>
      {close}
    </header>
  );
  return (
    <DialogFrame open={open} title={title} description={description} size={size} closeDisabled={pending} onRequestClose={requestClose} header={header} className="aui-confirm">
      <form
        id={id}
        className="aui-dialog-body"
        hidden={!hasBody}
        noValidate
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {failure && (
          <p role="alert" className="aui-error aui-dialog-alert">
            <CircleAlert aria-hidden="true" />
            {failure}
          </p>
        )}
        <fieldset disabled={pending} className="aui-form-content">
          {impact &&
            (impactList ? (
              <ul className="aui-confirm-impact" data-destructive={destructive || undefined}>
                {impactList.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            ) : (
              <div className="aui-confirm-impact" data-destructive={destructive || undefined}>
                {impact}
              </div>
            ))}
          {children}
          {reason && (
            <FormField label={reason.label} htmlFor={`${id}-reason`} required={reason.required} error={reasonError || undefined}>
              <Textarea
                ref={reasonRef}
                id={`${id}-reason`}
                rows={3}
                value={text}
                placeholder={reason.placeholder}
                data-autofocus
                onChange={(event) => {
                  setText(event.target.value);
                  if (reasonError) setReasonError("");
                }}
              />
            </FormField>
          )}
          {typeToConfirm !== undefined && (
            <div className="aui-confirm-type" data-match={typedOk || undefined}>
              <label htmlFor={`${id}-type`}>
                请输入 <code>{typeToConfirm}</code> 确认
              </label>
              <Input
                id={`${id}-type`}
                value={typed}
                autoComplete="off"
                spellCheck={false}
                data-autofocus={reason ? undefined : true}
                suffix={typedOk ? <Check className="aui-confirm-type-ok" aria-label="名称正确" /> : undefined}
                onChange={(event) => setTyped(event.target.value)}
              />
            </div>
          )}
        </fieldset>
      </form>
      <footer className="aui-dialog-footer">
        {reason?.required && (
          <div className="aui-dialog-footer-start">
            <span className="aui-note">
              <CircleHelp size={14} />带 * 的为必填项
            </span>
          </div>
        )}
        <Button variant="outline" disabled={pending} data-autofocus={reason || typeToConfirm !== undefined ? undefined : true} onClick={requestClose}>
          取消
        </Button>
        <Button type="submit" form={id} disabled={!typedOk} loading={pending} loadingText="处理中…" variant={destructive || look === "danger" ? "destructive" : "default"}>
          {confirmLabel}
        </Button>
      </footer>
      <DiscardPrompt
        open={discard}
        title="放弃已填写的原因？"
        description="关闭后不会保留已填写的原因，操作也不会执行。"
        keepLabel="继续填写"
        discardLabel="放弃并关闭"
        onKeep={() => setDiscard(false)}
        onDiscard={() => {
          setDiscard(false);
          onClose();
        }}
      />
    </DialogFrame>
  );
}

export type OneTimeSecretDialogProps = {
  open: boolean;
  title: string;
  /** Shown exactly once; the server must not be able to return it again. */
  secret: string;
  description?: ReactNode;
  /** How to use it (header name, example request). */
  usage?: ReactNode;
  onClose: () => void;
};
/**
 * A secret the server will never show again (API token, recovery code). Closing by any route
 * (X, Esc, outside, footer) requires a successful copy or ticking 「我已保存」; otherwise an inline
 * warning appears and the dialog stays.
 */
export function OneTimeSecretDialog({
  open,
  title,
  secret,
  description,
  usage,
  onClose,
}: OneTimeSecretDialogProps) {
  const id = useId();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [saved, setSaved] = useState(false);
  const [warn, setWarn] = useState(false);
  const secretRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setCopyError("");
    setSaved(false);
    setWarn(false);
  }, [open, secret]);
  const selectSecret = () => {
    const node = secretRef.current;
    const selection = window.getSelection();
    if (!node || !selection) return;
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.addRange(range);
  };
  const copy = async () => {
    setCopyError("");
    try {
      if (!navigator.clipboard?.writeText) throw Error("clipboard unavailable");
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setWarn(false);
    } catch {
      setCopied(false);
      setCopyError("复制失败，请手动选中复制");
      selectSecret();
    }
  };
  const requestClose = () => {
    if (copied || saved) onClose();
    else setWarn(true);
  };
  return (
    <DialogFrame
      open={open}
      title={title}
      description={description}
      size="md"
      onRequestClose={requestClose}
    >
      <div className="aui-dialog-body aui-secret-body">
        <div className="aui-secret-row">
          <pre ref={secretRef} className="aui-secret" tabIndex={0} aria-label="密钥内容">
            {secret}
          </pre>
          <Button variant={copied ? "secondary" : "outline"} onClick={() => void copy()}>
            {copied ? <Check /> : <Copy />}
            {copied ? "已复制" : "复制"}
          </Button>
        </div>
        {copyError ? (
          <p className="aui-error" role="alert">
            {copyError}
          </p>
        ) : (
          <p className="aui-note" role="status">
            {copied ? "已复制到剪贴板。" : "只显示这一次，关闭后无法再次查看。"}
          </p>
        )}
        {usage && <div className="aui-secret-usage">{usage}</div>}
        <label className="aui-check-label" htmlFor={`${id}-saved`}>
          <Checkbox
            id={`${id}-saved`}
            checked={saved}
            onCheckedChange={(value) => {
              setSaved(value === true);
              if (value === true) setWarn(false);
            }}
          />
          我已保存
        </label>
        {warn && (
          <p className="aui-secret-warn" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            还没有保存：关闭后无法再次查看。请先复制，或勾选「我已保存」。
          </p>
        )}
      </div>
      <footer className="aui-dialog-footer">
        <Button onClick={requestClose}>我已保存，关闭</Button>
      </footer>
    </DialogFrame>
  );
}

/** One global type scale for navigation, forms, tables and overlays in this provider. */
export function FontSizePicker() {
  const { fontSize, setFontSize } = useAdminTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton label={`全局字号：${FONT_SIZE_PRESETS.find((preset) => preset.id === fontSize)!.name}`} onClick={() => setOpen(true)} icon={<Type aria-hidden="true" />} />
      <Dialog open={open} title="全局字体大小" description="导航、表格、详情和表单会一起调整；默认是中大号。" onClose={() => setOpen(false)} size="sm">
        <div className="aui-font-size-choices" role="group" aria-label="全局字体大小">
          {FONT_SIZE_PRESETS.map((preset) => (
            <Button key={preset.id} variant={fontSize === preset.id ? "secondary" : "outline"} aria-pressed={fontSize === preset.id} onClick={() => { setFontSize(preset.id); setOpen(false); }}>
              <span className="aui-font-size-sample" style={{ fontSize: `${14 * preset.scale}px` }} aria-hidden="true">Aa</span>
              {preset.name}
              {fontSize === preset.id && <Check size={16} aria-hidden="true" />}
            </Button>
          ))}
        </div>
      </Dialog>
    </>
  );
}
