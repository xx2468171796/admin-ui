// bt/templates：T15 表格工作区（样稿 D01）——左 56px 平台图标栏 + 目录树（数据表 / 文件夹 / 数量 / 搜索 / 新建）+
// 标题栏（表名 · ? · ☆ · 业务线胶囊 · 正在看的人 · 评论 / 自动化 / 权限 · 分享 · ⋯）+ 视图标签 + 工具栏 + 视图区。
// 整页不滚，只有视图区滚。地址 #template=t15（加 &dark 看深色）。数据都在内存里；真实项目里视图、权限由服务端保存和校验。
import { useMemo, useState } from "react";
import { Bot, ClipboardList, FileSpreadsheet, FileText, LayoutDashboard, ListTree, MessageSquare, Plus, Share2, ShieldCheck, Table2, Upload, Zap } from "lucide-react";
import { Button, InlineAlert, NavTree, RailShell, ScopePill, SplitButton, WorkspaceTitleBar, useNotify, type NavTreeNode, IconButton } from "@adminui/react";
import { BitableGrid, ViewOverrideBar, normalizeGridView, useGridView } from "@adminui/react/grid";
import { GalleryView, KanbanBoard, ViewTabs, type ViewKind, type ViewSummary } from "@adminui/react/views";
import { FIELDS, STAGE_FIELD, fieldsByKey, initialCustomers, type Customer } from "./views-demo";
import { RAIL_FOOTER, RAIL_MODULES, accountOf, backToStarter } from "./template-rail";

const TREE: NavTreeNode[] = [
  { id: "sales", label: "销售", children: [
    { id: "customers", label: "客户", icon: Table2, count: 1284 },
    { id: "follow", label: "跟进记录", icon: ListTree, count: 9610 },
    { id: "deals", label: "商机", icon: Table2, count: 412 },
  ] },
  { id: "delivery", label: "交付", children: [
    { id: "install", label: "安装工单", icon: Table2, count: 356 },
    { id: "visit", label: "售后回访", icon: Table2, count: 201 },
  ] },
  { id: "docs", label: "资料", defaultOpen: false, children: [
    { id: "manual", label: "安装手册", icon: FileText },
    { id: "price", label: "价目表", icon: FileSpreadsheet },
    { id: "faq", label: "常见问题", icon: FileText },
  ] },
  { id: "board", label: "销售看板", icon: LayoutDashboard },
  { id: "auto", label: "自动化", icon: Zap, count: "6 条" },
  { id: "webform", label: "官网咨询表单", icon: ClipboardList },
];
const VIEWS: ViewSummary[] = [
  { id: "all", name: "全部客户", kind: "grid", tier: "standard", mustSee: true },
  { id: "mine", name: "我的客户", kind: "grid", tier: "mine" },
  { id: "board", name: "阶段看板", kind: "kanban", tier: "standard" },
  { id: "cal", name: "跟进日历", kind: "calendar", tier: "standard" },
  { id: "plan", name: "安装排期", kind: "gantt", tier: "standard" },
  { id: "photo", name: "现场照片", kind: "gallery", tier: "shared" },
  { id: "form", name: "官网咨询表单", kind: "form", tier: "shared" },
];
const LINES = [
  { value: "home", label: "智能家居", hint: "华南子公司" },
  { value: "solar", label: "太阳能", hint: "华南子公司" },
  { value: "ev", label: "充电桩", hint: "华东子公司" },
];
const VIEWERS = [{ name: "小王", hint: "在编辑" }, { name: "阿杰" }, { name: "美华" }, { name: "郑主管" }, { name: "小李" }];
const SHARED_VIEW = { groupBy: "stage", rowHeight: "short" } as const;

export function TemplateWorkspace() {
  const notify = useNotify();
  const [module, setModule] = useState("table");
  const [table, setTable] = useState("customers");
  const [line, setLine] = useState("home");
  const [star, setStar] = useState(true);
  const [views, setViews] = useState(VIEWS);
  const [active, setActive] = useState("all");
  const [rows, setRows] = useState<Customer[]>(initialCustomers);
  const base = useMemo(() => normalizeGridView(SHARED_VIEW, FIELDS), []);
  const { view, onViewChange } = useGridView(FIELDS, { storageKey: "starter:tpl-t15:view", defaults: { ...SHARED_VIEW, filters: [{ id: "f1", field: "region", op: "is", value: "上海" }] } });
  const current = views.find((v) => v.id === active) ?? views[0];
  const say = (text: string) => () => notify(`演示：${text}`, "info");
  const leaveModule = (id: string) => {
    setModule(id);
    if (id !== "table") notify("演示：切到别的模块（真实项目里换成那个模块的页面）", "info");
  };
  const create = (kind: ViewKind) => {
    const id = `v${views.length + 1}`;
    setViews((list) => [...list, { id, name: `新${kind === "grid" ? "表格" : "视图"} ${list.length + 1}`, kind, tier: "mine" }]);
    setActive(id);
  };
  const body = (() => {
    if (!current || current.kind === "grid")
      return (
        <BitableGrid
          caption="客户"
          rows={rows}
          getRowId={(r) => r.id}
          fields={FIELDS}
          view={view}
          onViewChange={onViewChange}
          frozenColumns={1}
          expandRecord
          onCellsChange={(changes) => setRows((list) => list.map((r) => changes.filter((c) => c.rowId === r.id).reduce((acc, c) => ({ ...acc, [c.field]: c.value }), r)))}
          toolbarLeading={<SplitButton label="添加记录" icon={<Plus />} onClick={say("新增一行客户")} sections={[{ items: [
            { key: "form", label: "用表单添加", icon: <ClipboardList aria-hidden="true" />, onSelect: say("打开表单添加") },
            { key: "import", label: "导入 Excel", icon: <Upload aria-hidden="true" />, onSelect: say("导入 Excel") },
          ] }]} />}
          banner={<ViewOverrideBar base={base} view={view} fields={FIELDS} onReset={() => onViewChange(base)} onSaveForAll={say("保存给所有人")} />}
          panelNote="只改你的个人设置，自动保存"
        />
      );
    if (current.kind === "kanban")
      return (
        <KanbanBoard
          records={rows}
          recordId={(r) => r.id}
          groupField={STAGE_FIELD}
          cardTitle={(r) => r.name}
          cardFields={fieldsByKey(["owner", "amount", "next"])}
          cardAttachments={(r) => r.files}
          label={current.name}
          onMove={(id, to) => setRows((list) => list.map((r) => (r.id === id ? { ...r, stage: to } : r)))}
          onOpen={(r) => notify(`打开「${r.name}」`, "info")}
        />
      );
    if (current.kind === "gallery")
      return <GalleryView records={rows} recordId={(r) => r.id} cardTitle={(r) => r.name} cardFields={fieldsByKey(["stage", "owner", "region"])} cardAttachments={(r) => r.files} label={current.name} onOpen={(r) => notify(`打开「${r.name}」`, "info")} />;
    return (
      <div style={{ padding: 16 }}>
        <InlineAlert tone="info" title={`「${current.name}」在这个示例里没有接数据`}>日历、甘特、表单视图的完整示例在后台外壳「系统 → 视图」里；放进 T15 时照样作为视图区（工作区的最后一块）。</InlineAlert>
      </div>
    );
  })();
  return (
    <RailShell
      brand="A"
      brandLabel="Acme · 回到首页"
      onBrandClick={backToStarter}
      modules={RAIL_MODULES}
      activeModule={module}
      onModuleChange={leaveModule}
      footer={RAIL_FOOTER}
      account={accountOf("小王", "华南子公司", (what) => notify(`演示：${what}`, "info"))}
      sidebarLabel="数据表目录"
      sidebar={
        <NavTree
          title="智能家居业务"
          subtitle="华南子公司"
          icon={<Table2 />}
          menu={[{ items: [{ key: "rename", label: "重命名", onSelect: say("重命名") }, { key: "members", label: "成员与权限", icon: <ShieldCheck aria-hidden="true" />, onSelect: say("成员与权限") }] }]}
          nodes={TREE}
          activeId={table}
          onSelect={(id) => (id === "customers" ? setTable(id) : (setTable(id), notify("演示：这一张表没接数据，内容还是「客户」", "info")))}
          search="搜索数据表、仪表盘"
          label="数据表目录"
          createMenu={[{ items: [
            { key: "table", label: "数据表", icon: <Table2 aria-hidden="true" />, onSelect: say("新建数据表") },
            { key: "dash", label: "仪表盘", icon: <LayoutDashboard aria-hidden="true" />, onSelect: say("新建仪表盘") },
            { key: "form", label: "表单", icon: <ClipboardList aria-hidden="true" />, onSelect: say("新建表单") },
            { key: "auto", label: "自动化", icon: <Bot aria-hidden="true" />, onSelect: say("新建自动化") },
          ] }]}
        />
      }
    >
      <WorkspaceTitleBar
        title="客户"
        description="智能家居业务线的全部客户；跟进记录在每个客户的详情里"
        favorite={star}
        onFavoriteChange={setStar}
        scope={<ScopePill value={line} options={LINES} onChange={(v) => { setLine(v); notify(`演示：切到「${LINES.find((l) => l.value === v)?.label}」业务线`, "info"); }} />}
        presence={VIEWERS}
        tools={<>
          <IconButton label="评论" onClick={say("打开评论")} icon={<MessageSquare />} />
          <IconButton label="自动化" onClick={say("打开自动化")} icon={<Zap />} />
          <IconButton label="权限" onClick={say("打开表格权限")} icon={<ShieldCheck />} />
        </>}
        actions={<Button size="sm" onClick={say("打开分享")}><Share2 />分享</Button>}
        more={[{ items: [
          { key: "import", label: "导入", icon: <Upload aria-hidden="true" />, onSelect: say("导入") },
          { key: "export", label: "导出 Excel", icon: <FileSpreadsheet aria-hidden="true" />, onSelect: say("导出") },
          { key: "history", label: "历史版本", onSelect: say("历史版本") },
        ] }]}
      />
      <ViewTabs views={views} activeId={active} onSelect={setActive} onCreate={create} tabMenu={(v) => [{ items: [{ key: "rename", label: "重命名", onSelect: say(`重命名「${v.name}」`) }, { key: "share", label: "分享视图", icon: <Share2 aria-hidden="true" />, onSelect: say(`分享「${v.name}」`) }] }]} />
      {body}
    </RailShell>
  );
}
