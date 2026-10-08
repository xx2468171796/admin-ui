import { HelpTip } from "@adminui/react";

/** 标题旁的「?」：悬停 / 聚焦打开说明卡，点一下钉住，点外面或 Esc 关；卡片从「?」下方左对齐弹出。 */
export function Demo() {
  const title = { display: "flex", alignItems: "center", gap: 4, margin: 0 } as const;
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <h3 className="aui-text-card" style={title}>
        客户质量
        <HelpTip label="客户质量说明" title="客户质量怎么算" more={{ href: "https://example.com/docs/quality", external: true }}>
          按最近 90 天的跟进次数、成交金额和续费情况打分，每天凌晨更新一次。
        </HelpTip>
      </h3>
      <h3 className="aui-text-card" style={title}>
        公海规则
        <HelpTip label="公海规则说明">超过 30 天没有跟进的客户自动回到公海，任何销售都可以领取。</HelpTip>
      </h3>
    </div>
  );
}
