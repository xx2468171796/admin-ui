import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  Box,
  CalendarDays,
  Check,
  Clock,
  Copy,
  Database,
  Eye,
  FileText,
  Inbox,
  JapaneseYen,
  KeyRound,
  LayoutGrid,
  Link2,
  Pause,
  Pencil,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Server,
  Settings,
  Share2,
  Shield,
  SquareTerminal,
  Tag as TagIcon,
  TriangleAlert,
  Upload,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  ActionList,
  Button,
  ChangeMark,
  ChatMessage,
  ChatThread,
  Checkbox,
  ChipGroup,
  Choice,
  ChoiceTiles,
  Composer,
  CopyBlock,
  CopyableValue,
  DataTable,
  FormField,
  FormSection,
  GraphLayout,
  InfoList,
  InlineAlert,
  Input,
  ListDetailLayout,
  LiveStatus,
  LoadingDots,
  LogTimeline,
  Meter,
  MetricCard,
  MetricGrid,
  PageBody,
  PageHeader,
  Pane,
  PaneSection,
  Panel,
  PersonLine,
  PresenceList,
  QueryBar,
  QuickLinks,
  RatioBar,
  ResourcePanel,
  RowActionBar,
  RowActions,
  SaveBar,
  SearchField,
  SegmentedControl,
  SelectList,
  SideNavLayout,
  SplitLayout,
  StatStrip,
  StatusBadge,
  Switch,
  TabbedPage,
  TodoInbox,
  ToolCallCard,
  BarList,
  CellPeople,
  CellTags,
  CellText,
  WizardLayout,
  WorkItemCard,
  WorkItemList,
  WorkspaceLayout,
  useAdminTheme,
  useNotify,
  type Column,
  type LogDiff,
  type WorkspaceItem,
  IconButton,
  DescriptionList,
} from "@adminui/react";

// 页面模板（PAGE-TEMPLATES.md）：已审定的 T01–T13 每个一页，只用 SDK 组件拼；内容是运维平台的演示数据。
// 新页面先选模板，照对应的一页改内容，不改布局。

const clock = (t: number) => new Date(t).toLocaleTimeString("zh-CN", { hour12: false });
const useDemo = () => {
  const notify = useNotify();
  return (what: string) => () => notify(`演示：${what}`);
};

// ---------------------------------------------------------------- T01 工作台首页

function HomeTemplate() {
  const demo = useDemo();
  const now = useMemo(() => Date.now(), []);
  const [stat, setStat] = useState("reach");
  const pick = (key: string) => ({ onSelect: () => setStat(key), selected: stat === key });
  return (
    <>
      <PageHeader title="工作台首页" />
      <PageBody>
        <StatStrip
          title="运营概况"
          description="每张卡一个数：现在怎么样、和昨天比。数字点开去对应页面。"
          actions={<><LiveStatus state="live" dataTime={now} /><Button size="sm" variant="outline" onClick={demo("刷新")}><RefreshCw />刷新</Button></>}
          items={[
            { key: "reach", label: "机器可达", icon: <Server />, value: "38/38", unit: "台", note: "100% · 比昨天持平", ...pick("reach") },
            { key: "backup", label: "备份达标", icon: <Upload />, value: "21/21", unit: "条", note: "红 0 · 黄 0 · 未跑 0", ...pick("backup") },
            { key: "idle", label: "闲置授权", icon: <Shield />, value: 41, unit: "条", note: "占 48% · 满 45 天才判断", noteTone: "attention", ...pick("idle") },
            { key: "temp", label: "临时接入", icon: <KeyRound />, value: 0, unit: "个", note: "AI 密钥 21 把生效中", ...pick("temp") },
            { key: "online", label: "在线的人", icon: <Users />, value: 2, unit: "人", note: "SSH 0 · 网页终端 0", href: "#online" },
            { key: "ai", label: "AI 会话", icon: <LayoutGrid />, value: 2, unit: "个", note: "近 5 分钟在用" },
          ]}
        />
        <SplitLayout
          rail={
            <>
              <PresenceList
                count="2 人"
                actions={<LiveStatus state="live" />}
                summary={[{ key: "ssh", label: "SSH", value: 0 }, { key: "web", label: "网页终端", value: 0 }, { key: "ai", label: "AI", value: 2 }]}
                people={[
                  { key: "admin", name: "admin", hint: "AI 助理 · 3 分钟前", status: <StatusBadge tone="success">在用</StatusBadge> },
                  { key: "mia", name: "mia", hint: "Claude Code · 刚刚", bot: true, status: <StatusBadge tone="success">在用</StatusBadge> },
                ]}
              />
              <Panel title="常用入口">
                <QuickLinks
                  items={[
                    { key: "m", label: "机器", icon: <Server />, onSelect: demo("打开机器") },
                    { key: "a", label: "凭据", icon: <Box />, onSelect: demo("打开凭据") },
                    { key: "b", label: "备份", icon: <Upload />, onSelect: demo("打开备份") },
                    { key: "r", label: "远控", icon: <SquareTerminal />, onSelect: demo("打开远控") },
                    { key: "g", label: "授权", icon: <Shield />, onSelect: demo("打开授权") },
                    { key: "ai", label: "AI 助理", icon: <LayoutGrid />, onSelect: demo("打开 AI 助理") },
                    { key: "al", label: "告警", icon: <Bell />, onSelect: demo("打开告警") },
                    { key: "au", label: "审计日志", icon: <FileText />, onSelect: demo("打开审计日志") },
                  ]}
                />
              </Panel>
            </>
          }
        >
          <TodoInbox
            description="要你处理或知道的事，最急的在上面；处理完自动消失。"
            filters={[{ key: "today", label: "今天" }, { key: "fyi", label: "知道一下" }]}
            items={[
              { key: "join", icon: <Server />, tone: "attention", title: "3 台机器还没接入", detail: "登记了但还没装上运维平台公钥：家庭软路由、公司 PVE 子机、测试机 2", meta: "2 天了", filters: ["today"], actions: [{ key: "join", label: "一键接入", primary: true, onSelect: demo("一键接入") }, { key: "see", label: "看机器", onSelect: demo("看机器") }] },
              { key: "mirror", icon: <Link2 />, tone: "attention", title: "1 个仓镜像到 GitHub 有问题", detail: "admin/widgets：GitHub 有同名仓，看门狗修不了", meta: "今天", filters: ["today"], actions: [{ key: "fix", label: "去处理", primary: true, onSelect: demo("去处理") }] },
              { key: "db", icon: <Database />, tone: "attention", title: "1 个数据库采集失败", detail: "crm-pg：权限不够，库介绍里的事实会过期", meta: "3 小时", filters: ["today"], actions: [{ key: "fix", label: "修连接", primary: true, onSelect: demo("修连接") }, { key: "detail", label: "详情", onSelect: demo("详情") }] },
              { key: "schema", icon: <FileText />, tone: "info", title: "23 个数据库结构有变化", detail: "介绍写完后又建了表 / 改了结构，AI 用到时会补写", meta: "本周", filters: ["fyi"], actions: [{ key: "see", label: "看看", onSelect: demo("看看") }] },
            ]}
            ok={["机器 38/38 可达", "备份 21/21 达标", "远控客户端都是最新"]}
          />
          <Panel title="最近的操作" description="所有人和 AI 最近做的事；完整记录在审计日志。" flush actions={<Button size="sm" variant="ghost" onClick={demo("全部审计日志")}>全部审计日志 ›</Button>}>
            <ActionList
              dense
              label="最近的操作"
              items={[
                { key: "1", avatar: "a", title: <><strong>admin</strong> 部署了运维平台 5afba4ab</>, meta: "2 分钟前" },
                { key: "2", avatar: "C", bot: true, title: <><strong>mia 的 claude</strong> 在 nas-01 上执行命令 <code>pm2 ls</code></>, meta: "6 分钟前" },
                { key: "3", avatar: "a", title: <><strong>admin</strong> 改了凭据「Claude 长期令牌」的分享</>, meta: "18 分钟前" },
                { key: "4", avatar: "C", bot: true, title: <><strong>sam 的 codex</strong> 立即备份 nas-01-mysql-all</>, meta: "25 分钟前" },
                { key: "5", avatar: "l", title: <><strong>leo</strong> 登录了网页终端 Acme 测试机</>, meta: "41 分钟前" },
              ]}
            />
          </Panel>
        </SplitLayout>
      </PageBody>
    </>
  );
}

// ---------------------------------------------------------------- T02 资源列表页

type Machine = { id: string; name: string; note: string; status: "online" | "down" | "check"; ip: string; agent: "ok" | "old" | "none"; agentNote: string; owner: string; mine: boolean };
const machines: Machine[] = [
  { id: "nas-01", name: "nas-01", note: "NAS · 运维平台第一跳 · Debian 12", status: "online", ip: "203.0.113.10", agent: "ok", agentNote: "1.42.0 · 2 秒前心跳", owner: "admin", mine: true },
  { id: "web-01", name: "web-01", note: "生产环境 · 103 · 主站", status: "online", ip: "203.0.113.18", agent: "ok", agentNote: "1.42.0 · 3 秒前心跳", owner: "admin", mine: true },
  { id: "ct102", name: "应用网关 (VM-102)", note: "PVE 容器 · 对外接口前置，只读白名单访问", status: "online", ip: "203.0.113.21", agent: "old", agentNote: "1.39.2 → 1.42.0", owner: "mia", mine: false },
  { id: "test", name: "Acme 测试机", note: "办公室 · 测试实例与 CI 跑批", status: "online", ip: "198.51.100.7", agent: "ok", agentNote: "1.42.0 · 1 秒前心跳", owner: "leo", mine: true },
  { id: "router", name: "家庭软路由", note: "OpenWrt · 登记了，还没装上运维平台公钥", status: "down", ip: "198.51.100.23", agent: "none", agentNote: "还没装", owner: "sam", mine: false },
  { id: "szpg", name: "web-pg 数据库机", note: "PostgreSQL 16 + PgBouncer 公网端口", status: "online", ip: "203.0.113.22", agent: "ok", agentNote: "1.42.0 · 2 秒前心跳", owner: "admin", mine: false },
  { id: "pve", name: "公司 PVE 子机", note: "Proxmox · 新开的虚拟机，等首次体检", status: "check", ip: "203.0.113.57", agent: "none", agentNote: "还没装", owner: "mia", mine: false },
  { id: "forge", name: "ai-forge 工作站", note: "专用 AI 机 · Codex / Claude 跑批与素材生成，内存 64G", status: "online", ip: "198.51.100.88", agent: "ok", agentNote: "1.42.0 · 4 秒前心跳", owner: "admin", mine: true },
];
const STATUS = { online: { label: "在线", tone: "success" }, down: { label: "连不上", tone: "danger" }, check: { label: "待体检", tone: "warning" } } as const;

function MachineList({ rows, total }: { rows: readonly Machine[]; total: number }) {
  const demo = useDemo();
  const [selected, setSelected] = useState<string[]>(["nas-01"]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [owner, setOwner] = useState("all");
  const [group, setGroup] = useState("all");
  const [page, setPage] = useState(1);
  const columns: Column<Machine>[] = [
    { key: "name", title: "机器", maxWidth: 300, render: (m) => <CellText primary={<strong>{m.name}</strong>} secondary={m.note} secondaryTitle={m.note} /> },
    { key: "status", title: "状态", width: 96, render: (m) => <StatusBadge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</StatusBadge> },
    { key: "ip", title: "地址", render: (m) => <CopyableValue variant="inline" value={m.ip} label={`${m.name} 的地址`} /> },
    { key: "agent", title: "常驻服务", render: (m) => m.agent === "none" ? <CellText primary="—" secondary={m.agentNote} /> : <CellText primary={<StatusBadge tone={m.agent === "ok" ? "success" : "warning"}>{m.agent === "ok" ? "已装" : "待升级"}</StatusBadge>} secondary={m.agentNote} /> },
    { key: "owner", title: "归属人", render: (m) => <CellPeople people={[{ name: m.owner }]} /> },
    {
      key: "actions",
      title: "操作",
      kind: "actions",
      render: (m) => (
        <RowActionBar
          label={`${m.name}的更多操作`}
          actions={m.status === "down"
            ? [{ key: "join", label: "一键接入", icon: <KeyRound />, onSelect: demo("一键接入") }, { key: "check", label: "体检", icon: <RefreshCw />, onSelect: demo("体检") }, { key: "edit", label: "编辑", icon: <Pencil />, onSelect: demo("编辑") }, { key: "del", label: "删除", destructive: true, onSelect: demo("删除") }]
            : [{ key: "term", label: "终端", icon: <SquareTerminal />, onSelect: demo("打开终端") }, { key: "doc", label: "介绍", icon: <FileText />, onSelect: demo("介绍") }, { key: "edit", label: "编辑", icon: <Pencil />, onSelect: demo("编辑") }, { key: "check", label: "体检", icon: <RefreshCw />, onSelect: demo("体检") }, { key: "del", label: "删除", destructive: true, onSelect: demo("删除") }]}
        />
      ),
    },
  ];
  const opt = (label: string, values: string[]) => [{ value: "all", label: `${label}：全部` }, ...values.map((v) => ({ value: v, label: v }))];
  return (
    <ResourcePanel
      title="机器"
      count={total}
      unit="台"
      description="所有登记的机器；状态每分钟体检一次。"
      actions={<><Button size="sm" variant="outline" onClick={demo("一键脚本接入")}><SquareTerminal />一键脚本接入</Button><Button size="sm" onClick={demo("新增机器")}><Plus />新增机器</Button><IconButton label="刷新" variant="outline" onClick={demo("刷新")} icon={<RefreshCw />} /></>}
      filters={
        <QueryBar value={q} onChange={setQ} onSearch={demo("查询")} onReset={() => { setQ(""); setStatus("all"); setOwner("all"); setGroup("all"); }} placeholder="搜名称、地址、备注">
          <Choice label="状态" value={status} onChange={setStatus} options={opt("状态", ["在线", "连不上", "待体检"])} />
          <Choice label="归属人" value={owner} onChange={setOwner} options={opt("归属人", ["admin", "mia", "leo", "sam"])} />
          <Choice label="分组" value={group} onChange={setGroup} options={opt("分组", ["生产", "测试", "办公室"])} />
        </QueryBar>
      }
    >
      <DataTable
        caption="机器列表"
        rows={rows}
        rowKey={(m) => m.id}
        columns={columns}
        rowHeight="medium"
        selected={selected}
        onSelectionChange={setSelected}
        expandRecord={{ title: (m) => m.name }}
        bulkActions={[
          { key: "grant", label: "批量授权", icon: <Shield />, onSelect: demo("批量授权") },
          { key: "check", label: "批量体检", icon: <RefreshCw />, onSelect: demo("批量体检") },
        ]}
        pagination={{ mode: "page", total, page, pageSize: 8, pageSizes: [8, 20, 50], onPageChange: setPage, onPageSizeChange: () => setPage(1) }}
      />
    </ResourcePanel>
  );
}

function ListTemplate({ active }: { active: boolean }) {
  const [section, setSection] = useState("all");
  return (
    <TabbedPage
      title="资源列表页"
      active={active}
      value={section}
      onValueChange={setSection}
      sections={[{ id: "all", label: "全部机器", count: 38 }, { id: "mine", label: "我能连的", count: 12 }]}
      render={(id) => <MachineList rows={id === "all" ? machines : machines.filter((m) => m.mine)} total={id === "all" ? 38 : 12} />}
    />
  );
}

// ---------------------------------------------------------------- T03 指标 + 列表页

type Policy = { id: string; state: "running" | "failed" | "ok" | "paused"; name: string; note: string; machine: string; to: string; last: string; progress?: number; next: string; on: boolean };
const policies: Policy[] = [
  { id: "p1", state: "running", name: "nas-01-mysql-all", note: "MySQL 全库 · 每天 04:00 · 留 14 份", machine: "nas-01", to: "SILO · web-01 节点", last: "昨天 04:12", progress: 0.62, next: "", on: true },
  { id: "p2", state: "failed", name: "web-pg-main", note: "PostgreSQL 16 · 每 6 小时 · 留 28 份", machine: "web-01", to: "SILO · nas-01 节点", last: "今天 00:06", next: "下次 06:00", on: true },
  { id: "p3", state: "ok", name: "nas-01-pg", note: "PostgreSQL 共享实例 · 每 6 小时 · 留 28 份", machine: "nas-01", to: "SILO · web-01 节点", last: "今天 00:03", next: "下次 06:00", on: true },
  { id: "p4", state: "ok", name: "app-relay-etc", note: "目录 /etc + /opt/relay · 每天 03:30 · 留 7 份", machine: "应用网关 (VM-102)", to: "SILO · nas-01 节点", last: "今天 03:31", next: "明天 03:30", on: true },
  { id: "p5", state: "ok", name: "web-redis-rdb", note: "Redis 快照 · 每小时 · 留 48 份", machine: "web-01", to: "SILO · nas-01 节点", last: "今天 04:00", next: "下次 05:00", on: true },
  { id: "p6", state: "ok", name: "git-data", note: "代码仓目录 /data/git · 每天 02:00 · 留 14 份", machine: "nas-01", to: "SILO · web-01 节点", last: "今天 02:09", next: "明天 02:00", on: true },
  { id: "p7", state: "paused", name: "test-box-home", note: "目录 /home · 每周日 · 留 4 份", machine: "Acme 测试机", to: "SILO · nas-01 节点", last: "9 天前", next: "暂停中，不会跑", on: false },
];
const POLICY_STATE = { running: { label: "正在备份", tone: "success" }, failed: { label: "校验没过", tone: "warning" }, ok: { label: "达标", tone: "success" }, paused: { label: "已暂停", tone: "neutral" } } as const;

function BackupList() {
  const demo = useDemo();
  const [rows, setRows] = useState(policies);
  const [machine, setMachine] = useState("all");
  const columns: Column<Policy>[] = [
    { key: "state", title: "状态", width: 96, render: (p) => <StatusBadge tone={POLICY_STATE[p.state].tone}>{POLICY_STATE[p.state].label}</StatusBadge> },
    { key: "name", title: "策略", maxWidth: 300, render: (p) => <CellText primary={<strong>{p.name}</strong>} secondary={p.note} secondaryTitle={p.note} /> },
    { key: "machine", title: "机器", truncate: (p) => p.machine, maxWidth: 140, render: (p) => p.machine },
    { key: "to", title: "写到", render: (p) => p.to },
    { key: "last", title: "最近成功", render: (p) => p.last },
    { key: "next", title: "进度 / 下次", render: (p) => (p.progress !== undefined ? <RatioBar ratio={p.progress} label={`${p.name} 进度`} /> : p.next) },
    {
      key: "actions",
      title: "操作",
      kind: "actions",
      render: (p) => (
        <>
          <Switch checked={p.on} aria-label={`${p.name} 启用`} onCheckedChange={(on) => setRows((list) => list.map((x) => (x.id === p.id ? { ...x, on } : x)))} />
          <RowActionBar label={`${p.name}的更多操作`} actions={[{ key: "run", label: "立即备份", icon: <Upload />, onSelect: demo("立即备份") }, { key: "verify", label: "校验", icon: <Check />, onSelect: demo("校验") }, { key: "log", label: "看日志", icon: <FileText />, menuOnly: true, onSelect: demo("看日志") }, { key: "del", label: "删除", destructive: true, onSelect: demo("删除") }]} />
        </>
      ),
    },
  ];
  return (
    <>
      <MetricGrid>
        <MetricCard title="恢复点达标" icon={Check} value="21/21" unit="条" note="每条都在规定时间内有成功备份" />
        <MetricCard title="超期" icon={Clock} value={0} unit="条" note="没有超过一个周期没成功的" />
        <MetricCard title="正在备份" icon={RefreshCw} value={1} unit="条" note="nas-01-mysql-all · 已 62%" />
        <MetricCard title="近 7 天写入" icon={Upload} value="12.97" unit="GB" note="比上周 +1.2 GB" />
      </MetricGrid>
      <TodoInbox
        title="要处理的"
        items={[{ key: "verify", icon: <TriangleAlert />, tone: "attention", title: "web-pg-main 上次校验没通过", detail: "恢复演练时 3 张表行数对不上，可能是备份时正在写入；建议重新校验一次", meta: "2 小时前", actions: [{ key: "re", label: "重新校验", primary: true, onSelect: demo("重新校验") }, { key: "log", label: "看日志", onSelect: demo("看日志") }] }]}
      />
      <ResourcePanel
        title="备份策略"
        count={21}
        unit="条"
        description="每条策略 = 备份什么、多久一次、写到哪、留几份。"
        actions={<><Choice label="机器" value={machine} onChange={setMachine} options={[{ value: "all", label: "机器：全部" }, { value: "nas-01", label: "nas-01" }, { value: "web-01", label: "web-01" }]} /><IconButton label="刷新" variant="outline" onClick={demo("刷新")} icon={<RefreshCw />} /></>}
      >
        <DataTable caption="备份策略" rows={rows} rowKey={(p) => p.id} columns={columns} rowHeight="medium" pagination={{ mode: "page", total: 21, page: 1, pageSize: 7, onPageChange: demo("翻页"), onPageSizeChange: demo("每页条数") }} />
      </ResourcePanel>
    </>
  );
}

function KpiListTemplate({ active }: { active: boolean }) {
  const demo = useDemo();
  const [section, setSection] = useState("machines");
  const now = useMemo(() => Date.now(), []);
  return (
    <TabbedPage
      title="指标 + 列表页"
      active={active}
      description="每台机器的备份策略和达标情况；超过一个周期没成功的会出现在「要处理的」。"
      actions={<><LiveStatus state="live" dataTime={now} /><Button size="sm" onClick={demo("新增备份")}><Plus />新增备份</Button></>}
      value={section}
      onValueChange={setSection}
      sections={[{ id: "machines", label: "各机器备份" }, { id: "graph", label: "备份图" }, { id: "self", label: "运维平台自身" }]}
      render={(id) => (id === "machines" ? <BackupList /> : <Panel title={id === "graph" ? "备份图" : "运维平台自身"}><InlineAlert title="演示只做了「各机器备份」这一分区" /></Panel>)}
    />
  );
}

// ---------------------------------------------------------------- T04 统计看板页

const DailyChart = lazy(() =>
  import("@adminui/react/charts").then((m) => ({
    default: function DailyChart({ mode }: { mode: "light" | "dark" }) {
      const values = [62, 71, 58, 90, 104, 48, 39, 77, 88, 95, 101, 83, 44, 41, 96, 112, 120, 108, 99, 52, 47, 115, 131, 126, 118, 109, 57, 49, 122, 138];
      const start = Date.UTC(2026, 8, 3, 0, 0);
      const option = m.timeSeriesOption({ series: [{ id: "cost", name: "花费", points: values.map((v, i) => [start + i * 86_400_000, v] as [number, number]) }], mode, unit: "元", area: true, expectedIntervalMs: 86_400_000 });
      return <m.AdminChart option={option} label="每天的花费" height={210} />;
    },
  })),
);

type UsageRow = { name: string; calls: number; fail: string; failWarn?: boolean; input: string; output: string; cost: string; share: number | null };
const usage: UsageRow[] = [
  { name: "mia", calls: 6210, fail: "1.2%", input: "412.6 万", output: "96.3 万", cost: "¥1,021.40", share: 0.36 },
  { name: "admin", calls: 4388, fail: "0.9%", input: "301.2 万", output: "71.8 万", cost: "¥736.90", share: 0.26 },
  { name: "sam", calls: 3102, fail: "2.1%", input: "188.4 万", output: "44.0 万", cost: "¥452.10", share: 0.16 },
  { name: "leo", calls: 2041, fail: "1.4%", input: "97.5 万", output: "23.1 万", cost: "¥268.30", share: 0.09 },
  { name: "wangyu", calls: 1377, fail: "9.0%", failWarn: true, input: "62.0 万", output: "15.4 万", cost: "¥197.60", share: 0.07 },
  { name: "lina", calls: 980, fail: "0.6%", input: "40.8 万", output: "9.7 万", cost: "¥118.20", share: 0.04 },
  { name: "chen", calls: 0, fail: "—", input: "—", output: "—", cost: "¥0", share: null },
];

function StatsTemplate() {
  const demo = useDemo();
  const { mode } = useAdminTheme();
  const [range, setRange] = useState("30");
  const [who, setWho] = useState("all");
  const [sort, setSort] = useState("cost");
  const columns: Column<UsageRow>[] = [
    { key: "name", title: "人员", render: (r) => <CellPeople people={[{ name: r.name }]} /> },
    { key: "calls", title: "调用", numeric: true, align: "right", render: (r) => r.calls.toLocaleString() },
    { key: "fail", title: "失败", numeric: true, align: "right", render: (r) => (r.failWarn ? <StatusBadge tone="warning">{r.fail}</StatusBadge> : r.fail) },
    { key: "input", title: "输入 tokens", numeric: true, align: "right", render: (r) => r.input },
    { key: "output", title: "输出 tokens", numeric: true, align: "right", render: (r) => r.output },
    { key: "cost", title: "花费", numeric: true, align: "right", render: (r) => r.cost },
    { key: "share", title: "占比", width: 150, render: (r) => (r.share === null ? "这段时间没用过" : <RatioBar ratio={r.share} label={`${r.name} 花费占比`} />) },
  ];
  return (
    <>
      <PageHeader title="统计看板页" />
      <PageBody>
        <StatStrip
          title="全员用量"
          count="9 月 3 日 – 10 月 2 日"
          description="所有人通过运维平台中转的 AI 调用；花费按各模型官方价格折算。"
          actions={
            <>
              <SegmentedControl size="sm" label="时间范围" value={range} onValueChange={setRange} options={[{ value: "1", label: "今天" }, { value: "7", label: "7 天" }, { value: "30", label: "30 天" }]} />
              <Choice label="人员" value={who} onChange={setWho} options={[{ value: "all", label: "人员：全部" }, ...usage.map((u) => ({ value: u.name, label: u.name }))]} />
              <Button size="sm" variant="outline" onClick={demo("导出")}><Upload />导出</Button>
            </>
          }
          items={[
            { key: "calls", label: "总调用", icon: <LayoutGrid />, value: "18,432", unit: "次", note: "比上个 30 天 +12%", noteTone: "brand" },
            { key: "cost", label: "总花费", icon: <JapaneseYen />, value: "¥2,846.20", note: "输入 61% · 输出 39%" },
            { key: "avg", label: "人均", icon: <Users />, value: "¥355.78", note: "8 个人在用 · 1 人没用" },
            { key: "fail", label: "失败率", icon: <TriangleAlert />, value: "1.8", unit: "%", note: "331 次失败 · 多是限流", noteTone: "attention" },
          ]}
        />
        <SplitLayout
          railWidth={380}
          rail={
            <Panel title="按模型分" count="按花费" flush>
              <BarList
                label="按模型分"
                items={[
                  { key: "opus", label: "Claude Opus", hint: "9,120 次", ratio: 0.58, value: "58%" },
                  { key: "codex", label: "GPT-5 Codex", hint: "5,904 次", ratio: 0.24, value: "24%" },
                  { key: "sonnet", label: "Claude Sonnet", hint: "2,611 次", ratio: 0.12, value: "12%" },
                  { key: "haiku", label: "Claude Haiku", hint: "612 次", ratio: 0.04, value: "4%" },
                  { key: "other", label: "其他", hint: "185 次", ratio: 0.02, value: "2%" },
                ]}
              />
            </Panel>
          }
        >
          <Panel title="每天的花费" description="每天 0 点到 24 点（北京时间）的花费合计。">
            <Suspense fallback={<LoadingDots label="图表加载中" />}><DailyChart mode={mode} /></Suspense>
          </Panel>
        </SplitLayout>
        <SplitLayout
          railWidth={380}
          rail={
            <Panel title="花费前 5" description="这段时间花费最多的 5 个人。" flush>
              <BarList
                ranked
                label="花费前 5"
                items={usage.slice(0, 5).map((u) => ({ key: u.name, label: u.name, avatar: u.name.slice(0, 1), ratio: (u.share ?? 0) / 0.36, value: u.cost.replace(/\.\d+$/, "") }))}
              />
            </Panel>
          }
        >
          <ResourcePanel title="人员明细" count={9} unit="人" actions={<Choice label="排序" value={sort} onChange={setSort} options={[{ value: "cost", label: "排序：花费" }, { value: "calls", label: "排序：调用" }]} />}>
            <DataTable caption="人员明细" rows={usage} rowKey={(r) => r.name} columns={columns} rowHeight="short" pagination={{ mode: "all" }} />
          </ResourcePanel>
        </SplitLayout>
      </PageBody>
    </>
  );
}

// ---------------------------------------------------------------- T05 分区合并页

type Person = { id: string; name: string; note: string; roles: string[]; state: "on" | "no2fa" | "off"; last: string; machines: string };
const people: Person[] = [
  { id: "admin", name: "admin", note: "管理员 · 负责运维平台和生产机", roles: ["超级管理员"], state: "on", last: "刚刚 · 办公室", machines: "38 台" },
  { id: "mia", name: "mia", note: "后端 · CRM 与支付相关项目", roles: ["运维", "开发"], state: "on", last: "3 分钟前 · 家里", machines: "12 台" },
  { id: "leo", name: "leo", note: "测试 · Acme 测试机日常回归", roles: ["开发"], state: "on", last: "41 分钟前 · 办公室", machines: "4 台" },
  { id: "sam", name: "sam", note: "前端 · 官网与管理后台", roles: ["开发", "只看凭据"], state: "no2fa", last: "昨天 21:14 · 家里", machines: "6 台" },
  { id: "wangyu", name: "wangyu", note: "运维 · 生产环境值班", roles: ["运维"], state: "on", last: "今天 09:02 · 办公室", machines: "21 台" },
  { id: "lina", name: "lina", note: "产品 · 只看报表和用量", roles: ["只看凭据"], state: "on", last: "3 天前 · 办公室", machines: "0 台" },
  { id: "chen", name: "chen", note: "已离职 · 代码仓已交给 mia", roles: ["开发"], state: "off", last: "45 天前", machines: "0 台" },
];
const PERSON_STATE = { on: { label: "在用", tone: "success" }, no2fa: { label: "没设两步验证", tone: "warning" }, off: { label: "已停用", tone: "neutral" } } as const;

function PeopleList() {
  const demo = useDemo();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [state, setState] = useState("all");
  const columns: Column<Person>[] = [
    { key: "name", title: "人员", maxWidth: 300, render: (p) => <PersonLine name={p.name} hint={p.note} /> },
    { key: "roles", title: "角色", render: (p) => <CellTags items={p.roles.map((r) => ({ label: r, tone: "green" as const }))} label="角色" /> },
    { key: "state", title: "状态", render: (p) => <StatusBadge tone={PERSON_STATE[p.state].tone}>{PERSON_STATE[p.state].label}</StatusBadge> },
    { key: "last", title: "最近登录", render: (p) => p.last },
    { key: "machines", title: "能连的机器", render: (p) => p.machines },
    {
      key: "actions",
      title: "操作",
      kind: "actions",
      render: (p) => (
        <RowActionBar
          label={`${p.name}的更多操作`}
          actions={p.state === "off"
            ? [{ key: "restore", label: "恢复", icon: <RotateCw />, onSelect: demo("恢复") }, { key: "log", label: "记录", icon: <FileText />, onSelect: demo("记录") }, { key: "del", label: "删除账号", destructive: true, onSelect: demo("删除账号") }]
            : [p.state === "no2fa" ? { key: "remind", label: "提醒", icon: <Bell />, onSelect: demo("提醒") } : { key: "grant", label: "授权", icon: <Shield />, onSelect: demo("授权") }, { key: "edit", label: "编辑", icon: <Pencil />, onSelect: demo("编辑") }, { key: "log", label: "记录", icon: <FileText />, onSelect: demo("记录") }, { key: "off", label: "停用", destructive: true, onSelect: demo("停用") }]}
        />
      ),
    },
  ];
  return (
    <ResourcePanel
      title="人员"
      count={23}
      unit="人"
      description="能登录面板的人；角色决定能看哪些页面，授权决定能连哪些机器。"
      actions={<><Button size="sm" variant="outline" onClick={demo("导出")}><Upload />导出</Button><Button size="sm" onClick={demo("邀请人员")}><Plus />邀请人员</Button><IconButton label="刷新" variant="outline" onClick={demo("刷新")} icon={<RefreshCw />} /></>}
      filters={
        <QueryBar value={q} onChange={setQ} onSearch={demo("查询")} onReset={() => { setQ(""); setRole("all"); setState("all"); }} placeholder="搜名字、账号、备注">
          <Choice label="角色" value={role} onChange={setRole} options={[{ value: "all", label: "角色：全部" }, { value: "ops", label: "运维" }, { value: "dev", label: "开发" }]} />
          <Choice label="状态" value={state} onChange={setState} options={[{ value: "all", label: "状态：全部" }, { value: "on", label: "在用" }, { value: "off", label: "已停用" }]} />
        </QueryBar>
      }
    >
      <DataTable caption="人员列表" rows={people} rowKey={(p) => p.id} columns={columns} rowHeight="medium" pagination={{ mode: "page", total: 23, page: 1, pageSize: 7, onPageChange: demo("翻页"), onPageSizeChange: demo("每页条数") }} />
    </ResourcePanel>
  );
}

function SectionsTemplate({ active }: { active: boolean }) {
  const [section, setSection] = useState("people");
  return (
    <TabbedPage
      title="分区合并页"
      active={active}
      description="一个菜单项下的几个分区：人员、角色、邀请。"
      value={section}
      onValueChange={setSection}
      sections={[
        { id: "people", label: "人员", icon: <Users />, count: 23 },
        { id: "roles", label: "角色", icon: <Shield />, count: 5 },
        { id: "invites", label: "邀请", icon: <Link2 />, count: 2, countTone: "attention" },
      ]}
      render={(id) => (id === "people" ? <PeopleList /> : <Panel title={id === "roles" ? "角色" : "邀请"}><InlineAlert title="演示只做了「人员」这一分区" /></Panel>)}
    />
  );
}

// ---------------------------------------------------------------- T06 日志 / 时间线页

type AuditEntry = { id: string; at: number; who: string; ai?: boolean; text: ReactNode; target: string; result: "ok" | "denied" | "failed"; diff?: LogDiff };
const auditEntries = (): AuditEntry[] => {
  const today = new Date();
  const at = (dayOffset: number, h: number, m: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOffset, h, m).getTime();
  return [
    { id: "a1", at: at(0, 4, 28), who: "admin", text: <>部署了运维平台版本 <code>5afba4ab</code></>, target: "运维平台 · nas-01", result: "ok" },
    { id: "a2", at: at(0, 4, 24), who: "mia 的 claude", ai: true, text: <>在机器上执行命令 <code>pm2 ls</code></>, target: "nas-01", result: "ok" },
    {
      id: "a3", at: at(0, 4, 12), who: "admin", text: "改了凭据的分享范围和到期时间", target: "Claude 长期令牌", result: "ok",
      diff: { meta: [<>来源 <code>203.0.113.42</code> · 网页面板</>, <>请求号 <code>a7f3-91c2</code></>, "改了 3 项"], changes: [{ field: "分享给", before: "mia", after: "mia、leo" }, { field: "到期时间", before: "2026-10-15", after: "2026-12-31" }, { field: "可查看明文", before: "否", after: "是" }, { field: "所属项目", before: "ops-platform", after: "ops-platform" }] },
    },
    { id: "a4", at: at(0, 4, 5), who: "sam 的 codex", ai: true, text: "立即备份数据库", target: "nas-01-mysql-all", result: "ok" },
    { id: "a5", at: at(0, 3, 49), who: "leo", text: <>在数据库上执行 <code>DROP TABLE tmp_orders</code></>, target: "web-pg · crm", result: "denied" },
    { id: "a6", at: at(0, 3, 47), who: "leo", text: "登录网页终端", target: "Acme 测试机", result: "ok" },
    { id: "b1", at: at(1, 23, 16), who: "mia 的 claude", ai: true, text: <>写文件 <code>/etc/nginx/conf.d/crm.conf</code></>, target: "应用网关 (VM-102)", result: "failed" },
    { id: "b2", at: at(1, 21, 40), who: "sam", text: "给人员开了机器授权（连接 + 文件，30 天）", target: "web-01 · 运维组", result: "ok" },
    { id: "b3", at: at(1, 18, 2), who: "admin", text: "轮换了机器托管密钥", target: "web-01", result: "ok" },
    { id: "b4", at: at(1, 9, 31), who: "mia", text: "登录面板", target: "网页面板", result: "ok" },
  ].map((e) => ({ ...e, diff: e.diff ?? { meta: [<>来源 <code>203.0.113.42</code> · 网页面板</>], changes: [] } })) as AuditEntry[];
};
const RESULT = { ok: { label: "成功", tone: "success" }, denied: { label: "被拒", tone: "warning" }, failed: { label: "失败", tone: "danger" } } as const;

function LogTemplate() {
  const demo = useDemo();
  const entries = useMemo(auditEntries, []);
  const [q, setQ] = useState("");
  const [range, setRange] = useState("7");
  const [who, setWho] = useState("all");
  const [act, setAct] = useState("all");
  return (
    <>
      <PageHeader title="日志 / 时间线页" />
      <PageBody>
        <ResourcePanel
          title="审计日志"
          count={1284}
          unit="条"
          description="近 7 天所有人和 AI 的操作；点一行看改前改后。"
          actions={<Button size="sm" variant="outline" onClick={demo("导出 CSV")}><Upload />导出 CSV</Button>}
          filters={
            <QueryBar value={q} onChange={setQ} onSearch={demo("查询")} onReset={() => { setQ(""); setWho("all"); setAct("all"); }} placeholder="搜索命令、机器、凭据名…">
              <SegmentedControl label="时间范围" value={range} onValueChange={setRange} options={[{ value: "1", label: "今天" }, { value: "7", label: "近 7 天" }, { value: "30", label: "近 30 天" }, { value: "pick", label: "自选", icon: CalendarDays }]} />
              <Choice label="操作人" value={who} onChange={setWho} options={[{ value: "all", label: "操作人：全部" }, { value: "admin", label: "admin" }, { value: "ai", label: "只看 AI" }]} />
              <Choice label="动作" value={act} onChange={setAct} options={[{ value: "all", label: "动作：全部" }, { value: "cmd", label: "执行命令" }, { value: "login", label: "登录" }]} />
            </QueryBar>
          }
        >
          <LogTimeline
            caption="审计日志"
            items={entries}
            getId={(e) => e.id}
            time={(e) => e.at}
            actor={(e) => ({ name: e.who, ai: e.ai, avatar: e.ai ? "C" : undefined })}
            text={(e) => e.text}
            target={(e) => e.target}
            result={(e) => RESULT[e.result]}
            diff={(e) => e.diff}
            defaultExpanded={["a3"]}
            total={1284}
            onLoadMore={demo("加载更多")}
          />
        </ResourcePanel>
      </PageBody>
    </>
  );
}

// ---------------------------------------------------------------- T07 关系图 / 实时监控页

// 画布由业务自己画（SVG / 图库）；这里的演示图只用色卡变量上色。
const ink = { line: "var(--aui-line)", primary: "var(--aui-primary)", fill: "var(--aui-primary-fill)", soft: "var(--aui-soft)", softLine: "var(--aui-soft-strong)", surface: "var(--aui-surface)", text: "var(--aui-text)", note: "var(--aui-note)", warn: "var(--aui-warning)", warnSoft: "var(--aui-warning-soft)", warnLine: "var(--aui-warning-line)", mid: "var(--aui-primary-mid)" } as const;
function DemoGraph() {
  const people = [
    { y: 84, name: "admin", sub: "网页终端 · 3 分钟", on: true, bot: false },
    { y: 160, name: "mia 的 claude", sub: "MCP · 刚刚", on: true, bot: true },
    { y: 236, name: "mia", sub: "SSH · 12 分钟", on: true, bot: false },
    { y: 312, name: "sam 的 codex", sub: "MCP · 1 分钟", on: true, bot: true },
    { y: 388, name: "leo", sub: "41 分钟前离开", on: false, bot: false },
    { y: 464, name: "sam", sub: "昨天 21:40 离开", on: false, bot: false },
  ];
  const hosts = [
    { y: 84, name: "nas-01", sub: "2 个会话 · CPU 18%", on: true, tag: "SSH 2" },
    { y: 182, name: "web-01", sub: "3 个会话 · CPU 41%", on: true, tag: "会话 3", sel: true },
    { y: 280, name: "Acme 测试机", sub: "2 个会话 · 内存 91%", on: true, tag: "终端 2", warn: true },
    { y: 378, name: "应用网关 (VM-102)", sub: "没人连 · 可达", on: false, tag: "空闲" },
    { y: 476, name: "家庭软路由", sub: "离线 · 2 天了", on: false },
  ];
  const edge = (on: boolean, sel?: boolean) => ({ fill: "none", stroke: on ? ink.primary : ink.note, strokeWidth: sel ? 3 : on ? 2 : 1.2, strokeDasharray: on ? undefined : "5 4", opacity: on ? 1 : 0.5 });
  return (
    <svg viewBox="0 0 880 560" preserveAspectRatio="xMidYMid meet">
      {[["人和 AI", 40], ["运维平台", 372], ["机器", 660]].map(([t, x]) => <text key={t} x={x} y={30} fontSize={12} fontWeight={600} fill={ink.note}>{t}</text>)}
      {people.map((p, i) => <path key={`p${i}`} d={`M210 ${p.y} C290 ${p.y},300 280,360 280`} style={edge(p.on, i === 1 || i === 2)} />)}
      {hosts.map((h, i) => <path key={`h${i}`} d={`M500 280 C580 280,580 ${h.y},650 ${h.y}`} style={edge(h.on, h.sel)} />)}
      {hosts.filter((h) => h.tag).map((h) => (
        <g key={`t${h.name}`}>
          <rect x={596} y={h.y - 9} width={50} height={18} rx={9} style={{ fill: h.on ? ink.soft : ink.surface, stroke: h.on ? ink.softLine : ink.line }} />
          <text x={621} y={h.y + 4} fontSize={11} textAnchor="middle" fontWeight={h.on ? 600 : 400} fill={h.on ? ink.primary : ink.note}>{h.tag}</text>
        </g>
      ))}
      {people.map((p) => (
        <g key={p.name} opacity={p.on ? 1 : 0.65}>
          <rect x={30} y={p.y - 22} width={180} height={44} rx={10} style={{ fill: ink.surface, stroke: p.on ? ink.softLine : ink.line }} />
          <circle cx={54} cy={p.y} r={12} style={{ fill: p.on ? (p.bot ? ink.mid : ink.fill) : ink.note }} />
          {/* admin-ui-audit-ignore hard-colour: 主色填充上的白字，色卡保证 primary-fill 配白字对比 ≥4.5（同 SDK 主按钮） */}
          <text x={54} y={p.y + 4} fontSize={11} fontWeight={700} textAnchor="middle" fill="#fff">{p.bot ? "C" : p.name.slice(0, 1)}</text>
          <text x={74} y={p.y - 3} fontSize={13} fontWeight={600} fill={p.on ? ink.text : ink.note}>{p.name}</text>
          <text x={74} y={p.y + 13} fontSize={11} fill={ink.note}>{p.sub}</text>
        </g>
      ))}
      <g>
        <rect x={360} y={246} width={140} height={68} rx={14} style={{ fill: ink.fill }} />
        {/* admin-ui-audit-ignore hard-colour: 主色填充上的白字，色卡保证 primary-fill 配白字对比 ≥4.5（同 SDK 主按钮） */}
        <text x={430} y={275} fontSize={14} fontWeight={700} textAnchor="middle" fill="#fff">运维平台</text>
        {/* admin-ui-audit-ignore hard-colour: 同上，主色填充上的白字 */}
        <text x={430} y={295} fontSize={11} textAnchor="middle" fill="#fff" opacity={0.85}>nas-01 · 第一跳</text>
      </g>
      {hosts.map((h) => (
        <g key={h.name} opacity={h.on || h.tag ? 1 : 0.65}>
          <rect x={650} y={h.y - 22} width={200} height={44} rx={10} style={{ fill: h.sel ? ink.soft : h.warn ? ink.warnSoft : ink.surface, stroke: h.sel ? ink.primary : h.warn ? ink.warnLine : ink.line, strokeWidth: h.sel ? 2 : 1.2 }} />
          <circle cx={668} cy={h.y} r={5} style={{ fill: h.warn ? ink.warn : h.on || h.tag ? ink.primary : ink.note }} />
          <text x={682} y={h.y - 3} fontSize={13} fontWeight={600} fill={ink.text}>{h.name}</text>
          <text x={682} y={h.y + 13} fontSize={11} fill={h.warn ? ink.warn : ink.note}>{h.sub}</text>
        </g>
      ))}
    </svg>
  );
}

function GraphTemplate() {
  const demo = useDemo();
  const now = useMemo(() => Date.now(), []);
  const [only, setOnly] = useState<string[]>(["online"]);
  return (
    <>
      <PageHeader title="关系图 / 实时监控页" />
      <PageBody>
        <GraphLayout
          title="连接图"
          description="谁此刻经过运维平台连在哪台机器上；线 = 正在连，虚线 = 有授权但没连。"
          live={<LiveStatus state="live" dataTime={now} />}
          filters={<ChipGroup label="筛选" value={only} onValueChange={setOnly} options={[{ value: "online", label: "只看在线" }, { value: "ai", label: "只看 AI" }]} />}
          legend={[
            { key: "on", label: "正在连接", kind: "line" },
            { key: "idle", label: "有授权、此刻没连", kind: "dashed" },
            { key: "online", label: "在线", kind: "dot" },
            { key: "busy", label: "负载高", kind: "dot", tone: "attention" },
            { key: "off", label: "离线", kind: "dot", tone: "muted" },
          ]}
          summary="人 6 · 在线 4 · 机器 5 · 会话 7"
          canvasLabel="人、运维平台和机器之间的连接"
          tools={<><IconButton label="放大" variant="outline" onClick={demo("放大")} icon={<Plus />} /><IconButton label="复位" variant="outline" onClick={demo("复位")} icon={<RefreshCw />} /></>}
          detail={
            <Pane
              bare
              icon={<Server />}
              title="web-01"
              hint="生产环境 · 103 · Ubuntu 22.04"
              actions={<IconButton label="关闭详情" onClick={demo("关闭详情")} icon={<X />} />}
              footer={<><Button size="sm" variant="outline" onClick={demo("看会话审计")}><Eye />看会话审计</Button><Button size="sm" onClick={demo("打开详情")}><Link2 />打开详情</Button></>}
            >
              <PaneSection title="此刻">
                <DescriptionList columns={2} items={[{ label: "此刻在上面", value: "2 人 · 1 AI" }, { label: "会话", value: "3 个" }, { label: "CPU", value: "41%" }, { label: "今天连过", value: "9 次" }]} />
              </PaneSection>
              <PaneSection title="正在连的会话" count={3} flush>
                <ActionList
                  label="正在连的会话"
                  actionStyle="buttons"
                  items={[
                    { key: "c", avatar: "C", bot: true, title: "mia 的 claude", detail: "MCP 命令 · pm2 logs crm · 刚刚", actions: [{ key: "x", label: "断开", destructive: true, menuOnly: false, onSelect: demo("断开") }] },
                    { key: "s", avatar: "m", title: "mia", detail: "SSH · 203.0.113.42 · 12 分钟", actions: [{ key: "x", label: "断开", destructive: true, menuOnly: false, onSelect: demo("断开") }] },
                    { key: "f", avatar: "m", title: "mia", detail: "文件传输 · 上传 2 个 · 4 分钟", actions: [{ key: "x", label: "断开", destructive: true, menuOnly: false, onSelect: demo("断开") }] },
                  ]}
                />
              </PaneSection>
              <PaneSection title="有授权、此刻没连" count={2}>
                <InfoList label="有授权、此刻没连" items={[{ key: "y", icon: <User />, label: "leo", value: "41 分钟前" }, { key: "l", icon: <User />, label: "sam", value: "昨天" }]} />
              </PaneSection>
            </Pane>
          }
        >
          <DemoGraph />
        </GraphLayout>
      </PageBody>
    </>
  );
}

// ---------------------------------------------------------------- T08 设置 / 表单页

function SettingsTemplate() {
  const demo = useDemo();
  const initial = { channel: "stable", window: "night", source: "https://ops.example.com/dl/", backupFirst: true, receivers: "admin-mia", voice: false, webhook: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send", merge: "10", lock: "5-15", session: "12", idle: "45 天没用过", approve: true };
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState({ ...initial, channel: "beta", voice: true });
  const set = <K extends keyof typeof initial>(key: K, value: (typeof initial)[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const changed = (Object.keys(initial) as (keyof typeof initial)[]).filter((k) => draft[k] !== saved[k]);
  const labels: Record<string, string> = { channel: "更新通道", window: "自动更新时段", source: "更新源地址", backupFirst: "更新前先备份", receivers: "告警接收人", voice: "语音播报", webhook: "企业微信机器人", merge: "同类告警合并", lock: "登录失败锁定", session: "面板会话时长", idle: "闲置授权判定", approve: "高危命令需审批" };
  const webhookError = draft.webhook.includes("?key=") ? undefined : "缺少 key 参数，地址应以 ?key= 结尾";
  const isChanged = (k: keyof typeof initial) => changed.includes(k);
  const sectionOf = (keys: (keyof typeof initial)[]) => keys.some(isChanged);
  return (
    <>
      <PageHeader title="设置 / 表单页" />
      <SideNavLayout
        label="设置分节"
        sections={[
          {
            id: "license",
            label: "授权信息",
            icon: <TagIcon />,
            content: (
              <Panel title="授权信息" description="产品授权文件里写的内容；换授权要导入新文件。" actions={<><Button size="sm" variant="outline" onClick={demo("导入授权文件")}><Upload />导入授权文件</Button><Button size="sm" variant="outline" onClick={demo("复制机器码")}><Copy />复制机器码</Button></>}>
                <DescriptionList columns={3} items={[{ label: "授权给", value: "Acme 总部" }, { label: "版本", value: <>总部版 <StatusBadge tone="success">生效中</StatusBadge></> }, { label: "到期", value: "2026-11-30 · 还剩 59 天" }, { label: "机器额度", value: "38 / 100 台" }, { label: "人员额度", value: "12 / 50 人" }, { label: "机器码", value: "OP-7F3A-91C2-04DE" }, { label: "开通的功能", value: "远控 · 数据库 · 备份 · AI 助理 · 镜像", full: true }]} />
              </Panel>
            ),
          },
          {
            id: "update",
            label: "更新设置",
            icon: <RefreshCw />,
            dirty: sectionOf(["channel", "window", "source", "backupFirst"]),
            content: (
              <Panel title="更新设置" description="面板自己怎么升级。">
                <FormSection>
                  <FormField label="更新通道" htmlFor="tpl-channel" changed={isChanged("channel")}><Choice label="更新通道" value={draft.channel} onChange={(v) => set("channel", v)} options={[{ value: "stable", label: "稳定版（推荐）" }, { value: "beta", label: "抢先版" }]} /></FormField>
                  <FormField label="自动更新时段" htmlFor="tpl-window" changed={isChanged("window")}><Choice label="自动更新时段" value={draft.window} onChange={(v) => set("window", v)} options={[{ value: "night", label: "每天 03:00–05:00" }, { value: "off", label: "不自动更新" }]} /></FormField>
                  <FormField label="更新源地址" htmlFor="tpl-source" changed={isChanged("source")}><Input id="tpl-source" value={draft.source} onChange={(e) => set("source", e.target.value)} /></FormField>
                  <FormField label="更新前先备份" htmlFor="tpl-backup" hint="先备份面板数据库再更新" changed={isChanged("backupFirst")}><Switch id="tpl-backup" checked={draft.backupFirst} onCheckedChange={(v) => set("backupFirst", v)} /></FormField>
                </FormSection>
              </Panel>
            ),
          },
          {
            id: "notify",
            label: "通知",
            icon: <Bell />,
            dirty: sectionOf(["receivers", "voice", "webhook", "merge"]),
            content: (
              <Panel title="通知" description="告警发给谁、怎么发。">
                <FormSection>
                  <FormField label="告警接收人" htmlFor="tpl-recv" changed={isChanged("receivers")}><Choice label="告警接收人" value={draft.receivers} onChange={(v) => set("receivers", v)} options={[{ value: "admin-mia", label: "admin、mia" }, { value: "admin", label: "admin" }]} /></FormField>
                  <FormField label="语音播报" htmlFor="tpl-voice" hint="AI 任务完成时在助手里念出来" changed={isChanged("voice")}><Switch id="tpl-voice" checked={draft.voice} onCheckedChange={(v) => set("voice", v)} /></FormField>
                  <FormField label="企业微信机器人" htmlFor="tpl-webhook" required error={webhookError} changed={isChanged("webhook")}><Input id="tpl-webhook" value={draft.webhook} onChange={(e) => set("webhook", e.target.value)} /></FormField>
                  <FormField label="同类告警合并" htmlFor="tpl-merge" hint="合并期内的重复告警只计数，不再推送" changed={isChanged("merge")}><Choice label="同类告警合并" value={draft.merge} onChange={(v) => set("merge", v)} options={[{ value: "10", label: "10 分钟内只发一次" }, { value: "60", label: "1 小时内只发一次" }]} /></FormField>
                </FormSection>
              </Panel>
            ),
          },
          {
            id: "security",
            label: "安全策略",
            icon: <Shield />,
            dirty: sectionOf(["lock", "session", "idle", "approve"]),
            content: (
              <Panel title="安全策略" description="登录和高危操作的限制。">
                <FormSection>
                  <FormField label="登录失败锁定" htmlFor="tpl-lock" changed={isChanged("lock")}><Choice label="登录失败锁定" value={draft.lock} onChange={(v) => set("lock", v)} options={[{ value: "5-15", label: "连错 5 次锁 15 分钟" }, { value: "3-60", label: "连错 3 次锁 1 小时" }]} /></FormField>
                  <FormField label="面板会话时长" htmlFor="tpl-session" changed={isChanged("session")}><Choice label="面板会话时长" value={draft.session} onChange={(v) => set("session", v)} options={[{ value: "12", label: "12 小时" }, { value: "24", label: "24 小时" }]} /></FormField>
                  <FormField label="闲置授权判定" htmlFor="tpl-idle" changed={isChanged("idle")}><Input id="tpl-idle" value={draft.idle} onChange={(e) => set("idle", e.target.value)} /></FormField>
                  <FormField label="高危命令需审批" htmlFor="tpl-approve" hint="DROP / rm -rf / 改防火墙前要人点头" changed={isChanged("approve")}><Switch id="tpl-approve" checked={draft.approve} onCheckedChange={(v) => set("approve", v)} /></FormField>
                </FormSection>
              </Panel>
            ),
          },
        ]}
        footer={
          <SaveBar
            count={changed.length}
            errors={webhookError ? 1 : 0}
            summary={changed.map((k) => labels[k]).join(" · ")}
            onDiscard={() => setDraft(saved)}
            onSave={async () => {
              if (webhookError) throw new Error("企业微信机器人地址有误，改好再保存");
              await new Promise((r) => setTimeout(r, 300));
              setSaved(draft);
            }}
          />
        }
      />
    </>
  );
}

// ---------------------------------------------------------------- T09 权限配置页

type Grant = { id: string; name: string; note: string; on: boolean; ssh: boolean; files: boolean; sudo: boolean; expiry: { label: string; tone: "success" | "warning" | "danger" }; renew?: boolean };
const groupGrants: Grant[] = [
  { id: "nas-01", name: "nas-01", note: "NAS · 运维平台所在", on: true, ssh: true, files: true, sudo: true, expiry: { label: "长期", tone: "success" } },
  { id: "web-01", name: "web-01", note: "生产环境 103", on: true, ssh: true, files: false, sudo: false, expiry: { label: "长期", tone: "success" } },
  { id: "test", name: "Acme 测试机", note: "测试 · 可随便折腾", on: true, ssh: true, files: true, sudo: true, expiry: { label: "长期", tone: "success" } },
  { id: "ct102", name: "应用网关 (VM-102)", note: "PVE 容器 · 客户系统中转", on: true, ssh: true, files: false, sudo: false, expiry: { label: "10-09 到期 · 还剩 7 天", tone: "warning" }, renew: true },
  { id: "router", name: "家庭软路由", note: "离线 2 天", on: false, ssh: true, files: false, sudo: false, expiry: { label: "已过期 3 天", tone: "danger" }, renew: true },
];

function MatrixSection() {
  const demo = useDemo();
  const [subject, setSubject] = useState<string | null>("ops");
  const [saved, setSaved] = useState(groupGrants);
  const [draft, setDraft] = useState(() => groupGrants.map((g) => (g.id === "nas-01" ? { ...g, sudo: false } : g.id === "web-01" ? { ...g, files: true } : g.id === "ct102" ? { ...g, expiry: { label: "10-09 到期 · 还剩 7 天", tone: "warning" as const } } : g)));
  const base = (id: string) => saved.find((g) => g.id === id)!;
  const flip = (id: string, key: "ssh" | "files" | "sudo") => setDraft((list) => list.map((g) => (g.id === id ? { ...g, [key]: !g[key] } : g)));
  const changes = draft.flatMap((g) => (["ssh", "files", "sudo"] as const).filter((k) => g[k] !== base(g.id)[k]).map((k) => `${g.name} ${g[k] ? "加上" : "去掉"} ${{ ssh: "连接", files: "文件", sudo: "sudo" }[k]}`));
  const extra = 1; // 演示：应用网关的到期时间也改过
  const cell = (g: Grant, key: "ssh" | "files" | "sudo", label: string) => (
    <ChangeMark changed={g[key] !== base(g.id)[key]}><Checkbox checked={g[key]} aria-label={`${g.name} ${label}`} onCheckedChange={() => flip(g.id, key)} /></ChangeMark>
  );
  const columns: Column<Grant>[] = [
    { key: "name", title: "机器", render: (g) => <CellText primary={<><StatusBadge tone={g.on ? "success" : "neutral"}>{g.on ? "在线" : "离线"}</StatusBadge> <strong>{g.name}</strong></>} secondary={g.note} /> },
    { key: "ssh", title: "连接", width: 84, render: (g) => cell(g, "ssh", "连接") },
    { key: "files", title: "文件", width: 84, render: (g) => cell(g, "files", "文件") },
    { key: "sudo", title: "sudo", width: 84, render: (g) => cell(g, "sudo", "sudo") },
    { key: "expiry", title: "到期", width: 210, render: (g) => <ChangeMark changed={g.id === "ct102"}><StatusBadge tone={g.expiry.tone}>{g.expiry.label}</StatusBadge></ChangeMark> },
    { key: "actions", title: "操作", kind: "actions", width: 120, render: (g) => <RowActionBar label={`${g.name}的更多操作`} actions={[...(g.renew ? [{ key: "renew", label: "续期", icon: <RotateCw />, onSelect: demo("续期") }] : []), { key: "expiry", label: "改到期时间", menuOnly: true, onSelect: demo("改到期时间") }, { key: "remove", label: "移除这台机器", destructive: true, onSelect: demo("移除") }]} /> },
  ];
  return (
    <Panel title="谁能连哪些机器" description="选左边的人或组，右边勾选能做什么；组里的人自动继承组的授权。" flush actions={<Button size="sm" onClick={demo("新增授权")}><Plus />新增授权</Button>}>
      <ListDetailLayout
        list={
          <SelectList
            label="人和组"
            search="搜人或组"
            selected={subject}
            onSelect={setSubject}
            items={[
              { key: "ops", group: "人员组", icon: <Users />, title: "运维组", hint: "admin、mia、sam", meta: "5 台" },
              { key: "dev", group: "人员组", icon: <Users />, title: "开发组", hint: "leo、mia", meta: "2 台" },
              { key: "ai", group: "人员组", icon: <LayoutGrid />, title: "AI 代理", hint: "mia 的 claude、sam 的 codex", meta: "3 台" },
              { key: "cs", group: "人员组", icon: <Users />, title: "客户支持", hint: "还没有成员", meta: "0 台" },
              { key: "admin", group: "人员", avatar: "a", title: "admin", hint: "管理员 · 全部机器", meta: "38 台" },
              { key: "mia", group: "人员", avatar: "m", title: "mia", hint: "运维组、开发组", meta: "6 台" },
              { key: "leo", group: "人员", avatar: "l", title: "leo", hint: "开发组 · 1 条单独授权", meta: "3 台" },
              { key: "sam", group: "人员", avatar: "s", title: "sam", hint: "运维组", meta: "5 台" },
            ]}
          />
        }
      >
        <Pane
          bare
          icon={<Users />}
          title="运维组"
          hint="3 人 · 授权 5 台机器 · 组里的人自动继承"
          actions={<><Button size="sm" variant="ghost" onClick={demo("加机器")}><Plus />加机器</Button><Button size="sm" variant="ghost" onClick={demo("改成员")}><Users />改成员</Button></>}
          footer="勾选 = 有这项权限；浅色框 = 改过、还没保存"
        >
          <DataTable caption="运维组的机器权限" rows={draft} rowKey={(g) => g.id} columns={columns} rowHeight="medium" pagination={{ mode: "all" }} />
          <SaveBar
            placement="inline"
            count={changes.length + extra}
            summary={[...changes, "应用网关 到期改到 10-09"].join(" · ")}
            onDiscard={() => setDraft(saved)}
            onSave={async () => { await new Promise((r) => setTimeout(r, 300)); setSaved(draft); }}
          />
        </Pane>
      </ListDetailLayout>
    </Panel>
  );
}

function MatrixTemplate({ active }: { active: boolean }) {
  const [section, setSection] = useState("grants");
  return (
    <TabbedPage
      title="权限配置页"
      active={active}
      value={section}
      onValueChange={setSection}
      sections={[{ id: "grants", label: "授权", icon: <Shield /> }, { id: "groups", label: "人员组", icon: <Users />, count: 4 }]}
      render={(id) => (id === "grants" ? <MatrixSection /> : <Panel title="人员组"><InlineAlert title="演示只做了「授权」这一分区" /></Panel>)}
    />
  );
}

// ---------------------------------------------------------------- T10 工具 / 工作区页

function WorkspaceTemplate() {
  const demo = useDemo();
  const [conv, setConv] = useState<string | null>("nginx");
  const [q, setQ] = useState("");
  const [text, setText] = useState("");
  return (
    <>
      <PageHeader title="工具 / 工作区页" />
      <WorkspaceLayout
        left={
          <Pane label="对话列表" header={<SearchField size="sm" value={q} onChange={setQ} placeholder="搜对话" />} actions={<Button size="sm" onClick={demo("新对话")}><Plus />新对话</Button>}>
            <SelectList
              label="对话"
              selected={conv}
              onSelect={setConv}
              items={[
                { key: "nginx", group: "今天", title: "web-01 上 nginx 502 排查", hint: "要在 web-01 上重启 nginx 吗？", meta: "04:31" },
                { key: "pg", group: "今天", title: "nas-01-pg 慢查询", hint: "已列出 3 条最慢的语句", meta: "03:12", unreadCount: 2 },
                { key: "bak", group: "今天", title: "备份 nas-01-mysql-all 没跑", hint: "原因：目标盘满了，已清理", meta: "01:45", unread: true },
                { key: "grant", group: "昨天", title: "给 leo 开 Acme 测试机", hint: "已授权 7 天", meta: "18:20" },
                { key: "disk", group: "昨天", title: "应用网关 (VM-102) 磁盘告警", hint: "日志轮转后剩 41%", meta: "15:02" },
                { key: "mirror", group: "昨天", title: "镜像同步失败的仓有哪些", hint: "admin/widgets 一个", meta: "11:37" },
                { key: "conn", group: "更早", title: "web-pg 连接数突然变多的原因分析", hint: "PgBouncer 池子太小", meta: "9-28" },
                { key: "remote", group: "更早", title: "远控客户端升级到 1.4", hint: "12 台已升级", meta: "9-27" },
                { key: "revoke", group: "更早", title: "sam 的密钥吊销", hint: "已吊销并通知本人", meta: "9-25" },
              ].filter((c) => !q || `${c.title} ${c.hint}`.includes(q))}
            />
          </Pane>
        }
        right={
          <Pane title="本次对话" description="这次对话能用的机器、工具和花费。">
            <PaneSection title="当前机器" icon={<Server />} actions={<Button size="sm" variant="ghost" onClick={demo("加机器")}><Plus />加</Button>}>
              <div>
                <StatusBadge tone="success">web-01</StatusBadge> <StatusBadge tone="success">nas-01</StatusBadge> <StatusBadge tone="warning">应用网关 (VM-102)</StatusBadge>
              </div>
              <InfoList label="提醒" items={[{ key: "disk", label: "VM-102 磁盘 92%，可能影响排查" }]} />
            </PaneSection>
            <PaneSection title="可用工具" icon={<Settings />} count="6 个">
              <InfoList
                label="可用工具"
                items={[
                  { key: "run", icon: <SquareTerminal />, label: "run_command", mono: true, value: "用了 2 次" },
                  { key: "read", icon: <FileText />, label: "read_file", mono: true, value: "—" },
                  { key: "edit", icon: <Pencil />, label: "edit_file", mono: true, value: "要确认" },
                  { key: "db", icon: <Database />, label: "db_query", mono: true, value: "只读" },
                  { key: "bak", icon: <Upload />, label: "backup_status", mono: true, value: "—" },
                  { key: "kb", icon: <Search />, label: "knowledge_search", mono: true, value: "—" },
                ]}
              />
            </PaneSection>
            <PaneSection title="本次花费" icon={<JapaneseYen />}>
              <DescriptionList columns={2} items={[{ label: "花费", value: "¥0.42" }, { label: "输入 / 输出", value: "18k / 2k" }]} />
              <Meter label="今日额度" ratio={3.1 / 20} detail="¥3.1 / ¥20" />
            </PaneSection>
          </Pane>
        }
      >
        <Pane
          title="web-01 上 nginx 502 排查"
          count={<StatusBadge tone="brand">Claude · 运维平台工具</StatusBadge>}
          actions={<><Button size="sm" variant="ghost" onClick={demo("分享")}><Share2 />分享</Button><RowActions label="对话的更多操作" actions={[{ key: "rename", label: "改名", onSelect: demo("改名") }, { key: "del", label: "删除对话", destructive: true, onSelect: demo("删除对话") }]} /></>}
          footer={<Composer value={text} onChange={setText} onSend={() => { demo("发送")(); setText(""); }} placeholder="接着问，或让它在机器上做点什么…" tools={<><Button size="sm" variant="ghost" onClick={demo("附件")}><Upload />附件</Button><Button size="sm" variant="ghost" onClick={demo("加机器")}><Server />加机器</Button></>} />}
        >
          <ChatThread>
            <ChatMessage author="admin" mine time="04:28">官网突然 502 了，帮我看看 web-01 上的 nginx 和后端进程。</ChatMessage>
            <ChatMessage author="mia 的 claude" avatar="C" bot time="04:31 · 用了 2 个工具">
              <p>先看一下后端进程是否都在跑。</p>
              <ToolCallCard icon={<SquareTerminal />} title="run_command · nas-01 · pm2 ls" status={<StatusBadge tone="success">完成 0.8 秒</StatusBadge>} defaultOpen>
                {"│ id │ name         │ status │ cpu │ mem    │\n│ 0  │ ops-api   │ online │ 2%  │ 182mb  │\n│ 3  │ ecosystem    │ online │ 0%  │ 96mb   │"}
              </ToolCallCard>
              <ToolCallCard icon={<SquareTerminal />} title="run_command · web-01 · tail -n 50 /var/log/nginx/error.log" status={<StatusBadge tone="success">完成 0.4 秒</StatusBadge>}>
                {"2026/10/02 04:27:41 [error] upstream timed out (110: Connection timed out)"}
              </ToolCallCard>
              <p>nas-01 上的进程都正常。web-01 的 nginx 日志里有 <code>upstream timed out</code>，同时 worker 进程卡在旧配置上，重启 nginx 能恢复。</p>
              <InlineAlert tone="warning" title="要在 web-01 上重启 nginx 吗？">
                <p>会执行 <code>systemctl restart nginx</code>，web-01 上所有站点断开约 1 秒；这是生产机，需要你确认。</p>
                <p><Button size="sm" onClick={demo("确认重启")}><Check />确认</Button> <Button size="sm" variant="outline" onClick={demo("取消")}>取消</Button></p>
              </InlineAlert>
            </ChatMessage>
            <LoadingDots label="等你确认后继续" />
          </ChatThread>
        </Pane>
      </WorkspaceLayout>
    </>
  );
}

// ---------------------------------------------------------------- T11 进度 / 工作项页

const GOAL_STEPS = [{ key: "plan", label: "计划" }, { key: "run", label: "执行" }, { key: "check", label: "验收" }];
function BoardTemplate() {
  const demo = useDemo();
  const [tab, setTab] = useState("doing");
  const [q, setQ] = useState("");
  const acts = (title: string) => [
    { key: "view", label: "查看", icon: <Eye />, onSelect: demo(`查看 ${title}`) },
    { key: "pause", label: "暂停", icon: <Pause />, onSelect: demo("暂停") },
    { key: "log", label: "看日志", icon: <FileText />, menuOnly: true, onSelect: demo("看日志") },
    { key: "stop", label: "终止", destructive: true, onSelect: demo("终止") },
  ];
  return (
    <>
      <PageHeader title="进度 / 工作项页" />
      <PageBody>
        <Panel
          title="目标"
          count="5 个进行中"
          description="交给 AI 的目标；卡住等人确认的排在最上面。"
          flush
          actions={
            <>
              <SegmentedControl size="sm" label="目标状态" value={tab} onValueChange={setTab} options={[{ value: "doing", label: "进行中 5" }, { value: "review", label: "待验收 2" }, { value: "done", label: "已完成 31" }]} />
              <SearchField size="sm" value={q} onChange={setQ} placeholder="搜目标 / 负责人" />
              <Button size="sm" onClick={demo("新目标")}><Plus />新目标</Button>
            </>
          }
        >{null}</Panel>
        <WorkItemList label="进行中的目标" footer={<><Check />本周已完成 6 个，平均用时 1.8 小时<Button size="sm" variant="ghost" onClick={demo("看已完成")}>看已完成 ›</Button></>}>
          <WorkItemCard title="web-01 上的官网迁到新的 PgBouncer 连接池" owner="mia 的 claude" facts={["发起人 mia", "已跑 2 小时"]} steps={GOAL_STEPS} current="run" progress={0.6} eventIcon={<TriangleAlert />} event="12 分钟前 · 新连接池已就绪，切换需要重启 nginx" actions={acts("官网迁移")} attention={{ label: "等你确认", text: "要在 web-01 上重启 nginx 让新连接池生效，生产站点会断开约 1 秒 · 已等 12 分钟", action: { label: "去确认", onSelect: demo("去确认") } }} />
          <WorkItemCard title="给 nas-01-pg 所有库补上每日备份策略" owner="mia 的 claude" facts={["发起人 mia", "已跑 40 分钟"]} steps={GOAL_STEPS} current="run" progress={0.67} eventIcon={<Upload />} event="刚刚 · 已建好 14 / 21 条策略，正在试跑 crm-pg" actions={acts("补备份")} />
          <WorkItemCard title="远控客户端统一升级到 1.4 并清理旧版本" owner="sam 的 codex" facts={["发起人 sam", "已跑 3 小时"]} steps={GOAL_STEPS} current="run" progress={0.8} eventIcon={<RefreshCw />} event="6 分钟前 · 12 / 15 台已升级，3 台客户电脑离线等上线" actions={acts("远控升级")} />
          <WorkItemCard title="整理 应用网关 (VM-102) 的日志轮转和磁盘告警阈值" owner="admin 的 claude" facts={["发起人 admin", "已跑 25 分钟"]} steps={GOAL_STEPS} current="plan" progress={0.15} eventIcon={<FileText />} event="25 分钟前 · 计划写好 5 步，等 AI 开工" actions={acts("日志轮转")} />
          <WorkItemCard title="Acme 测试机装好 Node 22 和 PM2 开机自启" owner="leo 的 claude" facts={["发起人 leo", "已跑 1.5 小时"]} steps={GOAL_STEPS} current="check" progress={0.95} eventIcon={<Check />} event="1 小时前 · 都装好了，等 leo 验收登录" actions={acts("装 Node")} />
        </WorkItemList>
      </PageBody>
    </>
  );
}

// ---------------------------------------------------------------- T12 向导页

function WizardTemplate() {
  const demo = useDemo();
  const [os, setOs] = useState("linux");
  const [tool, setTool] = useState("curl");
  const [now] = useState(() => Date.now());
  const command = `${tool === "curl" ? "curl -fsSL" : "wget -qO-"} https://ops.example.com/join/7Kq2-M9xD | sudo bash -s -- --name "Acme 测试机 3" --group 测试`;
  return (
    <>
      <PageHeader title="向导页" />
      <WizardLayout
        title="新增机器 · 一键脚本接入"
        description="在新机器上跑一行命令，它会装上运维平台公钥和健康检查，然后自己出现在机器列表里。"
        note="关掉也没关系，脚本跑完机器会自己出现在列表里"
        onClose={demo("关闭向导")}
        steps={[{ key: "os", label: "选系统" }, { key: "copy", label: "复制命令" }, { key: "wait", label: "等待接入" }, { key: "done", label: "完成" }]}
        current="copy"
        onBack={demo("上一步")}
        onNext={demo("下一步")}
        nextDisabledReason="机器连上来之后才能下一步"
        aside={
          <>
            <Panel title="常见问题" flush>
              <ActionList
                wrap
                label="常见问题"
                items={[
                  { key: "1", title: "等了很久还没连上？", detail: "看机器能否访问外网 443 端口，或换 wget 再试。" },
                  { key: "2", title: "没有 root 怎么办？", detail: "用有 sudo 的账号运行，命令里已带 sudo。" },
                  { key: "3", title: "机器在内网、出不了网？", detail: "先接一台同网段的机器当跳板，再选「经跳板接入」。" },
                ]}
              />
            </Panel>
            <Panel title="最近接入">
              <InfoList label="最近接入" items={[{ key: "ct", label: <><StatusBadge tone="success">已连上</StatusBadge>应用网关 (VM-102)</>, value: "昨天" }, { key: "rt", label: <><StatusBadge tone="warning">未连上</StatusBadge>家庭软路由</>, value: "2 天前" }]} />
            </Panel>
          </>
        }
      >
        <FormField label="这台机器是什么系统" htmlFor="tpl-os" hint="选错了可以随时换，命令会跟着变">
          <ChoiceTiles id="tpl-os" label="这台机器是什么系统" value={os} onValueChange={setOs} options={[{ value: "linux", label: "Linux", hint: "Ubuntu / Debian / CentOS", icon: <Server /> }, { value: "windows", label: "Windows", hint: "Win10 / Win11 / Server", icon: <LayoutGrid /> }, { value: "mac", label: "macOS", hint: "13 及以上，Intel / M 系列", icon: <Box /> }]} />
        </FormField>
        <FormField label="用 root 在这台机器上运行" htmlFor="tpl-cmd" hint="链接 30 分钟内有效，只能用一次；只装运维平台公钥和健康检查，不开新端口">
          <div>
            <SegmentedControl size="sm" label="下载工具" value={tool} onValueChange={setTool} options={[{ value: "curl", label: "curl" }, { value: "wget", label: "wget" }]} />
            <CopyBlock label="接入命令" value={command} />
          </div>
        </FormField>
        <InlineAlert tone="info" title="正在等这台机器连上来… 已等 00:42" action={<Button size="sm" variant="outline" onClick={demo("马上检查")}><RefreshCw />马上检查</Button>}>
          上次检查 {clock(now)}
        </InlineAlert>
      </WizardLayout>
    </>
  );
}

// ---------------------------------------------------------------- T13 个人页

function PersonalTemplate() {
  const demo = useDemo();
  const [host, setHost] = useState("test");
  const target = { test: "deploy@acme-test", "web-01": "leo@web-01", "nas-01": "leo@nas-01" }[host] ?? "deploy@acme-test";
  const connect = (name: string) => [
    { key: "term", label: "终端", icon: <SquareTerminal />, onSelect: demo(`打开 ${name} 终端`) },
    { key: "copy", label: "复制命令", icon: <Copy />, onSelect: demo("复制命令") },
  ];
  return (
    <>
      <PageHeader title="个人页" />
      <PageBody>
        <StatStrip
          title="我的概况"
          description="只算你自己的：能连的机器、快到期的授权、你的 AI 密钥。"
          actions={<><span>leo · 运维组</span><Button size="sm" variant="outline" onClick={demo("申请新机器")}><Shield />申请新机器</Button></>}
          items={[
            { key: "m", label: "我能连的机器", icon: <Server />, value: 12, unit: "台", note: "11 台可达 · 1 台离线" },
            { key: "due", label: "7 天内到期", icon: <CalendarDays />, value: 1, unit: "条", tone: "attention", note: "web-01 授权 10-05 到期", noteTone: "attention" },
            { key: "key", label: "我的 AI 密钥", icon: <KeyRound />, value: 2, unit: "把", note: "最近用过：12 分钟前" },
            { key: "bak", label: "我机器上的备份", icon: <Upload />, value: 5, unit: "条", note: "都达标 · 昨晚 03:00 跑过" },
          ]}
        />
        <SplitLayout
          railWidth={440}
          rail={
            <Panel title="我的接入" description="从自己电脑连机器用 SSH 公钥；给 AI 用 AI 密钥。" flush>
              <PaneSection title="SSH 公钥" icon={<KeyRound />} count={2} flush actions={<Button size="sm" variant="ghost" onClick={demo("添加公钥")}><Plus />添加</Button>}>
                <ActionList label="SSH 公钥" items={[
                  { key: "w", title: "办公室 Win11", detail: "SHA256:q3Zf9kT2mB8vXc1LwP0aRy7uNdE4hGs6", meta: "添加于 9-02", actions: [{ key: "del", label: "删除", destructive: true, onSelect: demo("删除公钥") }] },
                  { key: "m", title: "家里 MacBook", detail: "SHA256:7HnR2wYc5Qk1VbT8sLpM3xJf0aGd9Ue4", meta: "添加于 8-17", actions: [{ key: "del", label: "删除", destructive: true, onSelect: demo("删除公钥") }] },
                ]} />
              </PaneSection>
              <PaneSection title="AI 密钥" icon={<LayoutGrid />} count={2} flush actions={<Button size="sm" variant="ghost" onClick={demo("新建密钥")}><Plus />新建</Button>}>
                <ActionList label="AI 密钥" items={[
                  { key: "c", title: "leo 的 claude", detail: "op_live_••••••••••••3f9a · 12 分钟前用过", actions: [{ key: "copy", label: "复制", icon: <Copy />, onSelect: demo("复制密钥") }, { key: "revoke", label: "吊销", destructive: true, onSelect: demo("吊销") }] },
                  { key: "x", title: "leo 的 codex", detail: "op_live_••••••••••••c27e · 6 天没用", actions: [{ key: "copy", label: "复制", icon: <Copy />, onSelect: demo("复制密钥") }, { key: "revoke", label: "吊销", destructive: true, onSelect: demo("吊销") }] },
                ]} />
              </PaneSection>
              <PaneSection title="从自己电脑连" icon={<SquareTerminal />} actions={<SegmentedControl size="sm" label="连哪台" value={host} onValueChange={setHost} options={[{ value: "test", label: "Acme 测试机" }, { value: "web-01", label: "web-01" }, { value: "nas-01", label: "nas-01" }]} />}>
                <CopyBlock label="连接命令" value={`ssh -J leo@203.0.113.10:2222 ${target}`} hint="用上面任意一把 SSH 公钥对应的私钥登录，不需要密码" />
              </PaneSection>
            </Panel>
          }
        >
          <Panel title="最近连过" count={5} flush actions={<Button size="sm" variant="ghost" onClick={demo("我能连的全部")}>我能连的全部 12 台 ›</Button>}>
            <ActionList
              label="最近连过"
              items={[
                { key: "t", icon: <Server />, title: "Acme 测试机", detail: "Ubuntu 24.04 · 网页终端 · 用户 deploy", badge: <StatusBadge tone="success">可达</StatusBadge>, meta: "18 分钟前", actions: connect("Acme 测试机") },
                { key: "s", icon: <Server />, title: "web-01", detail: "生产环境 · SSH · 用户 leo · 只读日志目录", badge: <StatusBadge tone="warning">3 天后到期</StatusBadge>, meta: "2 小时前", actions: connect("web-01") },
                { key: "f", icon: <Server />, title: "nas-01", detail: "NAS · SSH · 用户 leo", badge: <StatusBadge tone="success">可达</StatusBadge>, meta: "昨天", actions: connect("nas-01") },
                { key: "c", icon: <Server />, title: "应用网关 (VM-102)", detail: "PVE 容器 · 网页终端 · 用户 root", badge: <StatusBadge tone="danger">离线</StatusBadge>, meta: "9-29", actions: connect("VM-102") },
                { key: "p", icon: <Database />, title: "nas-01-pg", detail: "数据库 · 只读 · 通过 AI 助理查询", badge: <StatusBadge tone="success">可达</StatusBadge>, meta: "9-28", actions: [{ key: "q", label: "查询", icon: <Search />, onSelect: demo("查询") }] },
              ]}
            />
          </Panel>
          <TodoInbox
            title="要留意的事"
            description="快到期的授权、被拒的申请、没在用的密钥。"
            items={[{ key: "due", icon: <CalendarDays />, tone: "attention", title: "web-01 的访问授权 3 天后到期", detail: "10-05 23:59 到期 · 由 admin 授权 · 到期后 SSH 和网页终端都连不上", meta: "10-05", actions: [{ key: "renew", label: "申请续期", icon: <RotateCw />, primary: true, onSelect: demo("申请续期") }] }]}
            ok="其他都正常：密钥都在用、备份都达标、没有被拒的申请"
          />
        </SplitLayout>
      </PageBody>
    </>
  );
}

// ---------------------------------------------------------------- 菜单

export type TemplatePage = { id: string; no: string; title: string; icon: LucideIcon; keywords: string; render: (active: boolean) => ReactNode };
/** 「页面模板」菜单组：T01–T13 各一页；T14 记录详情在「组件总览」里（由宿主把 tpl-t14 指到 kit）。 */
export const TEMPLATE_PAGES: readonly TemplatePage[] = [
  { id: "tpl-t01", no: "T01", title: "T01 工作台首页", icon: Inbox, keywords: "模板 首页 指标带 待办 在线 常用入口", render: () => <HomeTemplate /> },
  { id: "tpl-t02", no: "T02", title: "T02 资源列表页", icon: Server, keywords: "模板 列表 机器 筛选 批量 分页", render: (a) => <ListTemplate active={a} /> },
  { id: "tpl-t03", no: "T03", title: "T03 指标 + 列表", icon: Upload, keywords: "模板 指标 列表 备份 要处理的", render: (a) => <KpiListTemplate active={a} /> },
  { id: "tpl-t04", no: "T04", title: "T04 统计看板页", icon: JapaneseYen, keywords: "模板 统计 用量 图表 排行", render: () => <StatsTemplate /> },
  { id: "tpl-t05", no: "T05", title: "T05 分区合并页", icon: Users, keywords: "模板 分区 标签 人员 角色 邀请", render: (a) => <SectionsTemplate active={a} /> },
  { id: "tpl-t06", no: "T06", title: "T06 日志 / 时间线", icon: FileText, keywords: "模板 日志 审计 时间线 改前改后", render: () => <LogTemplate /> },
  { id: "tpl-t07", no: "T07", title: "T07 关系图 / 监控", icon: Link2, keywords: "模板 关系图 连接图 监控 图例", render: () => <GraphTemplate /> },
  { id: "tpl-t08", no: "T08", title: "T08 设置 / 表单", icon: Settings, keywords: "模板 设置 表单 分节 保存条", render: () => <SettingsTemplate /> },
  { id: "tpl-t09", no: "T09", title: "T09 权限配置页", icon: Shield, keywords: "模板 授权 矩阵 权限 人员组", render: (a) => <MatrixTemplate active={a} /> },
  { id: "tpl-t10", no: "T10", title: "T10 工具 / 工作区", icon: LayoutGrid, keywords: "模板 工作区 对话 AI 助理 终端", render: () => <WorkspaceTemplate /> },
  { id: "tpl-t11", no: "T11", title: "T11 进度 / 工作项", icon: Clock, keywords: "模板 进度 目标 任务 步骤", render: () => <BoardTemplate /> },
  { id: "tpl-t12", no: "T12", title: "T12 向导页", icon: Plus, keywords: "模板 向导 步骤 新增机器 一键接入", render: () => <WizardTemplate /> },
  { id: "tpl-t13", no: "T13", title: "T13 个人页", icon: User, keywords: "模板 个人 我的 接入 公钥 密钥", render: () => <PersonalTemplate /> },
];

/** One template page by menu id (template-menu.tsx loads this module lazily). */
export function TemplateById({ id, active }: { id: string; active: boolean }) {
  return <>{TEMPLATE_PAGES.find((p) => p.id === id)?.render(active) ?? null}</>;
}
