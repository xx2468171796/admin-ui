// 页内标签只用下划线：选中 = 深主色字 + 加粗 + 和字等宽的 2px 线；数量是灰色小胶囊（选中变主色浅底），
// 要处理的用异常色；不能用的分区灰掉。方向键 / Home / End 在标签之间移动。
import { useState } from "react";
import { Tabs } from "@adminui/react";

const CONTENT: Record<string, string> = {
  info: "基本资料：行业、城市、负责人、席位数。",
  follow: "28 条跟进记录，最近一条是昨天的电话回访。",
  deals: "3 个商机：续约、增购 40 席、培训服务。",
  late: "2 个待办已逾期，最早的一个逾期 5 天。",
};

export function Demo() {
  const [tab, setTab] = useState("follow");
  return (
    <Tabs
      label="客户分区"
      value={tab}
      onValueChange={setTab}
      items={[
        { value: "info", label: "资料" },
        { value: "follow", label: "跟进", count: 28 },
        { value: "deals", label: "商机", count: 3 },
        { value: "late", label: "逾期", count: 2, countTone: "danger" },
        { value: "archived", label: "已归档", disabled: true },
      ]}
    >
      <p className="aui-note" style={{ paddingTop: 16 }}>{CONTENT[tab]}</p>
    </Tabs>
  );
}
