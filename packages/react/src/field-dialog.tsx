"use client";
/**
 * FieldDialog (bt/records R3, demo D12): 「新建字段 / 修改字段」 as one large dialog. Left: name, type tiles
 * (FieldTypePicker), the type's own settings (slot), options (OptionsEditor, for the host's option
 * types), description + default value (slot). Right: a slot for 「谁能看 / 谁能改」 (GrantList mode
 * "picked" + audience banners). Footer: a grey note, 取消 / 确定. Below 860px the right column moves
 * under the left one. Validation is built in (validateFieldDraft) and shown at the fields after the first
 * submit; `onSubmit` rejecting keeps the dialog open with the message on top (input kept).
 */
import { useId, useState, type ReactNode } from "react";
import { Info, Shield } from "lucide-react";
import { Button, Input } from "./primitives.tsx";
import { Dialog } from "./forms.tsx";
import { InlineAlert } from "./layout.tsx";
import { HelpTip } from "./help-tip.tsx";
import { FieldTypePicker } from "./field-type-picker.tsx";
import { OptionsEditor, type OptionsEditorProps } from "./options-editor.tsx";
import { FIELD_NAME_MAX, hasFieldErrors, validateFieldDraft, type FieldDraft, type FieldDraftErrors, type FieldTypeTile } from "./field-dialog-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/fields.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/fields.css";

export type FieldDialogProps<V extends string = string> = {
  open: boolean;
  onClose: () => void;
  /** Save; reject (Error message) to stay open and show it. Resolve = saved, the host closes / resets. */
  onSubmit: (draft: FieldDraft<V>) => Promise<void>;
  value: FieldDraft<V>;
  onChange: (next: FieldDraft<V>) => void;
  types: readonly FieldTypeTile<V>[];
  /** Types that have options (single / multi select): the options editor shows for them. */
  optionTypes?: readonly V[];
  /** Names already used in the table (duplicate check). Leave out the field being edited. */
  existingNames?: readonly string[];
  /** Extra checks of the host (merged after the built-in ones). */
  validate?: (draft: FieldDraft<V>) => FieldDraftErrors;
  /** 「新建字段」 by default; 「修改字段」 when editing. */
  title?: string;
  /** Explanation behind the 「?」 next to the title. */
  help?: ReactNode;
  submitLabel?: string;
  /** Settings of the picked type (currency, decimals, include time …), right under the type tiles. */
  settings?: ReactNode;
  /** Default value control (depends on type / options). Leave out to hide the default value column. */
  defaultValue?: ReactNode;
  /** Grey note under the description label (default 「表头显示 ⓘ，悬停看到」). */
  descriptionHint?: ReactNode;
  /** Right column: 「谁能看 / 谁能改」 (GrantList mode="picked" + audience). Leave out for one column. */
  aside?: ReactNode;
  /** Heading of the right column (default 「谁能看 / 谁能改」) and its 「?」. */
  asideTitle?: string;
  asideHelp?: ReactNode;
  /** Grey note left of the buttons (「以后在表头菜单「字段权限」里还能改」). */
  footerNote?: ReactNode;
  /** Can't change the type any more (editing a field with data). */
  typeLocked?: string;
  /** Per-option host controls in the options editor (OptionsEditor `renderOptionExtra`; data goes in `option.meta`). */
  renderOptionExtra?: OptionsEditorProps["renderOptionExtra"];
  /** Option id → records using it (editing a field with data): 「32 条」 per option, deleting one in use asks first. */
  optionUsage?: Readonly<Record<string, number>>;
  /** What the records are called in that question (default 「记录」). */
  recordNoun?: string;
};

export function FieldDialog<V extends string = string>(props: FieldDialogProps<V>) {
  const { open, onClose, onSubmit, value, onChange, types, optionTypes, existingNames, validate, title = "新建字段", help, submitLabel = "确定", settings, defaultValue, descriptionHint = "表头显示 ⓘ，悬停看到", aside, asideTitle = "谁能看 / 谁能改", asideHelp, footerNote, typeLocked, renderOptionExtra, optionUsage, recordNoun } = props;
  const base = useId();
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const set = (patch: Partial<FieldDraft<V>>) => onChange({ ...value, ...patch });
  const own = validateFieldDraft(value, { optionTypes, existingNames });
  const extra = validate?.(value) ?? {};
  const errors: FieldDraftErrors = { ...own, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v)), optionRows: { ...own.optionRows, ...extra.optionRows } };
  const shownErrors = tried ? errors : {};
  const hasOptions = Boolean(value.type && optionTypes?.includes(value.type));
  const close = () => {
    if (busy) return;
    setTried(false);
    setFailure("");
    onClose();
  };
  const submit = async () => {
    setTried(true);
    if (hasFieldErrors(errors)) {
      // Focus the first wrong place: the name, else the type tiles, else the first option row.
      const target = errors.name
        ? document.getElementById(`${base}-name`)
        : document.querySelector<HTMLElement>(errors.type ? `[data-fdlg="${base}"] .aui-ftype-tile:not(:disabled)` : `[data-fdlg="${base}"] .aui-opts input`);
      target?.focus();
      return;
    }
    setBusy(true);
    setFailure("");
    try {
      await onSubmit(value);
      setTried(false);
    } catch (error) {
      setFailure(error instanceof Error && error.message ? error.message : "保存失败，请重试");
    } finally {
      setBusy(false);
    }
  };
  const footer = (
    <div className="aui-fdlg-foot">
      {footerNote && <span className="aui-fdlg-note"><Info aria-hidden="true" />{footerNote}</span>}
      <Button variant="outline" onClick={close} disabled={busy}>取消</Button>
      <Button onClick={() => void submit()} disabled={busy} aria-busy={busy || undefined}>{busy ? "保存中…" : submitLabel}</Button>
    </div>
  );
  return (
    <Dialog open={open} title={title} titleAdornment={help ? <HelpTip label={`${title}说明`}>{help}</HelpTip> : undefined} size="lg" onClose={close} footer={footer} bodyClassName="aui-fdlg-body">
      <div className="aui-fdlg" data-fdlg={base} data-aside={aside ? true : undefined}>
        <div className="aui-fdlg-main">
          {failure && <InlineAlert tone="error" title={failure} />}
          {tried && hasFieldErrors(errors) && !failure && <InlineAlert tone="error" title="还有没填好的地方">{[errors.name, errors.type, errors.options].filter(Boolean).join("；")}</InlineAlert>}
          <div className="aui-fdlg-block">
            <label className="aui-fdlg-label" htmlFor={`${base}-name`}>字段名称<span className="aui-required" aria-hidden="true"> *</span></label>
            <Input
              id={`${base}-name`}
              value={value.name}
              maxLength={FIELD_NAME_MAX}
              autoComplete="off"
              // The title's 「?」 would otherwise take the first focus and pop its bubble.
              autoFocus
              aria-required="true"
              aria-invalid={shownErrors.name ? true : undefined}
              aria-describedby={shownErrors.name ? `${base}-name-error` : undefined}
              onChange={(event) => set({ name: event.currentTarget.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void submit();
                }
              }}
            />
            {shownErrors.name && <p id={`${base}-name-error`} className="aui-error" role="alert">{shownErrors.name}</p>}
          </div>
          <FieldTypePicker types={types} value={value.type} disabled={Boolean(typeLocked)} hint={typeLocked} error={shownErrors.type} onChange={(type) => set({ type })} />
          {settings && <div className="aui-fdlg-block aui-fdlg-settings">{settings}</div>}
          {hasOptions && (
            <div className="aui-fdlg-block">
              <div className="aui-fdlg-label">选项<small>拖动排序 · 点色块换颜色 · 回车加下一个</small></div>
              <OptionsEditor options={value.options} onChange={(options) => set({ options })} allowCreate={value.allowCreate} onAllowCreateChange={(allowCreate) => set({ allowCreate })} errors={tried ? errors.optionRows : undefined} renderOptionExtra={renderOptionExtra}
                usage={optionUsage} fieldName={value.name.trim() || undefined} recordNoun={recordNoun} />
              {shownErrors.options && <p className="aui-error" role="alert">{shownErrors.options}</p>}
            </div>
          )}
          <div className="aui-fdlg-two" data-single={defaultValue === undefined || undefined}>
            <div className="aui-fdlg-block">
              <label className="aui-fdlg-label" htmlFor={`${base}-desc`}>说明{descriptionHint && <small>· {descriptionHint}</small>}</label>
              <Input id={`${base}-desc`} value={value.description} maxLength={2000} onChange={(event) => set({ description: event.currentTarget.value })} />
            </div>
            {defaultValue !== undefined && (
              <div className="aui-fdlg-block" role="group" aria-labelledby={`${base}-default`}>
                <span id={`${base}-default`} className="aui-fdlg-label">默认值</span>
                {defaultValue}
              </div>
            )}
          </div>
        </div>
        {aside && (
          <section className="aui-fdlg-aside" aria-labelledby={`${base}-aside`}>
            <h3 id={`${base}-aside`} className="aui-fdlg-aside-title">
              <Shield aria-hidden="true" />{asideTitle}
              {asideHelp && <HelpTip label={`${asideTitle}说明`}>{asideHelp}</HelpTip>}
            </h3>
            {aside}
          </section>
        )}
      </div>
    </Dialog>
  );
}
