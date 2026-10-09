import { useMemo, useState } from "react";
import { Panel } from "@adminui/react";
import { BitableGrid, type GridCellChange, type GridField, type GridSelectOption } from "@adminui/react/grid";

type Task = { id: string; title: string; status: string; due: string | null };

/** A day relative to today, as YYYY-MM-DD in the browser's zone. */
const day = (offset: number) => {
  const d = new Date(Date.now() + offset * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const START_STATUS: GridSelectOption[] = [
  { value: "todo", label: "待处理", tone: "gray" },
  { value: "doing", label: "进行中", tone: "blue" },
  { value: "done", label: "已完成", tone: "green" },
];

const START: Task[] = [
  { id: "t1", title: "续签合同盖章", status: "doing", due: day(-3) },
  { id: "t2", title: "确认上线时间", status: "todo", due: day(0) },
  { id: "t3", title: "发送培训材料", status: "todo", due: day(2) },
  { id: "t4", title: "回访使用情况", status: "todo", due: day(9) },
  { id: "t5", title: "归档验收单", status: "done", due: day(-6) },
];

/**
 * 截止日期和格子里新建选项。「截止」是 deadline：逾期红字 +「逾期 N 天」，今天 / 2 天内橙字，「已完成」的不提醒。
 * 双击「状态」，输入一个不存在的名字（例如「等对方回复」）→ 最后一行「+ 新建选项」，回车就建好并选上；名字里带「失败」会被拒绝。
 */
export function Demo() {
  const [rows, setRows] = useState<readonly Task[]>(START);
  const [status, setStatus] = useState<readonly GridSelectOption[]>(START_STATUS);
  // 字段引用保持稳定：只在选项变了时重建
  const fields = useMemo((): GridField<Task>[] => [
    { key: "title", title: "任务", type: "text", primary: true, width: 180, editable: true },
    {
      key: "status",
      title: "状态",
      type: "singleSelect",
      options: status,
      width: 130,
      editable: true,
      onCreateOption: async (label) => {
        await new Promise((resolve) => window.setTimeout(resolve, 400));
        if (label.includes("失败")) throw new Error("演示：这个名字不能用");
        const option: GridSelectOption = { value: `s${Date.now()}`, label, tone: "violet" };
        setStatus((list) => [...list, option]);
        return option;
      },
    },
    { key: "due", title: "截止", type: "date", editable: true, deadline: { closed: (row) => row.status === "done" } },
  ], [status]);
  const save = (changes: GridCellChange<Task>[]) => {
    setRows((list) => list.map((row) => changes.filter((c) => c.rowId === row.id).reduce((r, c) => ({ ...r, [c.field]: c.value }), row)));
  };
  return (
    <Panel title="本周待办" count={`${rows.length} 项`} flush>
      <BitableGrid caption="本周待办" rows={rows} getRowId={(r) => r.id} fields={fields} onCellsChange={save} height="auto" toolbar={false} summary={false} expandRecord={false} />
    </Panel>
  );
}
