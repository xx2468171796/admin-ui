import { useState } from "react";
import { DateRangePicker, FormField, dateRangePresets } from "@adminui/react";

const NOW = new Date(2026, 9, 8, 10, 0);
const now = () => NOW;
const PRESETS = dateRangePresets(["today", "yesterday", "thisWeek", "lastWeek", "thisMonth", "last7", "last30"], { now: NOW });

/** 范围：左边常用区间，两个月并排（手机一个月），先点开始再点结束，悬停预览，顺序反了自动对调。 */
export function Demo() {
  const [range, setRange] = useState({ from: "2026-10-01", to: "2026-10-07" });
  return (
    <div style={{ maxWidth: 420 }}>
      <FormField label="报表区间" htmlFor="dr-range" hint="最多看 1 年">
        <DateRangePicker id="dr-range" aria-label="报表区间" value={range} onChange={setRange} presets={PRESETS} min="2025-10-08" max="2026-10-08" clearable now={now} />
      </FormField>
    </div>
  );
}
