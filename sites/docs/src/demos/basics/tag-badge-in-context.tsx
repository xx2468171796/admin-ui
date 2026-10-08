import { useState } from "react";
import { CellTags, ChipGroup, StatusBadge } from "@adminui/react";
import { CUSTOMERS, STAGES, stageLabel } from "../../data/demo-data";

type Filter = "all" | "active" | "stopped";

/** 快捷筛选块这里当单选用（点哪个选哪个）。表格里状态只用「圆点 + 字」，选项值用选项颜色的软方块；上方快捷筛选块选中 = 主色边 + 浅底。 */
export function Demo() {
  const [filter, setFilter] = useState<Filter[]>(["all"]);
  const rows = CUSTOMERS.slice(0, 6).filter((c) => (filter.includes("active") ? c.active : filter.includes("stopped") ? !c.active : true));
  const tone = (stage: string) => STAGES.find((s) => s.value === stage)?.tone ?? "gray";
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <ChipGroup<Filter>
        label="快捷筛选"
        value={filter}
        onValueChange={(next) => setFilter([next.find((v) => !filter.includes(v)) ?? filter[0] ?? "all"])}
        options={[
          { value: "all", label: "全部", count: 6 },
          { value: "active", label: "启用中", count: CUSTOMERS.slice(0, 6).filter((c) => c.active).length },
          { value: "stopped", label: "已停用", count: CUSTOMERS.slice(0, 6).filter((c) => !c.active).length },
        ]}
      />
      <div role="list" aria-label="客户" style={{ display: "grid", gap: 8 }}>
        {rows.map((c) => (
          <div role="listitem" key={c.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", gap: 12, alignItems: "center" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
            <CellTags label="阶段" items={[{ label: stageLabel(c.stage), tone: tone(c.stage) }]} />
            <StatusBadge tone={c.active ? "success" : "neutral"} variant="dot">{c.active ? "正常" : "已停用"}</StatusBadge>
          </div>
        ))}
      </div>
    </div>
  );
}
