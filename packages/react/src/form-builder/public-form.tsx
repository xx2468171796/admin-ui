"use client";
/**
 * PublicForm (bt/builders-a V10, demos D18 / D18m): the page a visitor fills in — brand band (host
 * logo / cover image, else a plain soft band), title + 「带 * 的是必填」, numbered questions (short ones
 * two per row on wide screens), display conditions re-evaluated on every answer (the condition model of
 * the grid: a question shows once the earlier answers match; hidden answers don't count and aren't
 * submitted), errors after leaving a question or on submit (focus goes to the first), uploads that
 * must finish before submitting, a captcha slot (your captcha widget, e.g. a slider), and on phones a sticky bar
 * 「已填 4 / 7 题」 with touch-size controls. Presentational: the host submits and stores.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Button, cn } from "../primitives.tsx";
import { InlineAlert } from "../layout.tsx";
import type { ConditionContext } from "../condition-core.ts";
import { FormQuestionInput, radiosFor } from "./form-inputs.tsx";
import { FormUploadQuestion, type FormUploadAdapter } from "./form-upload.tsx";
import {
  checkFormAnswer,
  revealInvalidHidden,
  formProgress,
  questionTitle,
  submittedAnswers,
  visibleFormQuestions,
  type FormAnswers,
  type FormCountryCode,
  type FormDefinition,
  type FormField,
  type FormQuestion,
} from "./form-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/form-builder.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/form-builder.css";

export type PublicFormProps = {
  form: FormDefinition;
  fields: readonly FormField[];
  /** Controlled answers; omit to let the form keep them (start from `initialAnswers`, e.g. a prefill link). */
  answers?: FormAnswers;
  onAnswersChange?: (answers: FormAnswers) => void;
  initialAnswers?: FormAnswers;
  /** Questions filled by a prefill link and hidden from the visitor (parsePrefill().hidden). */
  hiddenQuestions?: readonly string[];
  /** Send the visible answers; reject with an Error whose message is shown (answers are kept). */
  onSubmit?: (answers: FormAnswers) => Promise<void> | void;
  /** Uploads of attachment / audio questions (the host's storage). */
  upload?: FormUploadAdapter;
  /** Captcha slot (your captcha widget, e.g. a slider) above the submit button; `captchaDone` unlocks submitting. */
  captcha?: ReactNode;
  captchaDone?: boolean;
  /** Brand block in the band (logo + name) — the host's. */
  brand?: ReactNode;
  /** Cover image URL of the band (default: a plain soft band, no illustration). */
  cover?: string;
  /** Line under the card (「由 Acme 多维表格 提供 · 你的信息仅用于联系你」). */
  footer?: ReactNode;
  /** Resolves 「我」 and relative dates in display conditions. */
  conditionContext?: ConditionContext;
  countryCodes?: readonly FormCountryCode[];
  /** Calling code phone questions start with (default: `AdminProvider defaults.phoneCountry`, else the browser locale's region). */
  defaultCountry?: string;
  /** Builder preview: everything works except sending. */
  preview?: boolean;
  /** Touch screen (audio-only questions show 按住说话); default: detected from `(pointer: coarse)`. */
  touch?: boolean;
  className?: string;
};

const SHORT = new Set(["text", "phone", "email", "url", "number", "money", "date", "datetime", "progress"]);
const isShort = (question: FormQuestion, field: FormField) => SHORT.has(field.type) || (field.type === "singleSelect" && !radiosFor(question, field));

function useCoarsePointer(force?: boolean) {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (force !== undefined || typeof matchMedia !== "function") return;
    const mq = matchMedia("(pointer: coarse)");
    setCoarse(mq.matches);
    const on = () => setCoarse(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [force]);
  return force ?? coarse;
}

export function PublicForm(props: PublicFormProps) {
  const { form, fields, onSubmit, upload, captcha, captchaDone, brand, cover, footer, conditionContext, countryCodes, defaultCountry, preview, className } = props;
  const base = useId();
  const touch = useCoarsePointer(props.touch);
  const [own, setOwn] = useState<FormAnswers>(() => props.initialAnswers ?? {});
  const answers = props.answers ?? own;
  // Uploads finish later: always merge into the newest answers, not those of the render that started them.
  const current = useRef(answers);
  current.current = answers;
  const setAnswer = (key: string, value: unknown) => {
    const next = { ...current.current };
    if (value === undefined) delete next[key];
    else next[key] = value;
    current.current = next;
    if (!props.answers) setOwn(next);
    props.onAnswersChange?.(next);
  };
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  // Pressing 提交 blurs the last answer: marking it then would add its error line, shift the button down
  // and swallow the click (only that question flagged, the empty required ones never). Submit judges all.
  const pressingSubmit = useRef(false);
  const holdSubmit = () => {
    pressingSubmit.current = true;
    window.addEventListener("pointerup", () => setTimeout(() => { pressingSubmit.current = false; }), { once: true, capture: true });
  };
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const byKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  const hidden = useMemo(() => new Set(props.hiddenQuestions ?? []), [props.hiddenQuestions]);
  const visible = useMemo(() => visibleFormQuestions(form, fields, answers, conditionContext), [form, fields, answers, conditionContext]);
  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    for (const q of form.questions) {
      const field = byKey.get(q.field);
      if (!field || !visible.includes(q.field)) continue;
      const message = checkFormAnswer(q, field, answers[q.field], answers);
      if (message) out[q.field] = message;
    }
    return out;
  }, [form.questions, byKey, visible, answers]);
  // A hidden prefill that fails validation (bad link, required but empty) would block submit silently: show it.
  const revealed = useRef<ReadonlySet<string>>(new Set());
  revealed.current = revealInvalidHidden(hidden, errors, revealed.current);
  const shown = visible.filter((k) => !hidden.has(k) || revealed.current.has(k));
  const progress = formProgress(fields, answers, shown);
  const required = form.questions.some((q) => q.required && shown.includes(q.field));
  const setBusyFor = useCallback((key: string, on: boolean) => setBusy((old) => {
    if (old.has(key) === on) return old;
    const next = new Set(old);
    if (on) next.add(key);
    else next.delete(key);
    return next;
  }), []);
  const busyHandlers = useRef(new Map<string, (on: boolean) => void>());
  const busyHandler = (key: string) => {
    let fn = busyHandlers.current.get(key);
    if (!fn) busyHandlers.current.set(key, (fn = (on: boolean) => setBusyFor(key, on)));
    return fn;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    setProblem(null);
    const firstBad = visible.find((k) => errors[k]);
    if (firstBad) {
      requestAnimationFrame(() => {
        const box = document.getElementById(`${base}-q-${firstBad}`);
        box?.scrollIntoView({ block: "center", behavior: "smooth" });
        box?.querySelector<HTMLElement>("input:not([type=hidden]):not([type=file]), textarea, button[role=radio], button[role=checkbox], button")?.focus({ preventScroll: true });
      });
      return;
    }
    if (busy.size) return setProblem("还有文件在上传，传完再提交");
    if (captcha && !captchaDone) return setProblem("请先完成上面的验证");
    if (preview || !onSubmit) return setProblem("这是预览，提交不会保存");
    setSending(true);
    try {
      await onSubmit(submittedAnswers(answers, visible));
    } catch (error) {
      setProblem(error instanceof Error && error.message ? error.message : "提交没成功，请稍后再试，已填的内容还在");
    } finally {
      setSending(false);
    }
  };

  let number = 0;
  return (
    <div className={cn("aui-pform", className)} data-preview={preview || undefined}>
      <div className="aui-pform-bar" aria-hidden={progress.total === 0 || undefined}>
        <span className="aui-pform-bar-title">{form.title}</span>
        <small role="status" aria-live="polite">已填 <b>{progress.answered}</b> / {progress.total} 题</small>
      </div>
      <div className="aui-pform-card">
        <div className="aui-pform-band" data-cover={cover ? true : undefined} style={cover ? { backgroundImage: `url("${cover.replace(/"/g, "%22")}")` } : undefined}>
          {brand && <div className="aui-pform-brand">{brand}</div>}
          {/* 白色品牌带右上「已填 2 / 5 题」+ 带底一条细进度线（手机用上面的吸顶条） */}
          {progress.total > 0 && !cover && (
            <>
              <span className="aui-pform-band-progress" aria-hidden="true">已填 <b>{progress.answered}</b> / {progress.total} 题</span>
              <span className="aui-pform-band-line" aria-hidden="true" style={{ width: `${Math.min(100, (progress.answered / progress.total) * 100)}%` }} />
            </>
          )}
        </div>
        <header className="aui-pform-head">
          <h1>
            {form.title}
            {required && <span className="aui-pform-reqn">带 <i>*</i> 的是必填</span>}
          </h1>
          {form.description && <p>{form.description}</p>}
        </header>
        <form noValidate onSubmit={(e) => void submit(e)} aria-label={form.title}>
          <div className="aui-pform-questions">
            {form.questions.map((q) => {
              const field = byKey.get(q.field);
              if (!field || !shown.includes(q.field)) return null;
              number += 1;
              const id = `${base}-q-${q.field}`;
              const title = questionTitle(q, field);
              const error = (attempted || touched.has(q.field)) && !busy.has(q.field) ? errors[q.field] : undefined;
              const desc = q.description && q.showDescription !== false ? `${id}-desc` : undefined;
              const describedBy = [desc, error ? `${id}-err` : undefined].filter(Boolean).join(" ") || undefined;
              return (
                <div key={q.field} id={id} className="aui-pform-q" data-short={isShort(q, field) || undefined} data-invalid={error ? true : undefined} data-conditional={q.condition ? true : undefined}
                  onBlur={(e) => {
                    if (pressingSubmit.current) return;
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setTouched((old) => (old.has(q.field) ? old : new Set(old).add(q.field)));
                  }}>
                  <div className="aui-pform-qt" id={`${id}-label`}>
                    <span className="aui-pform-no">{number}.</span>
                    {title}
                    {q.required && <span className="aui-pform-req" aria-label="必填">*</span>}
                  </div>
                  {desc && <div className="aui-pform-qd" id={desc}>{q.description}</div>}
                  {field.type === "attachment" ? (
                    <FormUploadQuestion question={q} title={title} value={answers[q.field]} onChange={(files) => setAnswer(q.field, files)} upload={upload}
                      onBusyChange={busyHandler(q.field)} labelledBy={`${id}-label`} describedBy={describedBy} touch={touch} />
                  ) : (
                    <FormQuestionInput question={q} field={field} value={answers[q.field]} labelledBy={`${id}-label`} describedBy={describedBy} invalid={Boolean(error)} countryCodes={countryCodes} defaultCountry={defaultCountry}
                      onChange={(value) => setAnswer(q.field, value)} />
                  )}
                  {error && <div className="aui-pform-err" id={`${id}-err`}><TriangleAlert aria-hidden="true" />{error}</div>}
                </div>
              );
            })}
          </div>
          {problem && <InlineAlert tone={preview ? "info" : "warning"} title={problem} />}
          <div className="aui-pform-foot">
            {captcha && <div className="aui-pform-captcha">{captcha}</div>}
            <Button type="submit" className="aui-pform-submit" disabled={sending} onPointerDown={holdSubmit}>{sending ? "正在提交…" : form.submitText ?? "提交"}</Button>
          </div>
        </form>
      </div>
      {footer && <div className="aui-pform-page-foot">{footer}</div>}
    </div>
  );
}


export type FormBrandProps = {
  /** Logo image URL, or a letter / icon in a brand square (default: the first character of the name). */
  logo?: ReactNode;
  logoUrl?: string;
  name: ReactNode;
  subtitle?: ReactNode;
};
/** The host's brand in the band of PublicForm / FormSuccess: logo square + name + small line. */
export function FormBrand({ logo, logoUrl, name, subtitle }: FormBrandProps) {
  return (
    <span className="aui-pform-brand-in">
      {logoUrl ? <img className="aui-pform-logo" src={logoUrl} alt="" /> : <span className="aui-pform-logo" aria-hidden="true">{logo ?? (typeof name === "string" ? Array.from(name)[0] : "")}</span>}
      <span className="aui-pform-brand-text"><b>{name}</b>{subtitle && <small>{subtitle}</small>}</span>
    </span>
  );
}
