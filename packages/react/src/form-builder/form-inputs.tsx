"use client";
/**
 * Question inputs of a form (bt/builders-a V10, demos D18 / D18m), one per field type: text, long
 * text, number, money (typed in yuan, stored in minor units; the kit MoneyInput), percent, email, url, phone with a
 * country code (the kit PhoneInput; answers stay 「+86 13812345678」),
 * single choice as coloured tag buttons or a dropdown, multiple choice as tick chips, date, date + time, yes / no,
 * rating stars. Attachments are FormUploadQuestion (form-upload.tsx). Used by PublicForm and by the
 * FormBuilder canvas (disabled preview). Touch sizes come from the form's CSS (≥ 44px on phones).
 */
import { Check } from "lucide-react";
import { Checkbox, Choice, Input, Textarea } from "../primitives.tsx";
import { ChoiceTags } from "../select.tsx";
import { Rating } from "../atoms.tsx";
import { DatePicker, DateTimePicker } from "../date-picker.tsx";
import { resolveOptionTone } from "../option-tone.ts";
import { toMinor } from "../grid-core.ts";
import { MoneyInput as KitMoneyInput } from "../number-inputs.tsx";
import { PhoneInput as KitPhoneInput } from "../phone-input.tsx";
import { PercentInput } from "../slider.tsx";
import { defaultPhoneCountry, PHONE_COUNTRIES, type PhoneCountry } from "../number-input-core.ts";
import { useAdminDefaults } from "../admin-defaults-context.tsx";
import { FORM_COUNTRY_CODES, joinPhone, splitPhone, type FormCountryCode, type FormField, type FormQuestion } from "./form-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/form-builder.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/form-builder.css";

export type FormInputProps = {
  question: FormQuestion;
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Id of the question title (inputs are labelled by it). */
  labelledBy: string;
  /** Id of the error / description text. */
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  countryCodes?: readonly FormCountryCode[];
  defaultCountry?: string;
};

/**
 * Coloured tag buttons (ChoiceTags) up to 6 short options, else a dropdown (question `display` overrides);
 * a single choice in a form keeps its option colours either way.
 */
export function radiosFor(question: FormQuestion, field: FormField): boolean {
  if (question.display === "radios") return true;
  if (question.display === "select") return false;
  const options = field.options ?? [];
  return options.length > 0 && options.length <= 6 && options.every((o) => o.label.length <= 8);
}

/** The control of one non-attachment question. */
export function FormQuestionInput({ question, field, value, onChange, labelledBy, describedBy, invalid, disabled, countryCodes = FORM_COUNTRY_CODES, defaultCountry }: FormInputProps) {
  const aria = { "aria-labelledby": labelledBy, "aria-describedby": describedBy, "aria-invalid": invalid || undefined };
  const text = typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
  const placeholder = question.placeholder ?? field.placeholder;
  switch (field.type) {
    case "longText":
      return <Textarea {...aria} rows={3} value={text} disabled={disabled} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
    case "number":
    case "progress":
      return <Input {...aria} inputMode="decimal" value={text} disabled={disabled} placeholder={placeholder ?? "输入数字"} onChange={(e) => onChange(toNumberAnswer(e.target.value))} />;
    case "money":
      return <MoneyInput aria={aria} field={field} value={value} disabled={disabled} placeholder={placeholder} onChange={onChange} />;
    case "percent":
      return <PercentInput {...aria} value={typeof value === "number" ? value : null} precision={field.precision ?? 0} disabled={disabled} placeholder={placeholder} onChange={(v) => onChange(v ?? undefined)} />;
    case "email":
      return <Input {...aria} type="email" inputMode="email" autoComplete="email" value={text} disabled={disabled} placeholder={placeholder ?? "name@example.com"} onChange={(e) => onChange(e.target.value)} />;
    case "url":
      return <Input {...aria} type="url" inputMode="url" value={text} disabled={disabled} placeholder={placeholder ?? "https://"} onChange={(e) => onChange(e.target.value)} />;
    case "phone":
      return <PhoneInput aria={aria} value={value} disabled={disabled} placeholder={placeholder} countryCodes={countryCodes} defaultCountry={defaultCountry} onChange={onChange} />;
    case "singleSelect":
      return radiosFor(question, field) ? (
        <ChoiceTags aria-labelledby={labelledBy} aria-describedby={describedBy} aria-invalid={invalid || undefined} label={field.title} value={text} disabled={disabled} options={(field.options ?? []).map((o) => ({ value: o.value, label: o.label, tone: resolveOptionTone(o) }))} onChange={onChange} />
      ) : (
        <Choice aria-labelledby={labelledBy} aria-describedby={describedBy} aria-invalid={invalid || undefined} label={field.title} value={text} disabled={disabled} placeholder={placeholder ?? "请选择"} clearable options={(field.options ?? []).map((o) => ({ value: o.value, label: o.label, tone: resolveOptionTone(o) }))} onChange={onChange} />
      );
    case "multiSelect":
      return <TickChips labelledBy={labelledBy} describedBy={describedBy} field={field} value={Array.isArray(value) ? value.map(String) : []} disabled={disabled} onChange={onChange} />;
    case "date":
      return <DatePicker {...aria} value={text.slice(0, 10)} disabled={disabled} placeholder={placeholder} clearable deadline={field.deadline} onChange={onChange} />;
    case "datetime":
      return <DateTimePicker {...aria} value={text.slice(0, 16)} disabled={disabled} placeholder={placeholder} clearable deadline={field.deadline} onChange={onChange} />;
    case "checkbox":
      return (
        <label className="aui-pform-check">
          <Checkbox aria-labelledby={labelledBy} checked={value === true} disabled={disabled} onCheckedChange={(v) => onChange(v === true)} />
          <span>是</span>
        </label>
      );
    case "rating":
      return (
        <span className="aui-pform-rating">
          <Rating label={field.title} max={field.max ?? 5} value={typeof value === "number" ? value : null} onChange={(v) => onChange(v ?? undefined)} disabled={disabled} size="md" />
          {typeof value === "number" && value > 0 && <span className="aui-pform-hint">{value} / {field.max ?? 5}</span>}
        </span>
      );
    default:
      return <Input {...aria} value={text} disabled={disabled} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
}

const toNumberAnswer = (text: string): unknown => {
  const t = text.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(t) ? n : text;
};

type Aria = { "aria-labelledby": string; "aria-describedby"?: string; "aria-invalid"?: boolean };

/** Money typed in major units (元); the answer is minor units (分) as an integer number (kit MoneyInput, currency fixed by the field). */
function MoneyInput({ aria, field, value, disabled, placeholder, onChange }: { aria: Aria; field: FormField; value: unknown; disabled?: boolean; placeholder?: string; onChange: (v: unknown) => void }) {
  const minor = toMinor(value);
  return (
    <KitMoneyInput {...aria} value={minor === null ? null : Number(minor)} currency={field.currency} precision={field.precision ?? 2} disabled={disabled} placeholder={placeholder}
      onChange={(next) => onChange(next === null ? undefined : next)} />
  );
}

/** Host calling codes (「+44 英国」) → the kit's country list (known ones keep their local rules). */
function phoneCountries(codes: readonly FormCountryCode[]): PhoneCountry[] {
  return codes.map((c) => PHONE_COUNTRIES.find((p) => p.code === c.value) ?? { code: c.value, region: "", name: c.label.replace(c.value, "").trim() || c.value, example: "", lengths: [6, 15] });
}

/** Country code segment + number in one box (kit PhoneInput); the answer stays 「+86 13812345678」 (form-core splitPhone). */
function PhoneInput({ aria, value, disabled, placeholder, countryCodes, defaultCountry: home, onChange }: { aria: Aria; value: unknown; disabled?: boolean; placeholder?: string; countryCodes: readonly FormCountryCode[]; defaultCountry?: string; onChange: (v: unknown) => void }) {
  const defaults = useAdminDefaults();
  const countries = phoneCountries(countryCodes);
  const defaultCountry = home ?? (defaults.phoneCountry || defaultPhoneCountry(countries));
  const parts = splitPhone(value);
  const stored = parts.number ? joinPhone(parts.country || defaultCountry, parts.number) : null;
  return (
    <KitPhoneInput {...aria} value={stored} defaultCountry={defaultCountry} countries={countries} disabled={disabled} placeholder={placeholder} showError={false}
      rememberKey={disabled ? undefined : "aui-form-phone-country"}
      onChange={(_e164, change) => onChange(change.local ? joinPhone(change.country, change.local) : undefined)} />
  );
}

/** Multiple choice as tick chips (D18 「智能门锁 ✓」); chips carry the option colour. */
function TickChips({ labelledBy, describedBy, field, value, disabled, onChange }: { labelledBy: string; describedBy?: string; field: FormField; value: readonly string[]; disabled?: boolean; onChange: (v: unknown) => void }) {
  const options = field.options ?? [];
  return (
    <div className="aui-pform-ticks" role="group" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {options.map((option) => {
        const on = value.includes(option.value);
        return (
          <button key={option.value} type="button" role="checkbox" aria-checked={on} disabled={disabled} className="aui-pform-tick" data-tone={resolveOptionTone(option)}
            onClick={() => onChange(on ? value.filter((v) => v !== option.value) : options.filter((o) => o.value === option.value || value.includes(o.value)).map((o) => o.value))}>
            <i aria-hidden="true">{on && <Check />}</i>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
