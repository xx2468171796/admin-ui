import { useState } from "react";
import { DatePicker, DateTimePicker, FormField, TimeInput } from "@adminui/react";

const now = () => new Date(2026, 9, 8, 10, 0);

/** 日期 + 时间：月历右边半小时一档的时间列；纯时间用 TimeInput（↑ ↓ 按步长调）；禁用日和最早日期。 */
export function Demo() {
  const [visit, setVisit] = useState("2026-10-12T14:30");
  const [remind, setRemind] = useState("09:00");
  const [install, setInstall] = useState("");
  const isSunday = (day: string) => new Date(`${day}T00:00:00`).getDay() === 0;
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 360 }}>
      <FormField label="上门时间" htmlFor="dt-visit" hint="15 分钟一档，只能约今天之后">
        <DateTimePicker id="dt-visit" value={visit} onChange={setVisit} min="2026-10-08T09:00" minuteStep={15} clearable now={now} />
      </FormField>
      <FormField label="每日提醒" htmlFor="dt-remind" hint="↑ ↓ 每次 5 分钟">
        <TimeInput id="dt-remind" value={remind} onChange={setRemind} minuteStep={5} />
      </FormField>
      <FormField label="安装日期" htmlFor="dt-install" hint="周日不派单，不能早于今天">
        <DatePicker id="dt-install" value={install} onChange={setInstall} min="2026-10-08" isDisabledDate={isSunday} clearable placeholder="选择安装日期" now={now} />
      </FormField>
    </div>
  );
}
