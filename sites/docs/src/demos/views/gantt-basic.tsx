import { useMemo, useState } from "react";
import { useNotify } from "@adminui/react";
import { GanttView, type GanttConfig, type GanttGroup } from "@adminui/react/views";
import { DEAL_FIELDS, TIME_ZONE, TODAY, WORK_CALENDAR, initialDeals, type Deal } from "../../data/views-data";

const CONFIG: GanttConfig = {
  startField: "kickoff",
  endMode: "field",
  endField: "golive",
  workdaysOnly: true,
  titleField: "name",
  listFields: ["name", "ownerName", "kickoff", "golive"],
  colorField: "stage",
  scale: "month",
};

/**
 * 实施排期：宿主按负责人分好组再传进来。拖条形整体移动，先点选再拖两端改起止；
 * 只算工作日时跳过周末和节假日。赢单的记录锁住（canEdit），不能拖。
 */
export function Demo() {
  const notify = useNotify();
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const groups = useMemo<GanttGroup<Deal>[]>(() => {
    const scheduled = deals.filter((d) => d.kickoff);
    const owners = [...new Set(scheduled.map((d) => d.ownerName))];
    return owners.map((o) => ({ key: o, label: o, person: true, records: scheduled.filter((d) => d.ownerName === o) }));
  }, [deals]);

  return (
    <div style={{ height: 480 }}>
      <GanttView
        label="实施排期"
        fields={DEAL_FIELDS}
        config={CONFIG}
        groups={groups}
        recordId={(r) => r.id}
        timeZone={TIME_ZONE}
        today={TODAY}
        workCalendar={WORK_CALENDAR}
        milestones={[{ day: "2026-10-16", label: "季度结算" }]}
        canEdit={(r) => r.stage !== "won"}
        onDateChange={async (id, change) => {
          await new Promise((r) => setTimeout(r, 200));
          setDeals((list) => list.map((d) => (d.id === id ? { ...d, kickoff: change.start, golive: change.end } : d)));
          notify(`已改为 ${change.start} → ${change.end} · ${change.duration} 个工作日`, "success");
        }}
        onOpen={(r) => notify(`打开「${r.name}」`, "info")}
        onAddRow={() => notify("新增一行", "info")}
      />
    </div>
  );
}
