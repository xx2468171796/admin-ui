"use client";
/**
 * DataScopeSelect — 一个「能看到的数据」下拉：本人 / 本人及下属 / 本部门 / 部门及下级 / 全部，
 * 给了部门树时多一项「指定部门…」（打开 DataScopeDialog 勾部门）。不能选的档灰掉并写原因；
 * `disabled` 给字符串 = 整个不能改的原因（悬停可见）。ModulePermissionEditor 的范围格子和细调里都用它。
 */
import { useState } from "react";
import { Choice } from "../primitives.tsx";
import { SCOPE_TIER_LABEL, SCOPE_TIER_ORDER, type AccessDimension, type DataScope, type OrgNode, type ScopeTier } from "./contracts.ts";
import { DataScopeDialog } from "./data-scope-dialog.tsx";
import { describeScope } from "./matrix-core.ts";
import { indexTree } from "./tree-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type DataScopeSelectProps = {
  /** 当前范围；null = 还没选（显示第一项可选的）。 */
  value: DataScope | null;
  onChange: (next: DataScope) => void;
  /** 读屏名字，例「多维表格 能看到的数据」。 */
  label: string;
  /** 给哪些档（默认五档；有部门树时再加「指定部门」）。 */
  tiers?: readonly ScopeTier[];
  /** 显示但不能选的档 + 原因。 */
  disabledTiers?: Partial<Record<ScopeTier, string>>;
  /** 部门树：给了才有「指定部门…」。 */
  orgTree?: readonly OrgNode[];
  /** 档位显示名（例：本人 / 部门及下级）。 */
  labels?: Partial<Record<ScopeTier, string>>;
  /** true 或原因：不能改。 */
  disabled?: boolean | string;
  /** 改过、还没保存（主色浅底）。 */
  changed?: boolean;
  size?: "sm" | "md";
  /** 指定部门对话框的标题行（「销售主管 · 多维表格」）。 */
  subject?: string;
  dimensions?: readonly AccessDimension[];
};

export function DataScopeSelect({ value, onChange, label, tiers, disabledTiers = {}, orgTree, labels = {}, disabled, changed, size = "md", subject, dimensions }: DataScopeSelectProps) {
  const [dialog, setDialog] = useState(false);
  const offered: readonly ScopeTier[] = (tiers ?? (orgTree ? [...SCOPE_TIER_ORDER, "custom"] : SCOPE_TIER_ORDER)).filter((t) => t !== "custom" || !!orgTree);
  const index = orgTree ? indexTree(orgTree) : null;
  const deptName = (id: string) => index?.byId.get(id)?.node.label ?? id;
  const name = (t: ScopeTier) => labels[t] ?? SCOPE_TIER_LABEL[t];
  const current = value?.tier ?? offered.find((t) => !disabledTiers[t]) ?? offered[0] ?? "own";
  const customText = value?.tier === "custom" ? describeScope(value, deptName) : "指定部门…";
  const reason = typeof disabled === "string" ? disabled : undefined;
  return (
    <span className="aui-am-scope" data-size={size} data-changed={changed || undefined} data-tip={reason}>
      <Choice
        label={label}
        value={current}
        disabled={!!disabled}
        options={offered.map((t) => ({
          value: t,
          label: t === "custom" ? customText : disabledTiers[t] ? `${name(t)}（${disabledTiers[t]}）` : name(t),
          disabled: !!disabledTiers[t],
        }))}
        onChange={(tier) => {
          if (tier === "custom") setDialog(true);
          else onChange({ ...(value ?? {}), tier: tier as ScopeTier, deptIds: undefined });
        }}
      />
      {orgTree && (
        <DataScopeDialog
          open={dialog}
          onClose={() => setDialog(false)}
          value={value?.tier === "custom" ? value : { tier: "custom", deptIds: [] }}
          tiers={["custom"]}
          orgTree={orgTree}
          subject={subject}
          allowUnassigned={false}
          dimensions={dimensions}
          onSubmit={(scope) => {
            onChange(scope);
            setDialog(false);
          }}
        />
      )}
    </span>
  );
}
