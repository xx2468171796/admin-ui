"use client";
/**
 * Sign-in pages: AuthLayout = one centred 420px column on the canvas — a card with the logo
 * square, 「登录 Acme 工作台」, one line of explanation, then the form; a grey line under the card. Phones: the card
 * fills the width and every control is a touch size (44px).
 * LoginForm = account (person icon) + password (lock icon, eye) + optional 「7 天内自动登录」 / 「忘记密码」 + the
 * button. **The button is always enabled**: a click with empty fields puts a danger line under each missing field
 * (and focuses the first); a rejected sign-in (`onSubmit` throws) shows one alert at the top of the card; while
 * signing in the button spins. Never a pale 「disabled」 button that looks broken.
 */
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { LockKeyhole, UserRound } from "lucide-react";
import { Button, Checkbox, Input } from "./primitives.tsx";
import { FormField } from "./forms.tsx";
import { PasswordInput } from "./password-input.tsx";
import { InlineAlert } from "./layout.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/navigation.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/navigation.css";

export type AuthLayoutProps = {
  /** Logo square content (「安」, an svg); default none. */
  logo?: ReactNode;
  /** 「登录 Acme 工作台」 */
  title: string;
  /** One line under the title (「用公司给你的账号登录」). */
  description?: ReactNode;
  children: ReactNode;
  /** Grey line under the card (「© Acme · 登录遇到问题找公司管理员」). */
  footer?: ReactNode;
  /** Column width: 420 (default) or 480 (pickers with longer lists). */
  width?: 420 | 480;
  /** Inside another page (a gallery, a preview): no full-screen height. */
  embedded?: boolean;
};
/** See the module comment. */
export function AuthLayout({ logo, title, description, children, footer, width = 420, embedded }: AuthLayoutProps) {
  const id = useId();
  return (
    <div className="aui-public aui-auth" data-width={width} data-embedded={embedded || undefined}>
      <div className="aui-auth-column">
        <section className="aui-auth-card" aria-labelledby={id}>
          <header className="aui-auth-head">
            {logo && <span className="aui-auth-logo" aria-hidden="true">{logo}</span>}
            <h1 id={id}>{title}</h1>
            {description && <p>{description}</p>}
          </header>
          {children}
        </section>
        {footer && <footer className="aui-auth-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export type LoginValues = { account: string; password: string; remember: boolean };
export type LoginFormProps = {
  /** Sign in; throw an Error whose message is shown at the top of the card (「账号或密码不对，还能试 3 次」). */
  onSubmit: (values: LoginValues) => Promise<void> | void;
  accountLabel?: string;
  accountPlaceholder?: string;
  passwordLabel?: string;
  passwordPlaceholder?: string;
  /** 「7 天内自动登录」 checkbox; omit to hide it. */
  remember?: { label?: string; defaultChecked?: boolean };
  /** Right of the remember row (「忘记密码」 link / button). */
  forgot?: ReactNode;
  submitLabel?: string;
  /** Pre-filled account (last used). */
  defaultAccount?: string;
  /** Extra block above the button (captcha slot). */
  extra?: ReactNode;
  /** Fixed ids for the two inputs (hosts whose scripts fill `#login-id`); default generated. */
  accountId?: string;
  passwordId?: string;
};
/** See the module comment. */
export function LoginForm({ onSubmit, accountLabel = "账号", accountPlaceholder = "输入账号", passwordLabel = "密码", passwordPlaceholder = "输入密码", remember, forgot, submitLabel = "登录", defaultAccount = "", extra, accountId, passwordId }: LoginFormProps) {
  const base = useId();
  const accountInput = accountId ?? `${base}-account`;
  const passwordInput = passwordId ?? `${base}-password`;
  const [account, setAccount] = useState(defaultAccount);
  const [password, setPassword] = useState("");
  const [keep, setKeep] = useState(remember?.defaultChecked ?? false);
  const [errors, setErrors] = useState<{ account?: string; password?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const accountRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const next = {
      account: account.trim() ? undefined : `请输入${accountLabel}`,
      password: password ? undefined : `请输入${passwordLabel}`,
    };
    setErrors(next);
    if (next.account || next.password) {
      (next.account ? accountRef : passwordRef).current?.focus();
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await onSubmit({ account: account.trim(), password, remember: keep });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
      passwordRef.current?.select();
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="aui-login" noValidate onSubmit={(e) => void submit(e)}>
      {failure && <InlineAlert tone="error" title={failure} />}
      <FormField label={accountLabel} htmlFor={accountInput} error={errors.account}>
        <Input
          ref={accountRef}
          id={accountInput}
          autoComplete="username"
          placeholder={accountPlaceholder}
          prefix={<UserRound aria-hidden="true" />}
          value={account}
          aria-invalid={errors.account ? true : undefined}
          onChange={(e) => {
            setAccount(e.target.value);
            if (errors.account) setErrors((old) => ({ ...old, account: undefined }));
          }}
        />
      </FormField>
      <FormField label={passwordLabel} htmlFor={passwordInput} error={errors.password}>
        <PasswordInput
          ref={passwordRef}
          id={passwordInput}
          placeholder={passwordPlaceholder}
          prefix={<LockKeyhole aria-hidden="true" />}
          value={password}
          aria-invalid={errors.password ? true : undefined}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors((old) => ({ ...old, password: undefined }));
          }}
        />
      </FormField>
      {(remember || forgot) && (
        <div className="aui-login-row">
          {remember ? (
            <label className="aui-check-label" htmlFor={`${base}-remember`}>
              <Checkbox id={`${base}-remember`} checked={keep} onCheckedChange={(v) => setKeep(v === true)} />
              {remember.label ?? "7 天内自动登录"}
            </label>
          ) : (
            <span />
          )}
          {forgot}
        </div>
      )}
      {extra}
      <Button type="submit" className="aui-login-submit" loading={busy} loadingText={`${submitLabel}中…`}>
        {submitLabel}
      </Button>
    </form>
  );
}
