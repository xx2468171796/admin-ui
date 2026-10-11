/**
 * The text to show a person for a caught error: an Error's message, a thrown string as is, else `fallback`
 * quality-ok: raw-error-string (this comment names what it replaces)
 * (default 「操作没成功，请重试」). Never 「[object Object]」 or the 「Error: 」 prefix that `String(error)` produces.
 */
export function errorText(error: unknown, fallback = "操作没成功，请重试"): string {
  const text = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return text.trim() || fallback;
}
