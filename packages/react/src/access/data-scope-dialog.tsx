"use client";
/**
 * DataScopeDialog — pick a data scope: 仅本人 / 本人及下属 / 本部门 / 本部门及以下 / 全部, or 指定部门
 * (CheckableTree with a linkage switch), plus「包含无部门的记录」. FormDialog semantics: onSubmit resolves
 * to close, rejects to keep the dialog with the message; unsaved changes ask before closing.
 * quanxian 2.2: when `dimensions` are given (业务线 …), each one adds a filter ANDed with the tier:
 * 不限 / 我的业务线 / 指定业务线 (+ 也包括没填的).
 */
import { useEffect, useId, useState } from "react";
import { Checkbox } from "../primitives.tsx";
import { ChipGroup, SegmentedControl } from "../choices.tsx";
import { FormDialog, FormField } from "../forms.tsx";
import { CheckableTree } from "./checkable-tree.tsx";
import { SCOPE_TIER_HINT, SCOPE_TIER_LABEL, SCOPE_TIER_ORDER, type AccessDimension, type DataScope, type DimFilter, type OrgNode, type ScopeTier } from "./contracts.ts";
import { normalizeScope, sameScope, validateScope } from "./matrix-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type DataScopeDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Current scope; null = start from the narrowest offered tier. */
  value: DataScope | null;
  /** Receives the normalized scope. Reject (throw) to keep the dialog open with the message. */
  onSubmit: (scope: DataScope) => void | Promise<void>;
  /** Department tree; required for「指定部门」. */
  orgTree?: readonly OrgNode[];
  /** Offered tiers (default the five + custom when orgTree is given). */
  tiers?: readonly ScopeTier[];
  /** Tiers shown but not selectable, with the reason (e.g. delegation:「不能宽于你自己的范围」). */
  disabledTiers?: Partial<Record<ScopeTier, string>>;
  title?: string;
  /** What the scope applies to, e.g.「销售经理 · 客户 · 查看」. */
  subject?: string;
  /** Show「包含无部门的记录」(default true). */
  allowUnassigned?: boolean;
  readOnly?: boolean;
  /** Dimensions the records carry (quanxian 2.2): each adds a filter 不限 / 我的 / 指定值, ANDed with the tier. */
  dimensions?: readonly AccessDimension[];
};

type DimMode = "any" | "mine" | "values";
const modeOf = (f: DimFilter | undefined): DimMode => (!f ? "any" : f.mine ? "mine" : "values");

/** One dimension filter: 不限 / 我的业务线 / 指定业务线 (+ chips) and「也包括没填的」. */
function DimFilterField({ dim, value, onChange, readOnly }: { dim: AccessDimension; value: DimFilter | undefined; onChange: (next: DimFilter | undefined) => void; readOnly: boolean }) {
  const id = useId();
  const mode = modeOf(value);
  return (
    <FormField label={dim.label} htmlFor={id} hint={`和上面的范围同时满足；没填${dim.label}的记录不算，除非勾选下面一项`}>
      <div id={id} className="aui-access-stack" data-aui-flow="stack">
        <SegmentedControl
          label={`${dim.label}过滤`}
          size="sm"
          disabled={readOnly}
          value={mode}
          options={[
            { value: "any", label: "不限" },
            { value: "mine", label: `我的${dim.label}` },
            { value: "values", label: `指定${dim.label}` },
          ]}
          onValueChange={(m) => onChange(m === "any" ? undefined : m === "mine" ? { mine: true, ...(value?.includeNull ? { includeNull: true } : {}) } : { values: value?.values ?? [], ...(value?.includeNull ? { includeNull: true } : {}) })}
        />
        {mode === "values" && (
          <ChipGroup
            label={`指定的${dim.label}`}
            disabled={readOnly}
            value={[...(value?.values ?? [])]}
            options={dim.values.map((v) => ({ value: v.id, label: v.name, disabled: v.disabled }))}
            onValueChange={(values) => onChange({ ...value, values })}
          />
        )}
        {mode !== "any" && (
          <label className="aui-access-toggle">
            <Checkbox checked={!!value?.includeNull} disabled={readOnly} aria-label={`也包括没填${dim.label}的记录`} onCheckedChange={(c) => onChange({ ...value, includeNull: c === true })} />
            <span>也包括没填{dim.label}的记录</span>
          </label>
        )}
      </div>
    </FormField>
  );
}

export function DataScopeDialog({
  open,
  onClose,
  value,
  onSubmit,
  orgTree,
  tiers,
  disabledTiers = {},
  title = "数据范围",
  subject,
  allowUnassigned = true,
  readOnly = false,
  dimensions = [],
}: DataScopeDialogProps) {
  const offered: readonly ScopeTier[] = tiers ?? (orgTree ? [...SCOPE_TIER_ORDER, "custom"] : SCOPE_TIER_ORDER);
  const initial = (): DataScope => value ?? { tier: offered.find((t) => !disabledTiers[t]) ?? offered[0] ?? "own" };
  const [draft, setDraft] = useState<DataScope>(initial);
  const [linked, setLinked] = useState(true);
  const name = useId();
  useEffect(() => {
    if (open) setDraft(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const dirty = !sameScope(draft, value ?? initial());
  return (
    <FormDialog
      open={open}
      title={title}
      description={subject ? `设置「${subject}」能看到哪些记录。保存后以服务端返回为准。` : "设置能看到哪些记录。保存后以服务端返回为准。"}
      dirty={!readOnly && dirty}
      size={draft.tier === "custom" ? "lg" : "md"}
      submitLabel={readOnly ? "关闭" : "确定"}
      onClose={onClose}
      onSubmit={async () => {
        if (readOnly) return;
        const problem = validateScope(draft);
        if (problem) throw new Error(problem);
        if (disabledTiers[draft.tier]) throw new Error(disabledTiers[draft.tier]);
        await onSubmit(normalizeScope(draft));
      }}
    >
      <fieldset className="aui-access-tiers" disabled={readOnly}>
        <legend className="aui-sr-only">范围档位</legend>
        {offered.map((tier) => {
          const reason = disabledTiers[tier];
          return (
            <label key={tier} className="aui-access-tier" data-checked={draft.tier === tier || undefined} data-disabled={reason ? true : undefined}>
              {/* admin-ui-audit-ignore raw-control: SDK 内部——DataScopeDialog 组件自己的范围档单选（每档带说明 / 不可选原因，fieldset + legend 读屏） */}
              <input
                type="radio"
                name={name}
                value={tier}
                checked={draft.tier === tier}
                disabled={!!reason}
                onChange={() => setDraft((d) => ({ ...d, tier, deptIds: tier === "custom" ? (d.deptIds ?? []) : d.deptIds }))}
              />
              <span className="aui-access-tier-text">
                <strong>{SCOPE_TIER_LABEL[tier]}</strong>
                <span className="aui-note">{reason ?? SCOPE_TIER_HINT[tier]}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      {draft.tier === "custom" && (
        <div className="aui-access-scope-depts">
          {orgTree ? (
            <CheckableTree
              label="部门"
              nodes={orgTree}
              value={draft.deptIds ?? []}
              linked={linked}
              onLinkedChange={setLinked}
              readOnly={readOnly}
              maxHeight={300}
              onValueChange={(deptIds) => setDraft((d) => ({ ...d, deptIds }))}
            />
          ) : (
            <p className="aui-note">没有提供部门树，不能选择指定部门。</p>
          )}
        </div>
      )}
      {allowUnassigned && draft.tier !== "all" && (
        <label className="aui-access-toggle aui-access-unassigned">
          <Checkbox
            checked={!!draft.includeUnassigned}
            disabled={readOnly}
            aria-label="同时包含没有部门或负责人的记录"
            onCheckedChange={(c) => setDraft((d) => ({ ...d, includeUnassigned: c === true }))}
          />
          <span>
            同时包含没有部门或负责人的记录
            <span className="aui-note">（公海客户、离职人员遗留的记录）</span>
          </span>
        </label>
      )}
      {dimensions.map((dim) => (
        <DimFilterField
          key={dim.id}
          dim={dim}
          readOnly={readOnly}
          value={draft.dims && Object.hasOwn(draft.dims, dim.id) ? draft.dims[dim.id] : undefined}
          onChange={(f) =>
            setDraft((d) => {
              const dims = { ...(d.dims ?? {}) };
              if (f) dims[dim.id] = f;
              else delete dims[dim.id];
              return { ...d, dims };
            })
          }
        />
      ))}
    </FormDialog>
  );
}
