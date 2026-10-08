import { useMemo, useState } from "react";
import { useNotify } from "@adminui/react";
import { CalendarMonth, CalendarWeek, type CalendarEvent, type CalendarMode, type CalendarUndatedItem, type DayKey } from "@adminui/react/views";
import { STAGE_LEGEND, TIME_ZONE, TODAY, WORK_CALENDAR, initialDeals, stageLabel, stageTone, type Deal } from "../../data/views-data";

/**
 * 跟进日历：事件按「阶段」着色；定时 = 色点 + 时间，赢单的实施期 = 跨天软底条。
 * 拖事件改日期，从「无日期」抽屉拖到某一天 = 设会议时间；节假日由宿主传 workCalendar。
 */
export function Demo() {
  const notify = useNotify();
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [date, setDate] = useState<DayKey>(TODAY);
  const [mode, setMode] = useState<CalendarMode>("month");

  const events = useMemo<CalendarEvent[]>(() => {
    const list: CalendarEvent[] = [];
    for (const d of deals) {
      const details = [{ label: "负责人", value: d.ownerName }, { label: "城市", value: d.city }];
      if (d.meetingAt) list.push({ id: d.id, title: d.name, start: d.meetingAt, tone: stageTone(d.stage), badge: stageLabel(d.stage), details });
      if (d.kickoff && d.stage === "won") list.push({ id: `impl-${d.id}`, title: `${d.name} · 实施`, start: d.kickoff, end: d.golive, tone: "teal", badge: "实施", details });
    }
    return list;
  }, [deals]);
  const undated = useMemo<CalendarUndatedItem[]>(
    () => deals.filter((d) => !d.meetingAt).map((d) => ({ id: d.id, title: d.name, badge: stageLabel(d.stage), tone: stageTone(d.stage), person: d.ownerName })),
    [deals],
  );

  const changeDate = async (id: string, start: string, end: string | null) => {
    await new Promise((r) => setTimeout(r, 200));
    setDeals((list) =>
      list.map((d) => {
        if (`impl-${d.id}` === id) return { ...d, kickoff: start, golive: end ?? start };
        if (d.id !== id) return d;
        // 从无日期拖进来只给了日子：宿主决定几点（这里放在上午 10 点）
        return { ...d, meetingAt: start.length === 10 ? `${start}T10:00:00+08:00` : start };
      }),
    );
  };

  const common = {
    events,
    date,
    onNavigate: setDate,
    label: "跟进日历",
    timeZone: TIME_ZONE,
    today: TODAY,
    workCalendar: WORK_CALENDAR,
    mode,
    onModeChange: setMode,
    legend: { title: "按「阶段」着色", items: STAGE_LEGEND },
    onDateChange: changeDate,
    onOpen: (id: string) => notify(`打开 ${id}`, "info"),
    onClearDate: (id: string) => setDeals((list) => list.map((d) => (d.id === id ? { ...d, meetingAt: null } : d))),
  };

  return (
    <div style={{ height: 600 }}>
      {mode === "month" ? (
        <CalendarMonth {...common} undated={undated} undatedHint="拖到某一天 = 设「会议时间」" onCreate={(day) => notify(`新建跟进：${day}`, "info")} />
      ) : (
        <CalendarWeek {...common} days={mode === "day" ? 1 : 7} now={Date.parse(`${TODAY}T10:42:00+08:00`)} onCreate={(start) => notify(`新建跟进：${start}`, "info")} />
      )}
    </div>
  );
}
