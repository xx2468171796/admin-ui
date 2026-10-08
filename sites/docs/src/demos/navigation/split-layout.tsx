// SplitLayout：主栏 + 右侧 340px 小卡片栏，1100px 以下叠成一列。工作台首页、详情页的「旁边信息」用它。
import { Panel, SplitLayout, StatusBadge } from "@adminui/react";
import { CUSTOMERS, stageLabel } from "../../data/demo-data";

export function Demo() {
  return (
    <SplitLayout
      rail={
        <>
          <Panel title="本周目标" count="62%">
            <p className="aui-note">已签 ¥1,240,000 / 目标 ¥2,000,000。</p>
          </Panel>
          <Panel title="快捷入口">
            <p className="aui-note">新建客户 · 导入名单 · 发起报价</p>
          </Panel>
        </>
      }
    >
      <Panel title="最近更新的客户" count={`${CUSTOMERS.slice(0, 5).length} 个`}>
        <ul style={{ display: "grid", gap: 8, margin: 0, padding: 0, listStyle: "none" }}>
          {CUSTOMERS.slice(0, 5).map((c) => (
            <li key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span>{c.name}</span>
              <StatusBadge variant="dot">{stageLabel(c.stage)}</StatusBadge>
            </li>
          ))}
        </ul>
      </Panel>
    </SplitLayout>
  );
}
