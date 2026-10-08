"use client";
/**
 * OptionsEditor (bt/records R2, demo D12): the options of a single / multi select
 * (or tags, dictionary values) as a sortable list. A row = grip (SortableList: pointer + keyboard) ·
 * colour dot button (OptionSwatchPicker, the 10 approved hues) · label box · 「N 条」 records using it
 * (when the host passes `usage`) · ×. Duplicate names turn red (「重名」 on the right, 「「报价」出现了两次」
 * under the list); deleting an option records use asks first (「32 条会变空」). One line under the list
 * previews the options as the table shows them. Footer: 「+ 添加选项」, count, the 「允许在单元格里直接新建选项」
 * switch. Enter in a label adds the next option and focuses it; Backspace in an empty label removes it.
 * The host owns the list (`options` / `onChange`).
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CircleAlert, Plus, X } from "lucide-react";
import { Button, Input, Switch } from "./primitives.tsx";
import { IconButton } from "./buttons.tsx";
import { ConfirmDialog } from "./forms.tsx";
import { CellTags } from "./cells.tsx";
import { SortableList } from "./sortable.tsx";
import { OptionSwatchPicker } from "./option-swatch.tsx";
import { tipProps } from "./tooltip.tsx";
import { newOptionId, nextOptionTone, optionProblems, type EditableOption } from "./field-dialog-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/fields.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/fields.css";

export type OptionsEditorProps = {
  options: readonly EditableOption[];
  onChange: (next: EditableOption[]) => void;
  /** Accessible name of the list (default 「选项」). */
  label?: string;
  /** Shows the switch when given. */
  allowCreate?: boolean;
  onAllowCreateChange?: (on: boolean) => void;
  allowCreateLabel?: string;
  /** Most options (default 200); 「添加选项」 turns off at the limit. */
  max?: number;
  /** Build a new option (default: id `o` + 5 chars, the next starter tone, empty label). */
  createOption?: (taken: readonly EditableOption[]) => EditableOption;
  /** Option id → message (server-side checks); duplicates are flagged automatically. */
  errors?: Readonly<Record<string, string>>;
  disabled?: boolean;
  /** Option id → records using it: 「32 条」 on the right; removing a used option asks first. */
  usage?: Readonly<Record<string, number>>;
  /** Field name in the delete question (「这些客户的『阶段』变成空」, default 「这个字段」). */
  fieldName?: string;
  /** What the records are called (default 「记录」 → 「32 条记录正在用」). */
  recordNoun?: string;
  /** The preview line under the list (default true). */
  preview?: boolean;
  /**
   * Host controls at the end of each option row, before the delete button (a category select, a
   * default win-rate input). `change(patch)` updates this option — usually `{ meta: { ...option.meta, … } }`;
   * `meta` is kept on rename, recolour and reorder.
   */
  renderOptionExtra?: (option: EditableOption, index: number, change: (patch: Partial<Omit<EditableOption, "id">>) => void) => ReactNode;
};

const nameOf = (option: EditableOption, index: number) => option.label.trim() || `选项 ${index + 1}`;

export function OptionsEditor({ options, onChange, label = "选项", allowCreate, onAllowCreateChange, allowCreateLabel = "允许在单元格里直接新建选项", max = 200, createOption, errors, disabled, usage, fieldName = "这个字段", recordNoun = "记录", preview = true, renderOptionExtra }: OptionsEditorProps) {
  const base = useId();
  const box = useRef<HTMLDivElement>(null);
  const focusId = useRef<string | null>(null);
  const [asking, setAsking] = useState<EditableOption | null>(null);
  const { duplicate } = optionProblems(options);
  const make = (taken: readonly EditableOption[]) => createOption?.(taken) ?? { id: newOptionId(taken), label: "", tone: nextOptionTone(taken.length) };
  const update = (id: string, patch: Partial<EditableOption>) => onChange(options.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const insertAfter = (id: string | null) => {
    if (options.length >= max) return;
    const option = make(options);
    const at = id === null ? options.length : options.findIndex((o) => o.id === id) + 1;
    focusId.current = option.id;
    onChange([...options.slice(0, at), option, ...options.slice(at)]);
  };
  const removeNow = (id: string) => {
    const at = options.findIndex((o) => o.id === id);
    const next = options.filter((o) => o.id !== id);
    focusId.current = next[Math.max(0, at - 1)]?.id ?? null;
    onChange(next);
    if (!next.length) requestAnimationFrame(() => box.current?.querySelector<HTMLButtonElement>(".aui-opts-add")?.focus());
  };
  const remove = (option: EditableOption) => ((usage?.[option.id] ?? 0) > 0 ? setAsking(option) : removeNow(option.id));
  useEffect(() => {
    const id = focusId.current;
    if (!id) return;
    focusId.current = null;
    box.current?.querySelector<HTMLInputElement>(`input[data-option-id="${CSS.escape(id)}"]`)?.focus();
  });
  const dupNames = [...new Set(options.filter((o) => duplicate.includes(o.id)).map((o) => o.label.trim()))];
  const named = options.filter((o) => o.label.trim());
  const askingCount = asking ? usage?.[asking.id] ?? 0 : 0;
  return (
    <div ref={box} className="aui-opts" data-disabled={disabled || undefined}>
      {options.length > 0 && (
        <SortableList
          label={`${label}顺序`}
          items={options}
          itemLabel={(o) => nameOf(o, options.indexOf(o))}
          onChange={(next) => onChange(next)}
          renderItem={(option) => {
            const index = options.indexOf(option);
            const name = nameOf(option, index);
            const dup = duplicate.includes(option.id);
            const message = dup ? undefined : errors?.[option.id];
            const errorId = `${base}-${option.id}-error`;
            const used = usage?.[option.id];
            const extra = renderOptionExtra?.(option, index, (patch) => update(option.id, patch));
            return (
              <span className="aui-opts-row" data-invalid={message || dup ? true : undefined} data-extra={extra ? true : undefined}>
                <OptionSwatchPicker label={`选项「${name}」的颜色`} value={option.tone} sample={option.label.trim() || undefined} disabled={disabled} onChange={(tone) => update(option.id, { tone })} />
                <Input
                  data-option-id={option.id}
                  value={option.label}
                  maxLength={100}
                  disabled={disabled}
                  placeholder={`选项 ${index + 1}`}
                  aria-label={`选项 ${index + 1} 名称`}
                  aria-invalid={message || dup ? true : undefined}
                  aria-describedby={message ? errorId : dup ? `${base}-dups` : undefined}
                  onChange={(event) => update(option.id, { label: event.currentTarget.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      insertAfter(option.id);
                    } else if (event.key === "Backspace" && option.label === "" && options.length > 1) {
                      event.preventDefault();
                      remove(option);
                    }
                  }}
                />
                <span className="aui-opts-used" data-dup={dup || undefined}>{dup ? "重名" : used !== undefined && used > 0 ? `${used} 条` : ""}</span>
                {extra ? <span className="aui-opts-extra">{extra}</span> : null}
                <IconButton size="sm" className="aui-opts-remove" icon={<X />} label={`删除选项「${name}」`} tooltip="删除选项" disabled={disabled} onClick={() => remove(option)} />
                {message && <span id={errorId} className="aui-opts-error" role="alert">{message}</span>}
              </span>
            );
          }}
        />
      )}
      {!options.length && <p className="aui-note aui-opts-empty">还没有选项</p>}
      <div className="aui-opts-foot">
        <Button variant="ghost" size="sm" className="aui-opts-add" disabled={disabled || options.length >= max} {...tipProps(options.length >= max ? `最多 ${max} 个选项` : null)} onClick={() => insertAfter(null)}>
          <Plus aria-hidden="true" />添加选项
        </Button>
        <span className="aui-opts-count">{options.length} 个选项</span>
        {dupNames.length > 0 && (
          <span id={`${base}-dups`} className="aui-opts-dups" role="alert"><CircleAlert aria-hidden="true" />{dupNames.map((n) => `「${n}」`).join("")}出现了两次，和上面的选项重名</span>
        )}
        {onAllowCreateChange && (
          <label className="aui-opts-switch">
            {allowCreateLabel}
            <Switch checked={Boolean(allowCreate)} disabled={disabled} onCheckedChange={onAllowCreateChange} aria-label={allowCreateLabel} />
          </label>
        )}
      </div>
      {preview && named.length > 0 && (
        <div className="aui-opts-preview" aria-label="表格里的样子">
          <span>表格里：</span>
          <CellTags items={named.map((o) => ({ label: o.label.trim(), tone: o.tone }))} />
        </div>
      )}
      <ConfirmDialog
        open={asking !== null}
        title={`删除「${asking ? nameOf(asking, options.indexOf(asking)) : ""}」？`}
        description={`${askingCount} 条${recordNoun}正在用。删掉后这些${recordNoun}的「${fieldName}」变成空。`}
        destructive
        confirmLabel={`删除并清空 ${askingCount} 条`}
        onClose={() => setAsking(null)}
        onConfirm={() => {
          if (asking) removeNow(asking.id);
          setAsking(null);
        }}
      />
    </div>
  );
}
