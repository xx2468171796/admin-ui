import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, CalendarButton, DatePicker, FormField, QuickDatePresets } from "@adminui/react";

const now = () => new Date(2026, 9, 8, 10, 0);
const shortDay = (day: string) => `${day.slice(5, 7)}-${day.slice(8)}`;

/** 跟进 / 提醒类字段在框下加「1 天 / 3 天 / 7 天」；只要一个按钮选日子时用 CalendarButton。 */
export function Demo() {
  const [follow, setFollow] = useState("");
  const [days, setDays] = useState<string[]>(["2026-10-10"]);
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 420 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <FormField label="下次跟进" htmlFor="dq-follow">
          <DatePicker id="dq-follow" value={follow} onChange={setFollow} deadline clearable placeholder="选择日期" now={now} />
        </FormField>
        <QuickDatePresets label="快捷跟进日期" type="date" days={[1, 3, 7]} onPick={(v) => setFollow(v)} now={now} />
      </div>
      <FormField label="补班日" htmlFor="dq-extra" hint="可以连续添加多天">
        <span role="list" aria-label="已添加的补班日" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          {days.map((d) => (
            <Button key={d} role="listitem" size="sm" variant="secondary" aria-label={`移除 ${d}`} onClick={() => setDays((list) => list.filter((x) => x !== d))}>
              {shortDay(d)}
              <X aria-hidden="true" />
            </Button>
          ))}
          <CalendarButton id="dq-extra" label="添加补班日" size="sm" variant="outline" isDisabledDate={(d) => days.includes(d)} onSelect={(d) => setDays((list) => [...list, d].sort())} now={now}>
            <Plus aria-hidden="true" />添加
          </CalendarButton>
        </span>
      </FormField>
    </div>
  );
}
