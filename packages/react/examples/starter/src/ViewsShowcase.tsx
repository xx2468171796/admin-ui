import { useMemo, useRef, useState } from "react";
import { Bell, Copy, EyeOff, Settings2, Share2, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button, ChipGroup, InlineAlert, PageBody, PageHeader, Panel, PopoverPanel, RecordDetailDialog, useNotify, type RecordFrame, type RecordLayout } from "@adminui/react";
import {
  CalendarMonth,
  CalendarSettings,
  CalendarWeek,
  CardSettings,
  GalleryView,
  GanttSettings,
  GanttView,
  KanbanBoard,
  RecordCard,
  ViewLockNotice,
  ViewManager,
  ViewSettingsFooter,
  ViewTabs,
  copyName,
  countSettingChanges,
  newViewName,
  viewActions,
  type NewViewDraft,
  type CalendarConfig,
  type CalendarEvent,
  type CalendarMode,
  type CalendarUndatedItem,
  type CardConfig,
  type DayKey,
  type GanttGroup,
  type GanttSettingsValue,
  type ViewKind,
  type ViewSummary,
  type WorkCalendar,
} from "@adminui/react/views";
import type { MenuSection } from "@adminui/react";
import { renderGridCell } from "@adminui/react/grid";
import { CARD_SLOTS, CN_2026, FIELDS, INITIAL_VIEWS, STAGES, STAGE_FIELD, TODAY, fieldsByKey, initialCustomers, moreFirstCalls, stageTone, type Customer } from "./views-demo";
/** 第二个地区的节假日（新加坡 2026，演示数据），演示日历设置里切换地区。 */
const SG_2026: WorkCalendar = { holidays: { "2026-10-09": "公司假日", "2026-10-10": "公司假日" } };

// 视图示例（样稿 D01 视图标签、D16 视图管理、D06 看板、D07 画册、D09 / D09b 日历、D10 甘特 + 甘特设置）。
// 记录、视图、节假日都是浏览器里的演示数据；真实项目里由宿主的服务端保存，并由服务端检查谁能改什么。
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stageOf = (value: string | null) => STAGES.find((s) => s.value === value);
const TEAM_EVENTS: CalendarEvent[] = [
  { id: "team-expo", title: "智能家居展 · 布展", start: "2026-10-06", end: "2026-10-08", tone: "violet", badge: "团队", editable: false },
  { id: "team-train", title: "新品培训", start: "2026-10-07", end: "2026-10-09", tone: "teal", badge: "团队", editable: false },
  { id: "team-stock", title: "门店盘点", start: "2026-10-07", tone: "gray", badge: "团队", editable: false },
];
const SETTINGS_TITLE: Partial<Record<ViewKind, string>> = { kanban: "卡片设置", gallery: "卡片设置", calendar: "日历设置", gantt: "甘特设置" };
// 看板按阶段分组：卡片标签行不再重复阶段（审阅 08 第 3 项）
const KANBAN_SLOTS = { ...CARD_SLOTS, tags: fieldsByKey(["products"]) };
const SHARED_CARD: CardConfig = { coverField: null, fields: [], density: "normal", showLabels: false };
const QUICK = [
  { value: "pool", label: "公海", count: 15 },
  { value: "mine", label: "我跟进中的", count: 42 },
  { value: "stalled", label: "停滞", count: 6 },
];
const RECORD_LAYOUT: RecordLayout<Customer> = {
  title: (r) => r.name,
  subtitle: (r) => `${stageOf(r.stage)?.label ?? "未设置"} · ${r.region} · ${r.owner}`,
  sections: [{ key: "fields", title: "客户资料", fields: FIELDS.filter((f) => f.key !== "name").map((f) => ({ key: f.key, label: f.title, value: (r: Customer) => renderGridCell(f, r) })) }],
};

export function ViewsShowcase() {
  const notify = useNotify();
  const [views, setViews] = useState<ViewSummary[]>(INITIAL_VIEWS);
  const [active, setActive] = useState("board");
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lockNotice, setLockNotice] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  // 看板卡片：五个固定位，不显示字段名；和共享设置不一样时标签上出注意色小点
  const [card, setCard] = useState<CardConfig>(SHARED_CARD);
  const cardChanges = countSettingChanges(SHARED_CARD, card);
  const [quick, setQuick] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [frame, setFrame] = useState<Exclude<RecordFrame, "page">>("drawer");
  // 画册卡片：五个固定位（CARD_SLOTS）之外不再加字段；字段名默认不显示（审阅 08）
  const [galleryCard, setGalleryCard] = useState<CardConfig>({ coverField: "files", fields: [], density: "normal", showLabels: false });
  const [galleryEmpty, setGalleryEmpty] = useState(false);
  const [calendar, setCalendar] = useState<CalendarConfig>({ startField: "followAt", endField: null, colorField: "stage", weekStart: 1, calendarId: "cn" });
  const [calMode, setCalMode] = useState<CalendarMode>("month");
  const [calDate, setCalDate] = useState<DayKey>(TODAY);
  const [gantt, setGantt] = useState<GanttSettingsValue>({
    startField: "installStart",
    endMode: "field",
    endField: "installEnd",
    workdaysOnly: true,
    titleField: "name",
    extraFields: [],
    listFields: ["name", "installer", "phone", "installStart", "installEnd"],
    colorField: "stage",
    scale: "month",
    calendarId: "cn",
    makeupDays: ["2026-10-10"],
    timeZone: "Asia/Shanghai",
    groups: [{ field: "installer", order: "asc" }, { field: "region", order: "asc" }],
    showEmptyGroups: false,
  });
  const view = views.find((v) => v.id === active) ?? views[0];

  // ---- 视图管理（D16）：顺序、显隐、改名、复制、删除、新建都交给宿主保存
  const duplicate = (id: string) => {
    const source = views.find((v) => v.id === id);
    if (!source) return;
    const copy: ViewSummary = { id: `my-${Date.now()}`, name: copyName(source.name, views.map((v) => v.name)), kind: source.kind, tier: "mine" };
    setViews((list) => [...list, copy]);
    setActive(copy.id);
    notify(`已复制为我的视图「${copy.name}」`, "success");
  };
  const create = (kind: ViewKind) => {
    const v: ViewSummary = { id: `my-${Date.now()}`, name: newViewName(kind, views.map((x) => x.name)), kind, tier: "mine" };
    setViews((list) => [...list, v]);
    setActive(v.id);
  };
  // 新建视图（6 张类型卡 + 名字 + 给谁看）
  const createView = async (draft: NewViewDraft) => {
    await sleep(150);
    const v: ViewSummary = { id: `my-${Date.now()}`, name: draft.name, kind: draft.kind, tier: draft.audience === "shared" ? "shared" : "mine" };
    setViews((list) => [...list, v]);
    setActive(v.id);
    notify(`已新建${draft.audience === "shared" ? "共享" : "我的"}视图「${draft.name}」`, "success");
  };
  const manager = (
    <ViewManager
      views={views}
      activeId={active}
      tierNotes={{ standard: "林经理维护", shared: "一组 · 周组长建", mine: "只有你看得到 · 数量不限" }}
      onSelect={setActive}
      onReorder={(tier, ids) => setViews((list) => [...list.filter((v) => v.tier !== tier), ...ids.map((id) => list.find((v) => v.id === id)).filter((v): v is ViewSummary => Boolean(v))].sort((a, b) => ["standard", "shared", "mine"].indexOf(a.tier) - ["standard", "shared", "mine"].indexOf(b.tier)))}
      onHiddenChange={(id, hidden) => setViews((list) => list.map((v) => (v.id === id ? { ...v, hidden } : v)))}
      onRename={(id, name) => setViews((list) => list.map((v) => (v.id === id ? { ...v, name } : v)))}
      onDuplicate={duplicate}
      onDelete={async (id) => {
        await sleep(200);
        setViews((list) => list.filter((v) => v.id !== id));
        if (active === id) setActive("all");
      }}
      onCreate={create}
    />
  );
  const tabMenu = (v: ViewSummary): MenuSection[] => {
    const set = viewActions(v);
    return [
      {
        items: [
          { key: "dup", label: v.tier === "mine" ? "复制一份" : "复制为我的视图", icon: <Copy size={15} />, onSelect: () => duplicate(v.id) },
          { key: "share", label: "分享视图", icon: <Share2 size={15} />, onSelect: () => notify(`分享「${v.name}」`, "info") },
          { key: "hide", label: "从标签栏隐藏", icon: <EyeOff size={15} />, disabled: !set.allowed.includes("hide"), disabledReason: set.reasons.hide, onSelect: () => setViews((list) => list.map((x) => (x.id === v.id ? { ...x, hidden: true } : x))) },
        ],
      },
      ...(set.allowed.includes("delete") ? [{ items: [{ key: "del", label: "删除视图", icon: <Trash2 size={15} />, danger: true, onSelect: () => setViews((list) => list.filter((x) => x.id !== v.id)) }] }] : []),
    ];
  };

  // ---- 看板（D06）
  const boardRecords = useMemo(() => customers.filter((c) => c.stage !== "lost"), [customers]);
  // 从视图打开记录：右侧抽屉（不挡看板，点别的卡片直接换人；↑ ↓ 切上下条）
  const openIndex = openId ? boardRecords.findIndex((c) => c.id === openId) : -1;
  const openRow = openIndex >= 0 ? boardRecords[openIndex] : undefined;
  const loadMore = async () => {
    setLoading(true);
    await sleep(400);
    setCustomers((list) => [...list, ...moreFirstCalls(pages + 1)]);
    setPages((p) => p + 1);
    setLoading(false);
  };
  const moveCard = async (id: string, to: string | null, before: string | null) => {
    await sleep(250);
    if (id === "C1010" && to !== "won") throw new Error("演示：郑淑惠已签约，阶段不能退回");
    setCustomers((list) => {
      const moving = list.find((c) => c.id === id);
      if (!moving) return list;
      const rest = list.filter((c) => c.id !== id);
      const at = before ? rest.findIndex((c) => c.id === before) : rest.length;
      rest.splice(at < 0 ? rest.length : at, 0, { ...moving, stage: to });
      return rest;
    });
  };

  // ---- 日历（D09 / D09b）
  const workCalendar = (id: string | null | undefined, extra: readonly string[] = []): WorkCalendar => {
    const base = id === "sg" ? SG_2026 : id === "cn" ? CN_2026 : {};
    return { ...base, workdays: { ...base.workdays, ...Object.fromEntries(extra.map((d) => [d, "补班"])) } };
  };
  const events = useMemo<CalendarEvent[]>(() => {
    const list: CalendarEvent[] = [];
    for (const c of customers) {
      const stage = stageOf(c.stage);
      const at = calendar.startField === "next" ? c.next : calendar.startField === "installStart" ? c.installStart : c.followAt;
      if (at) list.push({ id: c.id, title: c.name, start: at, end: calendar.startField === "followAt" ? c.followEnd : calendar.startField === "installStart" ? c.installEnd : null, tone: calendar.colorField ? stageTone(c.stage) : "green", badge: stage?.label, details: [{ label: "负责人", value: c.owner }, { label: "阶段", value: stage?.label ?? "未设置" }] });
      if (calendar.startField === "followAt" && c.installStart) list.push({ id: `inst-${c.id}`, title: `${c.name} · 安装`, start: c.installStart, end: c.installEnd, tone: "blue", badge: "安装", details: [{ label: "负责人", value: `${c.installer ?? "未分配"} · 安装 ${c.installer ?? ""}` }] });
    }
    // 团队日程（全天）：让周视图的全天栏超过 2 行，演示「2 行 + 更多 + 展开」
    if (calendar.startField === "followAt") list.push(...TEAM_EVENTS);
    return list;
  }, [customers, calendar]);
  const undated = useMemo<CalendarUndatedItem[]>(() => customers.filter((c) => !c.followAt && c.stage !== "lost").map((c) => ({ id: c.id, title: c.name, badge: stageOf(c.stage)?.label ?? "未设置", tone: stageTone(c.stage), person: c.owner })), [customers]);
  const changeDate = async (id: string, start: string, end: string | null) => {
    await sleep(200);
    setCustomers((list) =>
      list.map((c) => {
        if (`inst-${c.id}` === id) return { ...c, installStart: start, installEnd: end ?? start };
        if (c.id !== id) return c;
        // 拖到某一天的无日期记录：宿主决定几点（这里放在上午 10 点）。
        return { ...c, followAt: start.length === 10 ? `${start}T10:00:00+08:00` : start, followEnd: start.length === 10 ? null : end };
      }),
    );
  };
  const calendarProps = {
    events,
    date: calDate,
    onNavigate: setCalDate,
    label: view?.name ?? "日历",
    timeZone: "Asia/Shanghai",
    weekStart: calendar.weekStart,
    workCalendar: workCalendar(calendar.calendarId),
    today: TODAY,
    mode: calMode,
    onModeChange: setCalMode,
    onDateChange: changeDate,
    onOpen: (id: string) => notify(`打开「${customers.find((c) => c.id === id.replace("inst-", ""))?.name ?? id}」`, "info"),
    onClearDate: (id: string) => setCustomers((list) => list.map((c) => (c.id === id ? { ...c, followAt: null, followEnd: null } : `inst-${c.id}` === id ? { ...c, installStart: null, installEnd: null } : c))),
    eventMenu: (): MenuSection[] => [
      { items: [{ key: "remind", label: "设置提醒", icon: <Bell size={15} />, onSelect: () => notify("已设置提醒", "success") }, { key: "share", label: "分享记录", icon: <Share2 size={15} />, onSelect: () => notify("分享记录", "info") }] },
      { items: [{ key: "del", label: "删除记录", icon: <Trash2 size={15} />, danger: true, onSelect: () => notify("演示里不真删", "info") }] },
    ],
    legend: calendar.colorField ? { title: "按「阶段」着色", items: STAGES.slice(0, 5).map((s) => ({ label: s.label, tone: stageTone(s.value) })) } : undefined,
  };

  // ---- 甘特（D10）：分组由宿主做（这里按 安装负责人 → 地区），视图只画
  const ganttGroups = useMemo<GanttGroup<Customer>[]>(() => {
    const rows = customers.filter((c) => c.installer || c.stage === "won");
    const level = (list: Customer[], depth: number): GanttGroup<Customer>[] => {
      const spec = gantt.groups?.[depth];
      if (!spec) return [];
      const keyOf = (c: Customer) => String((c as Record<string, unknown>)[spec.field] ?? "") || "未分配";
      const keys = [...new Set(list.map(keyOf))].sort((a, b) => (a === "未分配" ? 1 : b === "未分配" ? -1 : spec.order === "desc" ? b.localeCompare(a, "zh") : a.localeCompare(b, "zh")));
      return keys.map((key) => {
        const members = list.filter((c) => keyOf(c) === key);
        const children = key === "未分配" ? [] : level(members, depth + 1);
        return { key, label: key, person: spec.field === "installer" && key !== "未分配", ...(children.length ? { groups: children } : { records: members }) };
      });
    };
    return gantt.groups?.length ? level(rows, 0) : [{ key: "all", label: "全部", records: rows }];
  }, [customers, gantt.groups]);

  const settingsBody = () => {
    if (!view) return null;
    if (view.kind === "kanban")
      return (
        <CardSettings
          fields={FIELDS}
          coverFields={[{ value: "files", label: "现场资料" }]}
          value={card}
          onChange={setCard}
          preview={boardRecords[0] && <RecordCard record={boardRecords[0]} title={boardRecords[0].name} {...KANBAN_SLOTS} fields={fieldsByKey(card.fields)} showLabels={card.showLabels === true} density={card.density} attachments={card.coverField ? boardRecords[0].files : undefined} today={TODAY} timeZone="Asia/Shanghai" />}
        />
      );
    if (view.kind === "gallery") return <CardSettings fields={FIELDS} coverFields={[{ value: "files", label: "现场资料" }]} value={galleryCard} onChange={setGalleryCard} />;
    if (view.kind === "calendar") return <CalendarSettings fields={FIELDS} value={calendar} onChange={setCalendar} calendars={[{ id: "cn", label: "中国大陆" }, { id: "sg", label: "新加坡" }]} />;
    if (view.kind === "gantt") return <GanttSettings fields={FIELDS} value={gantt} onChange={setGantt} calendars={[{ id: "cn", label: "中国大陆" }, { id: "sg", label: "新加坡" }]} timeZones={[{ value: "Asia/Shanghai", label: "(UTC+08:00) 北京、上海" }, { value: "Asia/Singapore", label: "(UTC+08:00) 新加坡" }]} />;
    return null;
  };

  const stage = () => {
    if (!view) return null;
    if (view.kind === "kanban")
      return (
        <KanbanBoard
          records={boardRecords}
          recordId={(r) => r.id}
          groupField={STAGE_FIELD}
          cardTitle={(r) => r.name}
          cardFields={fieldsByKey(card.fields)}
          cardSlots={KANBAN_SLOTS}
          showLabels={card.showLabels === true}
          cardAttachments={card.coverField ? (r) => r.files : undefined}
          density={card.density}
          label={view.name}
          columnMeta={{ first: { total: 12, hasMore: pages < 2, loading } }}
          sumField={FIELDS.find((f) => f.key === "amount")}
          canMove={(r) => r.name !== "杨佩珊"}
          lockReason={() => "成交只有主管能换阶段"}
          onLoadMore={(value) => value === "first" && void loadMore()}
          onMove={moveCard}
          selectedId={openId}
          onOpen={(r) => setOpenId(r.id)}
          onAdd={(value) => notify(`在「${stageOf(value)?.label ?? "未设置"}」新建记录`, "info")}
          lightbox={{ onDownload: (i) => notify(`下载 ${i.name}`, "info"), onOpenInNewWindow: (i) => notify(`新窗口打开 ${i.name}`, "info") }}
        />
      );
    if (view.kind === "gallery")
      return (
        <div style={{ height: "100%", overflow: "auto", padding: 16 }}>
          <GalleryView
            records={galleryEmpty ? [] : customers}
            recordId={(r) => r.id}
            cardTitle={(r) => r.name}
            cardSlots={CARD_SLOTS}
            cardFields={fieldsByKey(galleryCard.fields)}
            cardAttachments={galleryCard.coverField ? (r) => r.files : undefined}
            today={TODAY}
            timeZone="Asia/Shanghai"
            label={view.name}
            total={customers.length}
            summary={<>共 <b>{customers.length}</b> 条 · 按「最后跟进」从新到旧 <Button variant="text" size="sm" onClick={() => setGalleryEmpty((e) => !e)}>{galleryEmpty ? "看全部" : "看空状态"}</Button></>}
            coverFields={[{ value: "files", label: "现场资料" }]}
            coverField={galleryCard.coverField ?? "none"}
            onCoverFieldChange={(v) => setGalleryCard((c) => ({ ...c, coverField: v === "none" ? null : v }))}
            density={galleryCard.density}
            onDensityChange={(density) => setGalleryCard((c) => ({ ...c, density }))}
            showLabels={galleryCard.showLabels}
            onShowLabelsChange={(showLabels) => setGalleryCard((c) => ({ ...c, showLabels }))}
            filterText={galleryEmpty ? "阶段 = 成交 · 地区 = 漠河" : undefined}
            onClearFilters={() => setGalleryEmpty(false)}
            onOpen={(r) => notify(`打开「${r.name}」`, "info")}
            lightbox={{ onDownload: (i) => notify(`下载 ${i.name}`, "info"), onOpenInNewWindow: (i) => notify(`新窗口打开 ${i.name}`, "info") }}
          />
        </div>
      );
    if (view.kind === "calendar")
      return calMode === "month" ? (
        <CalendarMonth {...calendarProps} undated={undated} undatedHint="拖到日历上某一天 = 设「跟进时间」" onCreate={(day) => notify(`新建跟进：${day}`, "info")} />
      ) : (
        // now 固定在演示的「今天」10:42，「现在」线（主色）总在画面里
        <CalendarWeek {...calendarProps} now={Date.parse(`${TODAY}T10:42:00+08:00`)} onCreate={(start) => notify(`新建跟进：${start}`, "info")} />
      );
    if (view.kind === "gantt")
      return (
        <GanttView
          fields={FIELDS}
          config={gantt}
          groups={ganttGroups}
          recordId={(r) => r.id}
          label={view.name}
          timeZone={gantt.timeZone}
          workCalendar={workCalendar(gantt.calendarId, gantt.makeupDays)}
          today={TODAY}
          milestones={[{ day: "2026-10-18", label: "样板间开放日" }]}
          canEdit={(r) => r.stage !== "lost"}
          onDateChange={async (id, change) => {
            await sleep(200);
            setCustomers((list) => list.map((c) => (c.id === id ? { ...c, installStart: change.start, installEnd: change.end } : c)));
          }}
          onOpen={(r) => notify(`打开「${r.name}」`, "info")}
          onAddRow={() => notify("新增一行", "info")}
        />
      );
    return (
      <div style={{ display: "grid", gap: 12, padding: 16 }}>
        {view.tier !== "mine" && lockNotice && <ViewLockNotice view={view} onDuplicate={() => duplicate(view.id)} onDismiss={() => setLockNotice(false)} />}
        <InlineAlert title="表格视图用 BitableGrid">这一页演示其它视图；表格见「多维表格」页（@adminui/react/grid），它和这里共用同一套字段定义 GridField。</InlineAlert>
      </div>
    );
  };

  const settingsTitle = view ? SETTINGS_TITLE[view.kind] : undefined;
  return (
    <>
      <PageHeader title="视图" description="多维表格的视图：标签 + 视图管理（标准 / 必看 / 共享 / 我的）、看板、画册、日历、甘特和它们的设置面板。数据是演示的，真实项目由服务端保存并检查权限。" />
      <PageBody>
        <Panel flush>
          <ViewTabs views={views.map((v) => (v.id === "board" ? { ...v, modified: cardChanges > 0 } : v))} activeId={active} onSelect={setActive} tabMenu={tabMenu}
            onCreateView={createView} createAudiences={["mine", "shared"]} createNote="建好后从当前视图带上筛选和排序"
            onRename={(id, name) => setViews((list) => list.map((v) => (v.id === id ? { ...v, name } : v)))} manager={manager}
            trailing={<nav className="starter-dash-tabs" aria-label="仪表盘" style={{ display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
              <span className="aui-note">仪表盘</span>
              <Button size="sm" variant="ghost" onClick={() => undefined}>经营看板</Button>
              <Button size="sm" variant="ghost" onClick={() => undefined}>我的今天</Button>
              <Button size="sm" variant="ghost" aria-label="新建仪表盘" onClick={() => undefined}>+</Button>
            </nav>} />
          <div className="starter-view-toolbar" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--aui-line)" }}>
            {settingsTitle && (
              <Button ref={settingsButton} variant="ghost" size="sm" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((o) => !o)}>
                {view?.kind === "gantt" ? <SlidersHorizontal size={14} aria-hidden="true" /> : <Settings2 size={14} aria-hidden="true" />}
                {settingsTitle}
              </Button>
            )}
            {/* 快捷筛选（业务预设，带条数）在工具栏右边；表格页用 BitableGrid toolbarQuick */}
            <span style={{ marginLeft: "auto" }}>
              <ChipGroup label="快捷筛选" value={quick} options={QUICK} onValueChange={(next) => setQuick(next.filter((v) => !quick.includes(v)).slice(0, 1))} />
            </span>
          </div>
          <PopoverPanel open={settingsOpen && Boolean(settingsTitle)} anchor={settingsButton.current} onClose={() => setSettingsOpen(false)} sheet
            title={settingsTitle ? `${settingsTitle} · ${view?.name ?? ""}${view && view.tier !== "mine" ? `（${view.tier === "standard" ? "标准视图" : "共享视图"}）` : ""}` : undefined}
            width={view?.kind === "gantt" ? 780 : 440}
            footer={<ViewSettingsFooter changes={view?.kind === "kanban" ? cardChanges : undefined} onReset={() => { setCard(SHARED_CARD); notify("已恢复共享设置", "info"); }} onSaveAsNew={() => view && duplicate(view.id)} onSaveForAll={() => notify("已保存给所有人", "success")} />}>
            {settingsBody()}
          </PopoverPanel>
          <div style={{ height: 640, minHeight: 0 }}>{stage()}</div>
          <RecordDetailDialog<Customer>
            layout={RECORD_LAYOUT}
            row={openRow}
            level="expanded"
            frame={frame}
            onFrameChange={(next) => (next === "page" ? notify("整页：宿主跳到记录自己的地址", "info") : setFrame(next))}
            nav={openRow ? { index: openIndex, total: boardRecords.length, label: view?.name, onMove: (d) => setOpenId(boardRecords[openIndex + d]?.id ?? openId) } : undefined}
            onCopyLink={() => notify("已复制链接", "success")}
            onClose={() => setOpenId(null)}
            recordKey={openRow?.id}
          />
        </Panel>
      </PageBody>
    </>
  );
}
