"use client";
/**
 * FormBuilder (bt/builders-a V9, demo D08): build a collection form over a table. Top bar: 「?」,
 * 编辑 / 填写预览 / 提交结果, 「已收集 86 份 · 今天 +5」 and 分享表单. Three panes: the field list (已添加 /
 * 未添加, drag to add and reorder, locked fields), the canvas (cover band, title, description, question
 * blocks with their settings tray, submit preview) and the collection settings. 填写预览 renders the
 * real PublicForm; 提交结果 is the host's (usually the table filtered to this form).
 *
 * Controlled and presentational: `form` / `settings` come in, every edit goes out through
 * `onFormChange` / `onSettingsChange`; deleting a field, copying a question, picking people to notify,
 * the share dialog and the results view are host callbacks / slots. Phones stack the panes.
 */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ImagePlus, Plus, Share2 } from "lucide-react";
import { Button, Input, Textarea, cn } from "../primitives.tsx";
import { SegmentedControl } from "../choices.tsx";
import { HelpTip } from "../help-tip.tsx";
import { MenuButton } from "../menu.tsx";
import { SortableList } from "../sortable.tsx";
import { CONDITION_LIMITS, type ConditionContext, type ConditionLimits, type DynamicToken } from "../condition-core.ts";
import type { GridSelectOption } from "../grid-core.ts";
import { FormFieldList } from "./form-field-list.tsx";
import { FormQuestionCard } from "./form-question-card.tsx";
import { FormSettingsPane } from "./form-settings.tsx";
import { PublicForm, type PublicFormProps } from "./public-form.tsx";
import {
  FORM_SUBMIT_LIMITS_DEFAULT,
  addAllFormQuestions,
  addFormQuestion,
  formConditionFields,
  removeFormQuestion,
  reorderFormQuestions,
  setFormQuestionOrder,
  updateFormQuestion,
  type FormDefinition,
  type FormField,
  type FormQuestion,
  type FormSettings,
  type FormSubmitLimit,
} from "./form-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/form-builder.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/form-builder.css";

export type FormBuilderMode = "edit" | "preview" | "results";

export type FormBuilderProps = {
  /** The table's fields (BitableGrid fields over the answers). */
  fields: readonly FormField[];
  form: FormDefinition;
  onFormChange: (next: FormDefinition) => void;
  settings: FormSettings;
  onSettingsChange: (next: FormSettings) => void;
  /** Public link of the form (copy, QR, prefill links). */
  shareUrl: string;
  mode?: FormBuilderMode;
  onModeChange?: (mode: FormBuilderMode) => void;
  /** 提交结果 view (e.g. the table filtered to this form); without it the tab is hidden. */
  results?: ReactNode;
  /** 「已收集 86 份 · 今天 +5」 */
  stats?: { total: number; today?: number };
  /** Top-bar 「?」 text. */
  help?: ReactNode;
  /** More buttons in the top bar, before 分享表单 (「打开填写页」). */
  topExtra?: ReactNode;
  /** 分享表单 (open ShareDialog). */
  onShare?: () => void;
  /** Questions that must stay (locked first, can't be removed), e.g. the primary field. */
  pinned?: readonly string[];
  /** The selected question at first. */
  defaultSelected?: string;
  /** 「加选项」 / edit the field (host FieldDialog). */
  onEditField?: (field: FormField) => void;
  /** 删除题目（连字段）: the host confirms, deletes the field and its data; the question goes with it. */
  onDeleteField?: (field: FormField) => void;
  /** 复制题目: the host copies the field and adds the copy (onFormChange). */
  onCopyQuestion?: (question: FormQuestion, field: FormField) => void;
  /** 「新题型 ▾」: field types the host can create; `onNewField(type)` creates and adds it. */
  newFieldTypes?: readonly { type: string; label: string; icon?: ReactNode }[];
  onNewField?: (type: string) => void;
  /** 「+」 next to 新提交通知: the host picks people / groups and updates settings.notify. */
  onAddNotify?: () => void;
  /** 催填 (only when 指定人 fill in). */
  onRemind?: () => void;
  /** Submission limits offered (default 每人一次 / 每天一次 / 不限; FORM_SUBMIT_LIMITS adds 每周 / 每月). */
  submitLimits?: readonly FormSubmitLimit[];
  /** Cover image of the band and 「换封面」. */
  cover?: string;
  onChangeCover?: () => void;
  /** Brand block shown in the band (host logo). */
  brand?: ReactNode;
  /** Display-condition editor: limits (default one level of groups, 50), people choices, dynamic values. */
  conditionLimits?: Partial<ConditionLimits>;
  valueOptions?: Readonly<Record<string, readonly GridSelectOption[]>>;
  dynamicTokens?: readonly DynamicToken[];
  conditionContext?: ConditionContext;
  /** Extra PublicForm props for 填写预览 (upload adapter, captcha, footer …). */
  previewProps?: Partial<PublicFormProps>;
  /**
   * Calling code phone questions start with, in the canvas and in 填写预览 (default: `AdminProvider
   * defaults.phoneCountry`, else the browser locale's region) — the same value the host gives its PublicForm.
   */
  defaultCountry?: string;
  /** Calling codes offered (default FORM_COUNTRY_CODES). */
  countryCodes?: PublicFormProps["countryCodes"];
  /** Copy to the clipboard (default navigator.clipboard). */
  copy?: (text: string) => Promise<void>;
  /** Height of the builder (panes scroll inside). Default fills the space below it down to the window bottom. */
  height?: number | string;
  readOnly?: boolean;
  className?: string;
};

const defaultCopy = async (text: string) => {
  if (!navigator.clipboard?.writeText) throw Error("clipboard unavailable");
  await navigator.clipboard.writeText(text);
};

export function FormBuilder(props: FormBuilderProps) {
  const { fields, form, onFormChange, settings, onSettingsChange, shareUrl, results, stats, help, topExtra, onShare, onEditField, onDeleteField, onCopyQuestion, newFieldTypes, onNewField, onAddNotify, onRemind, cover, onChangeCover, brand, valueOptions, dynamicTokens, conditionContext, previewProps, defaultCountry, countryCodes, readOnly, className } = props;
  const [ownMode, setOwnMode] = useState<FormBuilderMode>("edit");
  const mode = props.mode ?? ownMode;
  const setMode = (next: FormBuilderMode) => {
    setOwnMode(next);
    props.onModeChange?.(next);
  };
  const [selected, setSelected] = useState<string | null>(props.defaultSelected ?? null);
  const pinned = useMemo(() => new Set(props.pinned ?? []), [props.pinned]);
  const byKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  const limits: ConditionLimits = { ...CONDITION_LIMITS, ...props.conditionLimits };
  const copy = props.copy ?? defaultCopy;
  const select = (key: string) => {
    setSelected(key);
    requestAnimationFrame(() => document.getElementById(`aui-fb-q-${key}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };
  useEffect(() => {
    if (selected && !form.questions.some((q) => q.field === selected)) setSelected(null);
  }, [form.questions, selected]);
  const questions = form.questions.filter((q) => byKey.has(q.field));
  const items = questions.map((q) => ({ id: q.field, locked: readOnly || pinned.has(q.field) }));
  const modes = [
    { value: "edit" as const, label: "编辑" },
    { value: "preview" as const, label: "填写预览" },
    ...(results ? [{ value: "results" as const, label: "提交结果" }] : []),
  ];
  const height = props.height ?? "max(560px, calc(100dvh - 160px))";

  return (
    <div className={cn("aui-fb", className)} data-mode={mode} style={{ "--aui-fb-height": typeof height === "number" ? `${height}px` : height } as CSSProperties}>
      <div className="aui-fb-top">
        {help && <HelpTip label="表单说明">{help}</HelpTip>}
        <SegmentedControl size="sm" className="aui-fb-modes" label="表单视图" value={mode} options={modes} onValueChange={setMode} />
        <span className="aui-fb-top-end">
          {stats && <span className="aui-fb-stats">已收集 <b>{stats.total.toLocaleString("zh-CN")}</b> 份{stats.today !== undefined && <> · 今天 <b>+{stats.today}</b></>}</span>}
          {!settings.collecting && <span className="aui-fb-stopped">已停止收集</span>}
          {topExtra}
          {onShare && <Button size="sm" onClick={onShare}><Share2 />分享表单</Button>}
        </span>
      </div>
      {mode === "preview" ? (
        <div className="aui-fb-preview">
          <PublicForm form={form} fields={fields} cover={cover} brand={brand} conditionContext={conditionContext} defaultCountry={defaultCountry} countryCodes={countryCodes} preview {...previewProps} />
        </div>
      ) : mode === "results" ? (
        <div className="aui-fb-results">{results}</div>
      ) : (
        <div className="aui-fb-cols">
          <FormFieldList fields={fields} form={form} pinned={pinned} selected={selected} onSelect={select} readOnly={readOnly}
            onOrder={(keys) => onFormChange(setFormQuestionOrder(form, fields, keys))}
            onAdd={(key) => { const f = byKey.get(key); if (f) { onFormChange(addFormQuestion(form, f)); select(key); } }}
            onRemove={(key) => onFormChange(removeFormQuestion(form, key))}
            onAddAll={() => onFormChange(addAllFormQuestions(form, fields))}
            footer={newFieldTypes?.length && onNewField && !readOnly ? (
              <MenuButton variant="outline" size="sm" label="新题型" align="start" className="aui-fb-newtype"
                sections={[{ items: newFieldTypes.map((t) => ({ key: t.type, label: t.label, icon: t.icon, onSelect: () => onNewField(t.type) })) }]}>
                <Plus />新题型
              </MenuButton>
            ) : undefined} />
          <main className="aui-fb-canvas" aria-label="表单内容">
            <div className="aui-fb-paper">
              <div className="aui-fb-band" data-cover={cover ? true : undefined} style={cover ? { backgroundImage: `url("${cover.replace(/"/g, "%22")}")` } : undefined}>
                {brand && <div className="aui-pform-brand">{brand}</div>}
                {onChangeCover && !readOnly && <Button variant="outline" size="sm" className="aui-fb-cover" onClick={onChangeCover}><ImagePlus />换封面</Button>}
              </div>
              <div className="aui-fb-head">
                <Input className="aui-fb-title" aria-label="表单标题" value={form.title} readOnly={readOnly} onChange={(e) => onFormChange({ ...form, title: e.target.value })} />
                <Textarea className="aui-fb-desc" aria-label="表单说明" rows={2} placeholder="表单说明（选填）：告诉填写人这份表单做什么用" value={form.description ?? ""} readOnly={readOnly} onChange={(e) => onFormChange({ ...form, description: e.target.value })} />
              </div>
              {questions.length === 0 ? (
                <div className="aui-fb-empty">从左边把字段加进来，每个字段就是一道题。</div>
              ) : (
                <SortableList
                  items={items}
                  label="题目顺序"
                  lockedHint="这一题固定在最前面"
                  itemLabel={(item) => { const q = questions.find((x) => x.field === item.id); return q ? q.title || byKey.get(q.field)?.title || q.field : item.id; }}
                  onChange={(next) => onFormChange(reorderFormQuestions(form, next.map((n) => n.id)))}
                  renderItem={(item) => {
                    const index = questions.findIndex((q) => q.field === item.id);
                    const question = questions[index]!;
                    const field = byKey.get(question.field)!;
                    return (
                      <FormQuestionCard question={question} field={field} number={index + 1} selected={selected === question.field} onSelect={() => setSelected(question.field)}
                        onChange={(patch) => onFormChange(updateFormQuestion(form, question.field, patch))}
                        conditionFields={formConditionFields(form, fields, question.field)}
                        pinned={pinned.has(question.field)} readOnly={readOnly} defaultCountry={defaultCountry} countryCodes={countryCodes}
                        onRemove={() => onFormChange(removeFormQuestion(form, question.field))}
                        onCopy={onCopyQuestion ? () => onCopyQuestion(question, field) : undefined}
                        onDeleteField={onDeleteField ? () => onDeleteField(field) : undefined}
                        onEditField={onEditField ? () => onEditField(field) : undefined}
                        limits={limits} valueOptions={valueOptions} dynamicTokens={dynamicTokens} />
                    );
                  }}
                />
              )}
              <div className="aui-fb-submit">
                <Button disabled tabIndex={-1}>{form.submitText ?? "提交"}</Button>
                <small>提交后显示「{form.successMessage ?? "提交成功"}」</small>
              </div>
            </div>
          </main>
          <FormSettingsPane form={form} fields={fields} settings={settings} onChange={onSettingsChange} shareUrl={shareUrl} submitLimits={props.submitLimits ?? FORM_SUBMIT_LIMITS_DEFAULT}
            onAddNotify={onAddNotify} onRemind={onRemind} copy={copy} readOnly={readOnly} />
        </div>
      )}
    </div>
  );
}
