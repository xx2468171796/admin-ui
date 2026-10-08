"use client";
/**
 * EffectiveAccessTable — what one person can actually do: per permission code allowed / denied, the
 * effective scope, every allow source (role / post / personal / record grant / share rule …) and every
 * blocking reason (restriction / personal deny / tenant / feature off / step-up …), with filters.
 * ExplainPanel — Keycloak「Evaluate」style: pick subject / action / resource (+ optional record id),
 * the host evaluates (`access.explain`) and passes the result back; the panel shows the decision path,
 * sources, blocks, unknown-because-NULL hints, the effective condition and field outcomes.
 * Both are presentational: the host loads data and owns the evaluation request.
 */
import { useMemo, useState, type ReactNode } from "react";
import { CircleCheck, CircleDashed, CircleHelp, CircleX, Columns3, Filter, ListTree, MousePointerClick, Search, Table2 } from "lucide-react";
import { Button, Checkbox, Choice, Input, StatusBadge } from "../primitives.tsx";
import { ChipGroup, SegmentedControl } from "../choices.tsx";
import { InlineAlert, Panel } from "../layout.tsx";
import { DataTable } from "../data.tsx";
import { CellTags, CellText } from "../cells.tsx";
import { RowActionBar, type RowAction } from "../row-actions.tsx";
import { formatDateTime } from "../format.ts";
import {
  type AssignScope,
  ALLOW_SOURCE_LABEL,
  BLOCK_LABEL,
  EFFECTIVE_CATEGORY_LABEL,
  EXPLAIN_STAGE_LABEL,
  FIELD_ABILITY_LABEL,
  RECORD_LEVEL_LABEL,
  type AccessBlock,
  type AccessSource,
  type AllowSourceKind,
  type EffectiveAccessRow,
  type EffectiveCategory,
  type ExplainOutcome,
  type ExplainQuery,
  type ExplainResult,
  type FieldAbility,
} from "./contracts.ts";
import { describeScope, effectiveScopeLines, type DimNamer } from "./matrix-core.ts";
import { Tag } from "../kit.tsx";
import { expiryState, explainSummary, filterEffective, sourceCounts, type EffectiveFilter } from "./review-core.ts";
import { personalOnly, rowExpiry } from "./profile-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

const CATEGORY_ICON: Readonly<Record<EffectiveCategory, ReactNode>> = {
  action: <MousePointerClick aria-hidden="true" />,
  scope: <Filter aria-hidden="true" />,
  field: <Columns3 aria-hidden="true" />,
  record: <Table2 aria-hidden="true" />,
  subtable: <ListTree aria-hidden="true" />,
};

const BLOCK_TONE: Readonly<Record<AccessBlock["kind"], "danger" | "warning" | "neutral">> = {
  restriction: "danger",
  denied: "danger",
  tenant: "danger",
  feature_off: "neutral",
  step_up: "warning",
  expired: "warning",
  not_granted: "neutral",
  condition: "warning",
};
/** The same blocks as option-tone chips (danger → red, warning → yellow, neutral → gray). */
const BLOCK_CHIP = { danger: "red", warning: "yellow", neutral: "gray" } as const;

function SourceList({ sources, deptName, onSourceClick, now }: { sources: readonly AccessSource[]; deptName?: (id: string) => string; onSourceClick?: (s: AccessSource) => void; now?: Date }) {
  if (!sources.length) return <p className="aui-note">没有授予来源</p>;
  return (
    <ul className="aui-access-sources">
      {sources.map((s, i) => {
        const expiry = s.expiresAt !== undefined ? expiryState(s.expiresAt, now) : null;
        return (
          <li key={`${s.kind}-${s.id ?? ""}-${i}`}>
            <StatusBadge tone="brand">{ALLOW_SOURCE_LABEL[s.kind]}</StatusBadge>
            {onSourceClick && s.id ? (
              <Button size="sm" variant="text" onClick={() => onSourceClick(s)}>{s.label}</Button>
            ) : (
              <span>{s.label}</span>
            )}
            {s.scope && <span className="aui-note">范围：{describeScope(s.scope, deptName)}</span>}
            {s.within && <Tag>仅在{s.within.label}</Tag>}
            {s.level && <span className="aui-note">级别：{RECORD_LEVEL_LABEL[s.level]}</span>}
            {expiry && expiry.kind !== "permanent" && <StatusBadge tone={expiry.kind === "expired" ? "danger" : expiry.kind === "soon" ? "warning" : "neutral"}>{expiry.label}</StatusBadge>}
            {s.detail && <span className="aui-note">{s.detail}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function BlockList({ blocks }: { blocks: readonly AccessBlock[] }) {
  if (!blocks.length) return <p className="aui-note">没有拦截</p>;
  return (
    <ul className="aui-access-sources">
      {blocks.map((b, i) => (
        <li key={`${b.kind}-${b.id ?? ""}-${i}`}>
          <StatusBadge tone={BLOCK_TONE[b.kind]}>{BLOCK_LABEL[b.kind]}</StatusBadge>
          <span>{b.label}</span>
          {b.detail && <span className="aui-note">{b.detail}</span>}
        </li>
      ))}
    </ul>
  );
}

export type EffectiveAccessTableProps = {
  rows: readonly EffectiveAccessRow[];
  /** Whose access this is (shown in the caption), e.g.「张三」. */
  subject?: string;
  caption?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  /** Department id → name for custom scopes. */
  deptName?: (id: string) => string;
  /** Make sources with an id clickable (open the role / grant). */
  onSourceClick?: (source: AccessSource) => void;
  /** Controlled filter; omit to keep it inside. */
  filter?: EffectiveFilter;
  onFilterChange?: (filter: EffectiveFilter) => void;
  pageSize?: number;
  now?: Date;
  /** Names of dimensions / values in scopes (quanxian 2.2「我的业务线」). */
  dimNames?: DimNamer;
  /** Row buttons (D15: 撤销 a personal deny, 收回 a personal add); RowActionBar, ≤ 3 shown. */
  rowActions?: (row: EffectiveAccessRow) => readonly RowAction[];
  /** Controlled 「只看单独加减」 (rows decided by a personal add / deny); leave out to keep it inside. */
  personalOnly?: boolean;
  onPersonalOnlyChange?: (on: boolean) => void;
};

export function EffectiveAccessTable({
  rows,
  subject,
  caption,
  loading,
  error,
  onRetry,
  deptName,
  onSourceClick,
  filter: filterProp,
  onFilterChange,
  pageSize: initialSize = 20,
  now,
  dimNames,
  rowActions,
  personalOnly: personalProp,
  onPersonalOnlyChange,
}: EffectiveAccessTableProps) {
  const [personalInner, setPersonalInner] = useState(false);
  const personal = personalProp ?? personalInner;
  const setPersonal = (on: boolean) => {
    if (personalProp === undefined) setPersonalInner(on);
    onPersonalOnlyChange?.(on);
    setPage(1);
  };
  const [inner, setInner] = useState<EffectiveFilter>({ status: "all" });
  const filter = filterProp ?? inner;
  const setFilter = (patch: Partial<EffectiveFilter>) => {
    const next = { ...filter, ...patch };
    if (!filterProp) setInner(next);
    onFilterChange?.(next);
    setPage(1);
  };
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(initialSize);
  const [expanded, setExpanded] = useState<string[]>([]);
  const filtered = useMemo(() => {
    const list = filterEffective(rows, filter);
    return personal ? personalOnly(list) : list;
  }, [rows, filter, personal]);
  const hasPersonal = useMemo(() => personalOnly(rows).length > 0, [rows]);
  const hasCategory = rows.some((r) => r.category);
  const hasExpiry = rows.some((r) => rowExpiry(r) !== null);
  const counts = useMemo(() => sourceCounts(rows), [rows]);
  const kinds = (Object.keys(ALLOW_SOURCE_LABEL) as AllowSourceKind[]).filter((k) => counts.has(k));
  const pageRows = filtered.slice((page - 1) * size, page * size);
  const filtering = !!filter.query?.trim() || filter.status !== "all" || !!filter.sources?.length || !!filter.blockedOnly || personal;
  const allowed = rows.filter((r) => r.allowed).length;
  return (
    <div className="aui-access-effective">
      <div className="aui-access-filters">
        <label className="aui-access-search">
          <Search size={15} aria-hidden="true" />
          <Input type="search" clearable value={filter.query ?? ""} placeholder="搜索权限、编码或来源" aria-label="搜索权限" onChange={(e) => setFilter({ query: e.target.value })} />
        </label>
        <SegmentedControl
          label="结果"
          size="sm"
          value={filter.status ?? "all"}
          onValueChange={(status) => setFilter({ status })}
          options={[
            { value: "all", label: `全部 ${rows.length}` },
            { value: "allowed", label: `允许 ${allowed}` },
            { value: "denied", label: `拒绝 ${rows.length - allowed}` },
          ]}
        />
        <label className="aui-access-toggle">
          <Checkbox checked={!!filter.blockedOnly} onCheckedChange={(c) => setFilter({ blockedOnly: c === true })} aria-label="只看被拦截的" />
          <span>只看被拦截的</span>
        </label>
        {(hasPersonal || personal) && (
          <label className="aui-access-toggle">
            <Checkbox checked={personal} onCheckedChange={(c) => setPersonal(c === true)} aria-label="只看单独加减" />
            <span>只看单独加减</span>
          </label>
        )}
        {kinds.length > 1 && (
          <ChipGroup
            label="来源"
            value={filter.sources ?? []}
            onValueChange={(sources) => setFilter({ sources })}
            options={kinds.map((k) => ({ value: k, label: ALLOW_SOURCE_LABEL[k], count: counts.get(k) ?? 0 }))}
          />
        )}
      </div>
      <DataTable
        caption={caption ?? (subject ? `${subject}的有效权限` : "有效权限")}
        rows={pageRows}
        rowKey={(r) => r.code}
        loading={loading}
        error={error}
        onRetry={onRetry}
        // 只在某处持有的行（quanxian 2.2）每条来源一行范围：让行跟着内容长高，不用展开才看得全
        rowHeight={rows.some((r) => r.within?.length) ? "auto" : "medium"}
        emptyKind={filtering ? "no-results" : "empty"}
        emptyLabel={filtering ? "没有符合筛选的权限" : "没有权限数据"}
        emptyAction={filtering ? <Button variant="outline" onClick={() => { setFilter({ query: "", status: "all", sources: [], blockedOnly: false }); if (personal) setPersonal(false); }}>清除筛选</Button> : undefined}
        pagination={{ mode: "page", page, pageSize: size, total: filtered.length, onPageChange: setPage, onPageSizeChange: (n) => { setSize(n); setPage(1); } }}
        expandable={{
          expanded,
          onExpandedChange: setExpanded,
          label: (r) => `${r.label}的来源与拦截`,
          render: (r) => (
            <div className="aui-access-detail-grid">
              <div><h4>允许来源</h4><SourceList sources={r.sources} deptName={deptName} onSourceClick={onSourceClick} now={now} /></div>
              <div><h4>拦截原因</h4><BlockList blocks={r.blocks} /></div>
            </div>
          ),
        }}
        columns={[
          ...(hasCategory
            ? [{ key: "category", title: "类别", width: 96, render: (r: EffectiveAccessRow) => (r.category ? <span className="aui-access-category">{CATEGORY_ICON[r.category]}{EFFECTIVE_CATEGORY_LABEL[r.category]}</span> : <span className="aui-note">—</span>) }]
            : []),
          { key: "perm", title: "权限", minWidth: 180, maxWidth: 196, render: (r) => <CellText primary={<>{r.label}{r.risk === "high" && <> <StatusBadge tone="warning">高危</StatusBadge></>}</>} secondary={r.group ? `${r.group} · ${r.code}` : r.code} /> },
          {
            key: "allowed",
            title: "结果",
            width: 80,
            render: (r) => (r.allowed ? <StatusBadge tone="success">允许</StatusBadge> : <StatusBadge tone={r.blocks.some((b) => b.kind !== "not_granted") ? "danger" : "neutral"}>拒绝</StatusBadge>),
          },
          {
            key: "scope",
            title: "范围",
            minWidth: 100,
            maxWidth: 300,
            wrap: true,
            // 只经带范围的分配持有（quanxian 2.2）：每条来源各自的档位 + 地方（「本部门及以下（仅在 A 线）；仅本人（仅在 B 线）」）
            truncate: (r) => effectiveScopeLines(r, deptName, dimNames).join("；"),
            render: (r) => {
              const lines = effectiveScopeLines(r, deptName, dimNames);
              return r.within?.length ? <CellText primary={lines[0]} secondary={lines.slice(1).join("；") || undefined} /> : lines[0];
            },
          },
          {
            key: "sources",
            title: "来源",
            minWidth: 180,
            maxWidth: 280,
            wrap: true,
            // 只在某处持有的行（quanxian 2.2）：每条来源一行、换行显示全（行跟着长高）；其余照旧是标签
            render: (r) => {
              if (!r.sources.length) return <span className="aui-note">—</span>;
              const lines = r.sources.map((s) => `${ALLOW_SOURCE_LABEL[s.kind]}：${s.label}`);
              if (r.within?.length) return <CellText primary={lines[0]} secondary={lines.slice(1).join("；") || undefined} />;
              return <CellTags label="来源" items={r.sources.map((s, i) => ({ key: `${s.kind}-${s.id ?? ""}-${i}`, label: lines[i]!, tone: "green" as const }))} />;
            },
            detail: (r) => <SourceList sources={r.sources} deptName={deptName} now={now} />,
          },
          {
            key: "blocks",
            title: "拦截原因",
            minWidth: 150,
            maxWidth: 260,
            render: (r) => (r.blocks.length ? <CellTags label="拦截原因" items={r.blocks.map((b, i) => ({ key: `${b.kind}-${b.id ?? i}`, label: `${BLOCK_LABEL[b.kind]}${b.kind === "not_granted" ? "" : `：${b.label}`}`, tone: BLOCK_CHIP[BLOCK_TONE[b.kind]] }))} /> : <span className="aui-note">—</span>),
            detail: (r) => <BlockList blocks={r.blocks} />,
          },
          ...(hasExpiry
            ? [{
                key: "expiry",
                title: "到期",
                width: 96,
                render: (r: EffectiveAccessRow) => {
                  const iso = rowExpiry(r);
                  if (!iso) return <span className="aui-note">—</span>;
                  const e = expiryState(iso, now);
                  return <CellText primary={(formatDateTime(iso) ?? iso).slice(5)} secondary={e.kind === "soon" || e.kind === "expired" ? <span className="aui-access-expiry-soon">{e.label}</span> : e.label} />;
                },
              }]
            : []),
          ...(rowActions
            ? [{ key: "actions", title: "操作", kind: "actions" as const, render: (r: EffectiveAccessRow) => { const list = rowActions(r); return list.length ? <RowActionBar label={`${r.label}的更多操作`} actions={[...list]} /> : null; } }]
            : []),
        ]}
      />
    </div>
  );
}

const OUTCOME: Readonly<Record<ExplainOutcome, { label: string; tone: "success" | "danger" | "warning" | "neutral"; icon: ReactNode }>> = {
  pass: { label: "通过", tone: "success", icon: <CircleCheck size={16} aria-hidden="true" /> },
  fail: { label: "不通过", tone: "danger", icon: <CircleX size={16} aria-hidden="true" /> },
  unknown: { label: "未知", tone: "warning", icon: <CircleHelp size={16} aria-hidden="true" /> },
  skip: { label: "跳过", tone: "neutral", icon: <CircleDashed size={16} aria-hidden="true" /> },
};

export type ExplainOption = { id: string; label: string; hint?: string };
export type ExplainPanelProps = {
  /** People / service accounts to evaluate as. Large orgs: pass the searched subset or use `subjectPicker`. */
  subjects: readonly ExplainOption[];
  /** Replaces the subject select (e.g. a host search box); it must call onQueryChange itself. */
  subjectPicker?: ReactNode;
  actions: readonly ExplainOption[];
  /** Resource types. */
  resources: readonly ExplainOption[];
  query: ExplainQuery;
  onQueryChange: (query: ExplainQuery) => void;
  /** The host runs `access.explain` for this query and passes `result` back. */
  onEvaluate: (query: ExplainQuery) => void;
  result?: ExplainResult | null;
  loading?: boolean;
  error?: string;
  deptName?: (id: string) => string;
  title?: string;
  /**
   * Places to explain within (quanxian 2.2:「他在 A 线能不能」), e.g. each 业务线 value. Given = a「按哪里看」select
   * (default「不限」) that sets `query.within`.
   */
  places?: readonly { id: string; label: string; within: AssignScope }[];
  /** Label of the place select (default「按哪里看」). */
  placeLabel?: string;
};

const sameWithin = (a?: AssignScope, b?: AssignScope) => (a?.dim ?? "") === (b?.dim ?? "") && (a?.value ?? "") === (b?.value ?? "") && (a?.deptId ?? "") === (b?.deptId ?? "");
const sameQuery = (a: ExplainQuery, b: ExplainQuery) => a.subjectId === b.subjectId && a.action === b.action && a.resourceType === b.resourceType && (a.resourceId ?? "") === (b.resourceId ?? "") && sameWithin(a.within, b.within);
const ANY_PLACE = "__any__";

export function ExplainPanel({ subjects, subjectPicker, actions, resources, query, onQueryChange, onEvaluate, result, loading = false, error, deptName, title = "权限解释", places = [], placeLabel = "按哪里看" }: ExplainPanelProps) {
  const ready = !!query.subjectId && !!query.action && !!query.resourceType;
  const set = (patch: Partial<ExplainQuery>) => onQueryChange({ ...query, ...patch });
  const stale = result && !sameQuery(result.query, query);
  const tone = result?.decision === "allow" ? "success" : result?.decision === "conditional" ? "warning" : "error";
  const decisionLabel = result?.decision === "allow" ? "允许" : result?.decision === "conditional" ? "有条件允许" : "拒绝";
  const abilities: FieldAbility[] = ["read", "write", "export", "mask"];
  return (
    <Panel title={title} description="选择人员、动作和资源，按服务端同一套规则模拟判定；只读，不会改任何权限。" className="aui-access-explain">
      <form
        className="aui-access-explain-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !loading) onEvaluate({ ...query, resourceId: query.resourceId?.trim() || undefined });
        }}
      >
        <div className="aui-access-explain-field">
          <span className="aui-access-explain-label">人员</span>
          {subjectPicker ?? <Choice label="人员" value={query.subjectId} placeholder="选择人员" options={subjects.map((s) => ({ value: s.id, label: s.hint ? `${s.label}（${s.hint}）` : s.label }))} onChange={(subjectId) => set({ subjectId })} />}
        </div>
        <div className="aui-access-explain-field">
          <span className="aui-access-explain-label">动作</span>
          <Choice label="动作" value={query.action} placeholder="选择动作" options={actions.map((a) => ({ value: a.id, label: a.label }))} onChange={(action) => set({ action })} />
        </div>
        <div className="aui-access-explain-field">
          <span className="aui-access-explain-label">资源</span>
          <Choice label="资源" value={query.resourceType} placeholder="选择资源" options={resources.map((r) => ({ value: r.id, label: r.label }))} onChange={(resourceType) => set({ resourceType })} />
        </div>
        {places.length > 0 && (
          <div className="aui-access-explain-field">
            <span className="aui-access-explain-label">{placeLabel}</span>
            <Choice
              label={placeLabel}
              value={places.find((p) => sameWithin(p.within, query.within))?.id ?? ANY_PLACE}
              options={[{ value: ANY_PLACE, label: "不限" }, ...places.map((p) => ({ value: p.id, label: p.label }))]}
              onChange={(id) => {
                const p = places.find((x) => x.id === id);
                const { within: _old, ...rest } = query;
                onQueryChange(p ? { ...rest, within: p.within } : rest);
              }}
            />
          </div>
        )}
        <label className="aui-access-explain-field">
          <span className="aui-access-explain-label">记录 ID</span>
          <Input value={query.resourceId ?? ""} placeholder="留空 = 列表级（看过滤条件）" onChange={(e) => set({ resourceId: e.target.value })} />
        </label>
        <div className="aui-access-explain-submit">
          <Button type="submit" disabled={!ready || loading}>{loading ? "评估中…" : "评估"}</Button>
        </div>
      </form>
      {error && <InlineAlert tone="error" title="评估失败">{error}</InlineAlert>}
      {!result && !error && <p className="aui-note aui-access-explain-empty">选好人员、动作和资源后点「评估」。</p>}
      {result && (
        <div className="aui-access-explain-result" aria-busy={loading || undefined}>
          {stale && <InlineAlert tone="info" title="条件已改动">下面是上一次评估的结果，点「评估」刷新。</InlineAlert>}
          <InlineAlert tone={tone} title={`${result.subject.label}：${decisionLabel}`}>
            {explainSummary(result)}
          </InlineAlert>
          {!!result.unknown?.length && (
            <InlineAlert tone="warning" title="有字段为空，条件结果未知">
              {result.unknown.map((u) => `${u.label ?? u.field}（${u.field}）${u.note ? `：${u.note}` : ""}`).join("；")}。未知按拒绝处理；补齐这些字段，或让规则对空值有明确写法。
            </InlineAlert>
          )}
          <section className="aui-access-explain-section">
            <h3>判定路径</h3>
            <ol className="aui-access-steps">
              {result.steps.map((s, i) => (
                <li key={`${s.stage}-${i}`} data-outcome={s.outcome}>
                  <span className="aui-access-step-icon" data-outcome={s.outcome}>{OUTCOME[s.outcome].icon}</span>
                  <span className="aui-access-step-text">
                    <span className="aui-access-step-head">
                      <strong>{EXPLAIN_STAGE_LABEL[s.stage]}</strong>
                      <StatusBadge tone={OUTCOME[s.outcome].tone}>{OUTCOME[s.outcome].label}</StatusBadge>
                    </span>
                    <span>{s.label}</span>
                    {s.detail && <span className="aui-note">{s.detail}</span>}
                  </span>
                </li>
              ))}
              {!result.steps.length && <li className="aui-note">服务端没有返回判定路径</li>}
            </ol>
          </section>
          <div className="aui-access-detail-grid">
            <section className="aui-access-explain-section"><h3>允许来源</h3><SourceList sources={result.allowedBy} deptName={deptName} /></section>
            <section className="aui-access-explain-section"><h3>拦截原因</h3><BlockList blocks={result.blockedBy} /></section>
          </div>
          {result.condition && (
            <section className="aui-access-explain-section">
              <h3>生效条件</h3>
              <code className="aui-access-condition">{result.condition}</code>
            </section>
          )}
          {!!result.fields?.length && (
            <section className="aui-access-explain-section">
              <h3>字段</h3>
              <div className="aui-access-matrix-scroll">
                {/* admin-ui-audit-ignore raw-control: SDK 内部——ExplainPanel 组件自己的字段判定小表（行头 th scope=row + 读 / 写 / 导出 / 脱敏四列） */}
                <table className="aui-access-fields">
                  <caption className="aui-sr-only">字段判定</caption>
                  <thead><tr><th scope="col">字段</th>{abilities.map((a) => <th key={a} scope="col">{FIELD_ABILITY_LABEL[a]}</th>)}</tr></thead>
                  <tbody>
                    {result.fields.map((f) => (
                      <tr key={f.id}>
                        <th scope="row">{f.label}</th>
                        {abilities.map((a) => <td key={a}>{f[a] ? <StatusBadge tone={a === "mask" ? "warning" : "success"}>是</StatusBadge> : <span className="aui-access-denied" aria-label="否">—</span>}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {result.evaluatedAt && <p className="aui-note">评估时间：{new Date(result.evaluatedAt).toLocaleString("zh-CN")}</p>}
        </div>
      )}
    </Panel>
  );
}
