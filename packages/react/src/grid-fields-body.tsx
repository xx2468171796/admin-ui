"use client";
/**
 * Body of the 字段配置 panel (GridFieldsTool): search, 全部显示 / 全部隐藏 and the sortable field tree with field
 * groups. A lazy module — the grid's first paint only has the button.
 */
import { useMemo } from "react";
import { Eye, EyeOff, Folder, Lock, Search, X } from "lucide-react";
import { Button, Input } from "./primitives.tsx";
import { SortableList } from "./sortable.tsx";
import { fieldIcon } from "./grid-field-picker.tsx";
import { primaryField, type GridField } from "./grid-core.ts";
import { FIELD_GROUP_PREFIX, fieldLayoutOf, fieldPanelTree, type FieldPanelNode as Node } from "./grid-fields-core.ts";
import type { GridToolContext } from "./grid-toolbar-panel.tsx";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

const GROUP = FIELD_GROUP_PREFIX;
const isGroupNode = (id: string) => id.startsWith(GROUP);

export type GridFieldsBodyProps<T> = Pick<GridToolContext<T>, "fields" | "view" | "apply"> & {
  /** Search text and folded field groups live in the tool, so they survive closing the panel. */
  query: string;
  onQueryChange: (query: string) => void;
  folded: ReadonlySet<string>;
  onFoldedChange: (folded: ReadonlySet<string>) => void;
};

export function GridFieldsBody<T>({ fields, view, apply, query, onQueryChange: setQuery, folded, onFoldedChange: setFolded }: GridFieldsBodyProps<T>) {
  const byKey = useMemo(() => new Map(fields.map((field) => [field.key, field])), [fields]);
  const primary = primaryField(fields)?.key;
  const hidden = new Set(view.hidden);
  const tree = fieldPanelTree(view, primary);
  const hideable = view.order.filter((key) => key !== primary);
  const term = query.trim().toLocaleLowerCase("zh-CN");
  const eye = (keys: readonly string[], name: string) => {
    const keysToToggle = keys.filter((key) => key !== primary);
    const allHidden = keysToToggle.length > 0 && keysToToggle.every((key) => hidden.has(key));
    return (
      <IconButton label={allHidden ? `显示「${name}」` : `隐藏「${name}」`} className="aui-grid-field-eye" data-hidden={allHidden || undefined} disabled={!keysToToggle.length} aria-pressed={!allHidden} onClick={() => apply({ type: "setHidden", keys: keysToToggle, hidden: !allHidden })} icon={allHidden ? <EyeOff /> : <Eye />} />
    );
  };
  const fieldRow = (field: GridField<T>) => {
    const Icon = fieldIcon(field.type);
    const reason = field.restricted ? (typeof field.restricted === "string" ? field.restricted : "你只能看到这个字段的部分内容") : field.locked ? (typeof field.locked === "string" ? field.locked : "这个字段有查看 / 编辑限制") : null;
    return (
      <div className="aui-grid-field-row" data-hidden={hidden.has(field.key) || undefined}>
        <Icon className="aui-grid-field-icon" aria-hidden="true" />
        <span className="aui-grid-field-name">{field.title}</span>
        {field.key === primary && <span className="aui-grid-field-badge">主字段</span>}
        {reason && <span className="aui-grid-field-lock" role="img" data-tip={reason} aria-label={reason}><Lock aria-hidden="true" /></span>}
        {eye([field.key], field.title)}
      </div>
    );
  };
  const groupTitle = (id: string) => view.fieldGroups.find((g) => g.id === id)?.title ?? id;
  return (
    <div className="aui-grid-fields-panel">
      <div className="aui-grid-fields-search">
        <Search aria-hidden="true" />
        <Input type="search" clearable aria-label="搜索字段" placeholder="搜索字段" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="aui-grid-fields-bar">
        <span className="aui-note">{view.hidden.length ? `已隐藏 ${view.hidden.length} 个` : "全部显示中"}</span>
        <Button variant="text" size="sm" disabled={!view.hidden.length} onClick={() => apply({ type: "showAll" })}>全部显示</Button>
        <Button variant="text" size="sm" disabled={hideable.every((key) => hidden.has(key))} onClick={() => apply({ type: "setHidden", keys: hideable, hidden: true })}>全部隐藏</Button>
      </div>
      {term ? (
        <ul className="aui-grid-fields-found" aria-label="搜索到的字段">
          {view.order.map((key) => byKey.get(key)!).filter((field) => field.title.toLocaleLowerCase("zh-CN").includes(term)).map((field) => <li key={field.key}>{fieldRow(field)}</li>)}
        </ul>
      ) : (
        <SortableList<Node> label="字段顺序" dense items={tree} lockedHint="主字段固定在第一列"
          collapsed={folded} onCollapsedChange={setFolded}
          itemLabel={(node) => (isGroupNode(node.id) ? groupTitle(node.id.slice(GROUP.length)) : byKey.get(node.id)?.title ?? node.id)}
          onChange={(next) => { const layout = fieldLayoutOf(next, view.fieldGroups); apply({ type: "setFieldLayout", order: layout.order, fieldGroups: layout.fieldGroups }); }}
          renderItem={(node) => (byKey.get(node.id) ? fieldRow(byKey.get(node.id)!) : null)}
          renderGroup={(node, state) => {
            const id = node.id.slice(GROUP.length);
            const members = (node.children ?? []).map((child) => child.id);
            return (
              <div className="aui-grid-field-row" data-group>
                <Folder className="aui-grid-field-icon" aria-hidden="true" />
                <span className="aui-grid-field-name"><strong>{groupTitle(id)}</strong></span>
                <span className="aui-note">{state.count} 个字段</span>
                {members.length ? eye(members, groupTitle(id)) : (
                  <IconButton label={`删除空编组「${groupTitle(id)}」`} onClick={() => apply({ type: "removeFieldGroup", id })} icon={<X />} />
                )}
              </div>
            );
          }} />
      )}
    </div>
  );
}
