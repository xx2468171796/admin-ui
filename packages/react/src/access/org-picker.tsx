"use client";
/**
 * OrgTreePicker — pick one or several departments; the field shows full paths (总部 / 销售中心 / 华东区),
 * the dialog is a searchable CheckableTree with a draft that only applies on「确定」.
 * UserTransfer — pick people by department tree: departments | candidates | selected list (Semi Transfer
 * treeList style). Both are controlled and presentational; the host supplies the tree and the users.
 *
 * Both are deprecated since 8.1 in favour of `OrgPicker` / `OrgPickerField` from
 * `@adminui/react/org-picker` and are removed in the next major version.
 */
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { Building2, Search, X } from "lucide-react";
import { Button, Checkbox, Input, Switch } from "../primitives.tsx";
import { Dialog } from "../forms.tsx";
import { CheckableTree } from "./checkable-tree.tsx";
import type { AccessUser, OrgNode, TreeNode } from "./contracts.ts";
import { descendants, fullPath, indexTree } from "./tree-core.ts";
import { IconButton } from "../buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

/** @deprecated 8.1：改用 `@adminui/react/org-picker` 的 `OrgPickerField` / `OrgPicker`（selectable={["dept"]}），下个大版本删除。 */
export type OrgTreePickerProps = {
  nodes: readonly OrgNode[];
  /** Field name and dialog title, e.g.「所属部门」. */
  label: string;
  multiple?: boolean;
  /** Picked ids (single: 0–1 items). */
  value: readonly string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Which nodes can be picked (e.g. only departments, not the company root). */
  isSelectable?: (node: OrgNode) => boolean;
  /** Multiple mode: picking a parent also picks its children (default false). */
  linked?: boolean;
  separator?: string;
  /** Wired by FormField: id / aria for the open button. */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

const stopEnter = (e: KeyboardEvent) => {
  if (e.key === "Enter") e.preventDefault();
};

function markUnselectable(nodes: readonly TreeNode[], ok: (n: TreeNode) => boolean): TreeNode[] {
  return nodes.map((n) => ({ ...n, disabled: n.disabled || !ok(n), children: n.children ? markUnselectable(n.children, ok) : undefined }));
}

/**
 * @deprecated 8.1：改用 `OrgPickerField`（行内）或 `OrgPicker`（弹窗），`selectable={["dept"]}` 只选部门、
 * `mode="single"` 单选；数据走 `OrgDataSource`（懒加载、带路径、可选范围）。下个大版本删除。
 */
export function OrgTreePicker({
  nodes,
  label,
  multiple = false,
  value,
  onChange,
  placeholder = "未选择",
  disabled = false,
  isSelectable,
  linked = false,
  separator = " / ",
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: OrgTreePickerProps) {
  const index = useMemo(() => indexTree(nodes), [nodes]);
  const treeNodes = useMemo(() => (multiple && isSelectable ? markUnselectable(nodes, isSelectable) : nodes), [nodes, multiple, isSelectable]);
  const [open, setOpen] = useState(false);
  const textId = useId();
  const [draft, setDraft] = useState<string[]>([...value]);
  const [draftLinked, setDraftLinked] = useState(linked);
  useEffect(() => {
    if (open) setDraft([...value]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const path = (dept: string) => (index.byId.has(dept) ? fullPath(index, dept, separator) : `${dept}（已不存在）`);
  const draftPaths = draft.map(path);
  return (
    <div className="aui-access-picker" data-disabled={disabled || undefined}>
      <div className="aui-access-picker-values" aria-live="polite">
        {value.length === 0 && <span className="aui-note">{placeholder}</span>}
        {value.map((dept) => (
          <span key={dept} className="aui-access-chip" data-tip={path(dept)}>
            <span className="aui-access-chip-text">{path(dept)}</span>
            {multiple && !disabled && (
              /* admin-ui-audit-ignore raw-control: SDK 内部——OrgTreePicker 组件自己的已选标签里的小「×」（12px，Button 最小 28px 放不进标签） */
              <button type="button" className="aui-access-chip-remove" aria-label={`移除 ${path(dept)}`} onClick={() => onChange(value.filter((v) => v !== dept))}>
                <X size={12} />
              </button>
            )}
          </span>
        ))}
      </div>
      <div className="aui-access-picker-buttons">
        {!multiple && value.length > 0 && !disabled && (
          <Button size="sm" variant="ghost" onClick={() => onChange([])}>清除</Button>
        )}
        {/* Inside FormField (label id = `${id}-label`) the name is「字段名 + 按钮文字」, keeping the visible text in the name. */}
        <Button id={id} size="sm" variant="outline" disabled={disabled} aria-labelledby={id ? `${id}-label ${textId}` : undefined} aria-describedby={describedBy} aria-invalid={invalid} aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <Building2 size={14} aria-hidden="true" />
          <span id={textId}>{value.length ? `更改${label}` : `选择${label}`}</span>
        </Button>
      </div>
      <Dialog
        open={open}
        title={`选择${label}`}
        description={multiple ? "可多选；点「确定」后生效。" : "选一个；点「确定」后生效。"}
        onClose={() => setOpen(false)}
        footer={
          <>
            <span className="aui-note aui-access-picker-summary" data-tip={draftPaths.join("；")}>
              {draft.length ? `已选：${draftPaths.join("；")}` : "未选择"}
            </span>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={() => { onChange(draft); setOpen(false); }}>确定</Button>
          </>
        }
      >
        <CheckableTree
          label={label}
          nodes={treeNodes}
          mode={multiple ? "multiple" : "single"}
          value={draft}
          linked={draftLinked}
          onLinkedChange={multiple ? setDraftLinked : undefined}
          isSelectable={isSelectable}
          defaultExpanded={value.length ? value : undefined}
          onValueChange={setDraft}
        />
      </Dialog>
    </div>
  );
}

/** @deprecated 8.1：改用 `@adminui/react/org-picker` 的 `OrgPicker`（selectable={["person"]}），下个大版本删除。 */
export type UserTransferProps = {
  /** Department tree for the left column; omit for a flat list. */
  orgTree?: readonly OrgNode[];
  /** Candidate people (several thousand at most; page larger sets on the server by department / search). */
  users: readonly AccessUser[];
  value: readonly string[];
  onChange: (value: string[]) => void;
  /** Accessible name of the whole picker (default「选择成员」). */
  label?: string;
  max?: number;
  disabled?: boolean;
  loading?: boolean;
  /** Candidate rows rendered at once (default 200); refine with search / department beyond that. */
  renderLimit?: number;
};

/**
 * @deprecated 8.1：改用 `OrgPicker`（部门树 | 成员 | 已选三栏，`selectable={["person"]}` 只选人、`max` 最多 N 个），
 * 数据走 `OrgDataSource`（按部门分页取成员、服务端搜索）。下个大版本删除。
 */
export function UserTransfer({ orgTree, users, value, onChange, label = "选择成员", max, disabled = false, loading = false, renderLimit = 200 }: UserTransferProps) {
  const index = useMemo(() => (orgTree ? indexTree(orgTree) : null), [orgTree]);
  const [dept, setDept] = useState<string[]>([]);
  const [withSub, setWithSub] = useState(true);
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const picked = useMemo(() => new Set(value), [value]);
  const deptSet = useMemo(() => {
    const d = dept[0];
    if (!d || !index) return null;
    return new Set(withSub ? [d, ...descendants(index, d)] : [d]);
  }, [dept, withSub, index]);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const candidates = users.filter((u) => {
    if (deptSet && !u.deptIds.some((d) => deptSet.has(d))) return false;
    if (!words.length) return true;
    const hay = `${u.name} ${u.hint ?? ""} ${u.id}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const shown = candidates.slice(0, renderLimit);
  const full = max !== undefined && value.length >= max;
  const deptLabel = (u: AccessUser) => (index && u.deptIds[0] && index.byId.has(u.deptIds[0]) ? fullPath(index, u.deptIds[0]) : (u.hint ?? ""));
  const add = (ids: string[]) => {
    const next = [...value];
    for (const id of ids) if (!picked.has(id) && (max === undefined || next.length < max)) next.push(id);
    onChange(next);
  };
  const selectableShown = shown.filter((u) => !u.disabled);
  const allShownPicked = selectableShown.length > 0 && selectableShown.every((u) => picked.has(u.id));
  return (
    <div className="aui-access-transfer" role="group" aria-label={label} data-flat={!orgTree || undefined}>
      {orgTree && (
        <section className="aui-access-transfer-col" aria-label="按部门筛选">
          <header className="aui-access-transfer-head">
            <strong>部门</strong>
            <label className="aui-access-toggle">
              <Switch checked={withSub} onCheckedChange={setWithSub} aria-label="包含下级部门" />
              <span>含下级</span>
            </label>
          </header>
          <div className="aui-access-transfer-all">
            <Button size="sm" variant={dept.length ? "ghost" : "secondary"} aria-pressed={!dept.length} onClick={() => setDept([])}>全部成员</Button>
          </div>
          <CheckableTree label="部门" nodes={orgTree} mode="single" value={dept} onValueChange={setDept} toolbar={false} maxHeight={280} />
        </section>
      )}
      <section className="aui-access-transfer-col" aria-label="候选成员">
        <header className="aui-access-transfer-head">
          <strong>候选{deptSet && index ? `：${index.byId.get(dept[0]!)?.node.label ?? ""}` : ""}</strong>
          <span className="aui-note">{candidates.length} 人</span>
        </header>
        <label className="aui-access-search">
          <Search size={15} aria-hidden="true" />
          <Input type="search" clearable value={query} placeholder="搜索姓名、账号" aria-label="搜索成员" onChange={(e) => setQuery(e.target.value)} onKeyDown={stopEnter} />
        </label>
        <div className="aui-access-transfer-bar">
          <label className="aui-access-toggle">
            <Checkbox
              checked={allShownPicked}
              disabled={disabled || !selectableShown.length || (full && !allShownPicked)}
              aria-label="选中当前列表全部"
              onCheckedChange={(c) => (c === true ? add(selectableShown.map((u) => u.id)) : onChange(value.filter((v) => !selectableShown.some((u) => u.id === v))))}
            />
            <span>当前列表全选</span>
          </label>
          {max !== undefined && <span className="aui-note">最多 {max} 人</span>}
        </div>
        <ul className="aui-access-transfer-list" aria-busy={loading || undefined}>
          {loading && <li className="aui-note aui-access-empty">正在加载…</li>}
          {!loading && shown.length === 0 && <li className="aui-note aui-access-empty">{words.length || deptSet ? "没有匹配的成员" : "没有成员"}</li>}
          {!loading &&
            shown.map((u) => (
              <li key={u.id}>
                <label className="aui-access-person" data-disabled={u.disabled || undefined}>
                  <Checkbox
                    checked={picked.has(u.id)}
                    disabled={disabled || u.disabled || (full && !picked.has(u.id))}
                    aria-label={`${u.name}${u.hint ? `（${u.hint}）` : ""}`}
                    onCheckedChange={(c) => (c === true ? add([u.id]) : onChange(value.filter((v) => v !== u.id)))}
                  />
                  <span className="aui-access-person-text">
                    <span>{u.name}</span>
                    <span className="aui-note">{deptLabel(u)}</span>
                  </span>
                </label>
              </li>
            ))}
          {!loading && candidates.length > shown.length && (
            <li className="aui-note aui-access-empty">还有 {candidates.length - shown.length} 人没显示，请搜索或选部门缩小范围</li>
          )}
        </ul>
      </section>
      <section className="aui-access-transfer-col" aria-label="已选成员">
        <header className="aui-access-transfer-head">
          <strong>已选</strong>
          <span className="aui-note" aria-live="polite">{value.length}{max !== undefined ? ` / ${max}` : ""} 人</span>
          {value.length > 0 && !disabled && <Button size="sm" variant="ghost" onClick={() => onChange([])}>清空</Button>}
        </header>
        <ul className="aui-access-transfer-list">
          {value.length === 0 && <li className="aui-note aui-access-empty">从左边勾选成员</li>}
          {value.map((id) => {
            const u = byId.get(id);
            return (
              <li key={id} className="aui-access-picked">
                <span className="aui-access-person-text">
                  <span>{u?.name ?? id}</span>
                  <span className="aui-note">{u ? deptLabel(u) : "不在当前候选列表"}</span>
                </span>
                {!disabled && (
                  <IconButton label={`移除 ${u?.name ?? id}`} onClick={() => onChange(value.filter((v) => v !== id))} icon={<X size={14} />} />
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
