"use client";
/**
 * PermissionMatrix — resource × action grid (Logto / Strapi / NocoBase role page). Each granted scoped
 * cell has a data-scope tier select (+ 指定部门 / 包含无部门 via DataScopeDialog); each resource can
 * expand its field rows (读 / 写 / 导出 / 脱敏). Resources group under collapsible headers; read-only mode;
 * cells that differ from `savedValue` are highlighted and counted, with「撤销改动」.
 * Controlled and presentational: the host owns value / savedValue and saves through its own API.
 */
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronRight, Search, Settings2, Undo2 } from "lucide-react";
import { Button, Checkbox, Choice, Input, StatusBadge } from "../primitives.tsx";
import {
  FIELD_ABILITY_LABEL,
  SCOPE_TIER_LABEL,
  SCOPE_TIER_ORDER,
  type AccessDimension,
  type DataScope,
  type FieldAbility,
  type MatrixAction,
  type MatrixResource,
  type OrgNode,
  type PermissionMatrixValue,
  type ScopeTier,
} from "./contracts.ts";
import {
  cellKey,
  describeScope,
  diffMatrix,
  fieldKey,
  fieldPolicyOf,
  rowState,
  sameScope,
  setCell,
  toggleFieldAbility,
  toggleRows,
} from "./matrix-core.ts";
import { DataScopeDialog } from "./data-scope-dialog.tsx";
import { fullPath, indexTree } from "./tree-core.ts";
import { IconButton } from "../buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type PermissionMatrixProps = {
  resources: readonly MatrixResource[];
  actions: readonly MatrixAction[];
  value: PermissionMatrixValue;
  onChange?: (value: PermissionMatrixValue) => void;
  /** Last saved value: differences are highlighted and「撤销改动」restores it. */
  savedValue?: PermissionMatrixValue;
  readOnly?: boolean;
  /** Department tree: enables「指定部门」in scope selects. */
  orgTree?: readonly OrgNode[];
  /** Tiers that cannot be granted, with the reason (delegation ceiling). */
  disabledTiers?: Partial<Record<ScopeTier, string>>;
  /** Accessible table caption, e.g.「销售经理的功能权限」. */
  caption: string;
  /** Filter resources by name (default true). */
  searchable?: boolean;
  /** Host buttons on the right of the toolbar (保存 …). */
  toolbar?: ReactNode;
  /** Groups collapsed initially. */
  defaultCollapsed?: readonly string[];
  /** Dimensions with their values (quanxian 2.2): scope dialogs offer the ones a resource carries (`MatrixResource.dims`). */
  dimensions?: readonly AccessDimension[];
};

const ABILITIES: readonly FieldAbility[] = ["read", "write", "export", "mask"];
const NO_GROUP = "";

export function PermissionMatrix({
  resources,
  actions,
  value,
  onChange,
  savedValue,
  readOnly = false,
  orgTree,
  disabledTiers = {},
  caption,
  searchable = true,
  toolbar,
  defaultCollapsed = [],
  dimensions = [],
}: PermissionMatrixProps) {
  const dimNames = useMemo(() => ({ dim: (id: string) => dimensions.find((d) => d.id === id)?.label ?? id, value: (dim: string, id: string) => dimensions.find((d) => d.id === dim)?.values.find((v) => v.id === id)?.name ?? id }), [dimensions]);
  const dimsOf = (r: MatrixResource) => dimensions.filter((d) => r.dims?.includes(d.id));
  const editable = !readOnly && !!onChange;
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(defaultCollapsed));
  const [openFields, setOpenFields] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ resource: MatrixResource; action: MatrixAction; scope: DataScope | null } | null>(null);
  const orgIndex = useMemo(() => (orgTree ? indexTree(orgTree) : null), [orgTree]);
  // Cells are narrow: show department names, keep full paths for the hover title.
  const deptName = (id: string) => orgIndex?.byId.get(id)?.node.label ?? id;
  const deptPath = (id: string) => (orgIndex ? fullPath(orgIndex, id) : id);
  const changes = useMemo(() => (savedValue ? diffMatrix(savedValue, value, resources, actions) : []), [savedValue, value, resources, actions]);
  const changed = useMemo(() => new Set(changes.map((c) => c.key)), [changes]);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = resources.filter((r) => {
    if (!words.length) return true;
    const hay = `${r.label} ${r.id} ${r.group ?? ""} ${r.description ?? ""} ${(r.fields ?? []).map((f) => f.label).join(" ")}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const groups = useMemo(() => {
    const map = new Map<string, MatrixResource[]>();
    for (const r of shown) {
      const g = r.group ?? NO_GROUP;
      map.set(g, [...(map.get(g) ?? []), r]);
    }
    return [...map];
  }, [shown]);
  const actionById = useMemo(() => new Map(actions.map((a) => [a.id, a])), [actions]);
  const tiersFor = (action: MatrixAction): ScopeTier[] => {
    const base = action.tiers ?? [...SCOPE_TIER_ORDER, ...(orgTree ? (["custom"] as const) : [])];
    return base.filter((t) => t !== "custom" || !!orgTree);
  };
  const change = (next: PermissionMatrixValue) => editable && onChange!(next);
  const savedCell = (key: string) => savedValue?.grants[key];
  const previous = (cell: { scope?: DataScope } | undefined) => (!cell ? "未授予" : cell.scope ? describeScope(cell.scope, deptName, dimNames) : "已授予");
  const colCount = actions.length + 1;

  const toggleGroup = (g: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  const toggleFields = (id: string) =>
    setOpenFields((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderCell = (r: MatrixResource, action: MatrixAction) => {
    const key = cellKey(r.id, action.id);
    if (!r.actions.includes(action.id))
      return (
        <td key={action.id} className="aui-access-na">
          <span aria-hidden="true">—</span>
          <span className="aui-sr-only">{`${r.label}没有「${action.label}」`}</span>
        </td>
      );
    const cell = value.grants[key];
    const isChanged = changed.has(key);
    const scope = cell?.scope;
    const tiers = tiersFor(action);
    return (
      <td key={action.id} data-changed={isChanged || undefined} data-granted={cell ? true : undefined}>
        <div className="aui-access-cell">
          {editable ? (
            <Checkbox checked={!!cell} aria-label={`${r.label} · ${action.label}`} onCheckedChange={(c) => change(setCell(value, r.id, action, c === true))} />
          ) : cell ? (
            <span className="aui-access-granted"><Check size={15} aria-hidden="true" /><span className="aui-sr-only">已授予</span></span>
          ) : (
            <span className="aui-access-denied" aria-label="未授予">—</span>
          )}
          {action.scoped && cell && (
            editable ? (
              <span className="aui-access-scope">
                <Choice
                  label={`${r.label} · ${action.label} 的数据范围`}
                  value={scope?.tier ?? tiers[0] ?? "own"}
                  options={tiers.map((t) => ({ value: t, label: t === "custom" ? "指定部门…" : SCOPE_TIER_LABEL[t], disabled: !!disabledTiers[t] }))}
                  onChange={(tier) => {
                    const next = tier as ScopeTier;
                    if (next === "custom") setDialog({ resource: r, action, scope: { ...scope, tier: "custom", deptIds: scope?.tier === "custom" ? scope.deptIds : [] } });
                    else change(setCell(value, r.id, action, true, { ...scope, tier: next }));
                  }}
                />
                <IconButton label={`${r.label} · ${action.label}：更多范围设置（${describeScope(scope, deptName, dimNames)}）`} tooltip={describeScope(scope, deptPath, dimNames)} className="aui-access-scope-more" onClick={() => setDialog({ resource: r, action, scope: scope ?? null })} icon={<Settings2 size={15} />} />
              </span>
            ) : (
              <span className="aui-access-scope-text" data-tip={describeScope(scope, deptPath, dimNames)}>{describeScope(scope, deptName, dimNames)}</span>
            )
          )}
          {action.scoped && cell && (scope?.tier === "custom" || scope?.includeUnassigned || (scope?.dims && Object.keys(scope.dims).length > 0)) && editable && (
            <span className="aui-access-scope-extra aui-note" data-tip={describeScope(scope, deptPath, dimNames)}>{describeScope(scope, deptName, dimNames)}</span>
          )}
          {isChanged && <span className="aui-access-dot" aria-hidden="true" data-tip={`原来：${previous(savedCell(key))}`} />}
          {isChanged && <span className="aui-sr-only">（已修改）</span>}
        </div>
      </td>
    );
  };

  const renderFields = (r: MatrixResource) => (
    <tr className="aui-access-field-row">
      <td colSpan={colCount}>
        {/* admin-ui-audit-ignore raw-control: SDK 内部——PermissionMatrix 组件自己的字段行（嵌在矩阵的一行里，读 / 写 / 导出 / 脱敏勾选） */}
        <table className="aui-access-fields">
          <caption className="aui-sr-only">{`${r.label}的字段权限`}</caption>
          <thead>
            <tr>
              <th scope="col">字段</th>
              {ABILITIES.map((a) => <th key={a} scope="col">{FIELD_ABILITY_LABEL[a]}</th>)}
            </tr>
          </thead>
          <tbody>
            {(r.fields ?? []).map((f) => {
              const policy = fieldPolicyOf(value, r, f.id);
              const key = fieldKey(r.id, f.id);
              const isChanged = changed.has(key);
              return (
                <tr key={f.id} data-changed={isChanged || undefined}>
                  <th scope="row">
                    {f.label}
                    {f.sensitive && <> <StatusBadge tone="warning">敏感</StatusBadge></>}
                    {isChanged && <span className="aui-sr-only">（已修改）</span>}
                  </th>
                  {ABILITIES.map((a) => (
                    <td key={a}>
                      {editable ? (
                        <Checkbox
                          checked={policy[a]}
                          aria-label={`${r.label} · ${f.label} · ${FIELD_ABILITY_LABEL[a]}`}
                          onCheckedChange={() => change({ ...value, fields: { ...value.fields, [key]: toggleFieldAbility(policy, a) } })}
                        />
                      ) : policy[a] ? (
                        <span className="aui-access-granted"><Check size={15} aria-hidden="true" /><span className="aui-sr-only">是</span></span>
                      ) : (
                        <span className="aui-access-denied" aria-label="否">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="aui-note aui-access-field-note">写、导出、脱敏都要先能读；脱敏 = 能看到但显示为掩码，导出也是掩码。</p>
      </td>
    </tr>
  );

  return (
    <div className="aui-access-matrix">
      <div className="aui-access-matrix-toolbar">
        {searchable && (
          <label className="aui-access-search">
            <Search size={15} aria-hidden="true" />
            <Input type="search" clearable value={query} placeholder="搜索资源或字段" aria-label="搜索资源" onChange={(e) => setQuery(e.target.value)} />
          </label>
        )}
        {readOnly && <StatusBadge>只读</StatusBadge>}
        {savedValue && (
          <span className="aui-access-change-count" aria-live="polite">
            {changes.length ? <StatusBadge tone="warning">{`已修改 ${changes.length} 处，未保存`}</StatusBadge> : <span className="aui-note">没有未保存的改动</span>}
          </span>
        )}
        {savedValue && editable && changes.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => onChange!(savedValue)}>
            <Undo2 size={14} aria-hidden="true" />
            撤销改动
          </Button>
        )}
        {toolbar && <div className="aui-access-matrix-actions">{toolbar}</div>}
      </div>
      <div className="aui-access-matrix-scroll">
        {/* admin-ui-audit-ignore raw-control: SDK 内部——PermissionMatrix 组件本身就是这张矩阵（分组折叠、行列三态全选、格子里的范围选择），宿主用的是 PermissionMatrix */}
        <table className="aui-access-matrix-table">
          <caption className="aui-sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="aui-access-resource-col">资源</th>
              {actions.map((a) => (
                <th key={a.id} scope="col">
                  {a.label}
                  {a.scoped && <span className="aui-access-col-hint aui-note">含范围</span>}
                </th>
              ))}
            </tr>
          </thead>
          {groups.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={colCount} className="aui-access-empty aui-note">
                  {query ? <>没有匹配的资源 <Button size="sm" variant="outline" onClick={() => setQuery("")}>清除搜索</Button></> : "没有资源"}
                </td>
              </tr>
            </tbody>
          )}
          {groups.map(([group, list]) => {
            const isCollapsed = collapsed.has(group) && !words.length;
            const groupState = list.every((r) => rowState(value, r) === "checked") ? "checked" : list.every((r) => rowState(value, r) === "unchecked") ? "unchecked" : "indeterminate";
            const groupChanged = list.some((r) => r.actions.some((a) => changed.has(cellKey(r.id, a))) || (r.fields ?? []).some((f) => changed.has(fieldKey(r.id, f.id))));
            return (
              <tbody key={group || "__none"}>
                {group !== NO_GROUP && (
                  <tr className="aui-access-group-row">
                    <th scope="rowgroup" colSpan={colCount}>
                      <div className="aui-access-group-head">
                        <IconButton label={`${isCollapsed ? "展开" : "收起"}分组「${group}」`} aria-expanded={!isCollapsed} onClick={() => toggleGroup(group)} icon={<ChevronRight size={15} className="aui-access-chevron" data-open={!isCollapsed || undefined} />} />
                        {editable && (
                          <Checkbox
                            checked={groupState === "indeterminate" ? "indeterminate" : groupState === "checked"}
                            aria-label={`分组「${group}」全部动作`}
                            onCheckedChange={() => change(toggleRows(value, list, actions))}
                          />
                        )}
                        <span className="aui-access-group-name">{group}</span>
                        <span className="aui-note">{list.length} 个资源</span>
                        {groupChanged && <StatusBadge tone="warning">有改动</StatusBadge>}
                      </div>
                    </th>
                  </tr>
                )}
                {!isCollapsed &&
                  list.map((r) => {
                    const state = rowState(value, r);
                    const fieldsOpen = openFields.has(r.id);
                    const rowChanged = r.actions.some((a) => changed.has(cellKey(r.id, a)));
                    return (
                      <Fragment key={r.id}>
                        <tr data-changed={rowChanged || undefined}>
                          <th scope="row" className="aui-access-resource-col">
                            <div className="aui-access-resource">
                              {editable && (
                                <Checkbox
                                  checked={state === "indeterminate" ? "indeterminate" : state === "checked"}
                                  aria-label={`${r.label}：全部动作`}
                                  onCheckedChange={() => change(toggleRows(value, [r], actions))}
                                />
                              )}
                              <span className="aui-access-resource-text">
                                <span className="aui-access-resource-name">{r.label}</span>
                                {r.description && <span className="aui-note">{r.description}</span>}
                              </span>
                              {!!r.fields?.length && (
                                <Button size="sm" variant="ghost" aria-expanded={fieldsOpen} onClick={() => toggleFields(r.id)}>
                                  字段（{r.fields.length}）
                                  <ChevronRight size={14} className="aui-access-chevron" data-open={fieldsOpen || undefined} aria-hidden="true" />
                                </Button>
                              )}
                            </div>
                          </th>
                          {actions.map((a) => renderCell(r, actionById.get(a.id)!))}
                        </tr>
                        {fieldsOpen && renderFields(r)}
                      </Fragment>
                    );
                  })}
              </tbody>
            );
          })}
        </table>
      </div>
      <DataScopeDialog
        open={dialog !== null}
        value={dialog?.scope ?? null}
        orgTree={orgTree}
        tiers={dialog ? tiersFor(dialog.action) : undefined}
        disabledTiers={disabledTiers}
        subject={dialog ? `${caption} · ${dialog.resource.label} · ${dialog.action.label}` : undefined}
        dimensions={dialog ? dimsOf(dialog.resource) : []}
        readOnly={!editable}
        onClose={() => setDialog(null)}
        onSubmit={(scope) => {
          if (!dialog) return;
          const current = value.grants[cellKey(dialog.resource.id, dialog.action.id)]?.scope;
          if (!sameScope(current, scope)) change(setCell(value, dialog.resource.id, dialog.action, true, scope));
          setDialog(null);
        }}
      />
    </div>
  );
}
