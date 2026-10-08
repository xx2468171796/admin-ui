import { useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button, PopoverPanel } from "@adminui/react";
import { CalendarSettings, GanttSettings, ViewSettingsFooter, countSettingChanges, type CalendarConfig, type GanttSettingsValue } from "@adminui/react/views";
import { DEAL_FIELDS } from "../../data/views-data";

const CALENDARS = [{ id: "cn", label: "中国大陆" }, { id: "none", label: "不用节假日" }];
const SHARED_GANTT: GanttSettingsValue = {
  startField: "kickoff",
  endMode: "field",
  endField: "golive",
  workdaysOnly: true,
  titleField: "name",
  extraFields: [],
  listFields: ["name", "ownerName", "kickoff", "golive"],
  colorField: "stage",
  scale: "month",
  calendarId: "cn",
  timeZone: "Asia/Shanghai",
  groups: [{ field: "ownerName", order: "asc" }],
  showEmptyGroups: false,
};
const SHARED_CAL: CalendarConfig = { startField: "meetingAt", endField: null, colorField: "stage", weekStart: 1, calendarId: "cn" };

/** 甘特设置（780 宽两栏）和日历设置：同一个骨架 —— 标题写视图名和档位，分节，左标签右控件，底栏固定。 */
export function Demo() {
  const ganttBtn = useRef<HTMLButtonElement>(null);
  const calBtn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<"gantt" | "calendar" | null>(null);
  const [gantt, setGantt] = useState(SHARED_GANTT);
  const [calendar, setCalendar] = useState(SHARED_CAL);
  const close = () => setOpen(null);

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Button ref={ganttBtn} variant="outline" aria-expanded={open === "gantt"} onClick={() => setOpen(open === "gantt" ? null : "gantt")}>
        <SlidersHorizontal aria-hidden="true" />
        甘特设置
      </Button>
      <Button ref={calBtn} variant="outline" aria-expanded={open === "calendar"} onClick={() => setOpen(open === "calendar" ? null : "calendar")}>
        日历设置
      </Button>
      <PopoverPanel
        open={open === "gantt"}
        anchor={ganttBtn.current}
        onClose={close}
        title="甘特设置 · 实施排期（共享视图）"
        width={780}
        sheet
        footer={<ViewSettingsFooter changes={countSettingChanges(SHARED_GANTT, gantt)} onReset={() => setGantt(SHARED_GANTT)} onSaveAsNew={close} />}
      >
        <GanttSettings fields={DEAL_FIELDS} value={gantt} onChange={setGantt} calendars={CALENDARS} timeZones={[{ value: "Asia/Shanghai", label: "(UTC+08:00) 北京" }]} />
      </PopoverPanel>
      <PopoverPanel
        open={open === "calendar"}
        anchor={calBtn.current}
        onClose={close}
        title="日历设置 · 跟进日历（标准视图）"
        width={440}
        sheet
        footer={<ViewSettingsFooter changes={countSettingChanges(SHARED_CAL, calendar)} onReset={() => setCalendar(SHARED_CAL)} onSaveAsNew={close} />}
      >
        <CalendarSettings fields={DEAL_FIELDS} value={calendar} onChange={setCalendar} calendars={CALENDARS} />
      </PopoverPanel>
    </div>
  );
}
