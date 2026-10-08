import { DeltaBadge, DescriptionList, computeDelta } from "@adminui/react";

/**
 * 变化值的五种情况：变好（主色）· 变差（异常色）· 持平（灰底）· 从 0 增长（「新增」，不写 ∞%）· 没有基准（「—」）。
 * 颜色看「越大越好 / 越小越好」，不看箭头方向：响应时长下降是好事。
 */
export function Demo() {
  return (
    <DescriptionList
      columns={2}
      items={[
        { label: "签约金额 ↑ 越大越好", value: <DeltaBadge delta={computeDelta(128_000, 112_000)} comparison="比上月" />, hint: "比上月" },
        { label: "流失客户 ↑ 越小越好", value: <DeltaBadge delta={computeDelta(6, 4, { mode: "absolute", better: "down" })} unit="家" comparison="比上月" />, hint: "比上月" },
        { label: "响应时长 ↓ 越小越好", value: <DeltaBadge delta={computeDelta(42, 49, { mode: "absolute", better: "down" })} unit="分钟" comparison="比上周" />, hint: "比上周" },
        { label: "赢单率（百分点）", value: <DeltaBadge delta={computeDelta(0.298, 0.33, { mode: "points" })} comparison="比上季度" />, hint: "比上季度" },
        { label: "工单数 持平", value: <DeltaBadge delta={computeDelta(120, 120)} comparison="比昨天" />, hint: "比昨天" },
        { label: "试点客户 从 0 增长", value: <DeltaBadge delta={computeDelta(3, 0)} comparison="比上月" />, hint: "上月为 0" },
        { label: "续约率 没有基准", value: <DeltaBadge delta={null} comparison="比去年" />, hint: "去年还没有这项数据" },
        { label: "表格里用小号", value: <DeltaBadge size="sm" delta={computeDelta(53, 50)} comparison="比上周" /> },
      ]}
    />
  );
}
