import type { CSSProperties } from "react";
import { CalendarDays, Hourglass, Inbox, Info, Phone, Timer, TriangleAlert } from "lucide-react";
import {
  Button,
  CohortTable,
  DashboardSection,
  DeltaBadge,
  KpiCard,
  KpiGrid,
  PageBody,
  PageHeader,
  Panel,
  ProgressRing,
  RollupCard,
  StatStrip,
  StepFunnel,
  TodoInbox,
  computeDelta,
  useNotify,
  type FunnelStep,
  type RollupMetric,
  type TodoItem,
} from "@adminui/react";
import { TargetBars } from "./target-bars";

/*
 * 看板部件示例：照已审定的 D30「业务线经营」、D31「老板总览」、D29m「我的今天（手机）」摆真实内容。
 * 分类卡：D30 经营复盘 · 销售经理 · 比上月同期（日均）· T+1 定稿；D31 经营复盘 · 老板 · 比去年同期（364 天）；
 * D29m 实时值班 · 销售本人 · 手机。进度环只在 D29m 这种个人进度里用，其它地方用子弹图。
 */

const pp = (cur: number, prev: number, better: "up" | "down" = "up") => computeDelta(cur, prev, { mode: "points", better });
const rel = (cur: number, prev: number, better: "up" | "down" = "up") => computeDelta(cur, prev, { better, digits: 0 });
const abs = (cur: number, prev: number, better: "up" | "down" = "up") => computeDelta(cur, prev, { better, mode: "absolute", digits: 0 });
const ntWan = (n: number) => `¥${n.toLocaleString("zh-CN")} 万`;

const FUNNEL: readonly FunnelStep[] = [
  { key: "m0", code: "M0", label: "进线", count: 312 },
  { key: "m1", code: "M1", label: "首次有效接触", count: 268, delta: pp(0.859, 0.858) },
  { key: "m2", code: "M2", label: "需求确认", count: 174, delta: pp(0.649, 0.607) },
  { key: "m3", code: "M3", label: "报价 / 方案", count: 96, delta: pp(0.552, 0.547) },
  { key: "m4", code: "M4", label: "成交", count: 31, delta: pp(0.323, 0.305) },
];
const COHORT = [
  { key: "6", label: "6 月", size: "301 位", values: [0.023, 0.083, 0.126, 0.14] },
  { key: "7", label: "7 月", size: "288 位", values: [0.021, 0.087, 0.132, null] },
  { key: "8", label: "8 月", size: "312 位", values: [0.026, 0.099, null, null] },
  { key: "9", label: "9 月", size: "335 位", values: [null, null, null, null] },
];
const MONTHS = { categories: ["6 月", "7 月", "8 月", "9 月", "10 月"], values: [1080, 1165, 1020, 1248, 204], targets: [1100, 1100, 1200, 1200, 1200], inProgress: true, name: "成交额", targetName: "当月目标", unit: "万" };
const grid3: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 16, alignItems: "start" };

const m = (key: string, label: string, value: string | null, unit: string, delta?: ReturnType<typeof pp>, note?: string, deltaUnit?: string): RollupMetric => ({ key, label, value, unit, delta, note, deltaUnit });
const AR = m("ar", "应收逾期", null, "", undefined, "财务模块上线后显示");

export function DashboardKitShowcase({ active }: { active: boolean }) {
  const notify = useNotify();
  const drill = (to: string) => () => notify(`进入「${to}」，带着当前筛选（carryFilterContext）`);
  const anomalies: TodoItem[] = [
    { key: "a", icon: <Timer />, tone: "danger", title: "效果图 · 首响 P90 变成 9 小时", detail: "原来 2 小时 · 9-24 – 9-30 比前 4 周", actions: [{ key: "v", label: "查看", onSelect: drill("效果图") }] },
    { key: "b", icon: <TriangleAlert />, tone: "danger", title: "旅游 · 进线骤降", detail: "近 3 天 9 位，往常日均 11 位；官网表单来源掉得最多", actions: [{ key: "v", label: "查看", onSelect: drill("旅游") }] },
    { key: "c", icon: <Hourglass />, tone: "attention", title: "旅游 · 成交进度落后时间 1.8pp", detail: "已达 13.2%，时间进度 15.0%", actions: [{ key: "v", label: "查看", onSelect: drill("旅游") }] },
    { key: "d", icon: <Info />, tone: "info", title: "智能家居 · LINE 进线占比 26% → 33%", detail: "会拉低合计转化；各来源自己都在变好" },
    { key: "e", icon: <Inbox />, tone: "info", title: "软件定制 · 6 位新客户节后待分配", detail: "假期不算首响时间" },
  ];
  return (
    <>
      <PageHeader title="看板部件" description="子弹图 + 时间进度、分步漏斗、cohort 表、目标柱、汇总卡、占位指标、进度环（只给手机个人进度）。照 D30 / D31 / D29m 样稿摆的真实内容。" />
      <PageBody>
        <DashboardSection title="业务线经营：比目标差多少、哪个阶段在漏" description="D30 · 销售经理 · 本月至今（已过 3 / 20 个工作日）比上月同期日均；T+1 定稿">
          <KpiGrid>
            <KpiCard title="成交额" tag={["北极星", { label: "进行中", tone: "info" }]} value="¥204.0" unit="万" target={{ value: 204, target: 1200, format: ntWan }} timeProgress={0.15} detail="目标 ¥1,200 万 · 已达 17.0% · 时间进度 15.0%" delta={rel(204 / 3, 1248 / 20 * 0.92)} comparison="日均比 9 月同期" definition="成交口径（签约 / 订金 / 全款）待和财务模块一起定；金额以财务为准。" />
            <KpiCard title="30 天成交转化" value="9.9" unit="%" detail="8 月进线 31 / 312" delta={pp(0.099, 0.087)} comparison="比 7 月同天龄" trend={[8.1, 8.6, 8.3, 8.7, 9.9]} trendPlacement="inline" />
            <KpiCard title="赢单率" value="39" unit="%" detail="成交 9 ÷（成交 9 + 丢单 14）" delta={pp(0.39, 0.35)} comparison="比上月同期" trend={[33, 36, 34, 37, 35, 39]} trendPlacement="inline" />
            <KpiCard title="成交周期" value="34" unit="天 · 中位" detail="P90 71 天 · 还在跟进 186 位" delta={abs(34, 38, "down")} comparison="比上月同期" trend={[41, 39, 40, 38, 36, 34]} trendPlacement="inline" />
          </KpiGrid>
          <div style={grid3}>
            <Panel title="客户卡在哪一步" count="8 月进线 · 30 天读数" description="阶段转化率 = 进入下一步的客户 ÷ 进入这一步的客户。按进线批次在固定天龄读数，不用「本月成交 ÷ 本月进线」。">
              <StepFunnel steps={FUNNEL} label="8 月进线客户卡在哪一步" comparison="比 7 月同天龄" firstNote="这批进线的客户" />
            </Panel>
            <Panel title="每批进线最后成交多少" count="进线后 N 天内成交" description="cohort 成交转化：进线后 N 天内成交的客户 ÷ 这批进线客户。不到 N 天的批次不出数。">
              <CohortTable label="各月进线批次在 7 / 30 / 60 / 90 天的成交转化" rowHeader="进线月" periods={["7 天", "30 天", "60 天", "90 天"]} rows={COHORT} />
              <p className="aui-note">「未到期」= 还没到这个天龄，不算 0 · 只拿同天龄比</p>
            </Panel>
            <Panel title="每月成交额" count="万元 · 横线 = 当月目标">
              <TargetBars input={MONTHS} label="每月成交额和当月目标，10 月进行中" height={200} active={active} />
            </Panel>
          </div>
        </DashboardSection>

        <DashboardSection title="老板总览：各子公司、各业务线离目标多远" description="D31 · 老板 · 本月至今比去年同期（相差 364 天）；各业务线卡显示原币，集团合计折 CNY">
          <KpiGrid>
            <KpiCard title="集团成交额 · 折 CNY" tag={["北极星", { label: "进行中", tone: "info" }]} value="¥304.1" unit="万" target={{ value: 304.1, target: 2756, format: ntWan }} detail="目标 ¥2,756 万 · 已达 11.0%" delta={rel(304.1, 257.7)} comparison="比去年同期" />
            <KpiCard title="进线" value="123" unit="位" detail="华南 70 · 华东 53" delta={rel(123, 108)} comparison="比去年同期" trend={[96, 104, 99, 112, 108, 123]} trendPlacement="inline" />
            <KpiCard title="按时有效跟进率" value="75" unit="%" detail="1,180 / 1,573 个到期计划" delta={pp(0.75, 0.7)} comparison="比去年同期" trend={[70, 71, 73, 72, 74, 75]} trendPlacement="inline" />
            <KpiCard title="应收逾期" value={null} placeholder="财务模块上线后显示" footnote="口径以财务账本为准" />
          </KpiGrid>
          <div style={grid3}>
            <Panel title="华南子公司" count="¥290.0 万 / 目标 1,850 万 · 15.7%" flush>
              <RollupCard title="智能家居" value="¥204.0" unit="万" targetText="/ 目标 1,200 万 · 已达 17.0%" delta={rel(204, 167)} comparison="比去年同期" bullet={{ value: 204, target: 1200, timeProgress: 0.15 }} metrics={[m("in", "进线", "61", "位", rel(61, 53)), m("ontime", "按时有效跟进率", "72", "%", pp(0.72, 0.68)), m("resp", "首响中位", "22", "分", abs(22, 27, "down"), undefined, "分"), AR]} onDrill={drill("智能家居 · 业务线经营")} drillLabel="进入业务线经营" />
              <RollupCard title="旅游" anomaly="进线骤降" value="¥86.0" unit="万" targetText="/ 目标 650 万 · 已达 13.2%" delta={rel(86, 94.5)} comparison="比去年同期" bullet={{ value: 86, target: 650, timeProgress: 0.15 }} metrics={[m("in", "进线", "9", "位", rel(9, 31)), m("ontime", "按时有效跟进率", "81", "%", pp(0.81, 0.79)), m("resp", "首响中位", "9", "分", abs(9, 9, "down")), AR]} onDrill={drill("旅游 · 业务线经营")} drillLabel="进入业务线经营" />
            </Panel>
            <Panel title="华东子公司" count="¥ 3.2 万 / 目标 205 万 · 1.6%" flush>
              <RollupCard title="效果图" note={<><CalendarDays size={13} aria-hidden="true" /> 按中国大陆日历：国庆假期中，本月已过 0 个工作日；节后再看进度</>} anomaly="首响变慢" value="¥ 3.2" unit="万" targetText="/ 目标 85 万 · 已达 3.8%" delta={rel(3.2, 3)} comparison="比去年同期" bullet={{ value: 3.2, target: 85, timeProgress: 0, expectedLabel: "工作日进度 0%（假期）" }} metrics={[m("in", "进线", "47", "位", rel(47, 42)), m("ontime", "按时有效跟进率", "88", "%", pp(0.88, 0.9)), m("resp", "首响中位", "46", "分", abs(46, 25, "down"), undefined, "分"), AR]} onDrill={drill("效果图 · 业务线经营")} drillLabel="进入业务线经营" />
              <RollupCard title="软件定制" value="¥ 0" unit="万" targetText="/ 目标 120 万 · 已达 0.0%" delta={rel(0, 0)} comparison="比去年同期" bullet={{ value: 0, target: 120, timeProgress: 0, expectedLabel: "工作日进度 0%（假期）" }} metrics={[m("in", "进线", "6", "位", abs(6, 5), undefined, "位"), m("ontime", "按时有效跟进率", null, "", undefined, "假期无到期计划"), m("resp", "首响中位", null, "", undefined, "节后待分配"), AR]} onDrill={drill("软件定制 · 业务线经营")} drillLabel="进入业务线经营" />
            </Panel>
            <TodoInbox title="异常" items={anomalies} description="偏离最多的排前面；只放需要老板知道的，个人排名不放这里" />
          </div>
        </DashboardSection>

        <DashboardSection title="我的今天（手机）：个人进度用进度环" description="D29m · 销售本人 · 手机首页。只有这种个人进度用 ProgressRing，其它地方一律用子弹图。">
          <div style={{ display: "grid", gap: 12, maxWidth: 390 }}>
            <Panel>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <ProgressRing value={7} max={12} target={9.6} label="已按时有效跟进" />
                <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                  <b>已按时有效跟进</b>
                  <span className="aui-note">今天到期 12 位（含逾期 1），还差 5 位</span>
                  <span className="aui-note">目标 80%：再跟 3 位就到</span>
                  <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <DeltaBadge delta={pp(0.58, 0.55)} comparison="比近 4 周周一中位" size="sm" />
                    <span className="aui-note">比近 4 周周一中位</span>
                  </span>
                </div>
              </div>
            </Panel>
            <StatStrip
              label="我的今天"
              items={[
                { key: "call", label: "有效通话", value: "9", unit: "次 · 42 分", note: "比上周一 +1 次", noteTone: "brand" },
                { key: "new", label: "新领客户", value: "2", unit: "位", note: "比上周一 持平" },
                { key: "late", label: "逾期客户", value: "1", unit: "位", tone: "danger", note: "比上周一 +1", noteTone: "danger" },
              ]}
            />
            <Button size="lg" onClick={() => notify("写跟进（演示）")}><Phone />写跟进</Button>
          </div>
        </DashboardSection>
      </PageBody>
    </>
  );
}
