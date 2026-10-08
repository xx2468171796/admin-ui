"use client";
/**
 * PhoneInput: the calling code is an in-field segment (a button opening the country list: name + code), the
 * number shows grouped the local way (CN 138 1234 5678, GB 07700 900123) once the box is left, the value is
 * E.164 (「+8613812345678」, for de-duplication) and the check runs only on blur — typing is never interrupted.
 * The starting country is `defaultCountry`, else `AdminProvider defaults.phoneCountry`, else the browser
 * locale's region when it is in the list (defaultPhoneCountry); `rememberKey` keeps the visitor's last pick.
 */
import { useEffect, useId, useRef, useState, type FocusEvent, type RefObject } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { cn, Input } from "./primitives.tsx";
import { SegmentPicker } from "./number-inputs.tsx";
import { useAdminDefaults } from "./admin-defaults-context.tsx";
import { defaultPhoneCountry, formatLocalPhone, parsePhone, PHONE_COUNTRIES, phoneDigits, toE164, validatePhone, type PhoneCountry } from "./number-input-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/numbers.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/numbers.css";

export type PhoneInputChange = {
  /** Calling code of the box (「+86」). */
  country: string;
  /** Local digits as typed (「13812345678」). */
  local: string;
  /** null = fine (or empty); otherwise the message shown on blur. */
  error: string | null;
};

export type PhoneInputProps = {
  /** E.164 (「+8613812345678」); the older 「+86 13812345678」 is read too. null / "" = empty. */
  value: string | null;
  onChange: (value: string | null, change: PhoneInputChange) => void;
  /** Calling code used when the value is empty (default: `AdminProvider defaults.phoneCountry`, else the browser locale's region, else the first country). */
  defaultCountry?: string;
  countries?: readonly PhoneCountry[];
  /** Must look like a local mobile number (「中国大陆手机是 1 开头 11 位」); default false = any number of a sane length. */
  mobile?: boolean;
  /** localStorage key remembering the last calling code picked here (visitors on public forms). */
  rememberKey?: string;
  /** Show the check on blur under the box (default true). Turn off when a FormField shows `error`. */
  showError?: boolean;
  /** Called on blur with the message (null = fine): wire it to FormField `error`. */
  onValidate?: (error: string | null) => void;
  /** A ✓ at the right end once a valid number was left (default true). */
  okMark?: boolean;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  size?: "sm" | "md";
  autoFocus?: boolean;
  className?: string;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
};

const readRemembered = (key: string | undefined): string | null => {
  if (!key || typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** Calling code segment + local number; see the module comment. */
export function PhoneInput(props: PhoneInputProps) {
  const { value, onChange, countries = PHONE_COUNTRIES, mobile, rememberKey, showError = true, okMark = true, size } = props;
  const defaults = useAdminDefaults();
  const defaultCountry = props.defaultCountry ?? (defaults.phoneCountry || defaultPhoneCountry(countries));
  const parsed = parsePhone(value, countries);
  const [picked, remember] = usePickedCountry(parsed?.country, defaultCountry, rememberKey, countries);
  const country = parsed?.country ?? picked;
  const [draft, setDraft] = useState<string | null>(null);
  const { error, checked, check } = usePhoneCheck(value, draft, (code, text) => validatePhone(code, text, { mobile, list: countries }), props.onValidate);
  const input = useRef<HTMLInputElement | null>(null);
  const errorId = useId();
  const local = draft ?? (parsed ? formatLocalPhone(parsed.country, parsed.local, countries) : typeof value === "string" ? value : "");
  const emit = (code: string, text: string) => {
    const message = validatePhone(code, text, { mobile, list: countries });
    onChange(toE164(code, text, countries), { country: code, local: phoneDigits(text), error: message });
  };
  const pick = (code: string) => {
    remember(code);
    const text = draft ?? parsed?.local ?? "";
    if (phoneDigits(text)) {
      emit(code, text);
      if (checked) check(code, text);
    }
  };
  const current = countries.find((c) => c.code === country);
  const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true" || Boolean(showError && error);
  const shownError = showError && error;
  const box = (
    <Input
      ref={(node) => {
        input.current = node;
      }}
      id={props.id}
      name={props.name}
      autoFocus={props.autoFocus}
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      aria-label={props["aria-label"]}
      aria-labelledby={props["aria-labelledby"]}
      aria-describedby={cn(props["aria-describedby"], shownError && errorId) || undefined}
      aria-invalid={invalid || undefined}
      disabled={props.disabled}
      readOnly={props.readOnly}
      placeholder={props.placeholder ?? current?.example ?? "电话号码"}
      size={size}
      className="aui-num-input"
      boxClassName={cn("aui-phone", props.className)}
      segment={<CountrySegment country={country} countries={countries} onPick={pick} input={input} disabled={props.disabled || props.readOnly} />}
      suffix={okMark && checked && !error && !draft ? <CircleCheck className="aui-phone-ok" aria-label="号码格式正确" /> : undefined}
      value={local}
      // Keep the grouped text while editing (no jump under the caret); it is re-grouped on blur.
      onFocus={() => setDraft((d) => d ?? local)}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        emit(country, text);
      }}
      onBlur={(event) => {
        if (draft !== null) check(country, draft);
        setDraft(null);
        props.onBlur?.(event);
      }}
    />
  );
  if (!showError) return box;
  return (
    <span className="aui-phone-wrap">
      {box}
      {shownError && (
        <span id={errorId} className="aui-field-msg" data-error="" role="alert">
          <CircleAlert aria-hidden="true" />
          {error}
        </span>
      )}
    </span>
  );
}

/** The calling code picked in the box: starts at the remembered / default one, follows a stored number, remembers picks. */
function usePickedCountry(stored: string | undefined, defaultCountry: string, rememberKey: string | undefined, countries: readonly PhoneCountry[]): [string, (code: string) => void] {
  const [picked, setPicked] = useState<string>(() => {
    const remembered = readRemembered(rememberKey);
    return remembered && countries.some((c) => c.code === remembered) ? remembered : defaultCountry;
  });
  // Keep the stored number's code when the box is emptied later.
  useEffect(() => {
    if (stored) setPicked(stored);
  }, [stored]);
  const remember = (code: string) => {
    setPicked(code);
    if (!rememberKey || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(rememberKey, code);
    } catch {
      // private mode: just don't remember
    }
  };
  return [picked, remember];
}

/** The blur-time check: its message, whether a number was checked (for the ✓), reset by a new outside value. */
function usePhoneCheck(value: string | null, draft: string | null, validate: (code: string, text: string) => string | null, onValidate?: (error: string | null) => void) {
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const last = useRef(value);
  useEffect(() => {
    if (last.current !== value && draft === null) {
      setError(null);
      setChecked(false);
    }
    last.current = value;
  }, [value, draft]);
  const check = (code: string, text: string) => {
    const message = validate(code, text);
    setError(message);
    setChecked(phoneDigits(text) !== "");
    onValidate?.(message);
  };
  return { error, checked, check };
}

/** The calling-code segment: the country list hangs under the whole box; focus goes back to the number. */
function CountrySegment({ country, countries, onPick, input, disabled }: { country: string; countries: readonly PhoneCountry[]; onPick: (code: string) => void; input: RefObject<HTMLInputElement | null>; disabled?: boolean }) {
  return (
    <SegmentPicker
      label="国家 / 地区"
      value={country}
      display={country}
      options={countries.map((c) => ({ value: c.code, label: c.name, hint: c.code, keywords: `${c.region} ${c.code.slice(1)}` }))}
      onPick={onPick}
      anchor={() => input.current?.closest<HTMLElement>(".aui-input-box") ?? null}
      disabled={disabled}
      onClosed={() => input.current?.focus({ preventScroll: true })}
    />
  );
}
