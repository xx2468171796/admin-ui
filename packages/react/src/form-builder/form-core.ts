/**
 * Form rules (bt/builders-a V9 / V10, demos D08 / D18): what a form is (questions over table fields),
 * which questions show for the answers so far (display conditions on the condition-core tree, judged
 * with the grid's own matching), answer checks, progress 「已填 4 / 7」, the success-page summary,
 * collection settings (submission limit, login, share scope) and prefill links.
 *
 * Pure: no React / DOM. Unit-tested in test/form-core.test.ts. Field definitions are BitableGrid
 * fields (`GridField`) so a form over a table uses the same types, options and colours; answers are
 * keyed by field key and have the grid's value shapes (money in minor units, select = option value,
 * multiSelect = values, attachment = MediaItem[], phone = 「+86 13812345678」).
 */
import { conditionOpLabel, countConditions, isConditionGroup, isDynamicValue, isRelativeDate, isDateRange, pruneConditionTree, relativeDateLabel, VALUELESS_OPS, type ConditionContext, type ConditionNode } from "../condition-core.ts";
import { filterGridRows, isEmptyValue, optionLabel, valueText, type GridField, type GridFilterGroup, type GridFilterOp, type GridSelectOption } from "../grid-core.ts";
import { coreType, maskPhone, toAttachments } from "../grid-field-types.ts";
import { formatPhoneDisplay } from "../number-input-core.ts";
import { gridConditionKind } from "../grid-view-v2.ts";
import { detectMediaKind, type MediaKind } from "../media-core.ts";
import type { CellTagTone } from "../cells.tsx";

export type FormAnswers = Record<string, unknown>;
/** A form field = a BitableGrid field over the answers. */
export type FormField = GridField<FormAnswers>;

/** Attachment questions: what can be uploaded and how. */
export type FormUploadOptions = {
  /** Same rules as UploadField: 「.pdf」, 「image/*」. Empty = anything. */
  accept?: readonly string[];
  /** Bytes per file (default 2 GB). */
  maxBytes?: number;
  maxFiles?: number;
  /** Extra source buttons (phones open the camera): 拍照 / 录像. Default both. */
  capture?: readonly ("photo" | "video")[];
  /** 录音 button (true, default), no recording (false), or an audio-only question (`"only"`: recorder / hold to talk). */
  record?: boolean | "only";
  /** Longest recording in seconds (default 600). */
  maxRecordSeconds?: number;
};

export type FormQuestion = {
  /** Field key (one question per field). */
  field: string;
  /** Question title; default the field title. */
  title?: string;
  /** Line under the title; shown when `showDescription` is not false. */
  description?: string;
  showDescription?: boolean;
  required?: boolean;
  placeholder?: string;
  /** Show only when the earlier answers match (null / empty = always shown). */
  condition?: GridFilterGroup | null;
  /** Single choice as radio buttons or a dropdown (auto: radios up to 5 short options). */
  display?: "auto" | "radios" | "select";
  upload?: FormUploadOptions;
};

export type FormDefinition = {
  title: string;
  description?: string;
  questions: FormQuestion[];
  /** Submit button text (default 「提交」). */
  submitText?: string;
  /** Shown on the success page (「顾问会在 1 个工作日内联系您」). */
  successMessage?: string;
};

// ---------------------------------------------------------------- settings

export type FormSubmitLimit = "once" | "daily" | "weekly" | "monthly" | "unlimited";
export const FORM_SUBMIT_LIMITS: readonly { value: FormSubmitLimit; label: string }[] = [
  { value: "once", label: "每人一次" },
  { value: "daily", label: "每天一次" },
  { value: "weekly", label: "每周一次" },
  { value: "monthly", label: "每月一次" },
  { value: "unlimited", label: "不限" },
];
/** D08 shows three; hosts pass FORM_SUBMIT_LIMITS (or any subset) for weekly / monthly too. */
export const FORM_SUBMIT_LIMITS_DEFAULT: readonly FormSubmitLimit[] = ["once", "daily", "unlimited"];
export type FormAudience = "picked" | "company" | "anyone";
export const FORM_AUDIENCES: readonly { value: FormAudience; label: string }[] = [
  { value: "picked", label: "指定人" },
  { value: "company", label: "公司内" },
  { value: "anyone", label: "任何人" },
];
export type FormNotifyTarget = { id: string; name: string; kind?: "user" | "group" };
export type FormSettings = {
  submitLimit: FormSubmitLimit;
  /** Fillers sign in first (needed for per-person limits, editing own submissions, 指定人 / 公司内). */
  loginRequired: boolean;
  allowEditOwn: boolean;
  /** Who gets a message on each submission. */
  notify: readonly FormNotifyTarget[];
  audience: FormAudience;
  /** false = 停止收集: the link no longer opens. */
  collecting: boolean;
};
export const DEFAULT_FORM_SETTINGS: FormSettings = { submitLimit: "unlimited", loginRequired: false, allowEditOwn: false, notify: [], audience: "anyone", collecting: true };

/** Why a setting can't change right now (shown as the disabled reason). */
export function formSettingLocks(settings: FormSettings): { loginRequired?: string } {
  if (settings.audience !== "anyone") return { loginRequired: settings.audience === "picked" ? "指定人填写时必须登录" : "公司内填写时必须登录" };
  return {};
}
/**
 * Apply a settings change with its knock-on rules: a per-person limit or 「允许修改自己的提交」 needs
 * login (turned on with it); 指定人 / 公司内 need login; turning login off drops both back.
 */
export function patchFormSettings(settings: FormSettings, patch: Partial<FormSettings>): FormSettings {
  const next = { ...settings, ...patch };
  if (patch.audience && patch.audience !== "anyone") next.loginRequired = true;
  if ((patch.submitLimit && patch.submitLimit !== "unlimited") || patch.allowEditOwn) next.loginRequired = true;
  if (patch.loginRequired === false) {
    if (next.audience !== "anyone") next.loginRequired = true;
    else {
      next.submitLimit = "unlimited";
      next.allowEditOwn = false;
    }
  }
  return next;
}
export const submitLimitLabel = (limit: FormSubmitLimit) => FORM_SUBMIT_LIMITS.find((l) => l.value === limit)?.label ?? limit;

// ---------------------------------------------------------------- fields and questions

/** Why a field can't be a question (null = it can): system / computed fields fill themselves. */
export function formFieldUnsupported(field: Pick<FormField, "type">): string | null {
  switch (field.type) {
    case "autoNumber":
    case "createdBy":
    case "createdAt":
    case "modifiedBy":
    case "modifiedAt":
      return "系统自动填写，不能做成题目";
    case "formula":
    case "lookup":
      return "由别的字段算出来，不能做成题目";
    case "link":
    case "user":
      return "填表的人选不了表里的记录和同事";
    case "custom":
      return "自定义字段没有填写控件";
    default:
      return null;
  }
}
/** Fields a condition can test (attachments and long text can't). */
export const isConditionField = (field: Pick<FormField, "type">) => field.type !== "attachment" && field.type !== "longText" && !formFieldUnsupported(field);

export const questionTitle = (question: FormQuestion, field: Pick<FormField, "title"> | undefined) => question.title?.trim() || field?.title || question.field;

/** The fields split into 已添加 (question order) and 未添加 (field order; unsupported ones last). */
export function formFieldLists<F extends Pick<FormField, "key" | "type">>(form: Pick<FormDefinition, "questions">, fields: readonly F[]): { added: F[]; notAdded: F[] } {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const added = form.questions.flatMap((q) => (byKey.has(q.field) ? [byKey.get(q.field)!] : []));
  const used = new Set(added.map((f) => f.key));
  const rest = fields.filter((f) => !used.has(f.key));
  return { added, notAdded: [...rest.filter((f) => !formFieldUnsupported(f)), ...rest.filter((f) => formFieldUnsupported(f))] };
}

/** The form with a question for `field` at `index` (default: the end); no duplicates, unsupported fields refused. */
export function addFormQuestion(form: FormDefinition, field: Pick<FormField, "key" | "type" | "required">, index = form.questions.length): FormDefinition {
  if (form.questions.some((q) => q.field === field.key) || formFieldUnsupported(field)) return form;
  const questions = form.questions.slice();
  questions.splice(Math.max(0, Math.min(index, questions.length)), 0, { field: field.key, ...(field.required ? { required: true } : {}) });
  return { ...form, questions };
}
/** 全部添加: every supported field not in the form yet, appended in field order. */
export function addAllFormQuestions(form: FormDefinition, fields: readonly Pick<FormField, "key" | "type" | "required">[]): FormDefinition {
  return fields.reduce((next, field) => addFormQuestion(next, field), form);
}
/** 从表单移除 (the field and its data stay); conditions that pointed at it are cleaned up. */
export function removeFormQuestion(form: FormDefinition, key: string): FormDefinition {
  return pruneFormConditions({ ...form, questions: form.questions.filter((q) => q.field !== key) });
}
export function updateFormQuestion(form: FormDefinition, key: string, patch: Partial<FormQuestion>): FormDefinition {
  return { ...form, questions: form.questions.map((q) => (q.field === key ? { ...q, ...patch } : q)) };
}
/** New question order (keys); unknown keys ignored, missing ones kept at the end. Conditions are re-checked. */
export function reorderFormQuestions(form: FormDefinition, keys: readonly string[]): FormDefinition {
  const byKey = new Map(form.questions.map((q) => [q.field, q]));
  const ordered = keys.flatMap((k) => (byKey.has(k) ? [byKey.get(k)!] : []));
  const rest = form.questions.filter((q) => !keys.includes(q.field));
  return pruneFormConditions({ ...form, questions: [...ordered, ...rest] });
}
/**
 * A display condition may only look at earlier questions: after a move / removal, conditions on
 * questions that are no longer before it are dropped (an emptied condition = always shown).
 */
export function pruneFormConditions(form: FormDefinition): FormDefinition {
  let changed = false;
  const questions = form.questions.map((q, index) => {
    if (!q.condition) return q;
    const earlier = new Set(form.questions.slice(0, index).map((x) => x.field));
    const pruned = pruneConditionTree(q.condition, (c) => earlier.has(c.field));
    if (countConditions(pruned) === countConditions(q.condition)) return q;
    changed = true;
    return { ...q, condition: pruned.items.length ? pruned : null };
  });
  return changed ? { ...form, questions } : form;
}
/** Fields a question's display condition can use: earlier questions that can be tested. */
export function formConditionFields<F extends FormField>(form: Pick<FormDefinition, "questions">, fields: readonly F[], key: string): F[] {
  const index = form.questions.findIndex((q) => q.field === key);
  const earlier = new Set(form.questions.slice(0, Math.max(0, index)).map((q) => q.field));
  return fields.filter((f) => earlier.has(f.key) && isConditionField(f)).map((f) => ({ ...f, title: questionTitle(form.questions.find((q) => q.field === f.key)!, f) }));
}
export const hasCondition = (question: Pick<FormQuestion, "condition">) => Boolean(question.condition && countConditions(question.condition) > 0);

// ---------------------------------------------------------------- visibility, checks, progress

/**
 * Keys of the questions shown for these answers, in order. A question's condition sees only the
 * answers of visible earlier questions (a hidden question's answer doesn't count), so hiding cascades.
 */
export function visibleFormQuestions(form: Pick<FormDefinition, "questions">, fields: readonly FormField[], answers: FormAnswers, context: ConditionContext = {}): string[] {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const effective: FormAnswers = {};
  const shown: string[] = [];
  for (const q of form.questions) {
    const field = byKey.get(q.field);
    if (!field || formFieldUnsupported(field)) continue;
    if (hasCondition(q)) {
      const hit = filterGridRows([effective], fields, { filter: q.condition!, search: "", hidden: [] }, context).length === 1;
      if (!hit) continue;
    }
    shown.push(q.field);
    if (q.field in answers) effective[q.field] = answers[q.field];
  }
  return shown;
}

/** Nothing answered (attachments: no file; checkbox: unticked). */
export function isAnswerEmpty(field: Pick<FormField, "type">, value: unknown): boolean {
  if (field.type === "attachment") return toAttachments(value).length === 0;
  if (field.type === "rating") return typeof value !== "number" || !(value > 0);
  if (field.type === "phone") return splitPhone(value).number === "";
  return isEmptyValue(coreType(field), value);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const choiceTypes = new Set(["singleSelect", "multiSelect", "rating", "checkbox", "date", "datetime"]);
/** The message of one answer (null = fine). Required, formats per type, then the field's own `validate`. */
export function checkFormAnswer(question: FormQuestion, field: FormField, value: unknown, answers: FormAnswers = {}): string | null {
  const title = questionTitle(question, field);
  if (isAnswerEmpty(field, value)) {
    if (!question.required) return null;
    if (field.type === "attachment") return question.upload?.record === "only" ? `请录一段${title}` : `请上传${title}`;
    return choiceTypes.has(field.type) ? `请选择${title}` : `请填写${title}`;
  }
  const max = question.upload?.maxFiles;
  if (field.type === "attachment" && max != null && toAttachments(value).length > max) return `${title}最多 ${max} 个文件`;
  const text = typeof value === "string" ? value.trim() : "";
  switch (coreType(field)) {
    case "email":
      if (!EMAIL.test(text)) return "邮箱格式不对，例如 name@example.com";
      break;
    case "url":
      if (!/^https?:\/\/\S+$/i.test(text)) return "网址要以 http:// 或 https:// 开头";
      break;
    case "number":
      if (typeof value === "string" && !Number.isFinite(Number(text))) return "要填数字";
      break;
    default:
      break;
  }
  if (field.type === "phone") {
    const digits = splitPhone(value).number.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 15) return "手机号位数不对";
  }
  return field.validate?.(value, answers) ?? null;
}
/** Messages of the visible questions (field key → message). */
export function validateFormAnswers(form: Pick<FormDefinition, "questions">, fields: readonly FormField[], answers: FormAnswers, visible: readonly string[]): Record<string, string> {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const out: Record<string, string> = {};
  for (const q of form.questions) {
    const field = byKey.get(q.field);
    if (!field || !visible.includes(q.field)) continue;
    const message = checkFormAnswer(q, field, answers[q.field], answers);
    if (message) out[q.field] = message;
  }
  return out;
}
/**
 * Prefilled questions hidden by the link (hide_) that don't pass validation are shown so the visitor can
 * fix them; once shown they stay shown. Returns the new revealed set (the old one when nothing changed).
 */
export function revealInvalidHidden(hidden: ReadonlySet<string>, errors: Readonly<Record<string, string>>, revealed: ReadonlySet<string>): ReadonlySet<string> {
  const add = [...hidden].filter((k) => errors[k] && !revealed.has(k));
  return add.length ? new Set([...revealed, ...add]) : revealed;
}
/** 「已填 4 / 7 题」: answered visible questions / visible questions. */
export function formProgress(fields: readonly FormField[], answers: FormAnswers, visible: readonly string[]): { answered: number; total: number } {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  return { answered: visible.filter((k) => byKey.has(k) && !isAnswerEmpty(byKey.get(k)!, answers[k])).length, total: visible.length };
}
/** Answers of the visible questions only (what gets submitted). */
export function submittedAnswers(answers: FormAnswers, visible: readonly string[]): FormAnswers {
  return Object.fromEntries(visible.filter((k) => k in answers).map((k) => [k, answers[k]]));
}

// ---------------------------------------------------------------- phone

export type FormCountryCode = { value: string; label: string };
/** Common calling codes, in ISO 3166 region-code order (CN GB HK JP KR MO MY SG TW US); hosts pass their own list. */
export const FORM_COUNTRY_CODES: readonly FormCountryCode[] = [
  { value: "+86", label: "+86 中国大陆" },
  { value: "+44", label: "+44 英国" },
  { value: "+852", label: "+852 中国香港" },
  { value: "+81", label: "+81 日本" },
  { value: "+82", label: "+82 韩国" },
  { value: "+853", label: "+853 中国澳门" },
  { value: "+60", label: "+60 马来西亚" },
  { value: "+65", label: "+65 新加坡" },
  { value: "+886", label: "+886 中国台湾" },
  { value: "+1", label: "+1 美国 / 加拿大" },
];
/** 「+44 07700900123」 → { country: "+44", number: "07700900123" }; no code → country "". */
export function splitPhone(value: unknown): { country: string; number: string } {
  const text = typeof value === "string" ? value.trim() : "";
  const m = /^(\+\d{1,4})\s*(.*)$/.exec(text);
  return m ? { country: m[1]!, number: m[2]!.trim() } : { country: "", number: text };
}
export const joinPhone = (country: string, number: string) => (number.trim() ? `${country ? `${country} ` : ""}${number.trim()}` : "");

// ---------------------------------------------------------------- summary (success page)

export type FormSummaryRow = {
  key: string;
  label: string;
  /** Plain text (phones masked). */
  text?: string;
  /** Multiple-choice answers as option chips (single choices read as text, D18s). */
  chips?: { label: string; tone?: CellTagTone; option?: GridSelectOption }[];
  /** Attachments counted by kind (图片 1 · 视频 1 …) and in total. */
  files?: { kind: MediaKind; count: number }[];
  fileCount?: number;
};
/**
 * A phone answer as the summary shows it: the form's own country (`home`, the PublicForm `defaultCountry`)
 * the local way 「138 **** 8000」, other countries international without the trunk 0 「+44 7700 ***123」.
 */
export function summaryPhoneText(value: unknown, options: { home?: string; mask?: boolean } = {}): string {
  const { country, number } = splitPhone(value);
  const shown = formatPhoneDisplay(country ? `${country}${number.replace(/[^\d]/g, "")}` : number, { home: options.home });
  if (options.mask === false) return shown;
  const prefix = /^\+\d{1,4} /.exec(shown)?.[0] ?? "";
  return `${prefix}${maskPhone(shown.slice(prefix.length))}`;
}
/** Rows of 「您提交的内容」: answered visible questions, phones masked, chips, files by kind. */
export function formSummary(form: Pick<FormDefinition, "questions">, fields: readonly FormField[], answers: FormAnswers, visible: readonly string[], options: { maskPhones?: boolean; /** The form's default calling code (PublicForm `defaultCountry`): its numbers read the local way. */ home?: string } = {}): { rows: FormSummaryRow[]; answered: number; total: number } {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const rows: FormSummaryRow[] = [];
  for (const q of form.questions) {
    const field = byKey.get(q.field);
    if (!field || !visible.includes(q.field)) continue;
    const value = answers[q.field];
    if (isAnswerEmpty(field, value)) continue;
    const label = questionTitle(q, field);
    if (field.type === "multiSelect") {
      const values = Array.isArray(value) ? value.map(String) : [String(value)];
      rows.push({ key: q.field, label, chips: values.map((v) => ({ label: optionLabel(field, v), option: field.options?.find((o) => o.value === v) })) });
    } else if (field.type === "attachment") {
      const files = toAttachments(value);
      const counts = new Map<MediaKind, number>();
      for (const f of files) counts.set(f.kind ?? detectMediaKind(f.name, f.mime), (counts.get(f.kind ?? detectMediaKind(f.name, f.mime)) ?? 0) + 1);
      const order: MediaKind[] = ["image", "video", "audio", "pdf", "file"];
      rows.push({ key: q.field, label, files: order.filter((k) => counts.has(k)).map((kind) => ({ kind, count: counts.get(kind)! })), fileCount: files.length });
    } else if (field.type === "phone") {
      rows.push({ key: q.field, label, text: summaryPhoneText(value, { home: options.home, mask: options.maskPhones !== false }) });
    } else if (field.type === "rating") {
      rows.push({ key: q.field, label, text: `${value} / ${field.max ?? 5} 星` });
    } else rows.push({ key: q.field, label, text: valueText(field, value) });
  }
  return { rows, answered: rows.length, total: visible.length };
}

// ---------------------------------------------------------------- conditions in words

const quote = (text: string) => `「${text}」`;
function conditionValueText(field: FormField | undefined, value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (isDynamicValue(value)) return value.dynamic === "me" ? "我" : value.dynamic;
  if (isRelativeDate(value)) return relativeDateLabel(value);
  if (isDateRange(value)) return `${value.from} 至 ${value.to}`;
  const list = Array.isArray(value) ? value.map(String) : [String(value)];
  return list.map((v) => quote(field?.options ? optionLabel(field, v) : v)).join("、");
}
/**
 * 「当「想了解的产品」包含任一「智能门锁」时显示」 — the chip under a question with a condition. Groups
 * read in brackets; 「且 / 或」 follow each group's conjunction.
 */
export function describeFormCondition(tree: GridFilterGroup | null | undefined, fields: readonly FormField[]): string {
  if (!tree || !countConditions(tree)) return "一直显示";
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const node = (n: ConditionNode<GridFilterOp>, top: boolean): string => {
    if (isConditionGroup(n)) {
      const text = n.items.map((x) => node(x, false)).filter(Boolean).join(n.conjunction === "or" ? " 或 " : " 且 ");
      return top || n.items.length < 2 ? text : `（${text}）`;
    }
    const field = byKey.get(n.field);
    const op = conditionOpLabel(n.op, field ? gridConditionKind(field) : undefined);
    const value = VALUELESS_OPS.has(n.op) ? "" : conditionValueText(field, n.value);
    return `${quote(field?.title ?? n.field)}${op}${value}`;
  };
  return `当${node(tree, true)}时显示`;
}

// ---------------------------------------------------------------- prefill links

export type FormPrefill = { field: Pick<FormField, "key" | "title" | "type" | "options">; value: string | readonly string[]; hide?: boolean };
/**
 * 「?prefill_来源=展会&hide_来源=1」: open the form with answers filled and (optionally) those questions
 * hidden — one link per channel tells the sources apart. Names use the field title; select values
 * use the option label (readable in the link).
 */
export function buildPrefillLink(base: string, items: readonly FormPrefill[]): string {
  const params: string[] = [];
  for (const item of items) {
    const values = Array.isArray(item.value) ? item.value : [item.value as string];
    const text = values.map((v) => (item.field.options ? optionLabel(item.field, v) : v)).filter((v) => v !== "").join(",");
    if (!text) continue;
    params.push(`prefill_${encodeURIComponent(item.field.title)}=${encodeURIComponent(text)}`);
    if (item.hide) params.push(`hide_${encodeURIComponent(item.field.title)}=1`);
  }
  if (!params.length) return base;
  return `${base}${base.includes("?") ? "&" : "?"}${params.join("&")}`;
}
/** Read a prefill query (title or key names; select by label or value). Unknown names / values are ignored. */
export function parsePrefill(search: string, fields: readonly Pick<FormField, "key" | "title" | "type" | "options">[]): { answers: FormAnswers; hidden: string[] } {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const find = (name: string) => fields.find((f) => f.title === name) ?? fields.find((f) => f.key === name);
  const answers: FormAnswers = {};
  const hidden: string[] = [];
  for (const [name, raw] of params) {
    if (name.startsWith("hide_") && raw === "1") {
      const field = find(name.slice(5));
      if (field) hidden.push(field.key);
      continue;
    }
    if (!name.startsWith("prefill_")) continue;
    const field = find(name.slice(8));
    if (!field || formFieldUnsupported(field) || field.type === "attachment") continue;
    const parts = raw.split(",").map((v) => v.trim()).filter(Boolean);
    const toOption = (v: string) => field.options?.find((o) => o.label === v || o.value === v)?.value;
    if (field.type === "multiSelect") {
      const values = parts.map(toOption).filter((v): v is string => Boolean(v));
      if (values.length) answers[field.key] = values;
    } else if (field.type === "singleSelect") {
      const value = parts[0] && toOption(parts[0]);
      if (value) answers[field.key] = value;
    } else if (field.type === "number" || field.type === "rating") {
      const n = Number(raw);
      if (raw.trim() && Number.isFinite(n)) answers[field.key] = n;
    } else if (field.type === "checkbox") answers[field.key] = raw === "1" || raw === "true" || raw === "是";
    else if (field.type !== "money") answers[field.key] = raw;
  }
  return { answers, hidden: hidden.filter((k) => k in answers) };
}

// ---------------------------------------------------------------- builder helpers

/** Type names shown on question cards (「单选」「附件」). */
export const FORM_TYPE_LABELS: Readonly<Record<string, string>> = {
  text: "文本",
  longText: "多行文本",
  number: "数字",
  money: "金额",
  date: "日期",
  datetime: "日期时间",
  singleSelect: "单选",
  multiSelect: "多选",
  user: "人员",
  checkbox: "勾选",
  url: "网址",
  email: "邮箱",
  phone: "电话",
  rating: "评分",
  progress: "进度",
  attachment: "附件",
  autoNumber: "自动编号",
  createdBy: "创建人",
  createdAt: "创建时间",
  modifiedBy: "修改人",
  modifiedAt: "修改时间",
  formula: "公式",
  link: "关联",
  lookup: "查找引用",
  custom: "自定义",
};
export const formTypeLabel = (field: Pick<FormField, "type">, question?: Pick<FormQuestion, "upload">) => (field.type === "attachment" && question?.upload?.record === "only" ? "录音" : FORM_TYPE_LABELS[field.type] ?? field.type);

/**
 * The form after the field list was rearranged: `keys` = the 已添加 list in its new order. Questions
 * not in it are removed (field and data stay), new keys are added, then reordered; conditions re-checked.
 */
export function setFormQuestionOrder(form: FormDefinition, fields: readonly Pick<FormField, "key" | "type" | "required">[], keys: readonly string[]): FormDefinition {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  let next = form;
  for (const q of form.questions) if (!keys.includes(q.field)) next = removeFormQuestion(next, q.field);
  for (const key of keys) {
    const field = byKey.get(key);
    if (field && !next.questions.some((q) => q.field === key)) next = addFormQuestion(next, field);
  }
  return reorderFormQuestions(next, keys);
}
