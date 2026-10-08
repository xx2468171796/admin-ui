import { useMemo, useState, type ReactNode } from "react";
import { CalendarClock, Copy, Flag, Inbox, Plus, RefreshCw, Repeat, Timer, TriangleAlert } from "lucide-react";
import {
  ActionList,
  BulletBar,
  Button,
  DashboardFilterBar,
  DataTable,
  DeltaBadge,
  KpiCard,
  KpiGrid,
  LiveStatus,
  PageBody,
  PageHeader,
  Panel,
  PersonLine,
  SegmentedControl,
  SplitLayout,
  StatusBadge,
  Tag,
  TodoInbox,
  computeDelta,
  useDashboardFilters,
  useNotify,
  type Column,
  type DashboardDimension,
  type DashboardFilterValue,
  type Delta,
  type FilterOption,
  type TodoItem,
} from "@adminui/react";
import { TargetBars } from "./target-bars";

/*
 * 本页用 T04 统计看板页的看板骨架（DASHBOARDS.md §3），照已审定的 D29「团队今日」摆真实内容。
 * 看板分类卡（DASHBOARDS.md §0）
 * 业务类型：销售跟进（客户 / CRM，§0 调研新增，未回流前按 §2.12 通用硬规则）· 用途：实时值班（今天）· 受众：组长
 * 要做的决定：今天该找谁谈——没动、只刷数、新客户没接、逾期堆积；北极星：按时有效跟进率
 * 一级 KPI：按时有效跟进率、有效跟进、有效通话、新客户首响（中位）、逾期客户
 * 对比：上周同一天同时段（遇假日自动改比上一个工作日）· 刷新：每分钟 · 时区：Asia/Shanghai
 * 查看范围：服务端按组长的组强制；按人员排，不做排行榜，新人样本不足灰显不比较
 */

const TIME: readonly FilterOption[] = [
  { value: "today", label: "今天" },
  { value: "yesterday", label: "昨天" },
];
const COMPARE: readonly FilterOption[] = [
  { value: "wow", label: "上周同一天 · 9-21", description: "上周同一天同样截至 15:42；遇假日自动改比上一个工作日" },
  { value: "dod", label: "昨天同时段", description: "昨天同样截至 15:42 的数" },
  { value: "target", label: "目标", description: "和今天的目标比，按已过的工作时间看进度" },
];
const DIMENSIONS: readonly DashboardDimension[] = [
  { key: "line", label: "业务线", options: [{ value: "smart", label: "智能家居" }, { value: "travel", label: "旅游" }] },
  { key: "group", label: "组", options: [{ value: "g1", label: "一组" }, { value: "g2", label: "二组" }] },
  { key: "who", label: "人", allLabel: "全部 5 人", options: ["小王", "小李", "阿杰", "美华", "小林"].map((n) => ({ value: n, label: n })) },
  { key: "source", label: "来源", options: [{ value: "web", label: "官网表单" }, { value: "line", label: "LINE" }, { value: "expo", label: "展会" }] },
  { key: "stage", label: "阶段", options: ["首通", "二通", "报价", "成交"].map((s) => ({ value: s, label: s })) },
];
const DEFAULTS: DashboardFilterValue = { time: "today", compare: "wow", dims: { line: "smart", group: "g1" } };
const HOURS = { categories: ["9", "10", "11", "12", "13", "14", "15", "16", "17", "18"], values: [6, 8, 9, 2, 4, 7, 4, null, null, null], inProgress: 6, name: "有效跟进", unit: "条" };

const d = (cur: number, prev: number, better: "up" | "down" | "neutral" = "up", mode: "absolute" | "points" = "absolute") => computeDelta(cur, prev, { better, mode, digits: 0 });
type Cell = { v: ReactNode; delta?: Delta | null; unit?: string; note?: string };
type Person = { id: string; name: string; avatar: string; hint: string; flag?: string; tag?: string; grey?: boolean; ontime: [number, number]; cells: Cell[] };
const PEOPLE: readonly Person[] = [
  { id: "wang", name: "小王", avatar: "王", hint: "普通池 · 10 条跟进", ontime: [7, 12], cells: [{ v: "7 / 12", delta: d(7 / 12, 0.64, "up", "points") }, { v: 9, delta: d(9, 7) }, { v: "21 / 14 / 9", delta: d(9, 8), unit: "有效" }, { v: "42 分 / 2:50", delta: d(42, 36, "neutral"), unit: "分" }, { v: "2 · 18 分", delta: d(18, 27, "down"), unit: "分" }, { v: 3, delta: d(3, 2) }, { v: 1, delta: d(1, 0, "down") }] },
  { id: "li", name: "小李", avatar: "李", hint: "普通池 · 12 条跟进", ontime: [9, 10], cells: [{ v: "9 / 10", delta: d(0.9, 0.82, "up", "points") }, { v: 11, delta: d(11, 8) }, { v: "18 / 12 / 8", delta: d(8, 8) }, { v: "38 分 / 3:10", delta: d(38, 34, "neutral"), unit: "分" }, { v: "1 · 6 分", delta: d(6, 18, "down"), unit: "分" }, { v: 2, delta: d(2, 2) }, { v: 0, delta: d(0, 0, "down") }] },
  { id: "jie", name: "阿杰", avatar: "杰", hint: "普通池 · 19 条跟进", flag: "疑似刷数 2", ontime: [5, 14], cells: [{ v: "5 / 14", delta: d(5 / 14, 0.65, "up", "points") }, { v: 6, delta: d(6, 9) }, { v: "46 / 9 / 3", delta: d(3, 7), unit: "有效" }, { v: "11 分 / 0:40", delta: d(11, 30, "neutral"), unit: "分" }, { v: "1 · 超时", note: "等了 78 分" }, { v: 0, delta: d(0, 2) }, { v: 4, delta: d(4, 2, "down") }] },
  { id: "hua", name: "美华", avatar: "华", hint: "普通池 · LINE 为主", ontime: [8, 9], cells: [{ v: "8 / 9", delta: d(8 / 9, 0.85, "up", "points") }, { v: 10, delta: d(10, 9) }, { v: "6 / 5 / 4", note: "有效接触 12" }, { v: "21 分 / 4:05", delta: d(21, 18, "neutral"), unit: "分" }, { v: "1 · 42 分", delta: d(42, 27, "down"), unit: "分" }, { v: 2, delta: d(2, 1) }, { v: 0, delta: d(0, 0, "down") }] },
  { id: "lin", name: "小林", avatar: "林", hint: "新人 · 入职第 2 周", tag: "新人", grey: true, ontime: [3, 4], cells: [{ v: "3 / 4", note: "样本不足" }, { v: 4, note: "—" }, { v: "11 / 6 / 3", note: "—" }, { v: "14 分 / 2:20", note: "—" }, { v: "1 · 25 分", note: "—" }, { v: 1, note: "—" }, { v: 0, note: "—" }] },
];
// 1440 下表格和右栏并排，列宽按内容收紧，整表不横向溢出（通话类表头省掉「通话」两字，口径见面板说明）。
const HEADS = ["按时有效跟进", "有效跟进", "拨/接/有效", "时长 总/中位", "新客首响", "阶段推进", "逾期客户"];
const WIDTHS = [100, 64, 92, 108, 80, 64, 64];

/** 格子：上一行数值，下一行和对比期的变化（DeltaBadge 小号）或一句灰字。 */
function TwoLine({ cell, bar }: { cell: Cell; bar?: ReactNode }) {
  return (
    <span style={{ display: "grid", justifyItems: "end", gap: 2 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
        {bar}
        {cell.v}
      </span>
      {cell.note ? <span className="aui-note">{cell.note}</span> : cell.delta !== undefined && <DeltaBadge delta={cell.delta} unit={cell.unit} comparison="比 9-21 同时段" size="sm" />}
    </span>
  );
}

const FEED = [
  { key: "1", title: "09:12 张家豪（徐汇区别墅）", detail: "电话 3:40 · 有录音 · AI 摘要：三楼加装智能窗帘 4 樘，要求周四前出报价", badge: <StatusBadge tone="success">有效</StatusBadge>, meta: "接通 ≥ 60 秒", filters: [] },
  { key: "2", title: "10:05 邱志豪", detail: "电话 ×5 · 各 0:08 · 未接通，5 分钟内连拨 5 次", badge: <StatusBadge>无效</StatusBadge>, meta: "只算 1 次拨打", filters: ["no"] },
  { key: "3", title: "10:31 吴宗翰", detail: "手写 12 字：「客户说再考虑，下周再联系」", badge: <StatusBadge>无效</StatusBadge>, meta: "手写不足 30 字", filters: ["no"] },
  { key: "4", title: "11:20 蔡依琳", detail: "手写 31 字：「已联系客户，客户表示有兴趣，会再考虑……」", badge: <StatusBadge tone="warning">待复核</StatusBadge>, meta: "与 10-02 相似度 0.96", filters: ["review"] },
  { key: "5", title: "11:22 刘建宏", detail: "手写 31 字：「已联系客户，客户表示有兴趣，会再考虑……」", badge: <StatusBadge tone="warning">待复核</StatusBadge>, meta: "与上一条相似度 0.98", filters: ["review"] },
  { key: "6", title: "14:05 郑淑惠", detail: "上门 · 4 张照片 · AI 摘要：勘测客厅与主卧，确认 6 个开关位", badge: <StatusBadge tone="success">有效</StatusBadge>, meta: "上门有定位和照片", filters: [] },
];
function JieFeed() {
  const [only, setOnly] = useState("all");
  const items = only === "all" ? FEED : FEED.filter((f) => f.filters.includes(only));
  return (
    <div style={{ display: "grid", gap: 8, padding: "4px 0 8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <b>阿杰今天的跟进</b>
        <span className="aui-note">19 条 · 有效 6 · 无效 10 · 待复核 3</span>
        <SegmentedControl size="sm" label="只看" value={only} onValueChange={setOnly} options={[{ value: "all", label: "全部" }, { value: "no", label: "只看无效" }, { value: "review", label: "只看待复核" }]} />
      </div>
      <ActionList items={items} label="阿杰今天的跟进" dense />
    </div>
  );
}

export function TeamTodayDashboard({ active }: { active: boolean }) {
  const notify = useNotify();
  const [filters, setFilters] = useDashboardFilters(DEFAULTS, { times: TIME, compares: COMPARE, dimensions: DIMENSIONS, url: false });
  const [expanded, setExpanded] = useState<string[]>(["jie"]);
  const columns = useMemo<Column<Person>[]>(
    () => [
      {
        key: "who",
        title: "人员",
        width: 150,
        render: (p) => (
          <PersonLine
            avatar={p.avatar}
            name={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {p.name}
                {p.tag && <Tag variant="plain">{p.tag}</Tag>}
              </span>
            }
            hint={p.flag ? <StatusBadge tone="warning"><Flag size={12} aria-hidden="true" />{p.flag}</StatusBadge> : p.hint}
          />
        ),
      },
      ...HEADS.map((title, i): Column<Person> => ({
        key: `c${i}`,
        title,
        align: "right",
        numeric: true,
        width: WIDTHS[i],
        render: (p) => (
          <TwoLine
            cell={p.cells[i]!}
            bar={i === 0 ? <span style={{ width: 30 }}><BulletBar value={p.ontime[0]} max={p.ontime[1]} label={`${p.name}按时有效跟进`} size="sm" scale={false} /></span> : undefined}
          />
        ),
      })),
    ],
    [],
  );
  const todo: TodoItem[] = [
    { key: "a", icon: <Timer />, tone: "danger", title: "杨佩珊 分给阿杰 1 小时 18 分未接触", detail: "官网表单 · 新客户首响已超时，已提醒阿杰", actions: [{ key: "re", label: "改派", onSelect: () => notify("演示：改派") }] },
    { key: "b", icon: <TriangleAlert />, tone: "danger", title: "逾期客户 5 位", detail: "阿杰 4（最久 何俊贤 9 天）· 小王 1（陈雅婷 6 天）", actions: [{ key: "see", label: "查看", onSelect: () => notify("演示：查看逾期") }] },
    { key: "c", icon: <Flag />, tone: "attention", title: "复核：阿杰 疑似刷数 2", detail: "3 条内容几乎相同 · 昨晚 22:50 集中补录 6 条", actions: [{ key: "rv", label: "复核", onSelect: () => notify("演示：复核") }] },
    { key: "d", icon: <Repeat />, tone: "attention", title: "李承恩的跟进计划已改期 2 次", detail: "小王 · 改期不算按时，防止躲开分母", actions: [{ key: "log", label: "看记录", onSelect: () => notify("演示：看记录") }] },
    { key: "e", icon: <Inbox />, tone: "info", title: "销售池 3 位待领", detail: "普通销售池 · 最久已等 14 分钟", actions: [{ key: "as", label: "去分配", onSelect: () => notify("演示：去分配") }] },
  ];
  return (
    <>
      <PageHeader
        title="团队今日"
        description="今天该找谁谈：没动、只刷数、新客户没接、逾期堆积。范围：一组 5 人（智能家居 · 普通销售池）；数字口径见指标字典。这是标准看板，由管理员维护，复制为我的看板后可以增删组件。"
        actions={
          <>
            <LiveStatus state="live" dataTime={Date.UTC(2026, 9, 5, 7, 42)} timeZone="Asia/Shanghai" timeZoneLabel="（上海）" />
            <Button size="sm" variant="outline" onClick={() => notify("已刷新（演示）")}><RefreshCw />刷新</Button>
            <Button size="sm" variant="outline" onClick={() => notify("已复制为我的看板（演示）")}><Copy />复制为我的看板</Button>
          </>
        }
      />
      <PageBody>
        <DashboardFilterBar
          value={filters}
          onChange={setFilters}
          defaultValue={DEFAULTS}
          timeOptions={TIME}
          compareOptions={COMPARE}
          compareNote="9-28 教师节放假，自动改比 9-21 周一同时段"
          dimensions={DIMENSIONS}
          renderAddFilter={() => <Button size="sm" variant="ghost" onClick={() => notify("条件筛选器由宿主接入（演示）")}><Plus />添加筛选</Button>}
          onSaveMine={() => notify("已保存为我的筛选（演示）")}
        />
        <KpiGrid>
          <KpiCard title="按时有效跟进率" tag="北极星" value="65" unit="%" target={{ value: 65, target: 80, max: 100, format: (n) => `${n}%`, targetLabel: "目标" }} detail="32 / 49 个到期 · 目标 80%" delta={d(0.65, 0.71, "up", "points")} comparison="比 9-21 同时段 71%" definition="今天到期（含之前逾期未完成）的跟进计划中，到期日结束前有有效跟进的 ÷ 到期计划数。" />
          <KpiCard title="有效跟进" value="40" unit="条" detail="36 位客户 · 共 57，无效 17" delta={d(40, 36)} comparison="比 9-21 同时段" trend={[31, 35, 33, 38, 36, 34, 37, 36, 40]} trendInProgress trendPlacement="inline" definition="录音人声 ≥ 30 秒，或接通电话 ≥ 60 秒，或上门带定位 / 照片，或本人手写 ≥ 30 字且不重复。" />
          <KpiCard title="有效通话" value="27" unit="通" detail="接通 46 / 102 · 单通中位 2:40" delta={d(27, 31)} comparison="比 9-21 同时段" trend={[29, 33, 30, 34, 31, 28, 32, 31, 27]} trendInProgress trendPlacement="inline" />
          <KpiCard title="新客户首次响应" value="25" unit="分 · 中位" detail="1 小时内 5 / 6 · P90 不足" delta={d(25, 32, "down")} comparison="比 9-21 同时段" trend={[41, 36, 38, 30, 33, 29, 32, 28, 25]} trendInProgress trendPlacement="inline" />
          <KpiCard title="逾期客户" value="5" unit="位" valueTone="bad" detail="5 天没有效跟进 · 阿杰 4" delta={d(5, 3, "down")} comparison="比 9-21" trend={[2, 3, 2, 3, 3, 4, 3, 3, 5]} trendPlacement="inline" />
        </KpiGrid>
        <SplitLayout
          railWidth={256}
          rail={
            <>
              <Panel title="今天的节奏" count="每小时有效跟进 · 条">
                <TargetBars input={HOURS} label="今天每小时有效跟进条数，15 点进行中" height={170} active={active} />
                <p className="aui-note"><CalendarClock size={13} aria-hidden="true" /> 15 点这一格还在进行中（虚线）；12 点午休</p>
              </Panel>
              <TodoInbox title="需要你处理" items={todo} />
            </>
          }
        >
          <Panel title="每个人今天的情况" count="5 人 · 按人员排，不是排行榜" description="每列下方是和 9-21 周一同时段的变化；颜色看好坏：逾期、首响变长标红。新人与样本不足的人灰显，不比较。" flush actions={<Button size="sm" variant="outline" onClick={() => notify("导出（演示）")}>导出</Button>}>
            <DataTable
              caption="每个人今天的情况"
              rows={PEOPLE}
              rowKey={(p) => p.id}
              columns={columns}
              rowHeight="medium"
              pagination={{ mode: "all" }}
              expandable={{ expanded, onExpandedChange: setExpanded, render: (p) => (p.id === "jie" ? <JieFeed /> : <span className="aui-note">{p.name}今天的跟进明细（演示只展开阿杰）</span>), label: (p) => `${p.name}今天的跟进` }}
            />
            <p className="aui-note" style={{ padding: "10px 16px" }}>请假 0 人 · 只统计系统采集的通话；手填通话 3 通单列，不进数字 · 首响按上班时间算</p>
          </Panel>
        </SplitLayout>
      </PageBody>
    </>
  );
}
