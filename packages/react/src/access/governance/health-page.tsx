"use client";
/**
 * SecurityHealthPage — the permission health check: overall verdict, counts per level, items grouped
 * 严重 / 警告 / 正常 with expandable samples (which people / roles / rules), and the PostgreSQL
 * row-level-security self check when the host provides it.
 */
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button, StatusBadge } from "../../primitives.tsx";
import { InlineAlert, MetricCard, MetricGrid, PageBody, PageHeader, Panel, ResourcePanel } from "../../layout.tsx";
import { DataTable } from "../../data.tsx";
import { CellText } from "../../cells.tsx";
import { CellDate } from "../../displays.tsx";
import { HEALTH_LEVEL_LABEL, type HealthItem, type HealthLevel, type HealthReportDto, type RlsCheckDto } from "./contracts.ts";
import { groupHealth, healthSummary, rlsSummary } from "./governance-core.ts";
import { GovLoad, StaleAlert, useGov, type GovPageBaseProps } from "./shared.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type SecurityHealthPageProps = GovPageBaseProps & {
  /** tenant (default): `GET /health`; platform: `GET /platform/health` (cross-tenant). */
  scope?: "tenant" | "platform";
  /** Optional RLS self check (quanxian/drizzle rlsSelfCheck), as data or a loader. */
  rls?: RlsCheckDto | ((signal: AbortSignal) => Promise<RlsCheckDto>);
};

const TONE: Readonly<Record<HealthLevel, "danger" | "warning" | "success">> = { error: "danger", warn: "warning", ok: "success" };
const ALERT: Readonly<Record<HealthLevel, "error" | "warning" | "success">> = { error: "error", warn: "warning", ok: "success" };

export function SecurityHealthPage({ api, scope = "tenant", rls, active = true }: SecurityHealthPageProps) {
  const res = useGov<HealthReportDto>(`gov:health:${scope}`, (signal) => (scope === "platform" ? api.platform.health({ signal }) : api.health({ signal })), active);
  const rlsLoader = typeof rls === "function" ? rls : null;
  const rlsRes = useGov<RlsCheckDto | null>(`gov:health:rls:${scope}`, async (signal) => (rlsLoader ? rlsLoader(signal) : null), active && !!rlsLoader);
  const rlsData = typeof rls === "object" ? rls : rlsRes.data;
  return (
    <>
      <PageHeader
        title={scope === "platform" ? "平台安全体检" : "安全体检"}
        description="自动检查权限配置里的风险：长期没用的高危权限、违反职责分离、没人管的超级管理员、过期没收回的授权等。点开一项看具体是谁。"
        actions={
          <Button variant="outline" disabled={res.loading} onClick={() => { void res.refresh(); if (rlsLoader) void rlsRes.refresh(); }}>
            <RefreshCw />
            {res.loading && res.data ? "体检中…" : "重新体检"}
          </Button>
        }
      />
      <PageBody>
        <StaleAlert res={res} />
        <GovLoad res={res} label="体检结果">
          {(report) => <HealthReport report={report} />}
        </GovLoad>
        {(rlsData || rlsRes.error) && (
          <Panel title="数据库行级安全（RLS）" description="确认业务连接用的数据库角色绕不过租户隔离。">
            {rlsData ? <RlsTable rls={rlsData} /> : <InlineAlert tone="error" title="行级安全自检失败" action={<Button size="sm" variant="outline" onClick={() => void rlsRes.refresh()}>重试</Button>}>{rlsRes.error}</InlineAlert>}
          </Panel>
        )}
      </PageBody>
    </>
  );
}

function HealthReport({ report }: { report: HealthReportDto }) {
  const summary = healthSummary(report);
  const groups = groupHealth(report.items);
  return (
    <>
      <InlineAlert tone={ALERT[summary.level]} title={summary.text}>
        体检时间 <CellDate value={report.checkedAt} time />
      </InlineAlert>
      <MetricGrid>
        <MetricCard title="严重" value={summary.counts.error} unit="项" note="需要尽快处理" />
        <MetricCard title="警告" value={summary.counts.warn} unit="项" note="建议处理" />
        <MetricCard title="正常" value={summary.counts.ok} unit="项" note="检查通过" />
      </MetricGrid>
      {groups.map((g) => (
        <HealthGroup key={g.level} level={g.level} items={g.items} />
      ))}
    </>
  );
}

function HealthGroup({ level, items }: { level: HealthLevel; items: HealthItem[] }) {
  const [expanded, setExpanded] = useState<string[]>(level === "ok" ? [] : items.filter((i) => i.samples.length).slice(0, 1).map((i) => i.id));
  return (
    <ResourcePanel title={`${HEALTH_LEVEL_LABEL[level]}（${items.length}）`}>
      <DataTable rowHeight="medium"
        caption={`${HEALTH_LEVEL_LABEL[level]}的检查项`}
        rows={items}
        rowKey={(i) => i.id}
        pagination={{ mode: "all" }}
        expandable={{
          expanded,
          onExpandedChange: setExpanded,
          label: (i) => `${i.title} 的明细`,
          canExpand: (i) => i.samples.length > 0,
          render: (i) => (
            <ul className="aui-gov-samples" aria-label={`${i.title} 的明细`}>
              {i.samples.map((s) => (
                <li key={s.id}>
                  <strong>{s.label}</strong>
                  {s.detail && <span className="aui-note">{s.detail}</span>}
                </li>
              ))}
              {i.count > i.samples.length && <li className="aui-note">{`另外还有 ${i.count - i.samples.length} 项没有列出`}</li>}
            </ul>
          ),
        }}
        columns={[
          { key: "title", title: "检查项", minWidth: 220, maxWidth: 420, render: (i) => <CellText primary={i.title} secondary={i.detail} secondaryTitle={i.detail} /> },
          { key: "level", title: "级别", width: 80, render: (i) => <StatusBadge tone={TONE[i.level]}>{HEALTH_LEVEL_LABEL[i.level]}</StatusBadge> },
          { key: "count", title: "数量", width: 80, numeric: true, render: (i) => i.count.toLocaleString() },
          { key: "samples", title: "例如", minWidth: 160, maxWidth: 280, truncate: (i) => i.samples.map((s) => s.label).join("、") || "—", render: (i) => i.samples.map((s) => s.label).join("、") || "—" },
        ]}
      />
    </ResourcePanel>
  );
}

function RlsTable({ rls }: { rls: RlsCheckDto }) {
  const summary = rlsSummary(rls);
  const yes = (v: boolean, good = true) => <StatusBadge tone={v === good ? "success" : "danger"}>{v ? "是" : "否"}</StatusBadge>;
  return (
    <div className="aui-gov-rls">
      <InlineAlert tone={summary.ok ? "success" : "error"} title={summary.text}>
        连接角色 <code className="aui-gov-code">{rls.role}</code>：超级用户 {rls.superuser ? "是" : "否"} · BYPASSRLS {rls.bypassRls ? "是" : "否"}
      </InlineAlert>
      {rls.issues.length > 0 && (
        <ul className="aui-gov-samples" aria-label="行级安全问题">
          {rls.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
      <DataTable rowHeight="medium"
        caption="各表的行级安全状态"
        rows={rls.tables}
        rowKey={(t) => t.table}
        pagination={{ mode: "all" }}
        columns={[
          { key: "table", title: "表", minWidth: 160, render: (t) => <code className="aui-gov-code">{t.table}</code> },
          { key: "owner", title: "所有者", width: 120, render: (t) => t.owner },
          { key: "rls", title: "已开启", width: 80, render: (t) => yes(t.rls) },
          { key: "forced", title: "强制", width: 80, render: (t) => yes(t.forced) },
          { key: "policies", title: "策略数", width: 80, numeric: true, render: (t) => t.policies },
          { key: "owned", title: "归业务角色所有", width: 130, render: (t) => yes(t.ownedByApp, false) },
        ]}
      />
    </div>
  );
}
