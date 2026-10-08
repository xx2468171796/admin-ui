// 放不下：两头渐隐、滚轮横着滚，右端「更多 ⌄」列出全部分区；不用压在字上的圆箭头。
// size="sm"（36px）用在栏 / 卡片里。
import { useState } from "react";
import { Tabs } from "@adminui/react";

const SECTIONS = ["资料", "跟进", "商机", "报价单", "合同", "回款", "工单", "续约", "附件", "操作记录"];

export function Demo() {
  const [tab, setTab] = useState("合同");
  return (
    <div style={{ display: "grid", gap: 24, maxWidth: 480 }}>
      <Tabs label="客户分区" value={tab} onValueChange={setTab} items={SECTIONS.map((s) => ({ value: s, label: s, count: s === "跟进" ? 28 : undefined }))} />
      <Tabs size="sm" label="客户分区（栏里）" value={tab} onValueChange={setTab} items={SECTIONS.map((s) => ({ value: s, label: s }))} />
      <p className="aui-note">当前分区：{tab}</p>
    </div>
  );
}
