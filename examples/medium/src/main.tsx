import React, { lazy, Suspense, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ChartNoAxesCombined,
  LayoutGrid,
  Settings,
  UserRound,
  Eye,
  KeyRound,
  Pencil,
  FileText,
  Image,
  Plus,
  RefreshCw,
  Moon,
  Sun,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Sheet,
  Table2,
  Users,
  History,
  Sparkles,
} from "lucide-react";
import {
  AdminProvider,
  AdminShell,
  Button,
  ChangeList,
  ChipGroup,
  Choice,
  CommandPalette,
  ConfirmDialog,
  CopyableValue,
  DataTable,
  DescriptionList,
  DetailLayout,
  Dialog,
  FormDialog,
  FormField,
  FormSection,
  AppearanceButton,
  Input,
  InlineAlert,
  NotificationProvider,
  OneTimeSecretDialog,
  PageBody,
  PageHeader,
  Panel,
  QueryBar,
  QuickDatePresets,
  ResourcePanel,
  RowActionBar,
  SegmentedControl,
  StatePanel,
  StatusBadge,
  Switch,
  TabbedPage,
  UploadField,
  changedFields,
  navCommands,
  useCursorDataSource,
  useDataSource,
  useNotify,
  type Column,
  type CursorListAdapter,
  type ListAdapter,
  type ListQuery,
  type NavItem,
  type WorkspaceItem,
  DateTimePicker,
  IconButton,
} from "@adminui/react";
import "@adminui/react/styles.css";
const MotionShowcase = lazy(() => import("./MotionShowcase").then((m) => ({ default: m.MotionShowcase })));
const WorkflowShowcase = lazy(() => import("./WorkflowShowcase").then((m) => ({ default: m.WorkflowShowcase })));
const BusinessTables = lazy(() => import("./BusinessTables").then((m) => ({ default: m.BusinessTables })));
// bt/dashboards
const TeamTodayDashboard = lazy(() => import("./TeamTodayDashboard").then((m) => ({ default: m.TeamTodayDashboard })));
const DashboardKitShowcase = lazy(() => import("./DashboardKitShowcase").then((m) => ({ default: m.DashboardKitShowcase })));
import { recordDemoAudit } from "./governance-demo";
const AccessPage = lazy(() => import("./GovernancePages").then((m) => ({ default: m.AccessPage })));
const AuditPage = lazy(() => import("./GovernancePages").then((m) => ({ default: m.AuditPage })));
// 多维表格在可选子路径 @adminui/react/grid（TanStack Table + Virtual），按需加载，不进首屏包。
const CollectionsShowcase = lazy(() => import("./CollectionsShowcase").then((m) => ({ default: m.CollectionsShowcase })));
const KitShowcase = lazy(() => import("./KitShowcase").then((m) => ({ default: m.KitShowcase })));
// bt/foundations
const FoundationsShowcase = lazy(() => import("./FoundationsShowcase").then((m) => ({ default: m.FoundationsShowcase })));
const DatePickerShowcase = lazy(() => import("./DatePickerShowcase").then((m) => ({ default: m.DatePickerShowcase }))); // bt/datepicker
const FormControlsShowcase = lazy(() => import("./FormControlsShowcase").then((m) => ({ default: m.FormControlsShowcase })));
const BasicsShowcase = lazy(() => import("./BasicsShowcase").then((m) => ({ default: m.BasicsShowcase })));
const NavigationShowcase = lazy(() => import("./NavigationShowcase").then((m) => ({ default: m.NavigationShowcase })));
const OverlaysShowcase = lazy(() => import("./OverlaysShowcase").then((m) => ({ default: m.OverlaysShowcase })));
const InputsShowcase = lazy(() => import("./InputsShowcase").then((m) => ({ default: m.InputsShowcase })));
import { CalendarDays, ListChecks } from "lucide-react";
const MediaShowcase = lazy(() => import("./MediaShowcase").then((m) => ({ default: m.MediaShowcase }))); // bt/media
import { Paperclip } from "lucide-react"; // bt/media
const RecordsShowcase = lazy(() => import("./RecordsShowcase").then((m) => ({ default: m.RecordsShowcase }))); // bt/records
const RecordCardsShowcase = lazy(() => import("./RecordCardsShowcase").then((m) => ({ default: m.RecordCardsShowcase })));
// 协作与分享（评论、改前 → 改后）、通用审批
const CollabShowcase = lazy(() => import("./CollabShowcase").then((m) => ({ default: m.CollabShowcase })));
const ApprovalShowcase = lazy(() => import("./ApprovalShowcase").then((m) => ({ default: m.ApprovalShowcase })));
import { ClipboardCheck, MessagesSquare } from "lucide-react";
const TableAccessShowcase = lazy(() => import("./TableAccessShowcase").then((m) => ({ default: m.TableAccessShowcase }))); // bt/records
const AccessModulesShowcase = lazy(() => import("./AccessModulesShowcase").then((m) => ({ default: m.AccessModulesShowcase }))); // bt/access-modules
// bt/share
import { Share2 } from "lucide-react";
const ShareShowcase = lazy(() => import("./ShareShowcase").then((m) => ({ default: m.ShareShowcase })));
const OrgPickerShowcase = lazy(() => import("./OrgPickerShowcase").then((m) => ({ default: m.OrgPickerShowcase })));
import type { PublicKind } from "./SharePublicDemo";
const SharePublicDemo = lazy(() => import("./SharePublicDemo").then((m) => ({ default: m.SharePublicDemo })));
// 页面模板 T01–T13 按需加载：菜单只用轻量的 template-menu.ts，页面本身在 PageTemplates.tsx（懒加载）
import { TEMPLATE_PAGES, templateWorkspacePages } from "./template-menu";
import { TEMPLATE_LINKS, TemplateStandalone, templatePage } from "./TemplatePages"; // bt/templates
// bt/views：视图（看板 / 画册 / 日历 / 甘特）在可选子路径 @adminui/react/views，按需加载。
const ViewsShowcase = lazy(() => import("./ViewsShowcase").then((m) => ({ default: m.ViewsShowcase })));
// bt/builders-a：表单搭建器（@adminui/react/form-builder）与公开填写页（@adminui/react/forms-public），按需加载。
const FormsShowcase = lazy(() => import("./FormsShowcase").then((m) => ({ default: m.FormsShowcase })));
const FormPublicDemo = lazy(() => import("./FormPublicDemo").then((m) => ({ default: m.FormPublicDemo })));
const BitableShowcase = lazy(() => import("./BitableShowcase").then((m) => ({ default: m.BitableShowcase })));
const GridCustomersShowcase = lazy(() => import("./GridCustomersShowcase").then((m) => ({ default: m.GridCustomersShowcase }))); // bt/grid-b
// 权限管理组件在可选子路径 @adminui/react/access，同样按需加载。
const AccessShowcase = lazy(() => import("./AccessShowcase").then((m) => ({ default: m.AccessShowcase })));
const GovernanceAccessShowcase = lazy(() => import("./GovernanceAccessShowcase").then((m) => ({ default: m.GovernanceAccessShowcase })));
// bt/history
const HistoryShowcase = lazy(() => import("./HistoryShowcase").then((m) => ({ default: m.HistoryShowcase })));
const AiShowcase = lazy(() => import("./AiShowcase").then((m) => ({ default: m.AiShowcase })));
// bt/builders-b：录音文字稿、分配规则、看板搭建（搭建器在子路径 @adminui/react/dashboard-builder，按需加载）
import { AudioLines, LayoutDashboard, ListOrdered } from "lucide-react";
const TranscriptShowcase = lazy(() => import("./TranscriptShowcase").then((m) => ({ default: m.TranscriptShowcase })));
const RulesShowcase = lazy(() => import("./RulesShowcase").then((m) => ({ default: m.RulesShowcase })));
const FlushWorkspaceShowcase = lazy(() => import("./FlushWorkspaceShowcase").then((m) => ({ default: m.FlushWorkspaceShowcase }))); // bt/flush
const PageFlushShowcase = lazy(() => import("./PageFlushShowcase").then((m) => ({ default: m.PageFlushShowcase }))); // 8.6 page flush
const SingleSectionShowcase = lazy(() => import("./PageFlushShowcase").then((m) => ({ default: m.SingleSectionShowcase }))); // 8.6 page flush
const LeadCountShowcase = lazy(() => import("./PageFlushShowcase").then((m) => ({ default: m.LeadCountShowcase }))); // 8.6.1 lone list: no empty toolbar row
const AccessConsoleShowcase = lazy(() => import("./AccessConsoleShowcase").then((m) => ({ default: m.AccessConsoleShowcase }))); // 8.6.1 AccessConsole flush
const DashboardBuilderShowcase = lazy(() => import("./DashboardBuilderShowcase").then((m) => ({ default: m.DashboardBuilderShowcase })));
// （组件库审阅 06「图表与仪表盘」）：图表在 charts 子路径，整页按需加载
const ChartsShowcase = lazy(() => import("./ChartsShowcase").then((m) => ({ default: m.ChartsShowcase })));
const Markdown = lazy(() =>
  import("@adminui/react/markdown").then((m) => ({
    default: m.MarkdownEditor,
  })),
);
type User = { id: string; name: string; phone: string; status: string };
/** Demo pools: `pick` keeps modulo indexing typed under noUncheckedIndexedAccess. */
const pick = <T,>(pool: readonly [T, ...T[]], index: number): T =>
  pool[index % pool.length] ?? pool[0];
const demoNames = ["林风", "知夏", "星河", "青禾"] as const;
const initialUsers: User[] = Array.from({ length: 32 }, (_, i) => ({
  id: `U${1001 + i}`,
  name: pick(demoNames, i) + (i + 1),
  phone: `1380000${String(i).padStart(4, "0")}`,
  status: i % 6 ? "active" : "disabled",
}));
const emptyQuery: ListQuery = {
  page: 1,
  pageSize: 10,
  search: "",
  filters: { status: "all" },
  sort: { key: "id", direction: "asc" },
};
type LedgerRow = { id: string; day: string; reason: string; amount: string };
const demoReasons = ["开箱扣款", "置换入账", "充值到账", "活动赠送"] as const;
// 只追加的热表示例：服务端刻意不做实时 count，所以没有 total，只有游标。
const ledgerRows: LedgerRow[] = Array.from({ length: 47 }, (_, i) => ({
  id: `L${9000 + i}`,
  day: `2026-09-${String(1 + (i % 16)).padStart(2, "0")}`,
  reason: pick(demoReasons, i),
  amount: `${i % 4 === 0 ? "-" : "+"}${(120 + i * 7).toFixed(2)}`,
}));
const listLedger: CursorListAdapter<LedgerRow> = async (query, { signal }) => {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 120);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
  const matched = ledgerRows.filter((row) =>
    `${row.id} ${row.reason}`.includes(query.search),
  );
  const start = query.cursor ? matched.findIndex((r) => r.id === query.cursor) : 0;
  const slice = matched.slice(start, start + query.limit);
  const nextRow = matched[start + query.limit];
  // 真实服务端同理：nextCursor 是「下一页第一行」的 keyset 锚点，不是页码。
  return { rows: slice, nextCursor: nextRow?.id ?? null, hasMore: Boolean(nextRow) };
};
function App({ motion, onMotionChange, dark, onToggleMode }: { motion: "system" | "none"; onMotionChange: (value: "system" | "none") => void; dark: boolean; onToggleMode: () => void }) {
  const [active, setActive] = useState("users");
  const [open, setOpen] = useState(["users"]);
  const [closing, setClosing] = useState<string | null>(null);
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState(emptyQuery);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<User | null>(null);
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [markdown, setMarkdown] = useState(
    "# 运营公告\n\n使用 **共享组件** 编写业务页面。\n\n- 日期与范围清晰\n- 重要文字保持可读",
  );
  const [savedMarkdown, setSavedMarkdown] = useState(markdown);
  const [settingsTab, setSettingsTab] = useState("modules");
  const [switches, setSwitches] = useState({
    signup: true,
    captcha: false,
    crawler: true,
  });
  const [resultOpen, setResultOpen] = useState(false);
  // Row menu demos: status change goes through ConfirmDialog + ChangeList; a token is shown once.
  const [statusTarget, setStatusTarget] = useState<User | null>(null);
  const [token, setToken] = useState<{ user: User; value: string } | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerDraft, setLedgerDraft] = useState("");
  const [ledgerLimit, setLedgerLimit] = useState(10);
  const ledger = useCursorDataSource(listLedger, {
    limit: ledgerLimit,
    search: ledgerSearch,
    filters: {},
  });
  const notify = useNotify();
  const adapter: ListAdapter<User> = useMemo(
    () =>
      async (q, { signal }) => {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 150);
          signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });
        if (q.search === "error") throw Error("演示网络异常：请重置筛选后重试");
        const rows = users
          .filter(
            (u) =>
              `${u.id} ${u.name} ${u.phone}`.includes(q.search) &&
              (q.filters.status === "all" || u.status === q.filters.status),
          )
          .sort(
            (a, b) =>
              (q.sort?.key === "name"
                ? a.name.localeCompare(b.name)
                : a.id.localeCompare(b.id)) *
              (q.sort?.direction === "desc" ? -1 : 1),
          );
        return {
          rows: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
          total: rows.length,
        };
      },
    [users],
  );
  const result = useDataSource(adapter, query);
  const navigate = (target: string) => {
    // 「T14 记录详情」没有单独一页：C 版记录详情的演示在「组件总览」里。
    const id = target === "tpl-t14" ? "kit" : target;
    // bt/templates：T15–T17 自带外壳，各自占一整页（#template=…）。
    const link = TEMPLATE_LINKS.find((t) => t.id === target);
    if (link) {
      window.location.hash = link.hash;
      return;
    }
    setOpen((v) => (v.includes(id) ? v : [...v, id]));
    setActive(id);
  };
  const remove = (id: string) => {
    const remaining = open.filter((x) => x !== id);
    setOpen(remaining);
    if (active === id) setActive(remaining.at(-1) || "users");
    setClosing(null);
  };
  const changeQuery = (patch: Partial<ListQuery>) => {
    setQuery((q) => ({ ...q, page: 1, ...patch }));
    setSelected([]);
  };
  const resetUserFilters = () => {
    setDraft("");
    setStatus("all");
    setQuery(emptyQuery);
    setSelected([]);
  };
  const columns: Column<User>[] = [
    { key: "id", title: "用户编号", sortable: true, render: (u) => u.id },
    {
      key: "name",
      title: "昵称",
      sortable: true,
      render: (u) => <strong>{u.name}</strong>,
    },
    { key: "phone", title: "手机号", render: (u) => u.phone },
    {
      key: "status",
      title: "状态",
      render: (u) => (
        <StatusBadge tone={u.status === "active" ? "success" : "danger"}>
          {u.status === "active" ? "正常" : "停用"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      title: "操作",
      kind: "actions",
      render: (u) => (
        // 放得下几个就露几个，放不下的才进 ⋯；危险操作默认在 ⋯ 里。
        <RowActionBar
          label={`${u.name}的更多操作`}
          actions={[
            { key: "view", label: "查看详情", icon: <Eye />, onSelect: () => { setDetail(u); navigate("detail"); } },
            { key: "edit", label: "编辑资料", icon: <Pencil />, onSelect: () => openEdit(u) },
            {
              key: "token",
              label: "生成接口令牌",
              icon: <KeyRound />,
              onSelect: () => setToken({ user: u, value: `tok_${u.id}_${Math.random().toString(36).slice(2, 14)}` }),
            },
            {
              key: "status",
              label: u.status === "active" ? "停用账号" : "恢复账号",
              destructive: u.status === "active",
              onSelect: () => setStatusTarget(u),
            },
            { key: "delete", label: "删除", destructive: true, disabled: true, disabledReason: "演示数据不能删除", onSelect: () => {} },
          ]}
        />
      ),
    },
  ];
  const ledgerColumns: Column<LedgerRow>[] = [
    // 表格里的可复制值：和普通文字一样高，单行省略 + 悬停全文，小复制图标。
    { key: "id", title: "流水号", render: (row) => <CopyableValue variant="inline" value={row.id} label={`流水号 ${row.id}`} /> },
    { key: "day", title: "日期", render: (row) => row.day },
    { key: "reason", title: "原因", render: (row) => row.reason },
    {
      key: "amount",
      title: "金额（弹药）",
      align: "right",
      render: (row) => row.amount,
    },
  ];
  const openEdit = (user: User | null) => {
    setDetail(user);
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
    setEdit(true);
  };
  const pages: Record<string, WorkspaceItem> = {
    ...templateWorkspacePages(active),
    access: { id: "access", title: "角色与权限", icon: Users, content: <><InlineAlert title="浏览器演示">角色和日志保存在此浏览器，最多保留 2000 条日志；不代表生产授权或可信审计。</InlineAlert><Suspense fallback={<StatePanel kind="loading" />}><AccessPage active={active === "access"} /></Suspense></> },
    audit: { id: "audit", title: "审计日志", icon: ScrollText, content: <><InlineAlert title="浏览器演示记录">这里汇总示例页面的关键操作。刷新后保留，清除浏览器存储会删除；业务演示数据仍仅在当前会话有效。</InlineAlert><Suspense fallback={<StatePanel kind="loading" />}><AuditPage active={active === "audit"} /></Suspense></> },
    kit: { id: "kit", title: "组件总览", icon: Table2, content: <Suspense fallback={<StatePanel kind="loading" />}><KitShowcase /></Suspense> },
    foundations: { id: "foundations", title: "基础部件", icon: Table2, content: <Suspense fallback={<StatePanel kind="loading" />}><FoundationsShowcase /></Suspense> }, // bt/foundations
    dates: { id: "dates", title: "日期选择", icon: CalendarDays, content: <Suspense fallback={<StatePanel kind="loading" />}><DatePickerShowcase /></Suspense> }, // bt/datepicker
    controls: { id: "controls", title: "表单控件", icon: ListChecks, content: <Suspense fallback={<StatePanel kind="loading" />}><FormControlsShowcase /></Suspense> },
    basics: { id: "basics", title: "基础元素", icon: ListChecks, content: <Suspense fallback={<StatePanel kind="loading" />}><BasicsShowcase /></Suspense> },
    inputs: { id: "inputs", title: "输入与表单", icon: ListChecks, content: <Suspense fallback={<StatePanel kind="loading" />}><InputsShowcase /></Suspense> },
    navigation: { id: "navigation", title: "外壳与布局", icon: ListChecks, content: <Suspense fallback={<StatePanel kind="loading" />}><NavigationShowcase /></Suspense> },
    overlays: { id: "overlays", title: "反馈与弹层", icon: ListChecks, content: <Suspense fallback={<StatePanel kind="loading" />}><OverlaysShowcase active={active === "overlays"} /></Suspense> },
    business: { id: "business", title: "客户与订单", icon: Users, content: <Suspense fallback={<StatePanel kind="loading" />}><BusinessTables /></Suspense> },
    collections: { id: "collections", title: "轻量集合", icon: Table2, content: <Suspense fallback={<StatePanel kind="loading" />}><CollectionsShowcase /></Suspense> },
    media: { id: "media", title: "媒体与附件", icon: Paperclip, content: <Suspense fallback={<StatePanel kind="loading" />}><MediaShowcase /></Suspense> }, // bt/media
    records: { id: "records", title: "记录与字段", icon: FileText, content: <Suspense fallback={<StatePanel kind="loading" />}><RecordsShowcase /></Suspense> }, // bt/records
    recordcards: { id: "recordcards", title: "记录详情 · 卡片", icon: FileText, content: <Suspense fallback={<StatePanel kind="loading" />}><RecordCardsShowcase /></Suspense> },
    tableaccess: { id: "tableaccess", title: "表格权限", icon: ShieldCheck, content: <Suspense fallback={<StatePanel kind="loading" />}><TableAccessShowcase /></Suspense> }, // bt/records
    accessmodules: { id: "accessmodules", title: "权限按模块", icon: ShieldCheck, content: <Suspense fallback={<StatePanel kind="loading" />}><AccessModulesShowcase /></Suspense> }, // bt/access-modules
    share: { id: "share", title: "分享与历史", icon: Share2, content: <Suspense fallback={<StatePanel kind="loading" />}><ShareShowcase /></Suspense> }, // bt/share
    orgpicker: { id: "orgpicker", title: "组织选人", icon: Users, content: <Suspense fallback={<StatePanel kind="loading" />}><OrgPickerShowcase /></Suspense> },
    collab: { id: "collab", title: "协作与分享", icon: MessagesSquare, content: <Suspense fallback={<StatePanel kind="loading" />}><CollabShowcase /></Suspense> },
    approval: { id: "approval", title: "审批", icon: ClipboardCheck, content: <Suspense fallback={<StatePanel kind="loading" />}><ApprovalShowcase /></Suspense> },
    views: { id: "views", title: "视图", icon: Sheet, content: <Suspense fallback={<StatePanel kind="loading" />}><ViewsShowcase /></Suspense> }, // bt/views
    forms: { id: "forms", title: "表单", icon: FileText, content: <Suspense fallback={<StatePanel kind="loading" />}><FormsShowcase /></Suspense> }, // bt/builders-a
    bitable: { id: "bitable", title: "多维表格", icon: Sheet, content: <Suspense fallback={<StatePanel kind="loading" />}><BitableShowcase /></Suspense> },
    gridpro: { id: "gridpro", title: "多维表格 · 客户", icon: Sheet, content: <Suspense fallback={<StatePanel kind="loading" />}><GridCustomersShowcase /></Suspense> }, // bt/grid-b
    accessui: { id: "accessui", title: "权限组件", icon: ShieldCheck, content: <Suspense fallback={<StatePanel kind="loading" />}><AccessShowcase active={active === "accessui"} /></Suspense> },
    accessgov: { id: "accessgov", title: "权限治理", icon: ShieldCheck, content: <Suspense fallback={<StatePanel kind="loading" />}><GovernanceAccessShowcase active={active === "accessgov"} /></Suspense> },
    // bt/dashboards
    teamtoday: { id: "teamtoday", title: "团队今日示例", icon: ChartNoAxesCombined, content: <Suspense fallback={<StatePanel kind="loading" />}><TeamTodayDashboard active={active === "teamtoday"} /></Suspense> },
    dashkit: { id: "dashkit", title: "看板部件", icon: ChartNoAxesCombined, content: <Suspense fallback={<StatePanel kind="loading" />}><DashboardKitShowcase active={active === "dashkit"} /></Suspense> },
    charts06: { id: "charts06", title: "图表与仪表盘", icon: ChartNoAxesCombined, content: <Suspense fallback={<StatePanel kind="loading" />}><ChartsShowcase /></Suspense> },
    // bt/history
    history: { id: "history", title: "版本回退", icon: History, content: <Suspense fallback={<StatePanel kind="loading" />}><HistoryShowcase /></Suspense> },
    ai: { id: "ai", title: "AI 分析", icon: Sparkles, content: <Suspense fallback={<StatePanel kind="loading" />}><AiShowcase /></Suspense> },
    // bt/builders-b
    transcript: { id: "transcript", title: "录音文字稿", icon: AudioLines, content: <Suspense fallback={<StatePanel kind="loading" />}><TranscriptShowcase /></Suspense> },
    rules: { id: "rules", title: "分配规则", icon: ListOrdered, content: <Suspense fallback={<StatePanel kind="loading" />}><RulesShowcase /></Suspense> },
    flush: { id: "flush", title: "工作区贴边", icon: LayoutDashboard, content: <Suspense fallback={<StatePanel kind="loading" />}><FlushWorkspaceShowcase /></Suspense> }, // bt/flush
    pageflush: { id: "pageflush", title: "页面贴边", icon: LayoutDashboard, content: <Suspense fallback={<StatePanel kind="loading" />}><PageFlushShowcase /></Suspense> }, // 8.6 page flush
    tenant: { id: "tenant", title: "租户成员", icon: Users, content: <Suspense fallback={<StatePanel kind="loading" />}><SingleSectionShowcase /></Suspense> }, // 8.6: single-section TabbedPage
    leadcount: { id: "leadcount", title: "单块数量", icon: LayoutDashboard, content: <Suspense fallback={<StatePanel kind="loading" />}><LeadCountShowcase /></Suspense> }, // 8.6.1
    accessconsole: { id: "accessconsole", title: "权限控制台", icon: ShieldCheck, content: <Suspense fallback={<StatePanel kind="loading" />}><AccessConsoleShowcase active={active === "accessconsole"} /></Suspense> }, // 8.6.1
    dashbuilder: { id: "dashbuilder", title: "看板搭建", icon: LayoutDashboard, content: <Suspense fallback={<StatePanel kind="loading" />}><DashboardBuilderShowcase /></Suspense> },
    workflows: { id: "workflows", title: "后台工作流", icon: SlidersHorizontal, content: <Suspense fallback={<StatePanel kind="loading" />}><WorkflowShowcase active={active === "workflows"} /></Suspense> },
    motion: { id: "motion", title: "动效示例", icon: SlidersHorizontal,
      content: <Suspense fallback={<StatePanel kind="loading" />}><MotionShowcase active={active === "motion"} motion={motion} onMotionChange={onMotionChange}/></Suspense> },
    users: {
      id: "users",
      title: "用户管理",
      icon: Users,
      closable: false,
      content: (
        <>
          <PageHeader
            title="用户管理"
            description="查找用户、查看账户状态与维护基本资料。"
            actions={
              <Button onClick={() => openEdit(null)}>
                <Plus />
                新增用户
              </Button>
            }
          />
          {/* 列表页撑满一屏：卡片伸到底，空表时「暂无数据」居中，分页贴底。 */}
          <PageBody fill>
          <ResourcePanel
            title="用户列表"
            count={result.loading || result.error ? undefined : result.data?.total}
            description={`${query.search || query.filters.status !== "all" ? "当前显示符合筛选条件的用户" : "全部用户 · 按用户编号排序或搜索"}。演示数据，修改仅在当前页面会话中生效。`}
            actions={<Button variant="outline" disabled={result.loading || result.refreshing} onClick={result.refresh}><RefreshCw />{result.refreshing ? "刷新中…" : "刷新"}</Button>}
            feedback={
              result.staleError ? (
                <InlineAlert tone="error" title="刷新失败，当前数据可能已过期" action={<Button variant="outline" onClick={result.refresh}>重试</Button>}>{result.staleError}</InlineAlert>
              ) : (
                selected.length > 0 && <InlineAlert title={`已选择 ${selected.length} 项`} action={<Button variant="ghost" onClick={() => setSelected([])}>取消选择</Button>}>可通过行内操作查看用户详情。</InlineAlert>
              )
            }
            filters={
          <QueryBar
            value={draft}
            onChange={setDraft}
            onSearch={() => changeQuery({ search: draft, filters: { status } })}
            onReset={resetUserFilters}
          >
            <Choice
              label="状态筛选"
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "全部状态" },
                { value: "active", label: "正常" },
                { value: "disabled", label: "停用" },
              ]}
            />
          </QueryBar>
            }
          >
          <DataTable
            rows={result.data?.rows ?? []}
            columns={columns}
            rowKey={(u) => u.id}
            caption="用户列表"
            pagination={{
              mode: "page",
              total: result.data?.total ?? 0,
              page: query.page,
              pageSize: query.pageSize,
              onPageChange: (page) => changeQuery({ page }),
              onPageSizeChange: (pageSize) => changeQuery({ pageSize }),
            }}
            sort={query.sort}
            onSortChange={(sort) => changeQuery({ sort })}
            selected={selected}
            onSelectionChange={setSelected}
            loading={result.loading}
            error={result.error}
            onRetry={result.reload}
            emptyKind={query.search || query.filters.status !== "all" ? "no-results" : "empty"}
            emptyAction={query.search || query.filters.status !== "all" ? <Button variant="outline" onClick={resetUserFilters}>清空筛选</Button> : <Button onClick={() => openEdit(null)}>创建第一个用户</Button>}
          />
          </ResourcePanel>
          </PageBody>
        </>
      ),
    },
    detail: {
      id: "detail",
      title: "用户详情",
      icon: Users,
      content: (
        <>
          <PageHeader
            title="用户详情"
            actions={
              <Button variant="outline" onClick={() => navigate("users")}>
                返回列表
              </Button>
            }
          />
          {detail && (
            <DetailLayout
              aside={
                <>
                  <Panel title="账户状态">
                    <StatusBadge
                      tone={detail.status === "active" ? "success" : "danger"}
                    >
                      {detail.status === "active" ? "正常" : "停用"}
                    </StatusBadge>
                    <p className="aui-note" style={{ marginTop: 12 }}>
                      项目适配层负责账号权限和保存接口。
                    </p>
                  </Panel>
                  <Panel title="最近操作">
                    <p>详情表单与列表使用同一份数据。</p>
                  </Panel>
                </>
              }
            >
              <Panel
                title="基本信息"
                actions={
                  <Button variant="secondary" onClick={() => openEdit(detail)}>
                    编辑资料
                  </Button>
                }
              >
                {/* 只读事实用 DescriptionList，不要用只读输入框冒充表单。 */}
                <DescriptionList
                  items={[
                    { label: "用户编号", value: detail.id },
                    { label: "昵称", value: detail.name },
                    { label: "手机号", value: detail.phone, hint: "演示数据，真实项目按权限脱敏" },
                    { label: "邀请人", value: null },
                  ]}
                />
              </Panel>
            </DetailLayout>
          )}
        </>
      ),
    },
    assets: {
      id: "assets",
      title: "素材管理",
      icon: Image,
      content: (
        <>
          <PageHeader title="素材管理" />
          <Panel
            title="上传素材"
            description="示例适配器模拟上传，正式项目替换为自己的上传服务。"
          >
            <UploadField
              accept={["image/png", "image/jpeg", "image/webp"]}
              maxBytes={5 * 1024 * 1024}
              upload={async (file, { signal, onProgress }) => {
                for (let i = 1; i <= 5; i++) {
                  await new Promise((r) => setTimeout(r, 100));
                  if (signal.aborted)
                    throw new DOMException("Aborted", "AbortError");
                  onProgress(i * 20);
                }
                return {
                  id: crypto.randomUUID(),
                  name: file.name,
                  url: "/demo-upload",
                };
              }}
              onUploaded={(file) => { recordDemoAudit("assets:upload", file.id); notify(`${file.name} 演示上传完成`); }}
            />
          </Panel>
        </>
      ),
    },
    settings: {
      id: "settings",
      title: "系统设置",
      icon: SlidersHorizontal,
      content: (
        // 合并菜单项：一个页头 + 分区标签；打开过的分区切走不卸载，分区出错只坏那一块。
        <TabbedPage
          title="系统设置"
          actions={
            <Button variant="outline" onClick={() => setResultOpen(true)}>
              查看生成结果
            </Button>
          }
          sections={[
            { id: "modules", label: "模块开关" },
            { id: "security", label: "安全策略" },
            { id: "audit", label: "审计（演示禁用）", disabled: true },
          ]}
          value={settingsTab}
          onValueChange={setSettingsTab}
          active={active === "settings"}
          render={(id, sectionActive) =>
            id === "modules" ? (
              <Panel
                title="模块总开关"
                description="开关即时生效；真实项目由服务端做乐观并发与鉴权。"
              >
                <div className="aui-stack">
                  {(
                    [
                      ["signup", "开放注册"],
                      ["captcha", "强制人机验证"],
                      ["crawler", "反爬拦截"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="demo-setting-row">
                      <label htmlFor={`switch-${key}`}>{label}</label>
                      <Switch
                        id={`switch-${key}`}
                        checked={switches[key]}
                        onCheckedChange={(next) => {
                          recordDemoAudit("settings:update", key, [{ field: label, before: switches[key] ? "启用" : "停用", after: next ? "启用" : "停用" }]);
                          setSwitches((v) => ({ ...v, [key]: next }));
                          notify(`${label}已${next ? "启用" : "停用"}（演示）`);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </Panel>
            ) : (
              <SecuritySection active={sectionActive} />
            )
          }
        />
      ),
    },
    ledger: {
      id: "ledger",
      title: "资金账本",
      icon: ScrollText,
      content: (
        <>
          <PageHeader title="资金账本（游标分页）" description="查阅资金变动记录，按流水号或原因定位交易。" />
          <PageBody fill>
          <ResourcePanel title="资金流水" description="按游标翻页，不显示未经统计的总条数。" filters={
          <QueryBar
            value={ledgerDraft}
            onChange={setLedgerDraft}
            onSearch={() => setLedgerSearch(ledgerDraft)}
            onReset={() => {
              setLedgerDraft("");
              setLedgerSearch("");
            }}
            placeholder="按流水号或原因搜索"
          />
          }>
            <DataTable
              rows={ledger.data?.rows ?? []}
              columns={ledgerColumns}
              rowKey={(row) => row.id}
              caption="资金账本流水"
              loading={ledger.loading}
              error={ledger.error}
              onRetry={ledger.reload}
              pagination={{
                mode: "cursor",
                pageIndex: ledger.pageIndex,
                pageSize: ledgerLimit,
                onPageSizeChange: setLedgerLimit,
                canPrev: ledger.canPrev,
                canNext: ledger.canNext,
                onPrev: ledger.prev,
                onNext: ledger.next,
              }}
            />
          </ResourcePanel>
          </PageBody>
        </>
      ),
    },
    announcement: {
      id: "announcement",
      title: "公告编辑",
      icon: FileText,
      dirty: markdown !== savedMarkdown,
      content: (
        <>
          <PageHeader
            title="公告编辑"
            actions={
              <Button
                onClick={() => {
                  recordDemoAudit("保存公告", "运营公告");
                  setSavedMarkdown(markdown);
                  notify("演示公告已保存到当前会话");
                }}
              >
                保存公告
              </Button>
            }
          />
          <Panel>
            <Suspense fallback={<StatePanel kind="loading" />}>
              <Markdown value={markdown} onChange={setMarkdown} />
            </Suspense>
          </Panel>
        </>
      ),
    },
  };
  // 菜单只列出真实存在的页面；配错 id 就少一项，而不是渲染出空菜单。
  const navigation: NavItem[] = [
    // 不写 group 的项平铺在最上；同一 group 按首次出现顺序聚在一起。
    { id: "kit", keywords: "组件 色卡 记录详情 字段方块 分组卡片" },
    { id: "teamtoday", group: "看板", keywords: "团队今日 子弹图 目标 筛选 对比 变化值 D29" }, // bt/dashboards
    { id: "dashkit", group: "看板", keywords: "子弹图 漏斗 cohort 目标柱 汇总卡 进度环 占位 D30 D31" }, // bt/dashboards
    { id: "charts06", group: "看板", keywords: "图表 色板 柱 条形 环 堆叠 实际 vs 目标 折线 状态 数字卡 变化值 仪表盘标签 筛选行 报表 审阅 06" },
    { id: "users", group: "用户与内容", keywords: "会员 账号 停用" },
    { id: "announcement", group: "用户与内容" },
    { id: "ledger", group: "资金", keywords: "流水 账单" },
    { id: "assets", group: "素材" },
    { id: "settings", group: "系统", keywords: "开关 安全 验证" },
    { id: "motion", group: "系统" },
    { id: "workflows", group: "系统" },
    { id: "foundations", group: "系统", keywords: "菜单 右键 弹出面板 拖动排序 选项颜色 评分 倒计时 密码 水印 侧边弹层 底部弹层" }, // bt/foundations
    { id: "dates", group: "系统", keywords: "日期 时间 日历 日期范围 到期 补班 节假日 DatePicker" }, // bt/datepicker
    { id: "controls", group: "系统", keywords: "表单控件 下拉 选择 多选 单选 标签 颜色 10 色 勾选框 单选圆点 开关 分段 Choice MultiChoice ChoiceTags RadioGroup" },
    { id: "basics", group: "系统", keywords: "基础元素 按钮 标签 状态 角标 头像 提示气泡 说明 快捷键 复制 分隔线 骨架 加载 进度 字号 链接 图标" },
    { id: "inputs", group: "系统", keywords: "输入与表单 文本框 搜索 数字 金额 电话 百分比 滑块 评分 密码 上传 校验 保存条 字段类型 条件" },
    { id: "navigation", group: "系统", keywords: "导航与布局 外壳 侧栏 切换公司 账号菜单 头像 工作标签 胶囊 面包屑 外观 页内标签 更多 表设置 设置侧导航 保存条 列表详情 两步 步骤 加载更多 登录 公开页" },
    { id: "overlays", group: "系统", keywords: "反馈与弹层 弹框 确认 侧边弹层 底部弹层 操作单 菜单 弹出面板 提示条 撤销 空状态 出错 没权限 404 通知中心 待我处理 命令面板 编辑冲突" },
    { id: "business", group: "系统", keywords: "行高 展开记录 标签 负责人 分组 批量" },
    { id: "collections", group: "系统", keywords: "紧凑表格 时间线 动态 状态清单 自检 排行" },
    { id: "media", group: "系统", keywords: "附件 图片 视频 音频 录音 上传 预览 灯箱 按住说话" }, // bt/media
    { id: "records", group: "系统", keywords: "新建字段 字段类型 选项 授权 谁能看 记录详情 子表 评论 提到 打码 留痕 D11 D12" }, // bt/records
    { id: "recordcards", group: "系统", keywords: "记录详情 卡片分区 编辑布局 阶段 关键数 单栏 左右分栏 关注 阶段选项 赢率" },
    { id: "tableaccess", group: "系统", keywords: "表格权限 就地权限 角色 记录范围 按条件 字段权限 打码 导出 影响 D13" }, // bt/records
    { id: "accessmodules", group: "系统", keywords: "权限按模块 档位 只看 成员 管理员 能看到的数据 细调 高危 待确认 自定义 集团只读 保存前影响 预览 诊断 A1 A2 A3 A4 A5 A6" }, // bt/access-modules
    { id: "share", group: "系统", keywords: "分享 链接 二维码 密码 阅后即焚 访客 水印 访问记录 修改历史 版本 恢复" }, // bt/share
    { id: "orgpicker", group: "系统", keywords: "组织选人 选人 选部门 部门树 组织架构 集团 公司 角色 业务线 含下级 已离职 OrgPicker OrgPickerField 授权 分享给" },
    { id: "collab", group: "系统", keywords: "协作 评论 提到 回应 赞 收到 看过 有疑问 已解决 回复 划词 知识库 改前改后 ChangeValue" },
    { id: "approval", group: "系统", keywords: "审批 申请 待我审批 我的申请 批准 驳回 撤回 审批进度 折扣 请假 权限申请" },
    { id: "views", group: "系统", keywords: "视图 标签 视图管理 看板 画册 日历 甘特 卡片 拖动 节假日 D06 D07 D09 D10 D16" }, // bt/views
    { id: "forms", group: "系统", keywords: "表单 收集表 填写 提交次数 预填链接 二维码 显示条件 公开页 提交成功 D08 D18" }, // bt/builders-a
    { id: "bitable", group: "系统", keywords: "多维表格 bitable 分组 统计 筛选 冻结列 虚拟滚动" },
    { id: "gridpro", group: "系统", keywords: "多维表格 右键菜单 表头菜单 冻结线 填充柄 新增一行 拖动排序 评分 电话 附件 录音 关联 公式 D01 D02 D03" }, // bt/grid-b
    { id: "access", group: "系统" },
    { id: "accessui", group: "系统", keywords: "权限矩阵 数据范围 勾选树 部门 人员 有效权限 解释 协作成员 申请 复核 审计差异" },
    { id: "accessgov", group: "系统", keywords: "租户 套餐 配额 共享规则 收窄规则 职责分离 审批流程 紧急提权 复核 安全体检 大档" },
    { id: "audit", group: "系统" },
    // bt/history
    { id: "history", group: "系统", keywords: "操作记录 撤回整批 表时光机 回滚 冲突 版本" },
    { id: "ai", group: "系统", keywords: "AI 建议更新 采用 出处 话术 提示词 版本 试跑 对比" },
    // bt/builders-b
    { id: "transcript", group: "系统", keywords: "录音 文字稿 转写 说话人 波形 标注 打码 跟着播放 导出 D27t" },
    { id: "rules", group: "系统", keywords: "分配规则 如果 那么 第一条命中 兜底 拖动排序 命中数 条件 D26" },
    { id: "flush", group: "系统", keywords: "工作区 贴边 飞书 Pane 撑满 内边距 提示条 QueryBar flush TabbedPage 画册 表单搭建 表格权限 有效权限 记录头部 useIsMobile" }, // bt/flush
    { id: "pageflush", group: "系统", keywords: "页面贴边 卡片 灰底 画布 一条线 不重复标题 部门 成员 审计 审批 列表详情 8.6" },
    { id: "tenant", group: "系统", keywords: "单分区 TabbedPage 不出标签条 租户成员 8.6" },
    { id: "leadcount", group: "系统", keywords: "单块 数量 共 N 条 工具行 空行 8.6.1" },
    { id: "accessconsole", group: "系统", keywords: "AccessConsole 权限控制台 部门 岗位 角色 人员授权 用户组 字段权限 权限解释 授权审计 中档 8.6.1" },
    { id: "dashbuilder", group: "看板", keywords: "看板搭建 拖动 组件库 画布 指标字典 标准口径 自定义口径 撤销 预览 D32" },
    // 页面模板（PAGE-TEMPLATES.md）：每个后台页面都从其中一个起步，布局定死、内容换成自己的。
    ...TEMPLATE_PAGES.map((t) => ({ id: t.id, group: "页面模板", keywords: t.keywords })),
  ].flatMap(({ id, group, keywords }) => {
    const page = pages[id];
    // 菜单数量（灰胶囊）/ 要处理的（异常色实心）
    const badge = id === "assets" ? { badge: 1284 } : id === "ledger" ? { badge: 3, badgeTone: "danger" as const } : {};
    return page ? [{ id, title: page.title, icon: page.icon, group, keywords, ...badge }] : [];
  }).concat([{ id: "tpl-t14", title: "T14 记录详情", icon: Table2, group: "页面模板", keywords: "模板 记录详情 详情弹框 整页 C 版" }])
    .concat(TEMPLATE_LINKS.map((t) => ({ id: t.id, title: t.title, icon: t.icon, group: "页面模板", keywords: t.keywords }))); // bt/templates
  return (
    <>
      <AdminShell
        logo="A"
        brand={<>Acme <small>工作台</small></>}
        company={{
          value: "tw",
          options: [
            { id: "tw", name: "华南子公司（演示）" },
            { id: "hq", name: "集团总部（演示）" },
          ],
          onSwitch: (id) => notify(`切换到${id === "hq" ? "集团总部" : "华南子公司"}（演示）`, "info"),
          footer: { id: "company-settings", label: "公司设置", icon: Settings, hint: "管理后台", onSelect: () => notify("打开公司设置（演示）", "info") },
        }}
        account={{ name: "陈组长", detail: "lead01 · 华南子公司（演示）", role: "共享组件 · 项目独立适配" }}
        accountMenu={[
          { id: "profile", label: "我的资料", icon: UserRound, onSelect: () => notify("打开我的资料（演示）", "info") },
          { id: "tokens", label: "API 令牌", icon: KeyRound, onSelect: () => notify("打开 API 令牌（演示）", "info") },
          { id: "admin", label: "管理后台", icon: LayoutGrid, href: "#admin", external: true },
        ]}
        onSignOut={() => notify("已退出（演示）", "info")}
        onCloseTabs={(ids) => {
          const keep = ids.filter((id) => pages[id]?.dirty);
          const remaining = open.filter((x) => !ids.includes(x) || keep.includes(x));
          setOpen(remaining);
          if (!remaining.includes(active)) setActive(remaining.at(-1) || "users");
          if (keep[0]) setClosing(keep[0]);
        }}
        navigation={navigation}
        tabs={open.flatMap((id) => {
          const page = pages[id];
          return page ? [page] : [];
        })}
        activeId={active}
        onNavigate={navigate}
        onCloseTab={(id) => (pages[id]?.dirty ? setClosing(id) : remove(id))}
        headerActions={
          <>
            <StatusBadge tone="brand">SDK 接入示例</StatusBadge>
            {/* 右上角搜索：菜单直接变命令；后台工作流页、反馈与弹层页有自己的命令面板，在那两页把快捷键让给它们。 */}
            <CommandPalette
              enabled={active !== "workflows" && active !== "overlays"}
              commands={navCommands(navigation, navigate, [
                { id: "toggle-mode", label: "切换明暗模式", keywords: "深色 浅色 主题", run: onToggleMode },
              ])}
            />
            <IconButton label={dark ? "切换到浅色模式" : "切换到深色模式"} onClick={onToggleMode} icon={dark ? <Sun /> : <Moon />} />
            <AppearanceButton />
          </>
        }
        documentTitle={(title) => `${title} · Acme 工作台`}
        // Ctrl / ⌘ K also on a freshly opened page (focus still on <body>): the topbar palette listens on the window.
        globalShortcut
      />
      {/* 非表单弹层：只有复制/关闭，没有「保存」。 */}
      <Dialog
        open={resultOpen}
        title="生成结果"
        description="演示数据；真实项目的一次性凭证只显示一次。"
        size="lg"
        onClose={() => setResultOpen(false)}
        footer={
          <Button
            onClick={async () => {
              try {
                if (!navigator.clipboard) throw Error("当前浏览器不支持剪贴板");
                await navigator.clipboard.writeText("DEMO-0001\nDEMO-0002");
                recordDemoAudit("credentials:copy", "demo-result");
                notify("已复制到剪贴板");
              } catch (error) {
                recordDemoAudit("credentials:copy", "demo-result", undefined, "failed");
                notify(error instanceof Error ? error.message : "复制失败", "error");
              }
            }}
          >
            复制全部
          </Button>
        }
      >
        <pre className="demo-result">DEMO-0001{"\n"}DEMO-0002</pre>
      </Dialog>
      <FormDialog
        open={edit}
        title={detail ? "编辑用户资料" : "新增用户"}
        description="此示例只修改当前浏览器会话中的虚构用户。"
        dirty={name !== (detail?.name ?? "") || phone !== (detail?.phone ?? "")}
        onClose={() => setEdit(false)}
        onSubmit={async () => {
          if (!name.trim()) throw Error("请填写昵称");
          if (!/^1\d{10}$/.test(phone)) throw Error("请填写 11 位手机号");
          await new Promise((r) => setTimeout(r, 350));
          const user = {
            id: detail?.id ?? `U${Date.now()}`,
            name: name.trim(),
            phone,
            status: detail?.status ?? "active",
          };
          recordDemoAudit(detail ? "编辑用户" : "新增用户", user.id, [{ field: "昵称", before: detail?.name ?? "无", after: user.name }, { field: "手机号", before: detail ? "已隐藏" : "无", after: "已隐藏" }]);
          setUsers((v) =>
            detail ? v.map((u) => (u.id === user.id ? user : u)) : [...v, user],
          );
          setDetail(user);
          notify("用户资料已保存");
        }}
      >
        <FormSection title="基本信息">
          <FormField label="昵称" required htmlFor="edit-name">
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </FormField>
          <FormField label="手机号" required htmlFor="edit-phone">
            <Input
              id="edit-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
            />
          </FormField>
        </FormSection>
        <p className="aui-note">
          规则由项目适配层提供；SDK 统一表单外观和交互。
        </p>
      </FormDialog>
      <ConfirmDialog
        open={closing !== null}
        title="关闭未保存页面？"
        impact="公告内容尚未保存，关闭后本次修改会丢失。"
        confirmLabel="放弃并关闭"
        destructive
        onClose={() => setClosing(null)}
        onConfirm={() => {
          setMarkdown(savedMarkdown);
          if (closing) remove(closing);
        }}
      />
      <ConfirmDialog
        open={statusTarget !== null}
        title={statusTarget?.status === "active" ? "停用账号" : "恢复账号"}
        impact={
          statusTarget &&
          (statusTarget.status === "active"
            ? `将停用 ${statusTarget.name}（${statusTarget.id}），对方会立刻被登出，直到恢复前不能登录。`
            : `将恢复 ${statusTarget.name}（${statusTarget.id}），对方可以重新登录。`)
        }
        destructive={statusTarget?.status === "active"}
        confirmLabel={statusTarget?.status === "active" ? "停用" : "恢复"}
        reason={{ label: "原因", required: true, placeholder: "写进审计日志，例如：用户申诉已核实" }}
        onClose={() => setStatusTarget(null)}
        onConfirm={async (reason) => {
          if (!statusTarget) return;
          await new Promise((r) => setTimeout(r, 300));
          if (reason === "模拟失败") throw Error("演示：服务端拒绝了这次操作，请重试");
          const next = statusTarget.status === "active" ? "disabled" : "active";
          const label = (value: string) => (value === "active" ? "正常" : "停用");
          recordDemoAudit("修改账号状态", statusTarget.id, [{ field: "状态", before: label(statusTarget.status), after: label(next) }, { field: "原因", before: "", after: reason }]);
          setUsers((v) => v.map((u) => (u.id === statusTarget.id ? { ...u, status: next } : u)));
          notify(next === "active" ? "账号已恢复" : "账号已停用");
        }}
      >
        {statusTarget && (
          <ChangeList
            items={changedFields(
              statusTarget,
              { ...statusTarget, status: statusTarget.status === "active" ? "disabled" : "active" },
              [{ key: "status", label: "账号状态", effect: "立即", format: (v) => (v === "active" ? "正常" : "停用") }],
            )}
          />
        )}
      </ConfirmDialog>
      <OneTimeSecretDialog
        open={token !== null}
        title="接口令牌已生成"
        description={token ? `${token.user.name}（${token.user.id}）的新令牌。旧令牌已失效。` : undefined}
        secret={token?.value ?? ""}
        usage={<>请求时放在请求头：<code>Authorization: Bearer &lt;令牌&gt;</code></>}
        onClose={() => setToken(null)}
      />
    </>
  );
}
/** 本来是独立页面；放进 TabbedPage 后它的 PageHeader 自动变成「说明 + 操作」一行。 */
function SecuritySection({ active }: { active: boolean }) {
  const [level, setLevel] = useState<"loose" | "standard" | "strict" | "custom">("standard");
  const [factors, setFactors] = useState<string[]>(["sms"]);
  const [until, setUntil] = useState("");
  const [crash, setCrash] = useState(false);
  return (
    <>
      <PageHeader
        title="安全策略"
        description="登录防护、短信配额等由项目服务端提供，SDK 只提供交互外观。"
        actions={
          <Button variant="outline" onClick={() => setCrash(true)}>
            模拟渲染出错
          </Button>
        }
      />
      <Panel title="登录防护">
        <div className="aui-stack">
          {/* 实时状态（不是介绍），所以写在正文里 */}
          <p className="aui-note">{active ? "本分区可见：实时数据按 3 秒刷新。" : "本分区隐藏：已暂停刷新。"}</p>
          <div className="demo-setting-row">
            <span>验证强度</span>
            <SegmentedControl
              label="验证强度"
              value={level}
              onValueChange={setLevel}
              options={[
                { value: "loose", label: "宽松" },
                { value: "standard", label: "标准" },
                { value: "strict", label: "严格" },
                { value: "custom", label: "自定义", disabled: true },
              ]}
            />
          </div>
          <div className="demo-setting-row">
            <span>二次验证方式</span>
            <ChipGroup
              label="二次验证方式"
              value={factors}
              onValueChange={setFactors}
              options={[
                { value: "sms", label: "短信", count: 1280 },
                { value: "email", label: "邮箱", count: 312 },
                { value: "totp", label: "动态口令" },
                { value: "key", label: "硬件密钥", disabled: true },
              ]}
            />
          </div>
          <FormField label="临时放行截止" htmlFor="bypass-until" hint="留空 = 永久放行">
            <DateTimePicker id="bypass-until" clearable value={until} onChange={setUntil} />
          </FormField>
          <QuickDatePresets label="快捷截止时间" permanent onPick={setUntil} />
        </div>
      </Panel>
      {crash && <CrashOnRender />}
    </>
  );
}
function CrashOnRender(): React.ReactNode {
  throw Error("演示：分区渲染异常");
}
// bt/share：公开分享页在后台外壳外面（#share-public=visitor | password | secret，加 &dark 看深色）。
const publicPage = (): { kind: PublicKind; dark: boolean } | null => {
  const m = /^#share-public=(visitor|password|secret)(&dark)?$/.exec(window.location.hash);
  return m ? { kind: m[1] as PublicKind, dark: Boolean(m[2]) } : null;
};
// bt/builders-a：公开填写页（#form-public=fill，加 &dark 看深色）也在后台外壳外面。
const formPublicPage = (): { dark: boolean } | null => {
  const m = /^#form-public=fill(&dark)?$/.exec(window.location.hash);
  return m ? { dark: Boolean(m[1]) } : null;
};
// SDK 的默认值是中性的（时区跟浏览器、不带币种、电话区号按浏览器语言地区），项目在这里写自己的。
const STARTER_DEFAULTS = { timeZone: "Asia/Shanghai", currency: "CNY", phoneCountry: "+86" };
function Root() {
  const [motion, setMotion] = useState<"system" | "none">("system");
  const [formPage, setFormPage] = useState(formPublicPage); // bt/builders-a
  const [dark, setDark] = useState(false);
  const [shared, setShared] = useState(publicPage); // bt/share
  const [template, setTemplate] = useState(templatePage); // bt/templates
  React.useEffect(() => {
    const onHash = () => { setShared(publicPage()); setTemplate(templatePage()); setFormPage(formPublicPage()); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  if (template) return <TemplateStandalone key={template.kind} kind={template.kind} dark={template.dark} />; // bt/templates
  if (formPage) return <AdminProvider storageKey="adminui-starter-precision-theme" defaults={STARTER_DEFAULTS} mode={formPage.dark ? "dark" : "light"}><Suspense fallback={null}><FormPublicDemo /></Suspense></AdminProvider>; // bt/builders-a
  if (shared) return <AdminProvider storageKey="adminui-starter-precision-theme" defaults={STARTER_DEFAULTS} mode={shared.dark ? "dark" : "light"}><Suspense fallback={null}><SharePublicDemo key={shared.kind} kind={shared.kind} /></Suspense></AdminProvider>;
  return <AdminProvider storageKey="adminui-starter-precision-theme" defaults={STARTER_DEFAULTS} motion={motion} mode={dark ? "dark" : "light"}>
      <NotificationProvider>
        <App motion={motion} onMotionChange={setMotion} dark={dark} onToggleMode={() => setDark(v => !v)}/>
      </NotificationProvider>
    </AdminProvider>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><Root/></React.StrictMode>);
