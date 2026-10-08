import { useMemo } from "react";
import { Panel, chartColors, useAdminTheme } from "@adminui/react";
import { AdminChart, stackedBarOption } from "@adminui/react/charts";
import { MONTHS, PLANS, SEATS_BY_PLAN } from "../../data/charts-data";

/**
 * 色板跟着色卡和深浅走：在页面右上角换色卡 / 深色，色块和图一起变。
 * 构造器里只写 token（vizCategory / VIZ_BRAND），AdminChart 用 chartColors(palette) 换成当前颜色。
 */
export function Demo() {
  const { palette } = useAdminTheme();
  const colors = useMemo(() => chartColors(palette), [palette]);
  const option = useMemo(
    () => stackedBarOption({ categories: [...MONTHS], series: PLANS.map((p) => ({ name: p, values: SEATS_BY_PLAN[p] })), unit: "个" }),
    [],
  );
  const rows: { label: string; list: readonly string[] }[] = [
    { label: "类别（8 色，固定顺序）", list: colors.categorical },
    { label: "单系列 · 其他", list: [colors.brand, colors.other] },
    { label: "状态（配图标或文字）", list: [colors.status.good, colors.status.warning, colors.status.bad, colors.status.neutral] },
  ];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((row) => (
          <div key={row.label} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span className="aui-note" style={{ width: 150 }}>{row.label}</span>
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {row.list.map((c, i) => <span key={`${c}-${i}`} aria-hidden="true" style={{ width: 36, height: 22, borderRadius: 6, background: c }} />)}
            </span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="aui-note" style={{ width: 150, flexShrink: 0 }}>顺序（面板色 → 主色）</span>
          <span style={{ display: "flex", gap: 2, flex: 1, minWidth: 0 }}>
            {colors.sequential.map((c, i) => <span key={i} style={{ flex: 1, height: 16, borderRadius: 4, background: c }} />)}
          </span>
        </div>
      </div>
      <Panel title="各套餐付费席位" count="按套餐堆叠 · 个">
        <AdminChart option={option} label="各套餐付费席位" height={240} />
      </Panel>
    </div>
  );
}
