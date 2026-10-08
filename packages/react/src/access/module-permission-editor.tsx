"use client";
/**
 * ModulePermissionEditor（starter「权限按模块」页 A1–A3、A6）：角色页「模块权限」——
 * 每个模块一行：名字 + 一句说明 / 档位（全平台统一 5 档）/ 能看到的数据 / 细调情况 / ▸细调。
 * 用不了的模块整行灰并写原因；编辑人授不出的档 / 动作灰掉写原因；对不上任何一档显示「自定义」；
 * 改过的行打点，底部改动条「改了 N 个模块 · 撤销 · 保存…」；「系统管理」小节；只读（集团下发）顶部说明 +「复制后修改」。
 * 窄屏（≤ 760px）每个模块一张卡、两个下拉上下叠，细调打开全屏面板。纯展示：props 进、回调出，不请求。
 */
import { useId, useState, type ReactNode } from "react";
import { Check, ChevronRight, Copy, Eye, KeyRound, Pencil, Settings2, TriangleAlert } from "lucide-react";
import { Button } from "../primitives.tsx";
import { useIsMobile } from "../media-query.ts";
import { Dialog } from "../forms.tsx";
import { HelpTip } from "../help-tip.tsx";
import { IconBlock } from "../kit.tsx";
import { InlineAlert } from "../layout.tsx";
import type { OrgNode, ScopeTier } from "./contracts.ts";
import { DataScopeSelect } from "./data-scope-select.tsx";
import { ModuleFineTune } from "./module-finetune.tsx";
import { ModuleLevelSelect } from "./module-level-select.tsx";
import {
  changeSummaryText,
  diffModuleGrant,
  diffModuleGrants,
  effectiveScope,
  grantChips,
  levelLabel,
  moduleGrantOf,
  resetToLevel,
  scopeMode,
  scopeText,
  setLevel,
  setScope,
  type ModuleAccessDef,
  type ModuleGrant,
  type ModuleGrants,
} from "./module-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type ModuleEditorReadOnly = {
  /** 横幅标题（默认「只读」）：「来自集团 · 只读」。 */
  title?: string;
  /** 一句话：谁维护、怎么改。 */
  message?: ReactNode;
  /** 「复制后修改」 */
  onCopy?: () => void;
  copyLabel?: string;
};

export type ModulePermissionEditorProps = {
  modules: readonly ModuleAccessDef[];
  value: ModuleGrants;
  /** 上次保存的值：改过的模块打点、改动条计数。 */
  savedValue?: ModuleGrants;
  /** 不给 = 只读。 */
  onChange?: (next: ModuleGrants) => void;
  /** true 或横幅内容：整页只读（集团下发、模板、超管角色），「细调」变「查看」。 */
  readOnly?: boolean | ModuleEditorReadOnly;
  /** 展开细调的模块（受控）；不给就自己管。 */
  expanded?: string | null;
  onExpandedChange?: (id: string | null) => void;
  /** 待确认的决定（模块 id、动作键、给不给），值的变化照样走 onChange。 */
  onResolvePending?: (moduleId: string, key: string, give: boolean) => void;
  /** 改动条「保存…」：宿主打开 PermissionDiff。 */
  onSave?: () => void;
  /** 改动条「撤销」。 */
  onDiscard?: () => void;
  saveLabel?: string;
  /** 范围档显示名（例：本人 / 部门及下级）。 */
  scopeLabels?: Partial<Record<ScopeTier, string>>;
  /** 部门树：范围多一项「指定部门…」。 */
  orgTree?: readonly OrgNode[];
  /** 角色名（手机全屏面板的副标题「角色「销售主管」」）。 */
  roleName?: string;
  systemTitle?: string;
  systemHint?: string;
  /** 底部图例（默认显示）。 */
  legend?: boolean;
  /** auto = 按屏宽（≤ 760px 卡片 + 全屏细调）；table / cards 强制。 */
  layout?: "auto" | "table" | "cards";
};

function useNarrow(mode: "auto" | "table" | "cards"): boolean {
  const match = useIsMobile();
  return mode === "auto" ? match : mode === "cards";
}

const tunable = (def: ModuleAccessDef) => !def.unavailable && def.resources.some((r) => r.actions.length || r.fields?.length);

export function ModulePermissionEditor({
  modules,
  value,
  savedValue,
  onChange,
  readOnly,
  expanded: expandedProp,
  onExpandedChange,
  onResolvePending,
  onSave,
  onDiscard,
  saveLabel = "保存…",
  scopeLabels,
  orgTree,
  roleName,
  systemTitle = "系统管理",
  systemHint = "管理权限和组织本身，给出去要谨慎",
  legend = true,
  layout = "auto",
}: ModulePermissionEditorProps) {
  const uid = useId();
  const narrow = useNarrow(layout);
  const editable = !readOnly && !!onChange;
  const [inner, setInner] = useState<string | null>(null);
  const expanded = expandedProp !== undefined ? expandedProp : inner;
  const setExpanded = (id: string | null) => {
    if (expandedProp === undefined) setInner(id);
    onExpandedChange?.(id);
  };
  const labels = { scope: scopeLabels };
  const grant = (id: string) => moduleGrantOf(value, id);
  const saved = (id: string) => (savedValue ? moduleGrantOf(savedValue, id) : undefined);
  const update = (id: string, next: ModuleGrant) => onChange?.({ ...value, [id]: next });
  const changes = savedValue ? diffModuleGrants(modules, savedValue, value, labels) : [];
  const ro = typeof readOnly === "object" ? readOnly : readOnly ? {} : null;

  const scopeCell = (def: ModuleAccessDef, g: ModuleGrant, s: ModuleGrant | undefined) => {
    const mode = scopeMode(def, g);
    const tier = effectiveScope(def, g);
    if (mode === "none") return <span className="aui-am-na">—</span>;
    if (mode === "note")
      return (
        <span className="aui-am-na">
          <Eye aria-hidden="true" />
          {def.scopeNote}
        </span>
      );
    const text = scopeText(tier, labels, g.deptIds?.length);
    if (mode === "fixed") return <span className="aui-am-static" data-tip={`「${levelLabel(def, g.level)}」固定看本人的，不能选`}>{text}</span>;
    if (!editable) return <span className="aui-am-static">{text}</span>;
    return (
      <DataScopeSelect
        label={`${def.label} 能看到的数据`}
        value={tier ? { tier, ...(g.deptIds ? { deptIds: g.deptIds } : {}) } : null}
        tiers={def.tiers}
        disabledTiers={def.disabledTiers}
        orgTree={orgTree}
        labels={scopeLabels}
        subject={roleName ? `${roleName} · ${def.label}` : def.label}
        changed={!!s && effectiveScope(def, s) !== tier}
        onChange={(next) => update(def.id, setScope(g, next.tier, next.deptIds))}
      />
    );
  };

  const row = (def: ModuleAccessDef) => {
    const g = grant(def.id);
    const s = saved(def.id);
    const changed = !!s && diffModuleGrant(def, s, g, labels).length > 0;
    const open = expanded === def.id;
    const panelId = `${uid}-${def.id}`;
    const head = (
      <div className="aui-am-mod">
        {def.icon && <IconBlock size="sm" tone="brand">{def.icon}</IconBlock>}
        <span className="aui-am-mod-text">
          <b>
            {def.label}
            {changed && <span className="aui-am-dot" data-tip="改过，还没保存" />}
            {changed && <span className="aui-sr-only">（改过，还没保存）</span>}
          </b>
          {def.description && <small>{def.description}</small>}
        </span>
      </div>
    );
    if (def.unavailable)
      return (
        <div key={def.id} className="aui-am-row" data-unavailable>
          {head}
          <div className="aui-am-off">
            <TriangleAlert aria-hidden="true" />
            <span className="aui-am-chip" data-kind="off">{def.unavailable.label}</span>
            这一行不能设置
          </div>
          {def.unavailable.action ? (
            <Button size="sm" variant="ghost" className="aui-am-xp" onClick={def.unavailable.action.onSelect}>
              {def.unavailable.action.label} ›
            </Button>
          ) : <span />}
        </div>
      );
    const chips = grantChips(def, g);
    return (
      <div key={def.id} className="aui-am-row" data-changed={changed || undefined} data-open={(open && !narrow) || undefined}>
        {head}
        <div className="aui-am-cell">
          <span className="aui-am-lbl">档位</span>
          {editable ? (
            <ModuleLevelSelect def={def} value={g.level} changed={!!s && s.level !== g.level} onChange={(l) => update(def.id, setLevel(def, g, l))} />
          ) : (
            <span className="aui-am-static" data-custom={g.level === null || undefined}>{levelLabel(def, g.level)}</span>
          )}
        </div>
        <div className="aui-am-cell">
          <span className="aui-am-lbl">能看到的数据</span>
          {scopeCell(def, g, s)}
        </div>
        <div className="aui-am-sum">
          {chips.map((c, i) => (
            <span key={i} className="aui-am-chip" data-kind={c.kind}>
              {c.kind === "pending" && <TriangleAlert aria-hidden="true" />}
              {c.kind === "mute" ? <>去掉 <s>{c.text.replace(/^去掉 /, "")}</s></> : c.text}
            </span>
          ))}
        </div>
        {tunable(def) ? (
          <Button size="sm" variant="ghost" className="aui-am-xp" aria-expanded={open} aria-controls={open && !narrow ? panelId : undefined} onClick={() => setExpanded(open ? null : def.id)}>
            <ChevronRight className="aui-am-car" aria-hidden="true" />
            {editable ? "细调" : "查看"}
            <span className="aui-sr-only">{def.label}</span>
          </Button>
        ) : <span />}
        {open && !narrow && (
          <div className="aui-am-ft-wrap" id={panelId}>
            <ModuleFineTune
              def={def}
              grant={g}
              saved={s}
              onChange={editable ? (next) => update(def.id, next) : undefined}
              onResolvePending={onResolvePending ? (key, give) => onResolvePending(def.id, key, give) : undefined}
              scopeLabels={scopeLabels}
              orgTree={orgTree}
            />
          </div>
        )}
      </div>
    );
  };

  const business = modules.filter((m) => (m.section ?? "business") === "business");
  const system = modules.filter((m) => m.section === "system");
  const sheetDef = narrow && expanded ? modules.find((m) => m.id === expanded) : undefined;
  const sheetGrant = sheetDef ? grant(sheetDef.id) : undefined;
  const sheetSaved = sheetDef ? saved(sheetDef.id) : undefined;
  const sheetChanges = sheetDef && sheetSaved && sheetGrant ? diffModuleGrant(sheetDef, sheetSaved, sheetGrant, labels).length : 0;
  return (
    <div className="aui-am" data-layout={narrow ? "cards" : "table"} data-readonly={!editable || undefined}>
      {ro && (
        <div className="aui-am-ro">
          <InlineAlert
            tone="info"
            title={ro.title ?? "只读"}
            action={
              ro.onCopy ? (
                <Button size="sm" onClick={ro.onCopy}>
                  <Copy />
                  {ro.copyLabel ?? "复制后修改"}
                </Button>
              ) : undefined
            }
          >
            {ro.message}
          </InlineAlert>
        </div>
      )}
      <div className="aui-am-grid">
        <div className="aui-am-head" aria-hidden={narrow || undefined}>
          <span>模块</span>
          <span>
            档位
            <HelpTip label="档位说明">全平台统一 5 档，逐级包含：无 / 只看 / 成员·只看自己的 / 成员·按范围看 / 管理员。一个人有几个角色时，每个模块取最高的档位。</HelpTip>
          </span>
          <span>
            能看到的数据
            <HelpTip label="能看到的数据说明">分范围的操作（看、改记录……）能碰到谁的数据。「成员·只看自己的」固定本人；「按范围看」默认全部，可以收窄。</HelpTip>
          </span>
          <span>细调情况</span>
          <span />
        </div>
        {business.map(row)}
        {system.length > 0 && (
          <div className="aui-am-sec">
            <Settings2 aria-hidden="true" />
            {systemTitle}
            {systemHint && <small>· {systemHint}</small>}
          </div>
        )}
        {system.map(row)}
      </div>
      {editable && changes.length > 0 && (
        <div className="aui-am-bar" role="region" aria-label="没保存的改动">
          <Pencil aria-hidden="true" />
          <b>改了 {changes.length} 个模块</b>
          <small data-tip={changeSummaryText(changes)}>{changeSummaryText(changes)}</small>
          <span className="aui-am-bar-actions">
            {onDiscard && (
              <Button size="sm" variant="outline" onClick={onDiscard}>
                撤销
              </Button>
            )}
            {onSave && (
              <Button size="sm" onClick={onSave}>
                <Check />
                {saveLabel}
              </Button>
            )}
          </span>
        </div>
      )}
      {legend && (
        <div className="aui-am-legend">
          <span><span className="aui-am-dot" />改过、还没保存</span>
          <span><span className="aui-am-static" data-custom>自定义</span>勾选和任何一档都对不上</span>
          <span><span className="aui-am-chip" data-kind="off">本公司未开通</span>开通后自动多一行</span>
          <span><KeyRound aria-hidden="true" />灰掉的档位：你自己没有，不能授出</span>
        </div>
      )}
      {sheetDef && sheetGrant && (
        <Dialog
          open
          placement="side"
          title={`${sheetDef.label} · ${editable ? "细调" : "查看"}`}
          description={[roleName ? `角色「${roleName}」` : "", sheetGrant.add?.length ? `加 ${sheetGrant.add.length}` : "", sheetGrant.mute?.length ? `去掉 ${sheetGrant.mute.length}` : ""].filter(Boolean).join(" · ") || undefined}
          titleAdornment={sheetChanges ? <span className="aui-am-chip" data-kind="add">改了 {sheetChanges} 项</span> : undefined}
          onClose={() => setExpanded(null)}
          bodyClassName="aui-am-sheet-body"
          footer={
            <>
              {editable && (
                <Button variant="outline" onClick={() => update(sheetDef.id, resetToLevel(sheetGrant))}>
                  恢复默认
                </Button>
              )}
              <Button className="aui-am-sheet-done" onClick={() => setExpanded(null)}>
                <Check />
                完成
              </Button>
            </>
          }
        >
          <ModuleFineTune
            variant="sheet"
            def={sheetDef}
            grant={sheetGrant}
            saved={sheetSaved}
            onChange={editable ? (next) => update(sheetDef.id, next) : undefined}
            onResolvePending={onResolvePending ? (key, give) => onResolvePending(sheetDef.id, key, give) : undefined}
            scopeLabels={scopeLabels}
            orgTree={orgTree}
          />
        </Dialog>
      )}
    </div>
  );
}
