"use client";
/**
 * Password fields (review 「组件库 02 · 密码与密钥」):
 * - PasswordInput: the Input box in monospace with an eye button inside (show / hide, aria-pressed + bubble) and a
 *   「大写锁定已打开」 line while Caps Lock is on; same border / focus / error look as every other box.
 * - PasswordStrength: 4-segment bar + level word + requirement checklist ticking as you type (rules configurable).
 * - PasswordConfirmHint: the live 「再输一次」 compare under the second box.
 * - InitialPasswordField: 「自动生成 / 我来设」 for a new account; auto shows the generated password with 换一个 + 复制.
 * Rules are pure in password-core.ts. Styles in styles/upload-password.css.
 */
import { forwardRef, useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, CircleAlert, CircleCheck, CircleDot, Copy, Eye, EyeOff, Pencil, RefreshCw, TriangleAlert, WandSparkles, X } from "lucide-react";
import { Input, cn, type InputProps } from "./primitives.tsx";
import { tipProps } from "./tooltip.tsx";
import { useCopy } from "./copy-button.tsx";
import { SegmentedControl } from "./choices.tsx";
import { DEFAULT_PASSWORD_RULES, PASSWORD_LEVEL_TEXT, generatePassword, passwordStrength, passwordsMatch, type PasswordRule, type PasswordStrengthOptions } from "./password-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/password.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/password.css";

// ---------------------------------------------------------------- PasswordInput

export type PasswordInputProps = Omit<InputProps, "type" | "mono" | "segment" | "clearable" | "showCount"> & {
  /** Shown as text (controlled); omit to let the eye button toggle it. */
  visible?: boolean;
  defaultVisible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  /** Hide the eye button (a field that must never be shown). */
  toggle?: boolean;
  /** Warn 「大写锁定已打开」 under the box while typing with Caps Lock on. Default true. */
  capsLockHint?: boolean;
  /** Class on the wrapper (box + Caps Lock line). */
  wrapperClassName?: string;
};

/** Password box: monospace, eye button inside, Caps Lock warning. Ref, id and aria props go to the `<input>`. */
export const PasswordInput = /* @__PURE__ */ forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { visible, defaultVisible = false, onVisibleChange, toggle = true, capsLockHint = true, wrapperClassName, suffix, onKeyDown, onKeyUp, onBlur, autoComplete = "current-password", ...props },
  ref,
) {
  const [ownVisible, setOwnVisible] = useState(defaultVisible);
  const shown = visible ?? ownVisible;
  const [caps, setCaps] = useState(false);
  const readCaps = (event: KeyboardEvent<HTMLInputElement>) => {
    if (capsLockHint && typeof event.getModifierState === "function") setCaps(event.getModifierState("CapsLock"));
  };
  const flip = () => {
    const next = !shown;
    if (visible === undefined) setOwnVisible(next);
    onVisibleChange?.(next);
  };
  const tip = shown ? "隐藏密码" : "显示密码";
  const eye = toggle ? (
    <button
      type="button"
      className="aui-input-ibtn"
      aria-label="显示密码"
      aria-pressed={shown}
      disabled={props.disabled}
      {...tipProps(tip)}
      // Keep the caret in the box: the eye is a side tool, not a stop.
      onMouseDown={(event) => event.preventDefault()}
      onClick={flip}
    >
      {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
    </button>
  ) : null;
  return (
    <span className={cn("aui-password", wrapperClassName)}>
      <Input
        ref={ref}
        {...props}
        type={shown ? "text" : "password"}
        mono
        autoComplete={autoComplete}
        spellCheck={false}
        autoCapitalize="off"
        boxClassName={cn("aui-password-box", props.boxClassName)}
        suffix={
          eye || suffix !== undefined ? (
            <>
              {suffix}
              {eye}
            </>
          ) : undefined
        }
        onKeyDown={(event) => {
          readCaps(event);
          onKeyDown?.(event);
        }}
        onKeyUp={(event) => {
          readCaps(event);
          onKeyUp?.(event);
        }}
        onBlur={(event) => {
          setCaps(false);
          onBlur?.(event);
        }}
      />
      {caps && (
        <span className="aui-password-caps" role="status">
          <TriangleAlert aria-hidden="true" />
          大写锁定已打开
        </span>
      )}
    </span>
  );
});

// ---------------------------------------------------------------- PasswordStrength

export type PasswordStrengthProps = {
  /** The password being typed. */
  value: string;
  /** Requirements (default ≥ 8 位、大小写字母、数字、符号). */
  rules?: readonly PasswordRule[];
  /** Level words for 1–4 (default 太弱 / 一般 / 够用 / 很强, the approved mockup words). */
  levelLabels?: readonly [string, string, string, string];
  /** Hide the checklist (bar + word only, e.g. under 「我来设」). */
  showRules?: boolean;
  /** Right end of the word row (「打字试试」「改完其他设备要重新登录」). */
  hint?: ReactNode;
  options?: PasswordStrengthOptions;
  className?: string;
};

/** 4-segment bar + 「中」 + the checklist ticking as you type. Pure rules: passwordStrength. */
export function PasswordStrength({ value, rules = DEFAULT_PASSWORD_RULES, levelLabels, showRules = true, hint, options, className }: PasswordStrengthProps) {
  const result = passwordStrength(value, rules, options);
  const words = levelLabels ?? PASSWORD_LEVEL_TEXT.slice(1);
  const word = result.level ? words[result.level - 1] : "";
  const first = rules[0]?.label;
  return (
    <div className={cn("aui-pw-strength", className)} data-level={result.level}>
      <span className="aui-pw-meter" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="aui-pw-meter-row">
        <span aria-live="polite">{word ? <b data-level={result.level}><span className="aui-sr-only">密码强度：</span>{word}</b> : first}</span>
        {hint && <span>{hint}</span>}
      </span>
      {showRules && rules.length > 0 && (
        <ul className="aui-pw-rules" aria-label="密码要求">
          {result.checks.map((check) => (
            <li key={check.key} data-ok={check.ok || undefined}>
              {check.ok ? <CircleCheck aria-hidden="true" /> : <CircleDot aria-hidden="true" />}
              {check.label}
              <span className="aui-sr-only">{check.ok ? "（已满足）" : "（未满足）"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- PasswordConfirmHint

export type PasswordConfirmHintProps = {
  password: string;
  confirm: string;
  /** Mismatch text (default 「和上面不一样」). */
  mismatchText?: string;
  /** Text once both match (default 「两次一致」); `null` shows nothing. */
  matchText?: string | null;
  /** id for the confirm box's aria-describedby. */
  id?: string;
};

/**
 * The line under 「再输一次」: nothing while it is still a prefix, 「和上面不一样」 once it differs, 「两次一致」 when equal.
 * Put `aria-invalid={passwordsMatch(a, b) === "mismatch"}` on the confirm box for the red border.
 */
export function PasswordConfirmHint({ password, confirm, mismatchText = "和上面不一样", matchText = "两次一致", id }: PasswordConfirmHintProps) {
  const state = passwordsMatch(password, confirm);
  if (state === "mismatch")
    return (
      <p id={id} className="aui-field-msg" data-error role="alert">
        <CircleAlert aria-hidden="true" />
        {mismatchText}
      </p>
    );
  if (state === "match" && matchText)
    return (
      <p id={id} className="aui-field-msg aui-pw-match" role="status">
        <Check aria-hidden="true" />
        {matchText}
      </p>
    );
  return null;
}

// ---------------------------------------------------------------- InitialPasswordField

export type InitialPasswordValue = { mode: "auto" | "manual"; password: string };

export type InitialPasswordFieldProps = {
  value: InitialPasswordValue;
  onChange: (value: InitialPasswordValue) => void;
  /** Generated length (default 12, grouped 4-4-4). */
  length?: number;
  /** id of the visible box (for a FormField label). */
  id?: string;
  /** Under the generated password (default: shown once, tell them in person, they change it on first login). */
  autoHelp?: ReactNode;
  rules?: readonly PasswordRule[];
  disabled?: boolean;
};

/** 「自动生成 / 我来设」 — no hidden 「留空 = 自动生成」 rule. Auto: the password is shown, 换一个 + 复制. */
export function InitialPasswordField({ value, onChange, length = 12, id, autoHelp = "建好后只显示这一次，请当面或用即时通讯工具告诉他；他第一次登录要改", rules, disabled }: InitialPasswordFieldProps) {
  const { result, copy } = useCopy();
  const [kept, setKept] = useState<Record<"auto" | "manual", string>>({ auto: "", manual: "" });
  const missing = value.mode === "auto" && !value.password;
  useEffect(() => {
    // Auto with nothing generated yet (first render): draw one so the field never shows an empty auto box.
    if (missing) onChange({ mode: "auto", password: generatePassword(length) });
  }, [missing, length, onChange]);
  const switchTo = (mode: "auto" | "manual") => {
    if (mode === value.mode) return;
    const store = { ...kept, [value.mode]: value.password };
    setKept(store);
    onChange({ mode, password: store[mode] || (mode === "auto" ? generatePassword(length) : "") });
  };
  return (
    <div className="aui-initial-pw">
      <SegmentedControl
        label="初始密码的设置方式"
        value={value.mode}
        disabled={disabled}
        onValueChange={switchTo}
        options={[
          { value: "auto", label: "自动生成", icon: WandSparkles },
          { value: "manual", label: "我来设", icon: Pencil },
        ]}
      />
      {value.mode === "auto" ? (
        <>
          <Input
            id={id}
            mono
            readOnly
            value={value.password}
            aria-label="自动生成的初始密码"
            suffix={
              <>
                <button type="button" className="aui-input-ibtn" aria-label="换一个" {...tipProps("换一个")} disabled={disabled} onClick={() => onChange({ mode: "auto", password: generatePassword(length) })}>
                  <RefreshCw aria-hidden="true" />
                </button>
                <button type="button" className="aui-input-ibtn" aria-label="复制初始密码" {...tipProps("复制")} data-result={result || undefined} onClick={(event) => void copy(value.password, event.currentTarget)}>
                  {result === "ok" ? <Check aria-hidden="true" /> : result === "failed" ? <X aria-hidden="true" /> : <Copy aria-hidden="true" />}
                </button>
              </>
            }
          />
          {autoHelp && <p className="aui-field-msg">{autoHelp}</p>}
        </>
      ) : (
        <>
          <PasswordInput id={id} value={value.password} autoComplete="new-password" placeholder="至少 8 位" disabled={disabled} onChange={(event) => onChange({ mode: "manual", password: event.target.value })} />
          <PasswordStrength value={value.password} rules={rules} showRules={false} />
        </>
      )}
    </div>
  );
}
