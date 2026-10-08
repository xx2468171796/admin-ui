import { useState } from "react";
import { CalendarWeek, type CalendarEvent, type DayKey } from "@adminui/react/views";
import { TIME_ZONE, TODAY, WORK_CALENDAR } from "../../data/views-data";

const at = (day: string, time: string) => `${day}T${time}:00+08:00`;
const INITIAL: CalendarEvent[] = [
  { id: "e1", title: "远航精密 · 需求访谈", start: at("2026-10-08", "09:30"), end: at("2026-10-08", "11:00"), tone: "blue", badge: "已确认需求" },
  { id: "e2", title: "青禾教育 · 方案演示", start: at("2026-10-08", "10:00"), end: at("2026-10-08", "11:30"), tone: "violet", badge: "方案报价" },
  { id: "e3", title: "星河物流 · 合同评审", start: at("2026-10-09", "14:00"), end: at("2026-10-09", "15:00"), tone: "orange", badge: "商务谈判" },
  { id: "e4", title: "云杉医疗 · 上线回访", start: at("2026-10-10", "16:00"), end: at("2026-10-10", "16:30"), tone: "green", badge: "赢单" },
  { id: "e5", title: "华东区季度复盘", start: "2026-10-08", end: "2026-10-09", tone: "gray", badge: "团队", editable: false },
  { id: "e6", title: "启明零售 · 实施", start: "2026-10-09", end: "2026-10-13", tone: "teal", badge: "实施" },
];

/** 周视图：上下拖改时间、左右拖换天、拉底边改时长；「现在」是主色线；10-10 是宿主给的调休上班日。 */
export function Demo() {
  const [events, setEvents] = useState(INITIAL);
  const [date, setDate] = useState<DayKey>(TODAY);
  return (
    <div style={{ height: 560 }}>
      <CalendarWeek
        label="本周日程"
        events={events}
        date={date}
        onNavigate={setDate}
        timeZone={TIME_ZONE}
        today={TODAY}
        now={Date.parse(at(TODAY, "10:42"))}
        workCalendar={WORK_CALENDAR}
        onDateChange={(id, start, end) => setEvents((all) => all.map((e) => (e.id === id ? { ...e, start, end } : e)))}
      />
    </div>
  );
}
