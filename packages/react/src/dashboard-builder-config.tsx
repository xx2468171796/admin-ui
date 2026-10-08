"use client";
/**
 * Config panel of the selected widget (bt/builders-b D9, D32 right pane). 数据: data source (host
 * sources in groups, unavailable ones locked with the reason), metric — 标准指标 from the host's
 * metric dictionary (definition fixed, 「标准口径 vN」) or 自定义 (name + formula, the widget is
 * marked 「自定义口径」, DASHBOARDS.md §4) — group-by, comparison (default: follow the dashboard),
 * time granularity, chart-type tiles, the widget's own conditions (grid condition editor on
 * condition-core) and which dashboard filters it inherits / overrides; 堆叠按 (stacked), 目标值 (bullet,
 * actual vs target, rollup) and the 2–6 numbers of a 「数字组」. 样式: title, number size, caption, note text.
 */
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Lock, Plus, ShieldCheck, Sigma, SquarePlus, Trash2, X } from "lucide-react";
import { Button, Checkbox, Choice, Input, Tabs, Textarea } from "./primitives.tsx";
import { ChipGroup, SegmentedControl } from "./choices.tsx";
import { FormField } from "./forms.tsx";
import { NumberInput } from "./number-inputs.tsx";
import { GridConditionTree, canAddRootGroup } from "./grid-condition-editor.tsx";
import { addGridFilter, addGridFilterGroup, type GridFilterGroup } from "./grid-core.ts";
import { asGridFields, type ConditionFieldDef } from "./rule-list.tsx";
import { CONDITION_LIMITS, canAddCondition, emptyConditionGroup, type ConditionGroup } from "./condition-core.ts";
import type { DashboardFilterValue, FilterOption } from "./dashboard-filters-core.ts";
import { WIDGET_KIND_ICONS } from "./dashboard-builder-library.tsx";
import { filterInheritance, metricBadge, nextWidgetId, TARGET_WIDGET_KINDS, WIDGET_GRANULARITIES, WIDGET_GROUP_LIMITS, WIDGET_KIND_LABELS, type DashboardWidget, type WidgetGroupItem, type WidgetKind, type WidgetQuery } from "./dashboard-builder-core.ts";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard-builder.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/dashboard-builder.css";

/** A data source the host offers (a bitable table, platform data …). */
export type DashboardDataSource = {
  id: string;
  label: string;
  /** Group heading (「多维表格」「平台数据」). */
  group?: string;
  /** Records (shown after the name). */
  count?: number;
  /** Not available yet (「财务模块上线后可用」): locked chip + the reason. */
  disabledReason?: string;
  /** Group-by choices of this source. */
  groupBy?: readonly FilterOption[];
  /** Fields for the widget's own conditions (any GridField<Row> fits). */
  fields?: readonly ConditionFieldDef[];
  /** Standard metric keys usable on this source (default: all). */
  metrics?: readonly string[];
};
/** A standard metric from the host's metric dictionary (DASHBOARDS.md §4 MetricDef subset). */
export type DashboardMetricDef = { key: string; name: string; version?: number; unit?: string; formula?: string };

export type WidgetConfigProps = {
  widget: DashboardWidget;
  /** `merge` names a text field being typed: consecutive edits of it are one undo step. */
  onChange: (next: DashboardWidget, merge?: string) => void;
  onClose: () => void;
  sources: readonly DashboardDataSource[];
  metrics: readonly DashboardMetricDef[];
  compareOptions: readonly FilterOption[];
  context: DashboardFilterValue;
  dimensions: readonly { key: string; label: string }[];
  /** Chart types offered in the tiles (default: all data kinds). */
  kinds: readonly WidgetKind[];
  footer?: ReactNode;
};

const FOLLOW = "__follow__";
const NONE = "__none__";

export function WidgetConfig({ widget, onChange, onClose, sources, metrics, compareOptions, context, dimensions, kinds, footer }: WidgetConfigProps) {
  const id = useId();
  const [tab, setTab] = useState(widget.kind === "text" ? "style" : "data");
  const q: WidgetQuery = widget.query ?? {};
  const setQuery = (patch: Partial<WidgetQuery>) => onChange({ ...widget, query: { ...q, ...patch } });
  const source = sources.find((s) => s.id === q.source);
  const usable = source?.metrics ? metrics.filter((m) => source.metrics?.includes(m.key)) : metrics;
  const badge = metricBadge(q.metric, metrics);
  const inherit = filterInheritance(widget, context, dimensions);
  const tree = (q.filter ?? emptyConditionGroup()) as GridFilterGroup;
  const fields = asGridFields(source?.fields ?? []);
  const first = fields.find((f) => !f.restricted);
  const isText = widget.kind === "text";
  const groupsOf = [...new Set(sources.map((s) => s.group ?? "数据"))];
  return (
    <aside className="aui-dbb-cfg" aria-label="组件设置">
      <div className="aui-dbb-cfg-head">
        <b>组件设置</b>
        <span className="aui-dbb-tag" data-kind="kind">{WIDGET_KIND_LABELS[widget.kind]}</span>
        <IconButton label="关闭组件设置" onClick={onClose} icon={<X />} />
      </div>
      <Tabs value={tab} onValueChange={setTab} label="组件设置" items={[{ value: "data", label: "数据", disabled: isText }, { value: "style", label: "样式" }]}>
        {tab === "data" && !isText ? (
          <div className="aui-dbb-cfg-body">
            <section className="aui-dbb-sec" aria-label="数据源">
              <div className="aui-dbb-lb">数据源</div>
              {groupsOf.map((group) => {
                const list = sources.filter((s) => (s.group ?? "数据") === group);
                const locked = list.filter((s) => s.disabledReason);
                return (
                  <div key={group} className="aui-dbb-src">
                    <small>{group}</small>
                    <ChipGroup
                      label={`数据源：${group}`}
                      value={q.source && list.some((s) => s.id === q.source) ? [q.source] : []}
                      options={list.map((s) => ({ value: s.id, label: s.label, count: s.count ?? null, disabled: Boolean(s.disabledReason) }))}
                      onValueChange={(vals) => {
                        const next = vals.find((v) => v !== q.source);
                        if (next) setQuery({ source: next, groupBy: null, filter: undefined });
                      }}
                    />
                    {locked.map((s) => <small key={s.id} className="aui-dbb-locked"><Lock aria-hidden="true" />{s.label}：{s.disabledReason}</small>)}
                  </div>
                );
              })}
            </section>
            <section className="aui-dbb-sec" aria-label="指标">
              <div className="aui-dbb-lb">指标<small>来自指标字典</small></div>
              <SegmentedControl size="sm" label="指标口径" value={q.metric?.kind ?? "standard"} options={[{ value: "standard", label: "标准指标" }, { value: "custom", label: "自定义" }]}
                onValueChange={(v) => setQuery({ metric: v === "custom" ? { kind: "custom", name: q.metric?.kind === "standard" ? (metrics.find((m) => m.key === (q.metric as { key: string }).key)?.name ?? "") : "", formula: "" } : usable[0] ? { kind: "standard", key: usable[0].key, version: usable[0].version } : undefined })} />
              {q.metric?.kind === "custom" ? (
                <>
                  <FormField label="指标名称" htmlFor={`${id}-mname`}>
                    <Input id={`${id}-mname`} value={q.metric.name} onChange={(e) => onChange({ ...widget, query: { ...q, metric: { kind: "custom", name: e.target.value, formula: q.metric?.kind === "custom" ? q.metric.formula : "" } } }, "metric-name")} />
                  </FormField>
                  <FormField label="口径说明" htmlFor={`${id}-mformula`} hint="写清怎么算：只在你的看板用，组件会标「自定义口径」">
                    <Textarea id={`${id}-mformula`} rows={2} value={q.metric.formula ?? ""} onChange={(e) => onChange({ ...widget, query: { ...q, metric: { kind: "custom", name: q.metric?.kind === "custom" ? q.metric.name : "", formula: e.target.value } } }, "metric-formula")} />
                  </FormField>
                </>
              ) : (
                <div className="aui-dbb-metric">
                  <Sigma aria-hidden="true" />
                  <Choice label="标准指标" value={q.metric?.kind === "standard" ? q.metric.key : ""} placeholder="选一个指标" options={usable.map((m) => ({ value: m.key, label: m.name }))}
                    onChange={(key) => {
                      const def = metrics.find((m) => m.key === key);
                      if (def) setQuery({ metric: { kind: "standard", key: def.key, version: def.version } });
                    }} />
                  {badge && <span className="aui-dbb-tag" data-kind={badge.kind}>{badge.label}</span>}
                </div>
              )}
              <p className="aui-dbb-def">{q.metric?.kind === "custom" ? "自定义口径不进指标字典；要大家都用，请找指标负责人加进字典" : "标准口径不能改；换成「自定义」后，组件标「自定义口径」"}</p>
            </section>
            <section className="aui-dbb-sec aui-dbb-two" aria-label="分组与对比">
              <FormField label="分组" htmlFor={`${id}-group`}>
                <Choice label="分组" value={q.groupBy ?? NONE} options={[{ value: NONE, label: "不分组" }, ...(source?.groupBy ?? [])]} onChange={(v) => setQuery({ groupBy: v === NONE ? null : v })} />
              </FormField>
              <FormField label="对比基准" htmlFor={`${id}-compare`}>
                <Choice label="对比基准" value={q.compare ?? FOLLOW} options={[{ value: FOLLOW, label: `跟随看板（${compareOptions.find((o) => o.value === context.compare)?.label ?? context.compare}）` }, ...compareOptions]} onChange={(v) => setQuery({ compare: v === FOLLOW ? null : v })} />
              </FormField>
            </section>
            {widget.kind === "stacked" && (
              <FormField label="堆叠按" htmlFor={`${id}-stack`} hint="每个值一段，颜色用选项自己的标签色">
                <Choice label="堆叠按" value={q.stackBy ?? NONE} options={[{ value: NONE, label: "不堆叠" }, ...(source?.groupBy ?? []).filter((o) => o.value !== q.groupBy)]} onChange={(v) => setQuery({ stackBy: v === NONE ? null : v })} />
              </FormField>
            )}
            {TARGET_WIDGET_KINDS.includes(widget.kind) && (
              <FormField label="目标值" htmlFor={`${id}-target`} optional hint="每期的目标（和指标同一单位）；不填 = 卡上显示「设目标」">
                <NumberInput id={`${id}-target`} value={widget.target ?? null} min={0} thousands onChange={(v) => onChange({ ...widget, target: v }, "target")} />
              </FormField>
            )}
            {widget.kind === "group" && <GroupItems widget={widget} metrics={usable} onChange={onChange} />}
            <section className="aui-dbb-sec" aria-label="时间粒度">
              <div className="aui-dbb-lb">时间粒度</div>
              <SegmentedControl size="sm" label="时间粒度" value={q.granularity ?? "day"} options={WIDGET_GRANULARITIES} onValueChange={(v) => setQuery({ granularity: v })} />
            </section>
            <section className="aui-dbb-sec" aria-label="筛选">
              <div className="aui-dbb-lb">筛选<small>{inherit.ownConditions ? `${inherit.ownConditions} 条` : "没有自己的条件"}</small></div>
              {fields.length ? (
                <>
                  <GridConditionTree fields={fields} tree={tree} limits={CONDITION_LIMITS} onChange={(next: ConditionGroup<string>) => setQuery({ filter: next.items.length ? next : undefined })} />
                  <div className="aui-dbb-add">
                    <Button variant="ghost" size="sm" disabled={!first || !canAddCondition(tree)} onClick={() => setQuery({ filter: addGridFilter(tree, first) })}><Plus />添加条件</Button>
                    <Button variant="ghost" size="sm" disabled={!first || !canAddRootGroup(tree, CONDITION_LIMITS)} onClick={() => setQuery({ filter: addGridFilterGroup(tree, first, undefined, CONDITION_LIMITS) })}><SquarePlus />添加条件组</Button>
                  </div>
                </>
              ) : (
                <p className="aui-dbb-def">先选数据源，再加这个组件自己的条件</p>
              )}
              <p className="aui-dbb-inherit">另外继承看板筛选：{inherit.inherited.join("、")}</p>
              {dimensions.filter((d) => context.dims[d.key]).map((d) => (
                <label key={d.key} className="aui-dbb-follow">
                  <Checkbox checked={!q.ignore?.includes(d.key)} onCheckedChange={(v) => setQuery({ ignore: v === true ? (q.ignore ?? []).filter((k) => k !== d.key) : [...(q.ignore ?? []), d.key] })} />
                  跟看板的「{d.label}」筛选
                </label>
              ))}
              {inherit.overridden.length > 0 && <p className="aui-dbb-override" role="status">已覆盖看板筛选：{inherit.overridden.join("、")}</p>}
            </section>
          </div>
        ) : (
          <div className="aui-dbb-cfg-body">
            <FormField label="标题" htmlFor={`${id}-title`} hint="写这个组件回答的问题">
              <Input id={`${id}-title`} value={widget.title} onChange={(e) => onChange({ ...widget, title: e.target.value }, "title")} />
            </FormField>
            {!isText && (
              <section className="aui-dbb-sec" aria-label="图表类型">
                <div className="aui-dbb-lb">图表类型</div>
                <KindTiles kinds={kinds} value={widget.kind} onChange={(kind) => onChange(retype(widget, kind))} />
              </section>
            )}
            {(widget.kind === "kpi" || widget.kind === "group") && (
              <section className="aui-dbb-sec" aria-label="数字大小">
                <div className="aui-dbb-lb">数字大小</div>
                <SegmentedControl size="sm" label="数字大小" value={widget.size ?? "md"} options={[{ value: "lg", label: "大 28" }, { value: "md", label: "标准 24" }, { value: "sm", label: "紧凑 20" }]} onValueChange={(v) => onChange({ ...widget, size: v === "md" ? undefined : v })} />
              </section>
            )}
            {isText ? (
              <FormField label="说明文字" htmlFor={`${id}-text`}>
                <Textarea id={`${id}-text`} rows={6} value={widget.text ?? ""} onChange={(e) => onChange({ ...widget, text: e.target.value }, "text")} />
              </FormField>
            ) : (
              <FormField label="底部说明" htmlFor={`${id}-caption`} hint="例：9-25 中秋放假不画；今天还在进行中">
                <Input id={`${id}-caption`} value={widget.caption ?? ""} onChange={(e) => onChange({ ...widget, caption: e.target.value || undefined }, "caption")} />
              </FormField>
            )}
          </div>
        )}
      </Tabs>
      {footer && <div className="aui-dbb-cfg-foot"><ShieldCheck aria-hidden="true" />{footer}</div>}
    </aside>
  );
}

/** Switch the chart type; a 「数字组」 starts with two numbers (the widget's own metric first). */
function retype(widget: DashboardWidget, kind: WidgetKind): DashboardWidget {
  if (kind !== "group" || widget.items?.length) return { ...widget, kind };
  const first: WidgetGroupItem = { id: "n1", title: widget.title, ...(widget.query ? { query: widget.query } : {}) };
  return { ...widget, kind, items: [first, { id: "n2", title: "数字 2" }] };
}

/** The 2–6 numbers of a 「数字组」: title + standard metric each, add / remove. */
function GroupItems({ widget, metrics, onChange }: { widget: DashboardWidget; metrics: readonly DashboardMetricDef[]; onChange: WidgetConfigProps["onChange"] }) {
  const items = widget.items ?? [];
  const set = (next: WidgetGroupItem[], merge?: string) => onChange({ ...widget, items: next }, merge);
  const patch = (index: number, change: Partial<WidgetGroupItem>, merge?: string) => set(items.map((item, i) => (i === index ? { ...item, ...change } : item)), merge);
  return (
    <section className="aui-dbb-sec" aria-label="数字组">
      <div className="aui-dbb-lb">数字<small>{items.length} 个 · {WIDGET_GROUP_LIMITS.min}–{WIDGET_GROUP_LIMITS.max} 个，等宽</small></div>
      {items.map((item, i) => (
        <div key={item.id} className="aui-dbb-item">
          <Input aria-label={`第 ${i + 1} 个数字的标题`} value={item.title} placeholder="标题" onChange={(e) => patch(i, { title: e.target.value }, `item-${item.id}`)} />
          <Choice
            label={`第 ${i + 1} 个数字的指标`}
            value={item.query?.metric?.kind === "standard" ? item.query.metric.key : ""}
            placeholder="选指标"
            options={metrics.map((m) => ({ value: m.key, label: m.name }))}
            onChange={(key) => {
              const def = metrics.find((m) => m.key === key);
              if (def) patch(i, { title: item.title || def.name, query: { ...item.query, metric: { kind: "standard", key: def.key, ...(def.version ? { version: def.version } : {}) } } });
            }}
          />
          <IconButton label={`删除第 ${i + 1} 个数字`} disabled={items.length <= WIDGET_GROUP_LIMITS.min} onClick={() => set(items.filter((_, j) => j !== i))} icon={<Trash2 />} />
        </div>
      ))}
      <div className="aui-dbb-add">
        <Button variant="ghost" size="sm" disabled={items.length >= WIDGET_GROUP_LIMITS.max} onClick={() => set([...items, { id: nextWidgetId(items, "n"), title: `数字 ${items.length + 1}` }])}><Plus />加一个数字</Button>
      </div>
    </section>
  );
}

/** Chart-type tiles (radio group; arrows move and pick). */
function KindTiles({ kinds, value, onChange }: { kinds: readonly WidgetKind[]; value: WidgetKind; onChange: (kind: WidgetKind) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const list = kinds.filter((k) => k !== "text");
  const onKey = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + list.length) % list.length;
    const kind = list[next];
    if (kind) onChange(kind);
    refs.current[next]?.focus();
  };
  return (
    <div className="aui-dbb-types" role="radiogroup" aria-label="图表类型">
      {list.map((kind, i) => (
        <button key={kind} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={kind === value} tabIndex={kind === value ? 0 : -1} className="aui-dbb-type" onClick={() => onChange(kind)} onKeyDown={(e) => onKey(e, i)}>
          {WIDGET_KIND_ICONS[kind]}
          <span>{WIDGET_KIND_LABELS[kind]}</span>
        </button>
      ))}
    </div>
  );
}
