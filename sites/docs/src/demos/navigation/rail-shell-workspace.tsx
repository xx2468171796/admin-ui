// 模块工作区：左 60px 图标栏（模块 + 通知 / 设置 / 头像）· 目录树（文件夹、数量、搜索、新建）·
// 标题栏（名字 · ? · ☆ · 范围胶囊 · 正在看的人 · 工具 · 分享 · ⋯）· 下划线视图标签 · 内容。手机上图标栏变底栏。
import { useState } from "react";
import { BarChart3, Bell, BookOpen, ClipboardList, Home, LayoutDashboard, Layers, MessageSquare, Settings, Share2, ShieldCheck, Table2, Users, Zap } from "lucide-react";
import {
  Button, DataTable, IconButton, NavTree, RailShell, ScopePill, StatusBadge, Tabs, WorkspaceTitleBar, useNotify,
  type Column, type NavTreeNode, type RailModule,
} from "@adminui/react";
import { CUSTOMERS, formatAmount, personName, stageLabel, type Customer } from "../../data/demo-data";
import { LOGO } from "../../data/navigation-data";

const MODULES: readonly RailModule[] = [
  { id: "home", title: "工作台", icon: Home },
  { id: "tables", title: "多维表格", shortTitle: "表格", icon: Table2 },
  { id: "crm", title: "客户", icon: Users, badge: 3 },
  { id: "wiki", title: "知识库", icon: BookOpen },
  { id: "reports", title: "报表", icon: BarChart3 },
];
const FOOTER: readonly RailModule[] = [
  { id: "notice", title: "通知", icon: Bell, badge: 12 },
  { id: "settings", title: "设置", icon: Settings },
];
const TREE: NavTreeNode[] = [
  { id: "sales", label: "销售", children: [
    { id: "customers", label: "客户", icon: Table2, count: 1284 },
    { id: "deals", label: "商机", icon: Table2, count: 412 },
    { id: "follow", label: "跟进记录", icon: Table2, count: 9610 },
  ] },
  { id: "service", label: "客户成功", defaultOpen: false, children: [
    { id: "tickets", label: "工单", icon: Table2, count: 356 },
    { id: "renewals", label: "续约", icon: Table2, count: 88 },
  ] },
  { id: "board", label: "销售看板", icon: LayoutDashboard },
  { id: "form", label: "官网咨询表单", icon: ClipboardList },
];
const LINES = [
  { value: "smb", label: "中小企业", hint: "华东" },
  { value: "ka", label: "大客户", hint: "总部" },
];
const COLUMNS: readonly Column<Customer>[] = [
  { key: "name", title: "客户", render: (r) => r.name, minWidth: 160 },
  { key: "stage", title: "阶段", render: (r) => <StatusBadge variant="dot">{stageLabel(r.stage)}</StatusBadge> },
  { key: "owner", title: "负责人", render: (r) => personName(r.owner) },
  { key: "amount", title: "金额", render: (r) => formatAmount(r.amount), numeric: true, align: "right" },
];

export function Demo() {
  const notify = useNotify();
  const say = (text: string) => () => notify(text, "info");
  const [module, setModule] = useState("tables");
  const [table, setTable] = useState("customers");
  const [line, setLine] = useState("smb");
  const [star, setStar] = useState(false);
  const [view, setView] = useState("all");
  return (
    <div style={{ height: 600 }}>
      <RailShell
        brand={LOGO}
        modules={MODULES}
        activeModule={module}
        onModuleChange={setModule}
        footer={FOOTER}
        account={{ name: "林晓", hint: "销售总监", menu: [{ items: [{ key: "me", label: "我的资料", onSelect: say("打开我的资料") }, { key: "out", label: "退出登录", onSelect: say("已退出（演示）") }] }] }}
        sidebarLabel="数据表目录"
        sidebar={
          <NavTree
            title="销售业务"
            subtitle="总部 · 7 张表"
            icon={<Table2 />}
            nodes={TREE}
            activeId={table}
            onSelect={setTable}
            search="搜索数据表、仪表盘"
            createMenu={[{ items: [
              { key: "table", label: "数据表", icon: <Table2 aria-hidden="true" />, onSelect: say("新建数据表") },
              { key: "dash", label: "仪表盘", icon: <LayoutDashboard aria-hidden="true" />, onSelect: say("新建仪表盘") },
            ] }]}
          />
        }
      >
        <WorkspaceTitleBar
          title="客户"
          description="销售业务的全部客户；跟进记录在每个客户的详情里。"
          favorite={star}
          onFavoriteChange={setStar}
          scope={<ScopePill value={line} options={LINES} onChange={setLine} icon={<Layers aria-hidden="true" />} />}
          presence={[{ name: "陈一鸣", hint: "在编辑" }, { name: "王佳宁" }, { name: "赵思远" }, { name: "周可欣" }]}
          tools={<>
            <IconButton label="评论" icon={<MessageSquare />} onClick={say("打开评论")} />
            <IconButton label="自动化" icon={<Zap />} onClick={say("打开自动化")} />
            <IconButton label="权限" icon={<ShieldCheck />} onClick={say("打开权限")} />
          </>}
          actions={<Button size="sm" onClick={say("打开分享")}><Share2 aria-hidden="true" />分享</Button>}
          more={[{ items: [{ key: "export", label: "导出 Excel", onSelect: say("导出") }, { key: "history", label: "历史版本", onSelect: say("历史版本") }] }]}
        />
        <Tabs size="sm" label="视图" value={view} onValueChange={setView} items={[{ value: "all", label: "全部客户" }, { value: "mine", label: "我负责的" }, { value: "late", label: "逾期未跟进", count: 4, countTone: "danger" }]} />
        <DataTable caption="客户" rows={CUSTOMERS.slice(0, 8)} rowKey={(r) => r.id} columns={COLUMNS} pagination={{ mode: "all" }} />
      </RailShell>
    </div>
  );
}
