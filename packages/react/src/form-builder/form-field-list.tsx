"use client";
/**
 * Field list of the FormBuilder (bt/builders-a V9, D08 left pane): 「已添加 N」 and 「未添加 M · 全部添加」
 * in one SortableList — drag (or Alt+↑ / ↓) a field into 已添加 to make it a question, out to remove
 * it, within to reorder. Pinned questions are locked (first, can't move or leave). Each row: type icon,
 * name, 「题目：…」 when the question has its own title, a lock for permission-limited fields, and
 * 从表单移除 / 加到表单 buttons. While searching the list is flat (no dragging).
 */
import { useMemo, useState, type ReactNode } from "react";
import { EyeOff, Lock, Plus, Search } from "lucide-react";
import { Button, Input } from "../primitives.tsx";
import { HelpTip } from "../help-tip.tsx";
import { SortableList } from "../sortable.tsx";
import { fieldIcon } from "../grid-field-picker.tsx";
import { formFieldLists, formFieldUnsupported, type FormDefinition, type FormField } from "./form-core.ts";
import { IconButton } from "../buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/form-builder.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/form-builder.css";

type Row = { id: string; field?: FormField; locked?: boolean; children?: Row[] };
const ADDED = "__added";
const REST = "__rest";

export type FormFieldListProps = {
  fields: readonly FormField[];
  form: FormDefinition;
  pinned: ReadonlySet<string>;
  selected: string | null;
  onSelect: (key: string) => void;
  /** New 已添加 order (keys). */
  onOrder: (keys: string[]) => void;
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
  onAddAll: () => void;
  readOnly?: boolean;
  footer?: ReactNode;
};

const lockText = (field: FormField) => (typeof field.locked === "string" ? field.locked : typeof field.restricted === "string" ? field.restricted : field.locked || field.restricted ? "有字段权限的字段：表单里只写不读" : null);

export function FormFieldList({ fields, form, pinned, selected, onSelect, onOrder, onAdd, onRemove, onAddAll, readOnly, footer }: FormFieldListProps) {
  const [query, setQuery] = useState("");
  const { added, notAdded } = formFieldLists(form, fields);
  const addable = notAdded.filter((f) => !formFieldUnsupported(f));
  const tree = useMemo<Row[]>(() => [
    { id: ADDED, children: added.map((field) => ({ id: field.key, field, locked: readOnly || pinned.has(field.key) })) },
    { id: REST, children: notAdded.map((field) => ({ id: field.key, field, locked: readOnly || Boolean(formFieldUnsupported(field)) })) },
  ], [added, notAdded, pinned, readOnly]);
  const titleOf = (field: FormField) => {
    const q = form.questions.find((x) => x.field === field.key);
    return q?.title && q.title !== field.title ? q.title : null;
  };
  const row = (field: FormField, inForm: boolean) => {
    const Icon = fieldIcon(field.type);
    const unsupported = formFieldUnsupported(field);
    const lock = lockText(field);
    const custom = inForm ? titleOf(field) : null;
    return (
      <span className="aui-fb-field" data-selected={selected === field.key || undefined} data-off={!inForm || undefined}>
        <Icon className="aui-fb-field-icon" aria-hidden="true" />
        {inForm ? (
          <button type="button" className="aui-fb-field-name" onClick={() => onSelect(field.key)} aria-current={selected === field.key || undefined}>
            {field.title}
            {custom && <small>题目：{custom}</small>}
          </button>
        ) : (
          <span className="aui-fb-field-name" data-tip={unsupported ?? undefined}>{field.title}</span>
        )}
        {lock && <span className="aui-fb-field-lock" role="img" aria-label={lock} data-tip={lock}><Lock aria-hidden="true" /></span>}
        {!readOnly && inForm && !pinned.has(field.key) && <IconButton label={`从表单移除「${field.title}」`} tooltip="从表单移除（字段和数据保留）" className="aui-fb-field-act" onClick={() => onRemove(field.key)} icon={<EyeOff />} />}
        {!readOnly && !inForm && !unsupported && <IconButton label={`把「${field.title}」加到表单`} tooltip="加到表单" className="aui-fb-field-act" onClick={() => onAdd(field.key)} icon={<Plus />} />}
        {!inForm && unsupported && <span className="aui-fb-field-note">{unsupported.length > 8 ? "不能做题" : unsupported}</span>}
      </span>
    );
  };
  const words = query.trim().toLocaleLowerCase("zh-CN");
  const found = words ? fields.filter((f) => f.title.toLocaleLowerCase("zh-CN").includes(words)) : [];
  return (
    <aside className="aui-fb-pane aui-fb-fields" aria-label="字段">
      <div className="aui-fb-pane-head">
        <h3>字段</h3>
        <HelpTip label="字段说明">点「+」把字段加成题目，或把字段拖进「已添加」；「从表单移除」只是不再显示，字段和数据都还在。</HelpTip>
      </div>
      <label className="aui-fb-search">
        <Search aria-hidden="true" />
        <Input type="search" clearable aria-label="搜索字段" placeholder="搜索字段" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="aui-fb-pane-body">
        {words ? (
          <ul className="aui-fb-found" aria-label="搜索结果">
            {found.map((field) => <li key={field.key}>{row(field, form.questions.some((q) => q.field === field.key))}</li>)}
            {!found.length && <li className="aui-note">没有匹配的字段</li>}
          </ul>
        ) : (
          <SortableList<Row>
            items={tree}
            label="表单字段"
            dense
            lockedHint={readOnly ? "只读" : "固定的题目 / 不能做题的字段，不能拖"}
            itemLabel={(item) => (item.id === ADDED ? "已添加" : item.id === REST ? "未添加" : item.field?.title ?? item.id)}
            renderGroup={(group, { count }) =>
              group.id === ADDED ? (
                <span className="aui-fb-group">已添加 <b>{count}</b></span>
              ) : (
                <span className="aui-fb-group">未添加 <b>{count}</b>{!readOnly && addable.length > 0 && <Button variant="text" size="sm" className="aui-fb-addall" onClick={onAddAll}>全部添加</Button>}</span>
              )}
            renderItem={(item) => (item.field ? row(item.field, tree[0]!.children!.some((c) => c.id === item.id)) : null)}
            onChange={(next) => {
              // Group headers don't move; only the 已添加 list matters.
              if (next[0]?.id !== ADDED) return;
              const keys = (next[0].children ?? []).map((c) => c.id);
              onOrder(keys);
            }}
          />
        )}
      </div>
      {footer && <div className="aui-fb-pane-foot">{footer}</div>}
    </aside>
  );
}
