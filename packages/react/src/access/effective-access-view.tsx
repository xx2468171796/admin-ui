"use client";
/**
 * EffectiveAccessView（演示 A5「预览 / 诊断」）：左边选人（分组：这个角色的人 / 最近看过，可搜），右边这个人
 * 每个模块的最终档位 + 能看到的数据 + 来源标签（角色 / 集团角色 / 个人加 / 个人减 / 未开通 / 没有哪个角色给），
 * 「明细」展开成逐项表（EffectiveAccessTable：有没有、范围、来源 / 原因、权限码）。窄屏选人变成下拉、每个模块一张卡。
 * 宿主把诊断结果（例如 `GET …/diagnose` 的 DiagnoseResponse）转成 `EffectiveModule[]`。
 */
import { useState, type ReactNode } from "react";
import { ChevronRight, Info, KeyRound, Minus, Plus, TriangleAlert, Users } from "lucide-react";
import { Button, Choice } from "../primitives.tsx";
import { IconBlock, PersonLine } from "../kit.tsx";
import { SearchField } from "../page-templates.tsx";
import type { EffectiveAccessRow, ScopeTier } from "./contracts.ts";
import { EffectiveAccessTable } from "./effective-access.tsx";
import { CUSTOM_LEVEL_LABEL, ACCESS_LEVEL_LABEL, MODULE_SOURCE_TONE, scopeText, type AccessLevelId, type ModuleSource } from "./module-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type EffectiveModule = {
  id: string;
  label: string;
  /** 名字下面的小字（「有 14 项 · 没有 3 项」「系统管理」）。 */
  hint?: string;
  icon?: ReactNode;
  /** 最终档位；null = 自定义（对不上任何一档）。 */
  level: AccessLevelId | null;
  /** 档位显示名（模块改过名时）。 */
  levelLabel?: string;
  scope?: ScopeTier | null;
  /** 范围不由角色决定时的一句（「按空间成员」）。 */
  scopeText?: string;
  sources: readonly ModuleSource[];
  /** 逐项明细；有才出现「明细」。 */
  rows?: readonly EffectiveAccessRow[];
};
export type EffectivePerson = { id: string; name: string; hint?: string; /** 分组标题（「这个角色的人 · 3」「最近看过」）。 */ group?: string };

export type EffectiveAccessViewProps = {
  /** 右边正在看的人。 */
  subject: { name: string; hint?: ReactNode };
  modules: readonly EffectiveModule[];
  /** 左边可选的人；不给就只显示右边。 */
  people?: readonly EffectivePerson[];
  selectedId?: string;
  onPick?: (id: string) => void;
  /** 展开明细的模块（受控）；不给就自己管。 */
  expanded?: string | null;
  onExpandedChange?: (id: string | null) => void;
  /** 人名右边的按钮（查一项… / 以他身份预览）。 */
  actions?: ReactNode;
  /** 规则提示；false 不显示。 */
  note?: ReactNode | false;
  scopeLabels?: Partial<Record<ScopeTier, string>>;
  /** 搜人框的提示字（默认「搜任何人」）；搜索在本地按名字 / 小字过滤。 */
  searchPlaceholder?: string;
};

const SOURCE_ICON: Partial<Record<ModuleSource["kind"], ReactNode>> = {
  role: <Users aria-hidden="true" />,
  template: <Users aria-hidden="true" />,
  group_role: <KeyRound aria-hidden="true" />,
  personal_add: <Plus aria-hidden="true" />,
  personal_remove: <Minus aria-hidden="true" />,
  pending: <TriangleAlert aria-hidden="true" />,
};

export function EffectiveAccessView({
  subject,
  modules,
  people,
  selectedId,
  onPick,
  expanded: expandedProp,
  onExpandedChange,
  actions,
  note = "几个角色给的取最高档；个人减压过所有角色；模块没开通时谁都没有。",
  scopeLabels,
  searchPlaceholder = "搜任何人",
}: EffectiveAccessViewProps) {
  const [inner, setInner] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const expanded = expandedProp !== undefined ? expandedProp : inner;
  const setExpanded = (id: string | null) => {
    if (expandedProp === undefined) setInner(id);
    onExpandedChange?.(id);
  };
  const words = query.trim().toLowerCase();
  const shown = (people ?? []).filter((p) => !words || `${p.name} ${p.hint ?? ""}`.toLowerCase().includes(words));
  const groups = [...new Set(shown.map((p) => p.group ?? ""))];
  return (
    <div className="aui-am-ev" data-people={people ? true : undefined}>
      {people && (
        <aside className="aui-am-ev-people" aria-label="选人">
          <div className="aui-am-ev-search">
            <SearchField size="sm" value={query} onChange={setQuery} placeholder={searchPlaceholder} label="搜人" />
          </div>
          {groups.map((g) => (
            <div key={g} role="group" aria-label={g || "人员"}>
              {g && <div className="aui-am-ev-group">{g}</div>}
              {shown.filter((p) => (p.group ?? "") === g).map((p) => (
                <Button key={p.id} variant="ghost" className="aui-am-ev-person" aria-pressed={p.id === selectedId} onClick={() => onPick?.(p.id)}>
                  <PersonLine name={p.name} hint={p.hint} />
                </Button>
              ))}
            </div>
          ))}
          {!shown.length && <p className="aui-note aui-am-ev-empty">没有匹配的人</p>}
        </aside>
      )}
      <div className="aui-am-ev-main">
        {people && onPick && (
          <div className="aui-am-ev-pick">
            <Choice label="看谁的权限" value={selectedId ?? ""} options={people.map((p) => ({ value: p.id, label: p.hint ? `${p.name}（${p.hint}）` : p.name }))} onChange={onPick} />
          </div>
        )}
        <div className="aui-am-ev-who">
          <PersonLine name={subject.name} hint={subject.hint} />
          {actions && <span className="aui-am-ev-actions">{actions}</span>}
        </div>
        {note !== false && (
          <div className="aui-am-ev-note">
            <Info aria-hidden="true" />
            <span>{note}</span>
          </div>
        )}
        <div className="aui-am-ev-head" aria-hidden="true">
          <span>模块</span>
          <span>最终档位</span>
          <span>能看到的数据</span>
          <span>来源</span>
          <span />
        </div>
        {modules.map((m) => {
          const open = expanded === m.id && !!m.rows?.length;
          const level = m.levelLabel ?? (m.level === null ? CUSTOM_LEVEL_LABEL : ACCESS_LEVEL_LABEL[m.level]);
          const scope = m.scopeText ?? (m.level === "none" ? "—" : scopeText(m.scope ?? null, { scope: scopeLabels }));
          return (
            <div key={m.id} className="aui-am-er" data-open={open || undefined}>
              <div className="aui-am-mod">
                {m.icon && <IconBlock size="sm">{m.icon}</IconBlock>}
                <span className="aui-am-mod-text">
                  <b>{m.label}</b>
                  {m.hint && <small>{m.hint}</small>}
                </span>
              </div>
              <div className="aui-am-er-lv">
                <span className="aui-am-er-level" data-none={m.level === "none" || undefined} aria-label={`最终档位：${level}`}>{level}</span>
                <span className="aui-am-er-scope" data-muted={!m.scope || undefined} aria-label={`能看到的数据：${scope}`}>{scope}</span>
              </div>
              <div className="aui-am-src">
                {m.sources.map((s, i) => (
                  <span key={i} className="aui-am-chip" data-kind="source" data-tone={MODULE_SOURCE_TONE[s.kind]}>
                    {SOURCE_ICON[s.kind]}
                    {s.label}
                    {s.expiresAt && `（到 ${s.expiresAt}）`}
                  </span>
                ))}
              </div>
              {m.rows?.length ? (
                <Button size="sm" variant="ghost" className="aui-am-xp" aria-expanded={open} onClick={() => setExpanded(open ? null : m.id)}>
                  <ChevronRight className="aui-am-car" aria-hidden="true" />
                  明细
                  <span className="aui-sr-only">{m.label}</span>
                </Button>
              ) : <span />}
              {open && (
                <div className="aui-am-er-rows">
                  <EffectiveAccessTable rows={m.rows ?? []} subject={subject.name} caption={`${subject.name} · ${m.label} 逐项`} pageSize={10} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
