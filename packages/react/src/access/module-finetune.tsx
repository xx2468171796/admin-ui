"use client";
/**
 * 一个模块的「细调」（ModulePermissionEditor 内部用）：档位自带几项 + 恢复成档位默认 → 待确认的高危权限
 * （给 / 不给）→ 每个对象一行（操作勾选胶囊、范围或「— 不分范围」/「「管理员」档才有」）→ 字段 隐藏 / 只读 / 可编辑
 * → 图例。`variant="sheet"` 是手机全屏面板里的样子：档位框在最上面，每个对象一张卡，每个操作一行、勾在右边。
 */
import { KeyRound, RotateCcw, Settings2, TriangleAlert } from "lucide-react";
import { Button, Checkbox } from "../primitives.tsx";
import { SegmentedControl } from "../choices.tsx";
import { IconBlock } from "../kit.tsx";
import { InlineAlert } from "../layout.tsx";
import type { OrgNode, ScopeTier } from "./contracts.ts";
import { DataScopeSelect } from "./data-scope-select.tsx";
import { ModuleLevelSelect } from "./module-level-select.tsx";
import {
  FIELD_MODE_LABEL,
  actionOf,
  actionState,
  effectiveScope,
  fieldCounts,
  fieldModeOf,
  levelActions,
  levelHint,
  levelLabel,
  resetToLevel,
  resolvePending,
  scopeMode,
  scopeText,
  setFieldMode,
  setLevel,
  setScope,
  toggleAction,
  type FieldMode,
  type ModuleAccessDef,
  type ModuleAction,
  type ModuleGrant,
  type ModuleResource,
} from "./module-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type ModuleFineTuneProps = {
  def: ModuleAccessDef;
  grant: ModuleGrant;
  saved?: ModuleGrant;
  /** 不给 = 只读（「查看」）。 */
  onChange?: (next: ModuleGrant) => void;
  /** 待确认的决定（另外通知宿主，例如走单独的确认接口）；值的变化照样走 onChange。 */
  onResolvePending?: (key: string, give: boolean) => void;
  variant?: "inline" | "sheet";
  scopeLabels?: Partial<Record<ScopeTier, string>>;
  orgTree?: readonly OrgNode[];
};

const MODES: readonly FieldMode[] = ["hidden", "read", "write"];

function ActionItem({ def, grant, resource, action, editable, onToggle }: { def: ModuleAccessDef; grant: ModuleGrant; resource: ModuleResource; action: ModuleAction; editable: boolean; onToggle: (on: boolean) => void }) {
  const state = actionState(def, grant, action);
  const disabled = !editable || (!!state.locked && !state.checked);
  return (
    <label className="aui-am-ac" data-origin={state.origin} data-locked={state.locked && !state.checked ? true : undefined} data-risk={action.risk === "high" || undefined} data-tip={state.locked && !state.checked ? state.locked : undefined}>
      <Checkbox checked={state.checked} disabled={disabled} aria-label={`${resource.label} · ${action.label}`} onCheckedChange={(c) => onToggle(c === true)} />
      <span className="aui-am-ac-text">
        <span className="aui-am-ac-name">
          {state.origin === "muted" ? <s>{action.label}</s> : action.label}
          {state.origin === "added" && <i className="aui-am-tag" data-tone="brand">加</i>}
          {state.origin === "pending" && <i className="aui-am-tag" data-tone="attention">待确认</i>}
        </span>
        {action.risk === "high" && (
          <span className="aui-am-risk">
            <TriangleAlert aria-hidden="true" />
            {action.stepUp ? "高危 · 需二次验证" : "高危"}
          </span>
        )}
        {state.origin === "muted" && <em className="aui-am-ac-note">已手动去掉 · 升级也不会加回</em>}
      </span>
      {state.locked && !state.checked && <KeyRound className="aui-am-ac-lock" aria-hidden="true" />}
    </label>
  );
}

export function ModuleFineTune({ def, grant, saved, onChange, onResolvePending, variant = "inline", scopeLabels, orgTree }: ModuleFineTuneProps) {
  const editable = !!onChange;
  const change = (next: ModuleGrant) => onChange?.(next);
  const mode = scopeMode(def, grant);
  const scope = effectiveScope(def, grant);
  const inLevel = levelActions(def, grant.level);
  const sheet = variant === "sheet";
  const scopeCell = (r: ModuleResource) => {
    const states = r.actions.map((a) => actionState(def, grant, a));
    if (states.length && states.every((s) => s.locked && !s.checked))
      return (
        <span className="aui-am-na">
          <KeyRound aria-hidden="true" />
          {states[0]!.locked}
        </span>
      );
    if (!r.actions.length) return r.fieldsNote ? <span className="aui-am-na">{r.fieldsNote}</span> : null;
    if (!r.scoped || mode === "none") return sheet ? null : <span className="aui-am-na">— 不分范围</span>;
    if (mode === "note") return <span className="aui-am-na">{def.scopeNote}</span>;
    if (mode === "fixed" || !editable) return <span className="aui-am-na">{scopeText(scope, { scope: scopeLabels })}</span>;
    return (
      <DataScopeSelect
        size="sm"
        label={`${def.label} · ${r.label} 的数据范围`}
        value={scope ? { tier: scope, ...(grant.deptIds ? { deptIds: grant.deptIds } : {}) } : null}
        tiers={def.tiers}
        disabledTiers={def.disabledTiers}
        orgTree={orgTree}
        labels={scopeLabels}
        subject={def.label}
        onChange={(s) => change(setScope(grant, s.tier, s.deptIds))}
      />
    );
  };
  const fieldsBlock = (r: ModuleResource) => {
    if (!r.fields?.length) return null;
    return (
      <div className="aui-am-fields" role="group" aria-label={`${r.label}：字段权限`}>
        {r.fields.map((f) => {
          const m = fieldModeOf(grant.fields?.[f.id], f.defaultMode);
          const changed = !!saved && fieldModeOf(saved.fields?.[f.id], f.defaultMode) !== m;
          return (
            <div key={f.id} className="aui-am-fr" data-mode={m} data-changed={changed || undefined}>
              <span className="aui-am-fn">
                {f.icon}
                <span>{f.label}</span>
                {changed && <span className="aui-am-dot" data-tip="改过，还没保存" />}
              </span>
              <SegmentedControl
                size="sm"
                label={`${f.label}：字段权限`}
                value={m}
                disabled={!editable || grant.level === "none"}
                options={MODES.map((v) => ({ value: v, label: FIELD_MODE_LABEL[v] }))}
                onValueChange={(v) => change(setFieldMode(grant, f, v))}
              />
            </div>
          );
        })}
      </div>
    );
  };
  const pending = grant.pending ?? [];
  return (
    <div className="aui-am-ft" data-variant={variant}>
      {sheet && grant.level !== null && (
        <div className="aui-am-levelbox">
          <span className="aui-am-levelbox-label">档位</span>
          {editable ? (
            <ModuleLevelSelect touch def={def} value={grant.level} changed={!!saved && saved.level !== grant.level} onChange={(l) => change(setLevel(def, grant, l))} />
          ) : (
            <span className="aui-am-static">{levelLabel(def, grant.level)}</span>
          )}
          <small>{grant.level === "none" ? levelHint(def, "none") : `档位自带 ${inLevel.size} 项；下面改的会记成「加」或「去掉」，升级时保留。`}</small>
        </div>
      )}
      {!sheet && grant.level !== null && grant.level !== "none" && (
        <div className="aui-am-ft-bar">
          <Settings2 aria-hidden="true" />
          <span>
            档位 <b>{levelLabel(def, grant.level)}</b> 自带 {inLevel.size} 项 · 你加了 <b>{grant.add?.length ?? 0}</b> 项 · 去掉 <b>{grant.mute?.length ?? 0}</b> 项
          </span>
          {editable && (
            <Button size="sm" variant="ghost" className="aui-am-push" onClick={() => change(resetToLevel(grant))} disabled={!grant.add?.length && !grant.mute?.length && !Object.keys(grant.fields ?? {}).length}>
              <RotateCcw />
              恢复成档位默认
            </Button>
          )}
        </div>
      )}
      {pending.map((key) => (
        <div key={key} className="aui-am-pending">
          <InlineAlert
            tone="warning"
            title={`${sheet ? "新版本" : def.label}新增了高危权限「${actionOf(def, key)?.label ?? key}」`}
            action={
              editable ? (
                <span className="aui-am-pending-actions">
                  <Button size="sm" variant="outline" onClick={() => { change(resolvePending(def, grant, key, false)); onResolvePending?.(key, false); }}>
                    {sheet ? "不给" : "不给（记为去掉）"}
                  </Button>
                  <Button size="sm" onClick={() => { change(resolvePending(def, grant, key, true)); onResolvePending?.(key, true); }}>
                    给这个角色
                  </Button>
                </span>
              ) : undefined
            }
          >
            {`按规矩归「${levelLabel(def, grant.level)}」这一档，但没有自动给。`}
          </InlineAlert>
        </div>
      ))}
      {def.resources.map((r) => {
        const counts = fieldCounts(r, grant, saved);
        return (
          <section key={r.id} className="aui-am-ob" aria-label={r.label}>
            <div className="aui-am-ob-head">
              <span className="aui-am-ob-title">
              {r.icon && <IconBlock size="sm" tone={r.actions.length && r.actions.every((a) => a.minLevel === "admin") ? "attention" : "brand"}>{r.icon}</IconBlock>}
              <span className="aui-am-ob-name">
                <b>{r.label}</b>
                {(!!r.hint || (sheet && !!r.fields?.length)) && <small>{sheet && !!r.fields?.length && !r.actions.length ? `${counts.write} 可编辑 · ${counts.read} 只读 · ${counts.hidden} 隐藏` : r.hint}</small>}
              </span>
              </span>
              <span className="aui-am-ob-scope">{scopeCell(r)}</span>
            </div>
            {r.actions.length > 0 && (
              <div className="aui-am-acs">
                {r.actions.map((a) => (
                  <ActionItem key={a.key} def={def} grant={grant} resource={r} action={a} editable={editable && grant.level !== "none"} onToggle={(on) => change(toggleAction(def, grant, a.key, on))} />
                ))}
              </div>
            )}
            {!r.actions.length && !!r.fields?.length && !sheet ? (
              <div className="aui-am-acs aui-am-fcounts">
                <span className="aui-am-chip">{counts.write} 个可编辑</span>
                <span className="aui-am-chip">{counts.read} 个只读</span>
                <span className="aui-am-chip" data-kind="off">{counts.hidden} 个隐藏</span>
                {counts.changed > 0 && <span className="aui-am-chip" data-kind="add">改了 {counts.changed} 个</span>}
              </div>
            ) : null}
            {fieldsBlock(r)}
          </section>
        );
      })}
      {!sheet && (
        <div className="aui-am-ft-foot">
          <span><i className="aui-am-tag" data-tone="brand">加</i>手动加的</span>
          <span><s>去掉</s>手动去掉的（升级后不会被加回）</span>
          <span><i className="aui-am-tag" data-tone="attention">待确认</i>新版本带来的高危权限，不会自动给</span>
          <span className="aui-am-risk"><TriangleAlert aria-hidden="true" />高危：用的时候要再验证一次</span>
        </div>
      )}
    </div>
  );
}
