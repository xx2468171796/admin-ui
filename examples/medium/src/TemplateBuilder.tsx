// bt/templates：T17 看板搭建器（样稿 D32）——图标栏（不带目录）+ DashboardBuilder 占满工作区：
// 顶栏（名字 ✎ · 我的看板 · 状态 · 数据范围提示 · 撤销 / 重做 · 预览 · 取消 · 另存为我的 · 保存）+ 看板筛选行
// + 三栏：左 组件库 | 中 6 列画布 | 右 选中组件的设置。地址 #template=t17（加 &dark 看深色）。
// 看板内容、数据源、指标字典和演示数据与「看板搭建」示例同一份（DashboardBuilderShowcase 的 WeeklyDashboardBuilder）。
import { useNotify, RailShell } from "@adminui/react";
import { WeeklyDashboardBuilder } from "./DashboardBuilderShowcase";
import { RAIL_FOOTER, RAIL_MODULES, accountOf, backToStarter } from "./template-rail";

export function TemplateBuilder() {
  const notify = useNotify();
  return (
    <RailShell brand="A" brandLabel="Acme · 回到首页" onBrandClick={backToStarter} modules={RAIL_MODULES} activeModule="home" onModuleChange={() => notify("演示：切换模块", "info")} footer={RAIL_FOOTER}
      account={accountOf("周主管", "一组", (what) => notify(`演示：${what}`, "info"))}>
      <WeeklyDashboardBuilder height="100%" />
    </RailShell>
  );
}
