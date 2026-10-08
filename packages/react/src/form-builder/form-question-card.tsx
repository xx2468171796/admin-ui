"use client";
/**
 * A question block of the FormBuilder canvas (bt/builders-a V9, D08 middle): number, title, 「*」, type,
 * description and a disabled preview of the input. Selected, it becomes editable — title and
 * description inputs, option chips with 「加选项」 — and opens its tray: 必填 · 题目说明 · which field,
 * 显示条件 (built with the shared condition editor over the earlier questions, shown as a sentence),
 * 复制题目 · 从表单移除 · 删除题目（连字段）.
 */
import { useRef, useState } from "react";
import { Copy, EyeOff, Plus, Trash2, Upload, Workflow } from "lucide-react";
import { Button, Input, Switch } from "../primitives.tsx";
import { HelpTip } from "../help-tip.tsx";
import { PopoverPanel } from "../popover-panel.tsx";
import { fieldIcon } from "../grid-field-picker.tsx";
import { GridConditionTree } from "../grid-condition-editor.tsx";
import { resolveOptionTone } from "../option-tone.ts";
import { countConditions, emptyConditionGroup, type ConditionLimits, type DynamicToken } from "../condition-core.ts";
import type { GridFilterGroup, GridSelectOption } from "../grid-core.ts";
import { FormQuestionInput } from "./form-inputs.tsx";
import { describeFormCondition, formTypeLabel, hasCondition, questionTitle, type FormCountryCode, type FormField, type FormQuestion } from "./form-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/form-builder.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/form-builder.css";

export type FormQuestionCardProps = {
  question: FormQuestion;
  field: FormField;
  number: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<FormQuestion>) => void;
  /** Earlier questions a display condition may use (empty = first question). */
  conditionFields: readonly FormField[];
  pinned: boolean;
  onRemove: () => void;
  onCopy?: () => void;
  onDeleteField?: () => void;
  onEditField?: () => void;
  limits: ConditionLimits;
  valueOptions?: Readonly<Record<string, readonly GridSelectOption[]>>;
  dynamicTokens?: readonly DynamicToken[];
  readOnly?: boolean;
  /** Phone questions: calling code shown in the preview control (FormBuilder `defaultCountry`). */
  defaultCountry?: string;
  countryCodes?: readonly FormCountryCode[];
};

export function FormQuestionCard(props: FormQuestionCardProps) {
  const { question, field, number, selected, onSelect, onChange, conditionFields, onEditField, readOnly } = props;
  const Icon = fieldIcon(field.type);
  const title = questionTitle(question, field);
  const id = `aui-fb-q-${question.field}`;
  const editing = selected && !readOnly;
  const conditionText = describeFormCondition(question.condition, conditionFields);
  const showDesc = question.showDescription !== false && Boolean(question.description || editing);
  return (
    <div className="aui-fb-q" id={id} data-selected={selected || undefined} role="group" aria-label={`第 ${number} 题：${title}`}
      onClick={(e) => { if (!selected && !(e.target as HTMLElement).closest("button, input, textarea, [role=combobox]")) onSelect(); }}
      onFocus={(e) => { if (!selected && !(e.target as HTMLElement).closest(".aui-fb-q-preview")) onSelect(); }}>
      {hasCondition(question) && !editing && (
        <div className="aui-fb-q-cond"><Workflow aria-hidden="true" />显示条件：{conditionText.replace(/^当/, "当")}</div>
      )}
      <div className="aui-fb-q-title">
        <span className="aui-fb-q-no">{number}.</span>
        {editing ? (
          <Input className="aui-fb-q-title-input" aria-label={`第 ${number} 题的题目`} value={question.title ?? field.title} onChange={(e) => onChange({ title: e.target.value })} />
        ) : (
          <button type="button" className="aui-fb-q-title-text" onClick={onSelect} aria-label={`编辑第 ${number} 题「${title}」`}>{title}</button>
        )}
        {question.required && <span className="aui-pform-req" aria-label="必填">*</span>}
        <span className="aui-fb-q-type"><Icon aria-hidden="true" />{formTypeLabel(field, question)}</span>
      </div>
      {showDesc && (editing ? (
        <Input className="aui-fb-q-desc-input" aria-label={`第 ${number} 题的说明`} placeholder="题目说明（选填），例如：可多选，我们会按您选的产品准备资料" value={question.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} />
      ) : question.description ? <div className="aui-fb-q-desc">{question.description}</div> : null)}
      {editing && (field.type === "singleSelect" || field.type === "multiSelect") ? (
        <div className="aui-fb-q-options" aria-label="选项">
          {(field.options ?? []).map((o) => <span key={o.value} className="aui-chip" data-tone={resolveOptionTone(o)}><span className="aui-chip-label">{o.label}</span></span>)}
          {onEditField && <Button variant="ghost" size="sm" onClick={onEditField}><Plus />加选项</Button>}
        </div>
      ) : (
        <div className="aui-fb-q-preview" aria-hidden="true" inert>
          {field.type === "attachment" ? (
            <div className="aui-fb-q-drop"><Upload />{question.upload?.record === "only" ? "点一下开始录音（手机上按住说话）" : "点击或拖入图片 / 视频 / PDF，也可以拍照、录音"}</div>
          ) : (
            <FormQuestionInput question={question} field={field} value={undefined} onChange={() => undefined} labelledBy={`${id}-x`} disabled defaultCountry={props.defaultCountry} countryCodes={props.countryCodes} />
          )}
        </div>
      )}
      {editing && <QuestionTray {...props} conditionText={conditionText} />}
      {selected && readOnly && hasCondition(question) && <div className="aui-fb-q-cond"><Workflow aria-hidden="true" />显示条件：{conditionText}</div>}
    </div>
  );
}

function QuestionTray({ question, field, number, onChange, conditionFields, pinned, onRemove, onCopy, onDeleteField, limits, valueOptions, dynamicTokens, conditionText }: FormQuestionCardProps & { conditionText: string }) {
  const condButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<GridFilterGroup>(() => question.condition ?? emptyConditionGroup());
  const first = conditionFields.length === 0;
  const openCondition = () => {
    setDraft(question.condition ?? emptyConditionGroup());
    setOpen(true);
  };
  const commit = (tree: GridFilterGroup) => {
    setDraft(tree);
    onChange({ condition: countConditions(tree) ? tree : null });
  };
  const usable = conditionFields.filter((f) => !f.restricted);
  return (
    <div className="aui-fb-tray" role="group" aria-label={`第 ${number} 题的设置`}>
      <div className="aui-fb-tray-row">
        <label className="aui-fb-switch"><span>必填</span><Switch aria-label="必填" checked={Boolean(question.required)} onCheckedChange={(v) => onChange({ required: v })} /></label>
        <label className="aui-fb-switch"><span>题目说明</span><Switch aria-label="题目说明" checked={question.showDescription !== false} onCheckedChange={(v) => onChange({ showDescription: v })} /></label>
        <span className="aui-fb-tray-note">字段：{field.title}（{formTypeLabel(field, question)}）</span>
      </div>
      <div className="aui-fb-tray-row">
        <span className="aui-fb-tray-label">显示条件</span>
        <HelpTip label="显示条件说明">{first ? "第一题不能设显示条件。" : "只有前面的题答成这样时才显示这一题；条件只能看前面的题，题目挪到前面后，用不上的条件会自动去掉。"}</HelpTip>
        <span className="aui-fb-tray-cond" data-set={hasCondition(question) || undefined}>{hasCondition(question) ? conditionText : first ? "第一题，一直显示" : "未设置，一直显示"}</span>
        <Button ref={condButton} variant="text" size="sm" className="aui-fb-tray-end" disabled={first || !usable.length} onClick={openCondition}><Plus />{hasCondition(question) ? "修改条件" : "设置条件"}</Button>
      </div>
      <div className="aui-fb-tray-acts">
        {onCopy && <Button variant="outline" size="sm" onClick={onCopy}><Copy />复制题目</Button>}
        <span className="aui-fb-tray-end">
          {!pinned && <Button variant="outline" size="sm" onClick={onRemove}><EyeOff />从表单移除</Button>}
          {onDeleteField && !pinned && <Button variant="outline" size="sm" className="aui-fb-danger" tooltip={`会删除表里的「${field.title}」字段和全部数据`} onClick={onDeleteField}><Trash2 />删除题目（连字段）</Button>}
        </span>
      </div>
      <PopoverPanel open={open} anchor={condButton.current} onClose={(focus) => { setOpen(false); if (focus) condButton.current?.focus(); }} title="显示条件" width={600} align="end"
        help="满足条件时才显示这一题。条件按「全部满足」或「任一满足」组合，条件组里的条件有自己的关系。"
        footer={(
          <span className="aui-fb-cond-foot">
            {countConditions(draft) > 0 && <Button variant="ghost" size="sm" onClick={() => commit(emptyConditionGroup())}>清除条件</Button>}
            <Button size="sm" onClick={() => { setOpen(false); condButton.current?.focus(); }}>完成</Button>
          </span>
        )}>
        <div className="aui-fb-cond">
          <GridConditionTree fields={conditionFields} tree={draft} limits={limits} valueOptions={valueOptions} dynamicTokens={dynamicTokens} onChange={commit} rootActions />
          <p className="aui-fb-cond-text">{describeFormCondition(countConditions(draft) ? draft : null, conditionFields)}</p>
        </div>
      </PopoverPanel>
    </div>
  );
}
