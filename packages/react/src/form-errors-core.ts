/**
 * Per-field form errors (FormDialog / FormField): the host throws `FormFieldErrors` from `onSubmit` with
 * messages keyed by the control id (`FormField htmlFor`); each field shows its own message, turns red
 * (`aria-invalid`), and focus + scroll go to the first problem. No React here, only a minimal DOM shape.
 */

/** Messages keyed by control id (the `htmlFor` of the FormField). */
export type FieldErrorMap = Readonly<Record<string, string>>;

/** Throw from `FormDialog onSubmit` (or `PublicForm`-like hosts) to mark fields instead of one line at the bottom. */
export class FormFieldErrors extends Error {
  readonly fields: FieldErrorMap;
  constructor(fields: FieldErrorMap, message?: string) {
    const list = Object.values(fields).filter(Boolean);
    super(message ?? (list.length > 1 ? `有 ${list.length} 项要改` : (list[0] ?? "请检查填写的内容")));
    this.name = "FormFieldErrors";
    this.fields = fields;
  }
}

export const isFormFieldErrors = (value: unknown): value is FormFieldErrors =>
  value instanceof FormFieldErrors || (value instanceof Error && value.name === "FormFieldErrors" && typeof (value as { fields?: unknown }).fields === "object");

/** Drop empty messages (and the key a user just edited). */
export function pruneFieldErrors(errors: FieldErrorMap, remove?: string): FieldErrorMap {
  const out: Record<string, string> = {};
  let changed = false;
  for (const [key, message] of Object.entries(errors)) {
    if (!message || key === remove) changed = true;
    else out[key] = message;
  }
  return changed ? out : errors;
}

/** Keys whose control is not on the page (their messages must still be shown somewhere). */
export function unplacedFieldErrors(errors: FieldErrorMap, has: (id: string) => boolean): string[] {
  return Object.entries(errors).filter(([key, message]) => message && !has(key)).map(([, message]) => message);
}

type ProblemNode = {
  focus?: (options?: { preventScroll?: boolean }) => void;
  scrollIntoView?: (options?: { block?: "center" | "nearest" | "start" | "end"; behavior?: "auto" | "smooth" }) => void;
  matches?: (selector: string) => boolean;
  querySelector?: (selector: string) => ProblemNode | null;
};
type ProblemRoot = { querySelector: (selector: string) => ProblemNode | null };

/** First invalid control in document order; else the first alert (a form-level error). */
export const PROBLEM_SELECTOR = '[aria-invalid="true"]';
export const ALERT_SELECTOR = '[role="alert"]';
const FOCUSABLE = "input:not([type=hidden]):not([disabled]),textarea:not([disabled]),select:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex='-1'])";

/**
 * Bring the first problem into view: the first `aria-invalid` control gets focus (centered, so its
 * message under it is visible on a phone); with none, the first alert is scrolled into view.
 * Returns what it moved to, or null.
 */
export function revealFirstProblem(root: ProblemRoot | null | undefined): "field" | "alert" | null {
  if (!root) return null;
  const invalid = root.querySelector(PROBLEM_SELECTOR);
  if (invalid) {
    // A wrapper marked invalid (group, phone box): focus its first focusable child.
    const target = invalid.matches?.(FOCUSABLE) ? invalid : (invalid.querySelector?.(FOCUSABLE) ?? invalid);
    invalid.scrollIntoView?.({ block: "center" });
    target.focus?.({ preventScroll: true });
    return "field";
  }
  const alert = root.querySelector(ALERT_SELECTOR);
  if (alert) {
    alert.scrollIntoView?.({ block: "nearest" });
    return "alert";
  }
  return null;
}
