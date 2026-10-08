import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Download, Pencil, Plus, Share2 } from "lucide-react";
import {
  Breadcrumbs,
  Button,
  DataTable,
  DescriptionList,
  FactStrip,
  InlineAlert,
  PageBody,
  Pane,
  PaneSection,
  Panel,
  QueryBar,
  RecordHeader,
  ResourcePanel,
  SearchField,
  SelectList,
  StatusBadge,
  TabbedPage,
  Tabs,
  WorkspaceLayout,
  useIsMobile,
  useNotify,
  type Column,
} from "@adminui/react";
import { GridToolbar, filterGridRows, normalizeGridView, type GridView } from "@adminui/react/grid";
import { GalleryView } from "@adminui/react/views";
import { FormBuilder } from "@adminui/react/form-builder";
import { AccessProfileHeader, EffectiveAccessTable, TableAccessPanel, accessProfileStats, type CondDraft, type TableAccessValue } from "@adminui/react/access";
import { CARD_SLOTS, FIELDS, fieldsByKey, initialCustomers, STAGES, TODAY, type Customer } from "./views-demo";
import { FORM_DEFINITION, FORM_FIELDS, FORM_SETTINGS, FORM_URL } from "./forms-demo";
import { ACTIONS, COND_FIELDS, FIELDS as ACCESS_FIELDS, ICONS, IMPACT, ROLES, SAVED } from "./TableAccessShowcase";
import { NOW, ROWS } from "./PersonAccessDemo";

// 工作区贴边示例（bt/flush）：TabbedPage 里几个分区是整屏工作区（WorkspaceLayout + Pane），最后一个是普通卡片流。
// 演示 Pane 的 padding / fill / notice、QueryBar variant、ResourcePanel 当一栏自己滚、GridToolbar 去掉行高、
// 画册 / 表单搭建器 / 表格权限 / 有效权限 / 记录头部放进 Pane 自动贴边；「页签」= Pane fill 里放 Tabs（面板里的画册 / 表格照样贴边、
// 撑满），Pane 的 ref 和右键事件直接写在 Pane 上；「文档」= 文档阅读页：窄屏 narrow="flush"（不做成卡片、栏之间一条横线），
// 正文用 aui-neutral-text 换成纯中性灰，栏头是面包屑。数据都是演示的。
const SECTIONS = [
  { id: "table", label: "客户表" },
  { id: "views", label: "画册" },
  { id: "form", label: "表单" },
  { id: "access", label: "表格权限" },
  { id: "person", label: "有效权限" },
  { id: "record", label: "记录" },
  { id: "tabs", label: "页签" },
  { id: "doc", label: "文档" },
  { id: "cards", label: "卡片流" },
];
const stageLabel = (value: string | null) => STAGES.find((s) => s.value === value)?.label ?? "未设置";
const columns: Column<Customer>[] = [
  { key: "name", title: "客户", render: (c) => <strong>{c.name}</strong> },
  { key: "stage", title: "阶段", render: (c) => stageLabel(c.stage) },
  { key: "owner", title: "负责人", render: (c) => c.owner },
  { key: "region", title: "地区", render: (c) => c.region },
  { key: "amount", title: "预计金额", align: "right", render: (c) => c.amount.toLocaleString("zh-CN") },
];
const ALL = initialCustomers();
// 右栏的「最近跟进」：行数比一屏多，ResourcePanel 当一栏时在栏里自己滚，整页不滚。
const RECENT = Array.from({ length: 40 }, (_, i) => ({ ...ALL[i % ALL.length]!, id: `r${i}`, name: `第 ${i + 1} 次 · ${ALL[i % ALL.length]!.name.slice(0, 3)}` }));
const recentColumns: Column<Customer>[] = [
  { key: "name", title: "跟进", render: (c) => c.name },
  { key: "owner", title: "谁", render: (c) => c.owner },
];

function TableSection() {
  const notify = useNotify();
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const regions = [...new Set(ALL.map((c) => c.region))];
  const rows = ALL.filter((c) => (!region || c.region === region) && (!query || c.name.includes(query)));
  return (
    <WorkspaceLayout
      left={
        <Pane label="地区" header={<SearchField size="sm" value={q} onChange={setQ} placeholder="搜地区" label="搜地区" />}>
          <SelectList label="地区" items={[{ key: "all", title: "全部地区", meta: `${ALL.length}` }, ...regions.filter((r) => r.includes(q)).map((r) => ({ key: r, title: r, meta: `${ALL.filter((c) => c.region === r).length}` }))]} selected={region ?? "all"} onSelect={(k) => { setRegion(k === "all" ? null : k); setPage(1); }} />
        </Pane>
      }
      right={
        <ResourcePanel title="最近跟进" count={RECENT.length} unit="条">
          <DataTable caption="最近跟进" rows={RECENT} rowKey={(r) => r.id} columns={recentColumns} pagination={{ mode: "all" }} />
        </ResourcePanel>
      }
      rightWidth={320}
    >
      <Pane fill title="客户" count={rows.length} actions={<Button size="sm" onClick={() => notify("新建客户", "info")}><Plus />新建</Button>}
        notice={<InlineAlert title="演示数据">筛选和分页都在浏览器里算；真实项目由服务端分页。</InlineAlert>}>
        <QueryBar variant="flush" value={draft} onChange={setDraft} onSearch={() => { setQuery(draft.trim()); setPage(1); }} onReset={() => { setDraft(""); setQuery(""); setPage(1); }} placeholder="搜客户名称" />
        <DataTable caption="客户" rows={rows.slice((page - 1) * size, page * size)} rowKey={(r) => r.id} columns={columns}
          pagination={{ mode: "page", page, pageSize: size, total: rows.length, onPageChange: setPage, onPageSizeChange: (n) => { setSize(n); setPage(1); } }} />
      </Pane>
    </WorkspaceLayout>
  );
}

function ViewsSection() {
  const notify = useNotify();
  const [view, setView] = useState<GridView>(() => normalizeGridView({}, FIELDS));
  const records = useMemo(() => filterGridRows(ALL, FIELDS, view), [view]);
  return (
    <WorkspaceLayout right={<Pane title="画册说明" padding="md"><p className="aui-note">画册没有行，工具栏用 <code>features.rowHeight: false</code> 去掉「行高」。卡片区在栏里自己滚，「共 N 条」和卡片离栏边 16px。</p></Pane>}>
      <Pane fill title="客户 · 画册" label="客户画册">
        <GridToolbar fields={FIELDS} view={view} onViewChange={setView} total={ALL.length} matched={records.length} features={{ rowHeight: false, color: false, group: false }} />
        {/* 客户表没有图片字段（coverFields 为空）：画册默认「不显示封面」，卡片只有五个固定位（审阅 08） */}
        <GalleryView records={records} recordId={(r) => r.id} cardTitle={(r) => r.name} cardSlots={CARD_SLOTS} cardAttachments={(r) => r.files} coverFields={[]} today={TODAY} timeZone="Asia/Shanghai"
          label="客户画册" summary={<>共 <b>{records.length}</b> 条</>} onOpen={(r) => notify(`打开「${r.name}」`, "info")} />
      </Pane>
    </WorkspaceLayout>
  );
}

function FormSection() {
  const [form, setForm] = useState(FORM_DEFINITION);
  const [settings, setSettings] = useState(FORM_SETTINGS);
  return (
    <WorkspaceLayout>
      <Pane fill title="官网咨询表单" label="表单搭建">
        <FormBuilder fields={FORM_FIELDS} form={form} onFormChange={setForm} settings={settings} onSettingsChange={setSettings} shareUrl={FORM_URL} stats={{ total: 86, today: 5 }} pinned={["name"]} />
      </Pane>
    </WorkspaceLayout>
  );
}

function AccessSection() {
  const notify = useNotify();
  const [role, setRole] = useState("tech");
  const [draft, setDraft] = useState<TableAccessValue<CondDraft>>({ ...SAVED, actions: [...SAVED.actions, "export"] });
  return (
    <WorkspaceLayout>
      <Pane title="客户 · 权限设置" label="表格权限">
        <TableAccessPanel<CondDraft>
          roles={ROLES} selectedRole={role} onSelectRole={setRole} value={draft} savedValue={SAVED} onChange={setDraft}
          recordNoun="客户" conditionFields={COND_FIELDS} actions={ACTIONS} fields={ACCESS_FIELDS} fieldIcon={(f) => ICONS[f.id]}
          impact={IMPACT} onDiscard={() => setDraft(SAVED)} onSave={() => notify("已保存（演示）", "success")} />
      </Pane>
    </WorkspaceLayout>
  );
}

function PersonSection() {
  const [person, setPerson] = useState("wang");
  const people = [{ key: "wang", title: "小王", hint: "销售 · 一组", avatar: "王" }, { key: "zhou", title: "周组长", hint: "组长", avatar: "周" }, { key: "chen", title: "陈主管", hint: "主管", avatar: "陈" }];
  return (
    <WorkspaceLayout left={<Pane title="人员"><SelectList label="人员" items={people} selected={person} onSelect={setPerson} /></Pane>}>
      <Pane title="有效权限" label="有效权限" actions={<Button size="sm" variant="outline"><Download />导出</Button>}>
        <AccessProfileHeader name="小王" tags={["销售", "智能家居 · 一组"]} meta="组长 周组长 · 主管 陈主管" stats={accessProfileStats(ROWS)} />
        <EffectiveAccessTable subject="小王" caption="小王在客户表上的有效权限" rows={ROWS} now={NOW} />
      </Pane>
    </WorkspaceLayout>
  );
}

function RecordSection() {
  const c = ALL[0]!;
  return (
    <WorkspaceLayout right={<Pane title="相关"><PaneSection title="负责人">{c.owner}</PaneSection><PaneSection title="地区">{c.region}</PaneSection></Pane>}>
      <Pane label="客户详情" padding="md"
        header={<RecordHeader avatar="客" title={c.name} status={<StatusBadge tone="brand">{stageLabel(c.stage)}</StatusBadge>} tags={["客户", c.region]} meta="更新于 10-05 14:30 · 阿明"
          facts={<FactStrip items={[{ key: "amount", label: "预计金额", value: c.amount.toLocaleString("zh-CN") }, { key: "intent", label: "意向", value: `${c.intent} 星` }]} />} />}
        actions={<><Button size="sm"><Pencil />编辑</Button><Button size="sm" variant="outline"><Share2 />分享</Button></>}
        notice={<InlineAlert tone="warning" title="这条客户 7 天没跟进">按规则明天会转进公海。</InlineAlert>}>
        <DescriptionList items={[{ label: "手机", value: c.phone }, { label: "负责人", value: c.owner }, { label: "下次跟进", value: c.next }, { label: "安装负责人", value: c.installer }]} />
      </Pane>
    </WorkspaceLayout>
  );
}

// Tabs 放进 Pane fill：标签条贴边，标签页面板（role=tabpanel）里的工具栏 + 画册 / 表格照样贴边、最后一块撑满自己滚。
// Pane 直接收 ref（量栏宽）和 DOM 事件（onContextMenuCapture 换成自己的右键菜单）、data-* 属性。
function TabsSection() {
  const notify = useNotify();
  const [tab, setTab] = useState("gallery");
  const [view, setView] = useState<GridView>(() => normalizeGridView({}, FIELDS));
  const records = useMemo(() => filterGridRows(ALL, FIELDS, view), [view]);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const pane = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => setWidth(pane.current?.offsetWidth ?? 0), []);
  return (
    <WorkspaceLayout>
      <Pane fill ref={pane} title="客户" hint={`栏宽 ${width}px（Pane ref）`} label="客户页签" data-demo="pane-tabs"
        onContextMenuCapture={(e) => { e.preventDefault(); notify("右键菜单（演示）：Pane 收到 onContextMenuCapture", "info"); }}>
        <Tabs label="客户视图" value={tab} onValueChange={setTab} items={[{ value: "gallery", label: "画册", count: records.length }, { value: "table", label: "表格" }]}
          actions={<Button size="sm" variant="outline" onClick={() => notify("新建视图（演示）", "info")}><Plus />视图</Button>}>
          {tab === "gallery" ? (
            <>
              <GridToolbar fields={FIELDS} view={view} onViewChange={setView} total={ALL.length} matched={records.length} features={{ rowHeight: false, color: false, group: false }} />
              <GalleryView records={records} recordId={(r) => r.id} cardTitle={(r) => r.name} cardFields={fieldsByKey(["stage", "owner"])} label="页签里的画册" summary={<>共 <b>{records.length}</b> 条</>} onOpen={(r) => notify(`打开「${r.name}」`, "info")} />
            </>
          ) : (
            <DataTable caption="页签里的客户表" rows={ALL.slice((page - 1) * size, page * size)} rowKey={(r) => r.id} columns={columns}
              pagination={{ mode: "page", page, pageSize: size, total: ALL.length, onPageChange: setPage, onPageSizeChange: (n) => { setSize(n); setPage(1); } }} />
          )}
        </Tabs>
      </Pane>
    </WorkspaceLayout>
  );
}

// 文档阅读页（对标飞书文档）：窄屏不做成一张卡片（narrow="flush"）；正文区 className="aui-neutral-text" 用纯中性灰，
// 目录、大纲照常带主色调。栏头放面包屑「个人空间 / 文档名」。
const DOCS = [
  { key: "guide", title: "客户跟进指南", hint: "10-05 更新" },
  { key: "faq", title: "安装常见问题", hint: "10-02 更新" },
  { key: "price", title: "2026 报价口径", hint: "09-28 更新" },
];
const NEUTRAL_STEPS = [
  { token: "--aui-neutral-1", label: "1 · 正文" },
  { token: "--aui-neutral-2", label: "2 · 次要 / 备注" },
  { token: "--aui-neutral-3", label: "3 · 占位 / 大字 / 图标" },
  { token: "--aui-neutral-4", label: "4 · 禁用" },
];
function DocSection() {
  const notify = useNotify();
  const [doc, setDoc] = useState("guide");
  const current = DOCS.find((d) => d.key === doc) ?? DOCS[0]!;
  return (
    <WorkspaceLayout narrow="flush"
      left={<Pane title="个人空间" label="文档目录"><SelectList label="文档" items={DOCS} selected={doc} onSelect={setDoc} /></Pane>}
      right={
        <Pane title="文字灰阶" label="文字灰阶" padding="md">
          <div className="aui-neutral-text" data-demo="neutral-steps">
            {NEUTRAL_STEPS.map((s) => <div key={s.token} style={{ color: `var(${s.token})` }}>{s.label}</div>)}
          </div>
        </Pane>
      }>
      <Pane label="文档正文" padding="md" header={<Breadcrumbs items={[{ label: "个人空间", onClick: () => notify("回到个人空间（演示）", "info") }, { label: current.title }]} />}>
        <article className="aui-neutral-text" data-demo="doc-body" style={{ display: "grid", gap: 12, maxWidth: 720 }}>
          <h2>{current.title}</h2>
          <small className="aui-note">阿明 · 最近修改 {current.hint}</small>
          <p>新客户进来 24 小时内打第一通电话，记下需求、预算和装修进度；三天内没联系上的，转给组长重新分配。</p>
          <p>每次跟进后在客户表里写一条跟进记录，写清楚下一步和时间。客户说「再考虑」时，约好下次联系的具体日期。</p>
          <p style={{ color: "var(--aui-secondary)" }}>次要说明：报价以「2026 报价口径」为准，特价要主管批准。</p>
        </article>
      </Pane>
    </WorkspaceLayout>
  );
}

function CardsSection() {
  const mobile = useIsMobile();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  return (
    <PageBody>
      <InlineAlert title="普通卡片流分区">同一页的工作区分区贴边，这个分区照常有内边距、卡片之间 16px（{mobile ? "手机" : "宽屏"}布局，来自 useIsMobile）。</InlineAlert>
      <Panel title="本周概况"><DescriptionList items={[{ label: "新客户", value: 12 }, { label: "成交", value: 3 }]} /></Panel>
      <ResourcePanel title="客户" count={ALL.length} unit="位" filters={<QueryBar variant="bare" value={draft} onChange={setDraft} onSearch={() => setQuery(draft.trim())} onReset={() => { setDraft(""); setQuery(""); }} placeholder="搜客户名称" />}>
        <DataTable caption="客户（卡片流）" rows={ALL.filter((c) => !query || c.name.includes(query)).slice(0, 5)} rowKey={(r) => r.id} columns={columns} pagination={{ mode: "all" }} />
      </ResourcePanel>
    </PageBody>
  );
}

export function FlushWorkspaceShowcase() {
  const [section, setSection] = useState("table");
  return (
    <TabbedPage title="工作区贴边" description="TabbedPage 里的整屏工作区：分区标签条贴边，工作区里的表格、画册、表单、权限、记录头部都不再是一张张卡片；最后一个分区是普通卡片流。"
      sections={SECTIONS} value={section} onValueChange={setSection}
      render={(id) =>
        id === "table" ? <TableSection /> : id === "views" ? <ViewsSection /> : id === "form" ? <FormSection /> : id === "access" ? <AccessSection /> : id === "person" ? <PersonSection /> : id === "record" ? <RecordSection /> : id === "tabs" ? <TabsSection /> : id === "doc" ? <DocSection /> : <CardsSection />
      } />
  );
}
