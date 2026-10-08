import { useMemo, useState } from "react";
import { Bell, Box, CalendarClock, CalendarDays, Clock, Copy, ExternalLink, Eye, FileText, KeyRound, LayoutGrid, Link2, Pencil, RefreshCw, Server, Share2, Tag as TagIcon, User, Wallet } from "lucide-react";
import {
  ActivityFeed,
  AsyncSwitch,
  Button,
  CopyBlock,
  Count,
  DataTable,
  FactStrip,
  LogTimeline,
  Meter,
  PageBody,
  PageHeader,
  PALETTES,
  PersonLine,
  RecordHeader,
  RowActionBar,
  SectionCard,
  SegmentedControl,
  SharePicker,
  Sparkline,
  StatusBadge,
  Steps,
  Tag,
  useAdminTheme,
  useNotify,
  type Column,
  type RecordLayout,
  DescriptionList,
} from "@adminui/react";

// 组件总览：已审定的组件（色卡 + C 版记录详情）。新页面照这里拼，不要另造样式（AI-RULES.md）。
type Account = { id: string; name: string; plan: string; account: string; due: string; daysLeft: number; cost: string; sale: string; customer: string; usedBy: string; token: boolean; tags: string[]; owner: string };
const accounts: Account[] = [
  { id: "a1", name: "Acme Cloud 团队版 · max@example.com", plan: "团队版 · 年付", account: "max@example.com", due: "2026-10-28", daysLeft: 26, cost: "¥1,680 / 月", sale: "", customer: "市场部", usedBy: "订单 A-0015「年度采购」", token: true, tags: ["订阅", "acme", "续费提醒"], owner: "admin" },
  { id: "a2", name: "Acme Cloud 专业版 · pro@example.com", plan: "专业版 · 月付", account: "pro@example.com", due: "2026-10-06", daysLeft: 4, cost: "¥140 / 月", sale: "¥199 / 月", customer: "销售部", usedBy: "", token: false, tags: ["订阅", "acme"], owner: "王浩" },
  { id: "a3", name: "Acme Cloud 基础版 · ops@example.com", plan: "基础版 · 月付", account: "ops@example.com", due: "2027-01-12", daysLeft: 102, cost: "¥145 / 月", sale: "¥180 / 月", customer: "内部", usedBy: "运维组共用", token: false, tags: ["订阅", "acme"], owner: "admin" },
];
const dueTone = (a: Account) => (a.daysLeft <= 7 ? ("danger" as const) : a.daysLeft <= 30 ? ("attention" as const) : undefined);

// 演示用操作记录：右栏「最近动态」取前 4 条，「操作记录」标签页全部
type LogEvent = { id: string; at: string; actor: string; text: string; tone: "warning" | "brand" | "danger" | "neutral" };
const events: LogEvent[] = [
  { id: "e1", at: "2026-10-01T19:01:00+08:00", actor: "admin", text: "改了「用在哪」", tone: "brand" },
  { id: "e2", at: "2026-09-30T23:10:00+08:00", actor: "admin", text: "查看了长期令牌（已记审计）", tone: "danger" },
  { id: "e3", at: "2026-09-28T14:22:00+08:00", actor: "admin", text: "新建", tone: "neutral" },
  { id: "e4", at: "2026-09-28T09:00:00+08:00", actor: "系统", text: "续费提醒已发（还剩 30 天）", tone: "warning" },
  ...Array.from({ length: 8 }, (_, i) => ({ id: `o${i}`, at: `2026-09-${String(27 - i).padStart(2, "0")}T10:00:00+08:00`, actor: "admin", text: "查看了账号", tone: "neutral" as const })),
];
const priceFields = (a: Account) => [
  { key: "sale", label: "预算", icon: <Wallet />, value: () => a.sale || null, showEmpty: true, tone: () => (a.sale ? undefined : ("danger" as const)) },
  { key: "cost", label: "月费", icon: <Wallet />, value: () => a.cost },
  { key: "official", label: "标价", value: () => null },
  { key: "node", label: "地区", value: () => null },
  { key: "nodeCost", label: "存储费", value: () => null },
  { key: "supplier", label: "经销商", value: () => null },
  { key: "supplierCost", label: "年度合计", value: () => (a.sale ? "¥18,000 / 年" : null) },
];

function layoutOf(notify: (text: string, tone?: "info" | "success") => void): RecordLayout<Account> {
  const todo = (what: string) => () => notify(what, "info");
  return {
    title: (a) => a.name,
    crumb: "订阅 / Acme Cloud",
    avatar: (a) => a.name.slice(0, 1),
    tags: () => ["订阅", "Acme Cloud"],
    subtitle: (a) => `更新于 2026-10-01 19:01 · ${a.owner}`,
    status: () => ({ label: "运行中", tone: "success" }),
    overview: { label: "概览", icon: <LayoutGrid /> },
    highlights: (a) => [
      { key: "due", label: "下次续费", icon: <CalendarClock />, value: `${a.due.slice(5)} · 还剩 ${a.daysLeft} 天`, tone: a.daysLeft <= 30 ? "warning" : undefined },
      { key: "cost", label: "月费", icon: <Wallet />, value: a.cost },
      { key: "sale", label: "预算", icon: <Wallet />, value: a.sale || "未填", tone: a.sale ? undefined : "danger" },
      { key: "customer", label: "部门", icon: <User />, value: a.customer },
      { key: "usedBy", label: "用在哪", icon: <Box />, value: a.usedBy.replace(/「.*」/, "") || "—" },
    ],
    alerts: (a) => (a.sale ? [] : [{ key: "sale", tone: "danger", title: "预算没填", text: "这笔订阅本月有没有超预算算不出来，续费提醒也没法带上金额。", action: { label: "去填写", onSelect: todo("打开编辑表单：预算") } }]),
    sections: [
      {
        key: "connect",
        title: "连接信息",
        icon: <Link2 />,
        progress: true,
        actions: () => [{ key: "mail", label: "登录邮箱", icon: <ExternalLink />, onSelect: todo("新窗口打开邮箱") }],
        fields: [
          { key: "addr", label: "地址", icon: <Link2 />, value: () => "cloud.example.com（邮箱 mail.example.com）", text: () => "https://cloud.example.com", copy: true, href: () => "https://cloud.example.com", span: 2 },
          { key: "login", label: "登录方式", icon: <KeyRound />, value: () => "邮箱验证码" },
          { key: "account", label: "账号", icon: <User />, value: (a) => a.account, copy: true, mono: true, span: 2 },
          { key: "secret", label: "密码", icon: <KeyRound />, value: () => null, showEmpty: true },
        ],
      },
      {
        key: "plan",
        title: "订阅与续费",
        icon: <CalendarDays />,
        progress: true,
        onFill: todo("打开编辑表单"),
        actions: () => [{ key: "edit", label: "编辑", icon: <Pencil />, onSelect: todo("打开编辑表单") }],
        fields: [
          { key: "plan", label: "平台 · 套餐", icon: <Box />, value: (a) => `Acme Cloud · ${a.plan}` },
          { key: "start", label: "订阅日", icon: <CalendarDays />, value: () => "2026-09-28" },
          { key: "due", label: "下次续费", icon: <Bell />, value: (a) => <>{a.due} <Count tone="attention">{a.daysLeft} 天</Count></>, text: (a) => a.due, tone: dueTone, action: () => ({ label: "已续费", icon: <RefreshCw />, onSelect: todo("标记已续费") }) },
          { key: "cycle", label: "续费周期", icon: <RefreshCw />, value: () => "每月" },
          { key: "cost", label: "月费", icon: <Wallet />, value: (a) => a.cost },
          { key: "sale", label: "预算", icon: <Wallet />, value: (a) => a.sale || null, showEmpty: true, tone: (a) => (a.sale ? undefined : "danger"), action: (a) => (a.sale ? null : { label: "填写预算", onSelect: todo("打开编辑表单：预算") }) },
          { key: "pay", label: "付款方式", value: () => null },
        ],
      },
      {
        key: "token",
        title: "令牌",
        icon: <KeyRound />,
        actions: () => [{ key: "reveal", label: "查看全部密钥", icon: <Eye />, onSelect: todo("查看全部密钥（记审计）") }],
        fields: [
          { key: "token", label: "长期令牌", icon: <KeyRound />, value: (a) => (a.token ? "••••••••" : null), mono: true },
          { key: "tokenDue", label: "令牌到期", icon: <CalendarDays />, value: (a) => (a.token ? "2027-10-01" : null) },
          { key: "usedBy", label: "用在哪", icon: <Box />, value: (a) => a.usedBy || null },
        ],
      },
    ],
    aside: [
      {
        key: "owner",
        title: "归属与分享",
        icon: <Share2 />,
        render: (a) => <PersonLine name={`${a.owner}（我）`} hint="归属人 · 管理员" />,
        fields: [
          { key: "share", label: "分享", value: () => "还没分享", showEmpty: true },
          { key: "intro", label: "介绍", value: () => "已写 · 第 3 版" },
          { key: "remind", label: "提醒", value: () => "到期前 7 / 3 / 1 天" },
        ],
        actions: () => [{ key: "share", label: "分享", onSelect: todo("打开分享") }],
      },
      { key: "tags", title: "标签", icon: <TagIcon />, render: (a) => <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{a.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div> },
      {
        key: "recent",
        title: "最近动态",
        icon: <Clock />,
        render: (_a, { setTab }) => (
          <>
            <ActivityFeed caption="最近动态" items={events.slice(0, 4)} getId={(e) => e.id} time={(e) => e.at} title={(e) => e.text} actor={(e) => e.actor} tone={(e) => e.tone} groupByDay={false} />
            <Button variant="text" size="sm" onClick={() => setTab("log")}>查看全部 {events.length} 条操作记录 →</Button>
          </>
        ),
      },
    ],
    tabs: [
      { key: "price", label: "费用与预算", icon: <Wallet />, countUnfilled: true, sections: [{ key: "price", title: "费用与预算", icon: <Wallet />, progress: true, onFill: todo("打开编辑表单"), fields: priceFields }] },
      {
        key: "login",
        label: "登录与令牌",
        icon: <KeyRound />,
        sections: [{ key: "login", title: "登录与令牌", icon: <KeyRound />, progress: true, fields: [
          { key: "mail", label: "邮箱网址", icon: <Link2 />, value: () => "mail.example.com", href: () => "https://mail.example.com", copy: true },
          { key: "mailPass", label: "邮箱密码", icon: <KeyRound />, value: () => "••••••••", mono: true },
          { key: "login", label: "登录方式", value: () => "邮箱验证码" },
          { key: "token", label: "长期令牌", icon: <KeyRound />, value: (a) => (a.token ? "••••••••" : null), mono: true },
          { key: "tokenDue", label: "长期令牌到期", value: (a) => (a.token ? "2027-10-01" : null) },
          { key: "usedBy", label: "用在哪", value: (a) => a.usedBy || null },
        ] }],
      },
      {
        key: "customer",
        label: "客户",
        icon: <User />,
        sections: [{ key: "customer", title: "客户", icon: <User />, progress: true, fields: [
          { key: "nick", label: "客户昵称", value: () => null },
          { key: "wechat", label: "客户微信号", value: (a) => a.customer, copy: true },
          { key: "aigw", label: "aigw 客户", value: () => null },
          { key: "visible", label: "客户可见", value: () => null },
        ] }],
      },
      { key: "intro", label: "介绍", icon: <FileText />, render: () => <SectionCard title="介绍 · 第 3 版" icon={<FileText />}><p className="aui-note">干什么用、配在哪、权限范围、怎么轮换……</p></SectionCard> },
      {
        key: "log",
        label: "操作记录",
        icon: <Clock />,
        count: () => events.length,
        render: () => <LogTimeline caption="操作记录" items={events} getId={(e) => e.id} time={(e) => e.at} actor={(e) => ({ name: e.actor })} text={(e) => e.text} total={events.length} />,
      },
    ],
    actions: () => [
      { key: "copy", label: "复制全部", icon: <Copy />, primary: true, keepOpen: true, onSelect: todo("已复制") },
      { key: "renew", label: "已续费", icon: <RefreshCw />, tone: "attention", onSelect: todo("标记已续费") },
      { key: "edit", label: "编辑", icon: <Pencil />, primary: true, onSelect: todo("打开编辑表单") },
      { key: "share", label: "分享", icon: <Share2 />, onSelect: todo("打开分享") },
    ],
  };
}

const columns: Column<Account>[] = [
  { key: "name", title: "账号", render: (a) => <b>{a.name}</b> },
  { key: "due", title: "下次续费", render: (a) => <StatusBadge tone={a.daysLeft <= 7 ? "danger" : a.daysLeft <= 30 ? "warning" : "success"}>{a.due}（{a.daysLeft} 天）</StatusBadge> },
  { key: "trend", title: "近 7 天用量", render: (a) => <Sparkline label={`${a.name} 近 7 天用量`} values={a.id === "a1" ? [3, 5, 4, 8, 7, 9, 12] : [6, 5, 6, 4, 5, 3, 4]} tone={a.id === "a1" ? "attention" : "brand"} /> },
  { key: "actions", title: "操作", kind: "actions", render: (a) => <RowActionBar label={`${a.name}的更多操作`} actions={[{ key: "copy", label: "复制", icon: <Copy />, onSelect: () => { void navigator.clipboard?.writeText(a.name).catch(() => undefined); } }]} /> },
];

/** Palette switcher of the provider (persisted per storageKey). */
function PalettePicker() {
  const { paletteChoice, setPalette } = useAdminTheme();
  return (
    <SegmentedControl label="色卡" size="sm" value={typeof paletteChoice === "string" ? paletteChoice : "forest"} onValueChange={setPalette}
      options={PALETTES.map((p) => ({ value: p.id, label: p.name }))} />
  );
}

export function KitShowcase() {
  const notify = useNotify();
  const layout = useMemo(() => layoutOf(notify), [notify]);
  const [selected, setSelected] = useState<string[]>(["a1", "a2"]);
  const [step, setStep] = useState("run");
  const [shares, setShares] = useState([{ id: "u1", level: "view" }]);
  const [aiOn, setAiOn] = useState(true);
  return (
    <PageBody>
      <PageHeader title="组件总览" description="已审定的组件：一个主色系 + 3 种点缀色，不加色条，控件统一 36 / 28 高。新页面照这里拼。" actions={<PalettePicker />} />
      <SectionCard title="记录头部 + 关键信息块" icon={<Server />}>
        <RecordHeader avatar="A" title="Acme Cloud 团队版 · max@example.com" status={<StatusBadge tone="success">运行中</StatusBadge>} tags={["订阅", "Acme Cloud"]} meta="更新于 10-01 19:01 · admin"
          crumb="订阅 / Acme Cloud" nav={{ index: 0, total: 20, onMove: () => undefined }}
          actions={<><Button><Copy />复制全部</Button><Button variant="outline"><Pencil />编辑</Button></>}
          facts={<FactStrip items={layout.highlights!(accounts[0]!).map((h) => ({ key: h.key, label: h.label, value: h.value, hint: h.hint, icon: h.icon, tone: h.tone === "warning" ? "attention" : h.tone === "danger" ? "danger" : undefined }))} />} />
      </SectionCard>
      <SectionCard title="分组卡片 + 字段方块" icon={<CalendarDays />} progress={{ filled: 5, total: 6 }} actions={<Button size="sm" variant="outline"><Pencil />编辑</Button>}>
        <DescriptionList columns={3} items={[{ label: "账号", value: "max@example.com" }, { label: "下次续费", value: "2026-10-28 · 26 天" }, { label: "预算", value: "未填" }, { label: "地址", value: "cloud.example.com", full: true }, { label: "密码", value: "未存" }]} />
      </SectionCard>
      <SectionCard title="数据表格 + 批量操作 + 迷你趋势；点「详情」看 C 版大弹框" icon={<Server />} flush>
        <DataTable rows={accounts} columns={columns} rowKey={(a) => a.id} caption="订阅" pagination={{ mode: "all" }} selected={selected} onSelectionChange={setSelected}
          bulkActions={[{ key: "renew", label: "批量续费", icon: <RefreshCw />, onSelect: () => notify("批量续费（演示）", "info") }, { key: "share", label: "分享给…", icon: <Share2 />, onSelect: () => notify("分享（演示）", "info") }]}
          expandRecord={{ label: (a) => a.name, layout, level: "expanded" }} />
      </SectionCard>
      <SectionCard title="步骤条 · 数量角标 · 人员行" icon={<Box />}>
        <div style={{ display: "grid", gap: 16 }}>
          <Steps current={step} steps={[{ key: "owner", label: "选归属" }, { key: "run", label: "运行命令" }, { key: "check", label: "等待体检" }]} />
          <div style={{ display: "flex", gap: 8 }}><Button size="sm" variant="outline" onClick={() => setStep("owner")}>上一步</Button><Button size="sm" onClick={() => setStep("check")}>下一步</Button></div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>操作记录 <Count>12</Count> 价格 <Count tone="danger">6 未填</Count> 待处理 <Count tone="attention">3</Count></div>
          <PersonLine name="王浩" hint="运维组 · 归属人" />
          <div style={{ display: "flex", gap: 6 }}><Tag>订阅</Tag><Tag>续费提醒</Tag><Tag variant="plain">Acme Cloud</Tag></div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><AsyncSwitch checked={aiOn} label="允许 AI 连接" onChange={async (next) => { await new Promise((r) => setTimeout(r, 400)); setAiOn(next); }} />允许 AI 连接</label>
        </div>
      </SectionCard>
      <SectionCard title="命令块 · 进度条 · 选人分享" icon={<Share2 />}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ display: "grid", gap: 14 }}>
            <CopyBlock label="接入命令" value="curl -fsSL https://example.com/enroll/8f3a… | sudo bash" hint="命令 30 分钟内有效，只能用一次。" />
            <Meter label="CPU" ratio={0.32} />
            <Meter label="磁盘" ratio={0.86} detail="/data 预计 3 天写满" />
            <Meter label="额度" ratio={0.97} />
          </div>
          <SharePicker subjects={[{ id: "u1", name: "王浩", hint: "运维组" }, { id: "u2", name: "雷星", hint: "开发组" }, { id: "g1", name: "客服组", hint: "5 人", group: true }]}
            value={shares} onChange={setShares} levels={[{ value: "view", label: "可看" }, { value: "secret", label: "可看密码" }]} />
        </div>
      </SectionCard>
    </PageBody>
  );
}
