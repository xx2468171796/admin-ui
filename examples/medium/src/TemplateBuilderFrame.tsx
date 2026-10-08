// bt/templates：T17 的搭建器框架 BuilderLayout（样稿 D32 的骨架）——给还没有现成搭建器的编辑器（以后的表单 / 报表）用：
// 图标栏 + 顶栏（名字 ✎ · 标签 · 数据范围提示 · 撤销 / 重做 · 预览 · 取消 · 保存）+ 筛选行 + 三栏：左 组件库 | 中 画布 | 右 设置。
// 地址 #template=t17-frame（加 &dark 看深色）。看板本身直接用 DashboardBuilder（#template=t17）；这里画布用 KpiCard / BarList / CompactTable 摆样子，只演示框架。
import { useState } from "react";
import { BarChart3, ChartLine, Copy, Eye, Filter, Hash, LayoutDashboard, Plus, Shield, Table2, Trash2, Type, X } from "lucide-react";
import {
  BarList,
  BuilderLayout,
  Button,
  Choice,
  CompactTable,
  FormField,
  InfoList,
  KpiCard,
  KpiGrid,
  Pane,
  PaneSection,
  Panel,
  RailShell,
  SearchField,
  SegmentedControl,
  StatusBadge,
  Tag,
  computeDelta,
  useNotify,
  IconButton,
} from "@adminui/react";
import type { GridField } from "@adminui/react/grid";
import { RAIL_FOOTER, RAIL_MODULES, accountOf, backToStarter } from "./template-rail";

type Late = { id: string; name: string; stage: string; owner: string; last: string; days: string };
const LATE: Late[] = [
  { id: "1", name: "何俊贤", stage: "二通", owner: "阿杰", last: "09-26", days: "9 天" },
  { id: "2", name: "刘建宏", stage: "报价", owner: "阿杰", last: "09-28", days: "7 天" },
  { id: "3", name: "陈雅婷", stage: "二通", owner: "小王", last: "09-29", days: "6 天" },
];
const LATE_FIELDS: GridField<Late>[] = [
  { key: "name", title: "客户", type: "text", primary: true },
  { key: "stage", title: "阶段", type: "text" },
  { key: "owner", title: "负责人", type: "text" },
  { key: "last", title: "最后有效跟进", type: "text" },
  { key: "days", title: "没跟进", type: "text" },
];
const KINDS = [
  { key: "kpi", label: "数字卡", icon: Hash },
  { key: "bar", label: "柱图", icon: BarChart3 },
  { key: "line", label: "折线", icon: ChartLine },
  { key: "funnel", label: "漏斗", icon: Filter },
  { key: "table", label: "表格", icon: Table2 },
  { key: "text", label: "文字说明", icon: Type },
];

export function TemplateBuilderFrame() {
  const notify = useNotify();
  const [title, setTitle] = useState("一组周会看板");
  const [steps, setSteps] = useState(3);
  const [redo, setRedo] = useState(0);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("10d");
  const [tab, setTab] = useState("data");
  const [metric, setMetric] = useState("valid");
  const [grain, setGrain] = useState("day");
  const [selected, setSelected] = useState(true);
  const say = (text: string) => () => notify(`演示：${text}`, "info");
  return (
    <RailShell brand="A" brandLabel="Acme · 回到首页" onBrandClick={backToStarter} modules={RAIL_MODULES} activeModule="home" onModuleChange={say("切换模块")} footer={RAIL_FOOTER}
      account={accountOf("周主管", "一组", (what) => notify(`演示：${what}`, "info"))}>
      <BuilderLayout
        title={title}
        onTitleChange={async (next) => { await new Promise((r) => setTimeout(r, 150)); setTitle(next); }}
        icon={<LayoutDashboard />}
        badges={<><Tag>我的看板</Tag><StatusBadge tone="warning">编辑中</StatusBadge></>}
        notice={<><Shield aria-hidden="true" />你只能看到你有权限的数据：一组 5 人</>}
        history={{ canUndo: steps > 0, canRedo: redo > 0, onUndo: () => { setSteps((n) => n - 1); setRedo((n) => n + 1); }, onRedo: () => { setSteps((n) => n + 1); setRedo((n) => n - 1); } }}
        actions={<>
          <Button variant="outline" onClick={say("预览")}><Eye />预览</Button>
          <Button variant="outline" onClick={say("放弃改动")}>取消</Button>
          <Button onClick={() => notify("已保存（演示）", "success")}>保存</Button>
        </>}
        filters={<>
          <SegmentedControl size="sm" label="时间" value={range} onValueChange={setRange} options={[{ value: "today", label: "今天" }, { value: "10d", label: "近 10 个工作日" }, { value: "month", label: "本月" }]} />
          <Choice label="对比" value="lastweek" onChange={say("改对比")} options={[{ value: "lastweek", label: "对比：上周同一天" }, { value: "none", label: "不对比" }]} />
          <Choice label="组" value="g1" onChange={say("改组")} options={[{ value: "g1", label: "组：一组" }, { value: "g2", label: "组：二组" }]} />
          <Button variant="ghost" size="sm" onClick={say("添加筛选")}>+ 添加筛选</Button>
        </>}
        library={
          <Pane title="添加组件" icon={<Plus />}>
            <div style={{ padding: "10px 12px 0" }}><SearchField size="sm" value={search} onChange={setSearch} placeholder="搜索组件、指标" /></div>
            <PaneSection title="图表">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {KINDS.map((k) => <Button key={k.key} variant="outline" size="sm" onClick={say(`添加「${k.label}」`)}><k.icon />{k.label}</Button>)}
              </div>
            </PaneSection>
            <PaneSection title="标准组件 · 口径来自指标字典">
              <InfoList label="标准组件" items={[
                { key: "rate", label: "按时有效跟进率", value: "数字卡" },
                { key: "today", label: "每个人今天的情况", value: "表格" },
                { key: "first", label: "新客户首次响应", value: "数字卡" },
                { key: "funnel", label: "客户卡在哪一步", value: "漏斗" },
              ]} />
            </PaneSection>
          </Pane>
        }
        config={selected ? (
          <Pane title="组件设置" actions={<IconButton label="关闭组件设置" onClick={() => setSelected(false)} icon={<X />} />}>
            <PaneSection title="柱图" actions={<SegmentedControl size="sm" label="设置分类" value={tab} onValueChange={setTab} options={[{ value: "data", label: "数据" }, { value: "style", label: "样式" }]} />}>
              <InfoList label="数据源" items={[{ key: "src", label: "数据源", value: "多维表格 · 跟进记录" }]} />
            </PaneSection>
            <PaneSection title="指标">
              <FormField label="指标" htmlFor="tpl-metric"><Choice id="tpl-metric" label="指标" value={metric} onChange={setMetric} options={[{ value: "valid", label: "有效跟进数" }, { value: "rate", label: "按时有效跟进率" }]} /></FormField>
              <FormField label="时间粒度" htmlFor="tpl-grain"><SegmentedControl size="sm" label="时间粒度" value={grain} onValueChange={setGrain} options={[{ value: "hour", label: "小时" }, { value: "day", label: "天" }, { value: "week", label: "周" }, { value: "month", label: "月" }]} /></FormField>
            </PaneSection>
          </Pane>
        ) : null}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <KpiGrid>
            <KpiCard title="有效跟进 · 今天" value={40} unit="条" delta={computeDelta(40, 36)} comparison="比 9-21 同时段" />
            <KpiCard title="按时有效跟进率 · 今天" value={65} unit="%" delta={computeDelta(0.65, 0.71, { mode: "points" })} comparison="比 9-21 同时段" />
            <KpiCard title="上门次数" value={14} unit="次" delta={computeDelta(14, 11)} comparison="近 10 个工作日 · 比前 10 个" />
          </KpiGrid>
          <Panel title="本月客户推进 · 一组" actions={<><Button variant="ghost" size="sm" onClick={say("复制组件")}><Copy />复制</Button><Button variant="ghost" size="sm" onClick={say("删除组件")}><Trash2 />删除</Button></>}>
            <BarList label="本月客户推进" items={[
              { key: "1", label: "首次接触", ratio: 1, value: 41 },
              { key: "2", label: "需求确认", ratio: 26 / 41, value: "26 · 63%" },
              { key: "3", label: "报价", ratio: 14 / 41, value: "14 · 54%" },
              { key: "4", label: "成交", ratio: 4 / 41, value: "4 · 29%" },
            ]} />
          </Panel>
          <Panel title="逾期客户" count="多维表格 · 客户" flush>
            <CompactTable caption="逾期客户" rows={LATE} getRowId={(r) => r.id} fields={LATE_FIELDS} />
          </Panel>
          <Button variant="outline" onClick={say("把组件拖到这里")}>+ 把组件拖到这里</Button>
        </div>
      </BuilderLayout>
    </RailShell>
  );
}
