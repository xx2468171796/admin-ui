"use client";
/**
 * AccessConsole sections「权限解释」(ExplainPanel against `POST /explain`, plus「以他视角预览」: a
 * short-lived, read-only, audited snapshot of what someone else can do) and「授权审计」(filterable
 * audit list with AuditDiff, cursor「加载更多」). The view-as banner itself is rendered by AccessConsole.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { Eye, RefreshCw } from "lucide-react";
import { Button, Choice, Input, StatusBadge } from "../primitives.tsx";
import { FormField } from "../forms.tsx";
import { DescriptionList, InlineAlert, Panel, StatePanel } from "../layout.tsx";
import { DataTable } from "../data.tsx";
import { CellText } from "../cells.tsx";
import { DateTimeDisplay } from "../displays.tsx";
import { EffectiveAccessTable, ExplainPanel } from "./effective-access.tsx";
import { AuditDiff } from "./audit-diff.tsx";
import type { ExplainQuery, ExplainResult } from "./contracts.ts";
import type { AuditEventDto, AuditQuery, ViewAsDto } from "./console-contracts.ts";
import { auditActionLabel, auditActionOptions, auditEventDim, auditTargetLabel, errorLine, explainActions, remainingText, snapshotScopeLines } from "./console-core.ts";
import { ErrorAlert, StatusLine, useAction, useConsole, useSecondTick } from "./console-shared.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export function ExplainSection() {
  const c = useConsole();
  const resources = useMemo(() => (c.catalog?.resources ?? []).map((r) => ({ id: r.id, label: r.label })), [c.catalog]);
  const [query, setQuery] = useState<ExplainQuery>(() => ({ subjectId: c.preset.userId ?? "", action: "", resourceType: resources[0]?.id ?? "" }));
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (c.preset.userId) setQuery((q) => ({ ...q, subjectId: c.preset.userId! }));
  }, [c.preset.userId]);
  useEffect(() => {
    if (!query.resourceType && resources[0]) setQuery((q) => ({ ...q, resourceType: resources[0]!.id }));
  }, [resources, query.resourceType]);
  const actions = useMemo(() => explainActions(c.catalog, query.resourceType), [c.catalog, query.resourceType]);
  // 「他在 A 线能不能」（quanxian 2.2）：按某个维度值的视角解释
  const places = useMemo(() => (c.catalog?.scopedAssignments ? c.dimensions.flatMap((d) => d.values.map((v) => ({ id: `${d.id}:${v.id}`, label: c.dimensions.length > 1 ? `${d.label} · ${v.name}` : v.name, within: { dim: d.id, value: v.id } }))) : []), [c.catalog, c.dimensions]);
  if (!c.catalog) return <StatePanel kind="loading" message="正在加载权限目录…" />;
  return (
    <div className="aui-access-stack">
      <ExplainPanel
        places={places}
        placeLabel={c.dimensions.length === 1 ? `按${c.dimensions[0]!.label}看` : "按哪里看"}
        subjects={c.users.map((u) => ({ id: u.id, label: u.name, hint: u.hint }))}
        actions={actions}
        resources={resources}
        query={query}
        onQueryChange={(q) => setQuery(q.resourceType !== query.resourceType ? { ...q, action: "" } : q)}
        result={result}
        loading={loading}
        error={error || undefined}
        deptName={c.deptIdx.name}
        onEvaluate={async (q) => {
          setLoading(true);
          setError("");
          try {
            setResult(await c.api.explain(q));
          } catch (e) {
            setResult(null);
            setError(errorLine(e));
          } finally {
            setLoading(false);
          }
        }}
      />
      <ViewAsPanel />
    </div>
  );
}

function ViewAsPanel() {
  const c = useConsole();
  const ids = useId();
  const [userId, setUserId] = useState(c.preset.userId ?? "");
  const [reason, setReason] = useState("");
  const act = useAction();
  const view = c.viewAs;
  const name = (id: string) => c.userName(id);
  // 剩余时间每秒走一次（只在预览时）
  const tick = useSecondTick(!!view);
  const start = () =>
    act.run(async () => {
      if (!userId) throw new Error("请选择要预览的人");
      if (!reason.trim()) throw new Error("请填写预览原因（写进授权审计）");
      c.setViewAs(await c.api.viewAs(userId, reason.trim()));
      setReason("");
    }, "预览已开始：页面上方有提示条，到时间自动结束");
  const refresh = (v: ViewAsDto) => act.run(async () => c.setViewAs(await c.api.viewAsGet(v.token)), "已刷新预览");
  return (
    <Panel title="以他视角预览" description="只读、短时有效（默认 10 分钟）、记入授权审计。用来排查「他为什么看不到 / 能不能做」。">
      <ErrorAlert error={act.error} onDismiss={act.clear} />
      <StatusLine text={act.done} />
      {!view ? (
        <div className="aui-access-filters">
          <FormField label="预览谁" htmlFor={`${ids}-who`}>
            <Choice id={`${ids}-who`} label="预览谁" value={userId} placeholder="选择人员" options={c.users.map((u) => ({ value: u.id, label: u.name }))} onChange={setUserId} />
          </FormField>
          <FormField label="原因" htmlFor={`${ids}-why`} required>
            <Input id={`${ids}-why`} value={reason} placeholder="例如：排查他为什么看不到客户" onChange={(e) => setReason(e.target.value)} />
          </FormField>
          <div>
            <Button disabled={act.busy} onClick={() => void start()}>
              <Eye size={15} aria-hidden="true" />
              开始预览
            </Button>
          </div>
        </div>
      ) : (
        <div className="aui-access-stack">
          <div className="aui-access-bar">
            <StatusBadge tone="warning">只读预览</StatusBadge>
            <strong>{name(view.userId)}</strong>
            <span className="aui-note">剩余 {remainingText(view.expiresAt, tick)}</span>
            <span className="aui-access-bar-end">
              <Button size="sm" variant="outline" disabled={act.busy} onClick={() => void refresh(view)}>
                <RefreshCw size={14} aria-hidden="true" />
                刷新
              </Button>
              <Button size="sm" variant="ghost" onClick={() => c.setViewAs(null)}>结束预览</Button>
            </span>
          </div>
          <DescriptionList
            items={[
              { label: "角色", value: view.snapshot.roles.map((r) => c.roles.find((x) => x.id === r)?.name ?? r).join("、") || "无" },
              { label: "超级管理员", value: view.snapshot.superuser ? "是" : "否" },
              { label: "能进的页面", value: (view.snapshot.pages ?? []).join("、") || "无", full: true },
              { label: "数据范围", value: snapshotScopeLines(view.snapshot, c.catalog, c.dimNames).join("；") || "无", full: true },
            ]}
          />
          <EffectiveAccessTable rows={view.effective} subject={name(view.userId)} deptName={c.deptIdx.name} now={c.now} dimNames={c.dimNames} />
        </div>
      )}
    </Panel>
  );
}

/** The sticky banner while a preview is active (rendered at the top of AccessConsole). */
export function ViewAsBanner({ view, userName, onEnd }: { view: ViewAsDto; userName: string; onEnd: () => void }) {
  const now = useSecondTick();
  const left = remainingText(view.expiresAt, now);
  useEffect(() => {
    if (left === "已结束") onEnd();
  }, [left, onEnd]);
  return (
    <div className="aui-access-viewas">
      <InlineAlert tone="warning" title={`正在以「${userName}」的视角预览（只读）`} action={<Button size="sm" variant="outline" onClick={onEnd}>结束预览</Button>}>
        剩余 {left}。预览只给你看，不能用他的身份做任何修改；这次预览已记入授权审计。
      </InlineAlert>
    </div>
  );
}

const PAGE = 50;

/** Name from the audit snapshot (deleted departments / roles / posts are no longer in the lists). */
function snapshotName(e: AuditEventDto): string | null {
  for (const v of [e.after, e.before]) if (v && typeof v === "object" && typeof (v as { name?: unknown }).name === "string") return (v as { name: string }).name;
  return null;
}

export function AuditSection() {
  const c = useConsole();
  const ids = useId();
  const [filter, setFilter] = useState<AuditQuery>({});
  const [applied, setApplied] = useState<AuditQuery>({});
  const [rows, setRows] = useState<AuditEventDto[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const load = async (q: AuditQuery, append: boolean) => {
    setLoading(true);
    setError("");
    try {
      const list = await c.api.listAudit({ ...q, limit: PAGE, ...(append && rows.length ? { before: rows[rows.length - 1]!.id } : {}) });
      setRows((old) => (append ? [...old, ...list] : list));
      setMore(list.length === PAGE);
    } catch (e) {
      setError(errorLine(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load(applied, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);
  const set = (patch: Partial<AuditQuery>) => setFilter((f) => {
    const next: AuditQuery = { ...f, ...patch };
    for (const k of Object.keys(next) as (keyof AuditQuery)[]) if (next[k] === "" || next[k] === undefined) delete next[k];
    return next;
  });
  const filtered = Object.keys(applied).length > 0;
  // 维度事件（quanxian 2.2）：「调整业务线」「新建业务线」，对象类型写「业务线」而不是 dim:line
  const dimLabelOf = (e: AuditEventDto) => {
    const d = auditEventDim(e);
    return d ? c.dimNames.dim?.(d) : undefined;
  };
  const actionText = (e: AuditEventDto) => auditActionLabel(e.action, dimLabelOf(e));
  const typeText = (e: AuditEventDto) => c.catalog?.resources.find((r) => r.id === e.targetType)?.label ?? auditTargetLabel(e.targetType, dimLabelOf(e));
  const actionOptions = auditActionOptions(c.dims.length === 1 ? c.dims[0]!.label : undefined);
  const target = (e: AuditEventDto) => {
    if (e.targetType === "user") return c.userName(e.targetId);
    if (e.targetType === "dept") return c.deptIdx.byId.has(e.targetId) ? c.deptIdx.name(e.targetId) : (snapshotName(e) ?? e.targetId);
    if (e.targetType === "role") return c.roles.find((r) => r.id === e.targetId)?.name ?? snapshotName(e) ?? e.targetId;
    if (e.targetType === "post") return c.posts.find((p) => p.id === e.targetId)?.name ?? snapshotName(e) ?? e.targetId;
    if (e.targetType.startsWith("dim:")) return snapshotName(e) ?? c.dimNames.value?.(e.targetType.slice(4), e.targetId) ?? e.targetId;
    return snapshotName(e) ?? e.targetId;
  };
  return (
    <div className="aui-access-stack">
      <Panel title="授权审计" description="部门、岗位、角色、分配、个人加减、用户组、记录团队、视角预览的每一次改动；和改动在同一个事务里写入。">
        <div className="aui-access-filters">
          <FormField label="动作" htmlFor={`${ids}-action`}>
            <Choice id={`${ids}-action`} label="动作" value={filter.action ?? "__all"} options={[{ value: "__all", label: "全部动作" }, ...actionOptions]} onChange={(v) => set({ action: v === "__all" ? undefined : v })} />
          </FormField>
          <FormField label="操作人" htmlFor={`${ids}-actor`}>
            <Choice id={`${ids}-actor`} label="操作人" value={filter.actorId ?? "__all"} options={[{ value: "__all", label: "所有人" }, ...c.users.map((u) => ({ value: u.id, label: u.name }))]} onChange={(v) => set({ actorId: v === "__all" ? undefined : v })} />
          </FormField>
          <FormField label="对象类型" htmlFor={`${ids}-type`}>
            <Choice id={`${ids}-type`} label="对象类型" value={filter.targetType ?? "__all"} options={[{ value: "__all", label: "全部" }, ...["user", "role", "dept", "post", "group", ...(c.catalog?.resources ?? []).map((r) => r.id)].filter((v, i, a) => a.indexOf(v) === i).map((t) => ({ value: t, label: c.catalog?.resources.find((r) => r.id === t)?.label ?? auditTargetLabel(t) }))]} onChange={(v) => set({ targetType: v === "__all" ? undefined : v })} />
          </FormField>
          <FormField label="对象 ID" htmlFor={`${ids}-id`}>
            <Input id={`${ids}-id`} value={filter.targetId ?? ""} placeholder="如 c_a1" onChange={(e) => set({ targetId: e.target.value.trim() })} />
          </FormField>
          <div className="aui-access-bar">
            <Button onClick={() => setApplied({ ...filter })}>查询</Button>
            {filtered && <Button variant="ghost" onClick={() => { setFilter({}); setApplied({}); }}>清空</Button>}
          </div>
        </div>
      </Panel>
      <DataTable rowHeight="medium"
        caption="授权审计"
        rows={rows}
        rowKey={(e) => e.id}
        loading={loading && !rows.length}
        error={rows.length ? undefined : error || undefined}
        onRetry={() => void load(applied, false)}
        emptyKind={filtered ? "no-results" : "empty"}
        emptyLabel={filtered ? "没有符合条件的记录" : "还没有授权改动"}
        pagination={{ mode: "all" }}
        expandable={{ expanded, onExpandedChange: setExpanded, label: (e) => `${actionText(e)}的变更前后`, render: (e) => <AuditDiff before={e.before} after={e.after} caption={`${actionText(e)} · ${target(e)}`} /> }}
        columns={[
          { key: "at", title: "时间", width: 170, render: (e) => <DateTimeDisplay value={e.at} /> },
          { key: "actor", title: "操作人", minWidth: 120, render: (e) => <CellText primary={e.actorName && e.actorName !== e.actorId ? e.actorName : c.userName(e.actorId)} secondary={e.onBehalfOf && e.onBehalfOf !== e.actorId ? `代 ${c.userName(e.onBehalfOf)}` : undefined} /> },
          { key: "action", title: "动作", minWidth: 120, render: (e) => actionText(e) },
          { key: "target", title: "对象", minWidth: 140, render: (e) => <CellText primary={target(e)} secondary={typeText(e)} /> },
          { key: "reason", title: "原因", minWidth: 120, maxWidth: 280, truncate: (e) => e.reason || "—", render: (e) => e.reason || "—" },
        ]}
      />
      {error && rows.length > 0 && <InlineAlert tone="error" title="加载失败" action={<Button size="sm" variant="outline" onClick={() => void load(applied, true)}>重试</Button>}>{error}（已显示的记录仍然有效）</InlineAlert>}
      {more && (
        <div className="aui-access-bar">
          <Button variant="outline" disabled={loading} onClick={() => void load(applied, true)}>{loading ? "加载中…" : "加载更多"}</Button>
        </div>
      )}
    </div>
  );
}
