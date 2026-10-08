"use client";
/**
 * TableAccessPanel (bt/records P2, demo D13 「就地权限」): a table's permission page, role by role.
 * Left: roles with member counts and a dot for unsaved changes. Middle card: 记录范围 (six tiers, the
 * last 「按条件」 edits a condition through `renderCondition` — default the nested governance CondBuilder, compact),
 * 「交接后保留只读」, action chips (看 / 加 / 改 / 删 / 导出), the role's members (AvatarStack + 管理成员).
 * Right card: the field matrix 可读 / 可写 / 打码 / 可导出 with counts and row tags (始终可见 / owner text /
 * 对该角色隐藏 / 打码), filter 「全部 / 看不到的」. On top, once something changed: the impact banner
 * (governance RuleImpactView behind 「看每个人的变化」) with 「放弃改动」; toolbar 「以某人身份预览」 + 保存.
 * Presentational: the host loads the role, computes the impact on the server and saves.
 */
import { useId, useState, type ReactNode } from "react";
import { Eye, Filter, Info, Lock, Plus, Save, Shield, Users, EyeOff, Check } from "lucide-react";
import { Button, Checkbox } from "../primitives.tsx";
import { SegmentedControl } from "../choices.tsx";
import { HelpTip } from "../help-tip.tsx";
import { Count, IconBlock } from "../kit.tsx";
import { AvatarStack, type StackPerson } from "../avatar.tsx";
import type { FieldAbility, OrgNode } from "./contracts.ts";
import { DataScopeDialog } from "./data-scope-dialog.tsx";
import { CondBuilder, RuleImpactView } from "./governance/cond-builder.tsx";
import { emptyCondDraft, type CondDraft } from "./governance/cond-core.ts";
import { impactSummary } from "./governance/governance-core.ts";
import type { CondFieldDef, RuleImpactDto } from "./governance/contracts.ts";
import {
  TABLE_SCOPE_TIERS,
  canToggleField,
  hiddenTableFields,
  tableAccessChanges,
  tableFieldCounts,
  tableFieldPolicy,
  tableFieldTags,
  toggleTableField,
  type TableAccessField,
  type TableAccessValue,
  type TableScopeOption,
} from "./table-access-core.ts";
import { IconButton } from "../buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type TableAccessRole = { id: string; name: string; members: number; /** Shield icon (admins). */ admin?: boolean; /** Unsaved changes on another role (the selected one is computed). */ dirty?: boolean };

export type TableAccessPanelProps<C = CondDraft> = {
  roles: readonly TableAccessRole[];
  selectedRole: string;
  onSelectRole: (id: string) => void;
  onAddRole?: () => void;
  roleNote?: ReactNode;
  value: TableAccessValue<C>;
  /** Last saved value of the selected role: changes are counted and the role gets the dot. */
  savedValue?: TableAccessValue<C>;
  onChange: (next: TableAccessValue<C>) => void;
  /** Record noun for the headings (「客户」): 「技术 能看哪些客户」. */
  recordNoun?: string;
  tiers?: readonly TableScopeOption[];
  /** Condition editor of the 「按条件」 tier; default (bt/builders-a): the nested CondBuilder over `conditionFields`, compact like D13. */
  renderCondition?: (condition: C | undefined, onChange: (next: C) => void) => ReactNode;
  conditionFields?: readonly CondFieldDef[];
  /** 「交接后，参与过的人保留只读」 (false hides it). */
  keepAfterHandoverLabel?: string | false;
  /** Department tree for a `custom` tier (DataScopeDialog). */
  orgTree?: readonly OrgNode[];
  actions: readonly { id: string; label: string }[];
  actionsNote?: ReactNode;
  fields: readonly TableAccessField[];
  fieldIcon?: (field: TableAccessField) => ReactNode;
  /** Note under the field matrix (what 打码 means). */
  maskNote?: ReactNode;
  members?: readonly StackPerson[];
  membersText?: ReactNode;
  onManageMembers?: () => void;
  /** Server-computed effect of the draft (who sees more / fewer records). */
  impact?: RuleImpactDto | null;
  /** The draft changed after `impact` was computed. */
  impactStale?: boolean;
  /** 「技术部 6 人，」 before the summary. */
  impactLead?: string;
  onDiscard?: () => void;
  onSave?: () => Promise<void> | void;
  saving?: boolean;
  /** 「以某人身份预览」 */
  onPreviewAs?: () => void;
  /** Toolbar title and its 「?」; `toolbarExtra` = e.g. the business-line switch. */
  title?: ReactNode;
  help?: ReactNode;
  toolbarExtra?: ReactNode;
  readOnly?: boolean;
};

const COLUMNS: readonly { ability: FieldAbility; label: string }[] = [
  { ability: "read", label: "可读" },
  { ability: "write", label: "可写" },
  { ability: "mask", label: "打码" },
  { ability: "export", label: "可导出" },
];

export function TableAccessPanel<C = CondDraft>(props: TableAccessPanelProps<C>) {
  const { roles, selectedRole, onSelectRole, onAddRole, roleNote = "黄点 = 有没保存的改动。一个人有多个角色时取并集。", value, savedValue, onChange, recordNoun = "记录", tiers = TABLE_SCOPE_TIERS, renderCondition, conditionFields, keepAfterHandoverLabel = "交接后，参与过的人保留只读", orgTree, actions, actionsNote, fields, fieldIcon, maskNote, members, membersText, onManageMembers, impact, impactStale, impactLead, onDiscard, onSave, saving, onPreviewAs, title, help, toolbarExtra, readOnly } = props;
  const base = useId();
  const [fieldFilter, setFieldFilter] = useState<"all" | "hidden">("all");
  const [showImpact, setShowImpact] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const role = roles.find((r) => r.id === selectedRole);
  const roleName = role?.name ?? "";
  const changes = savedValue ? tableAccessChanges(savedValue, value, { fields, actions, tiers }) : [];
  const dirty = changes.length > 0;
  const counts = tableFieldCounts(fields, value);
  const rows = fieldFilter === "hidden" ? hiddenTableFields(fields, value) : fields;
  const scope = value.scope;
  const setScope = (patch: Partial<TableAccessValue<C>["scope"]>) => onChange({ ...value, scope: { ...scope, ...patch } });
  const condition = renderCondition
    ? renderCondition(scope.condition, (next) => setScope({ condition: next }))
    : conditionFields
      ? <CondBuilder fields={conditionFields} readOnly={readOnly} label="条件" density="compact" value={(scope.condition as CondDraft | undefined) ?? emptyCondDraft(conditionFields)} onChange={(next) => setScope({ condition: next as C })} />
      : null;
  const hasToolbar = Boolean(title || toolbarExtra || onPreviewAs || onSave);
  return (
    <div className="aui-taccess" data-readonly={readOnly || undefined}>
      {hasToolbar && (
        <div className="aui-taccess-bar">
          {title && <h2 className="aui-taccess-title">{title}</h2>}
          {help && <HelpTip label="权限设置说明">{help}</HelpTip>}
          <div className="aui-taccess-bar-tools">
            {toolbarExtra}
            {onPreviewAs && <Button size="sm" variant="outline" onClick={onPreviewAs}><Eye aria-hidden="true" />以某人身份预览</Button>}
            {onSave && !readOnly && (
              <Button size="sm" disabled={!dirty || saving} disabledReason={dirty ? undefined : "没有改动"} onClick={() => void onSave()}>
                <Save aria-hidden="true" />{saving ? "保存中…" : dirty ? `保存（${changes.length} 处改动）` : "保存"}
              </Button>
            )}
          </div>
        </div>
      )}
      {dirty && (
        <div className="aui-taccess-impact" role="status">
          <Info aria-hidden="true" />
          <span className="aui-taccess-impact-text">
            <b>保存后：{impactLead}{impact ? impactSummary(impact) : `${changes.length} 处改动`}</b>
            {impactStale ? "（正在重新计算…）" : "。保存后下一次操作立即生效，不用重新登录。"}
          </span>
          {impact && impact.users.length > 0 && <Button size="sm" variant="text" aria-expanded={showImpact} onClick={() => setShowImpact((v) => !v)}>{showImpact ? "收起每个人的变化" : "看每个人的变化"}</Button>}
          {onDiscard && <Button size="sm" variant="outline" onClick={onDiscard}>放弃改动</Button>}
        </div>
      )}
      {dirty && showImpact && impact && <RuleImpactView impact={impact} stale={impactStale} actionLabel={(id) => actions.find((a) => a.id === id)?.label ?? id} />}
      <div className="aui-taccess-body">
        <nav className="aui-taccess-roles" aria-label="角色">
          <div className="aui-taccess-roles-head">
            <b>角色</b><Count>{roles.length}</Count>
            {onAddRole && !readOnly && <IconButton label="新建角色" tooltip="新建角色（可复制已有角色再改）" onClick={onAddRole} icon={<Plus />} />}
          </div>
          <ul>
            {roles.map((r) => {
              const changed = r.id === selectedRole ? dirty : Boolean(r.dirty);
              return (
                <li key={r.id}>
                  {/* admin-ui-audit-ignore raw-control: SDK 内部——TableAccessPanel 的角色列表项（aria-current + 改动小点） */}
                  <button type="button" className="aui-taccess-role" aria-current={r.id === selectedRole || undefined} onClick={() => onSelectRole(r.id)}>
                    {r.admin ? <Shield aria-hidden="true" /> : <Users aria-hidden="true" />}
                    <span className="aui-taccess-role-name">{r.name}</span>
                    {changed && <span className="aui-taccess-dot" role="img" aria-label="有没保存的改动" />}
                    <span className="aui-taccess-role-n">{r.members} 人</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {roleNote && <p className="aui-taccess-roles-note"><Info aria-hidden="true" />{roleNote}</p>}
        </nav>

        <section className="aui-scard aui-taccess-scope" aria-labelledby={`${base}-scope`}>
          <div className="aui-scard-head">
            <IconBlock size="sm"><Filter /></IconBlock>
            <h3 id={`${base}-scope`}>记录范围</h3>
            <small className="aui-note">{roleName} 能看哪些{recordNoun}</small>
          </div>
          <div className="aui-taccess-sec">
            <fieldset className="aui-taccess-tiers" disabled={readOnly}>
              <legend className="aui-sr-only">记录范围</legend>
              {tiers.map((tier) => (
                <label key={tier.value} className="aui-taccess-tier" data-checked={scope.tier === tier.value || undefined}>
                  {/* admin-ui-audit-ignore raw-control: SDK 内部——记录范围单选（fieldset + legend，每档带说明） */}
                  <input type="radio" name={`${base}-tier`} value={tier.value} checked={scope.tier === tier.value} onChange={() => setScope({ tier: tier.value })} />
                  <span className="aui-taccess-tier-label">{tier.label}</span>
                  {tier.hint && <small>{tier.hint}</small>}
                </label>
              ))}
            </fieldset>
            {scope.tier === "condition" && condition && <div className="aui-taccess-cond">{condition}</div>}
            {scope.tier === "custom" && (
              <div className="aui-taccess-cond">
                <Button size="sm" variant="outline" disabled={readOnly} onClick={() => setDeptOpen(true)}>指定部门（{scope.deptIds?.length ?? 0} 个）</Button>
                <DataScopeDialog open={deptOpen} onClose={() => setDeptOpen(false)} subject={roleName} tiers={["custom"]} orgTree={orgTree} readOnly={readOnly}
                  value={{ tier: "custom", deptIds: scope.deptIds ?? [] }} onSubmit={async (next) => { setScope({ deptIds: next.deptIds ?? [] }); setDeptOpen(false); }} />
              </div>
            )}
            {keepAfterHandoverLabel !== false && (
              <label className="aui-taccess-check">
                <Checkbox checked={Boolean(scope.keepAfterHandover)} disabled={readOnly} onCheckedChange={(on) => setScope({ keepAfterHandover: on === true })} />
                {keepAfterHandoverLabel}
              </label>
            )}
          </div>
          <div className="aui-taccess-sec">
            <div className="aui-taccess-lab">能做的操作<small>· 只对上面范围里的{recordNoun}</small></div>
            <div className="aui-taccess-acts" role="group" aria-label="能做的操作">
              {actions.map((a) => {
                const on = value.actions.includes(a.id);
                return (
                  <label key={a.id} className="aui-taccess-act" data-checked={on || undefined}>
                    <Checkbox checked={on} disabled={readOnly} onCheckedChange={(next) => onChange({ ...value, actions: next === true ? [...value.actions, a.id] : value.actions.filter((x) => x !== a.id) })} />
                    {a.label}
                  </label>
                );
              })}
            </div>
            {actionsNote !== null && <p className="aui-note aui-taccess-hint">{actionsNote ?? "「改」只能改右边勾了「可写」的字段。"}</p>}
          </div>
          {(members || membersText || onManageMembers) && (
            <div className="aui-taccess-sec aui-taccess-members">
              <span>这个角色的人</span>
              {members && <AvatarStack people={members} label={`${roleName}的成员`} />}
              {membersText && <span className="aui-note">{membersText}</span>}
              {onManageMembers && <Button size="sm" variant="outline" onClick={onManageMembers}>管理成员</Button>}
            </div>
          )}
        </section>

        <section className="aui-scard aui-taccess-fields" aria-labelledby={`${base}-fields`}>
          <div className="aui-scard-head">
            <IconBlock size="sm"><Lock /></IconBlock>
            <h3 id={`${base}-fields`}>字段权限</h3>
            <small className="aui-note">{roleName} · {counts.total} 个字段，能看 {counts.read} 个</small>
            <div className="aui-scard-tools">
              <SegmentedControl size="sm" label="显示哪些字段" value={fieldFilter} onValueChange={setFieldFilter} options={[{ value: "all", label: "全部" }, { value: "hidden", label: "看不到的" }]} />
            </div>
          </div>
          <div className="aui-taccess-matrix">
            {/* admin-ui-audit-ignore raw-control: SDK 内部——字段权限勾选矩阵（表头带计数，每格一个 Checkbox） */}
            <table className="aui-taccess-table">
              <caption className="aui-sr-only">{roleName}的字段权限</caption>
              <thead>
                <tr>
                  <th scope="col">字段</th>
                  {COLUMNS.map((c) => (
                    <th key={c.ability} scope="col" className="aui-taccess-num">
                      {c.label}<small>{c.ability === "read" ? `${counts.read} / ${counts.total}` : counts[c.ability]}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((field) => {
                  const policy = tableFieldPolicy(value, field);
                  const tags = tableFieldTags(field, policy, roleName);
                  return (
                    <tr key={field.id} data-state={field.ownedBy ? "owned" : !policy.read ? "hidden" : undefined}>
                      <th scope="row">
                        <span className="aui-taccess-fname">
                          {fieldIcon?.(field)}
                          {field.label}
                          {tags.map((t) => (
                            <span key={t.kind} className="aui-taccess-tag" data-kind={t.kind}>
                              {t.kind === "owned" ? <Lock aria-hidden="true" /> : t.kind === "hidden" || t.kind === "mask" ? <EyeOff aria-hidden="true" /> : <Check aria-hidden="true" />}
                              {t.label}
                            </span>
                          ))}
                        </span>
                      </th>
                      {COLUMNS.map((c) => {
                        const applies = c.ability !== "mask" || field.sensitive;
                        return (
                          <td key={c.ability} className="aui-taccess-num" data-ability={c.ability}>
                            {applies ? (
                              <Checkbox checked={policy[c.ability]} disabled={readOnly || !canToggleField(field, c.ability)} aria-label={`${field.label} ${c.label}`} onCheckedChange={() => onChange(toggleTableField(value, field, c.ability))} />
                            ) : (
                              <span className="aui-note" aria-label={`${field.label} 不适用打码`}>—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr><td colSpan={5} className="aui-note aui-taccess-empty">{roleName}能看到全部字段</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {maskNote && <p className="aui-taccess-foot"><Info aria-hidden="true" />{maskNote}</p>}
        </section>
      </div>
    </div>
  );
}
