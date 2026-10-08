import { useMemo, useState } from "react";
import { AlarmClock, CheckCheck, Clock, Inbox, MessageSquare, Plus, TriangleAlert, UserCog } from "lucide-react";
import {
  Button, CellPeople, CellText, Choice, DataTable, LiveStatus, MetricCard, MetricGrid, Panel, InlineAlert, RatioBar, ResourcePanel, RowActionBar,
  StatusBadge, Switch, TabbedPage, TodoInbox, useNotify, type Column,
} from "@adminui/react";
import { TICKETS, type Ticket } from "../../data/templates-data";

const STATE = { open: { label: "处理中", tone: "info" }, waiting: { label: "等客户回复", tone: "neutral" }, overdue: { label: "已超时", tone: "danger" }, solved: { label: "已解决", tone: "success" } } as const;
const PRIORITY = { urgent: { label: "紧急", tone: "danger" }, high: { label: "高", tone: "warning" }, normal: { label: "普通", tone: "neutral" } } as const;

/** T03 指标 + 列表页：分区标签行（右端：实时 · 页面按钮）→ 紧凑指标卡 → 「要处理的」（有才出现）→ 列表卡。 */
export function Demo() {
  const notify = useNotify();
  const now = useMemo(() => Date.now(), []);
  const [section, setSection] = useState("all");
  const [rows, setRows] = useState(TICKETS);
  const [priority, setPriority] = useState("all");
  const [page, setPage] = useState(1);
  const [handled, setHandled] = useState(false);

  const filtered = rows.filter((t) => (priority === "all" || t.priority === priority) && (section === "all" || t.assignee === "周可欣"));
  const columns: Column<Ticket>[] = [
    { key: "state", title: "状态", width: 110, render: (t) => <StatusBadge tone={STATE[t.state].tone}>{STATE[t.state].label}</StatusBadge> },
    { key: "title", title: "工单", maxWidth: 280, render: (t) => <CellText primary={<strong>{t.title}</strong>} secondary={`${t.id} · ${t.customer}`} /> },
    { key: "priority", title: "优先级", width: 84, render: (t) => <StatusBadge tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</StatusBadge> },
    { key: "assignee", title: "处理人", render: (t) => <CellPeople people={[{ name: t.assignee }]} /> },
    { key: "sla", title: "响应时限已用", width: 150, render: (t) => (t.state === "solved" ? "—" : <RatioBar ratio={t.sla} tone={t.sla > 0.85 ? "danger" : t.sla > 0.6 ? "attention" : "brand"} label={`${t.id} 时限已用`} />) },
    {
      key: "actions",
      title: "操作",
      kind: "actions",
      render: (t) => (
        <>
          <Switch checked={t.subscribed} aria-label={`${t.id} 关注更新`} onCheckedChange={(on) => setRows((list) => list.map((x) => (x.id === t.id ? { ...x, subscribed: on } : x)))} />
          <RowActionBar
            label={`${t.id}的更多操作`}
            actions={[
              { key: "reply", label: "回复", icon: <MessageSquare />, onSelect: () => notify(`回复 ${t.id}`) },
              { key: "assign", label: "转给", icon: <UserCog />, onSelect: () => notify("转给其他人") },
              { key: "close", label: "关闭工单", destructive: true, onSelect: () => notify(`关闭 ${t.id}`) },
            ]}
          />
        </>
      ),
    },
  ];

  const tickets = (
    <>
      <MetricGrid>
        <MetricCard title="打开的工单" icon={Inbox} value={17} unit="个" note="比昨天少 3 个" />
        <MetricCard title="已超时" icon={TriangleAlert} value={handled ? 0 : 1} unit="个" note="超过约定响应时间" />
        <MetricCard title="今天解决" icon={CheckCheck} value={23} unit="个" note="满意度 4.8 / 5" />
        <MetricCard title="平均首次响应" icon={Clock} value="11" unit="分钟" note="约定 30 分钟内" />
      </MetricGrid>
      {!handled && (
        <TodoInbox
          title="要处理的"
          items={[{
            key: "sla", icon: <AlarmClock />, tone: "danger", title: "T-2041 已超出响应时限",
            detail: "星河物流 · 导入客户时手机号格式报错 · 客户已追问 2 次", meta: "超时 6 分钟",
            actions: [{ key: "take", label: "我来处理", primary: true, onSelect: () => setHandled(true) }, { key: "assign", label: "转给别人", onSelect: () => notify("转给别人") }],
          }]}
        />
      )}
      <ResourcePanel
        title="工单"
        count={filtered.length}
        unit="个"
        description="按响应时限排序；开关 = 有更新时通知我。"
        actions={<Choice label="优先级" value={priority} onChange={(v) => { setPriority(v); setPage(1); }} options={[{ value: "all", label: "优先级：全部" }, { value: "urgent", label: "紧急" }, { value: "high", label: "高" }, { value: "normal", label: "普通" }]} />}
      >
        <DataTable caption="工单" rows={filtered.slice((page - 1) * 6, page * 6)} rowKey={(t) => t.id} columns={columns} rowHeight="medium" pagination={{ mode: "page", total: filtered.length, page, pageSize: 6, onPageChange: setPage, onPageSizeChange: () => setPage(1) }} />
      </ResourcePanel>
    </>
  );

  return (
    <div style={{ height: 680, overflow: "auto", padding: 16, background: "var(--aui-canvas)" }}>
      <TabbedPage
        title="工单"
        description="客户提交的问题；超过约定响应时间的会出现在「要处理的」。"
        actions={<><LiveStatus state="live" dataTime={now} /><Button size="sm" onClick={() => notify("新建工单")}><Plus />新建工单</Button></>}
        value={section}
        onValueChange={setSection}
        sections={[{ id: "all", label: "全部工单", count: 17 }, { id: "mine", label: "分给我的", count: 4 }, { id: "rules", label: "分配规则" }]}
        render={(id) => (id === "rules" ? <Panel title="分配规则"><InlineAlert title="这个分区演示里没有内容" /></Panel> : tickets)}
      />
    </div>
  );
}
