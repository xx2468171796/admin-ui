import { useState } from "react";
import { DashboardFilterBar, encodeFilterContext, useNotify, type DashboardFilterValue } from "@adminui/react";
import { COMPARE_OPTIONS, DEFAULT_FILTERS, DIMENSIONS, TIME_OPTIONS } from "../../data/charts-data";

/**
 * 看板筛选行：时间分段 · 对比（每项一句说明）· 维度胶囊（有值 = 浅主色底 + ×）· 改过才出「重置」。
 * 整个状态是一个 DashboardFilterValue；真实页面用 useDashboardFilters 写进地址栏。手机上收成「筛选 · n」底部弹层。
 */
export function Demo() {
  const notify = useNotify();
  const [value, setValue] = useState<DashboardFilterValue>(DEFAULT_FILTERS);
  const query = encodeFilterContext(value, DEFAULT_FILTERS).toString();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }}>
      <DashboardFilterBar
        value={value}
        onChange={setValue}
        defaultValue={DEFAULT_FILTERS}
        timeOptions={TIME_OPTIONS}
        compareOptions={COMPARE_OPTIONS}
        compareNote="10-01 ~ 10-07 是假期，自动改比上月同样的工作日"
        dimensions={DIMENSIONS}
        unapplied={value.dims.owner ? ["负责人（日活图不按人统计）"] : undefined}
        onSaveMine={async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          notify("已保存为你打开这个看板时的默认筛选", "success");
        }}
      />
      <p className="aui-note">地址栏参数：{query ? `?${query}` : "（标准筛选，不写参数）"}</p>
    </div>
  );
}
