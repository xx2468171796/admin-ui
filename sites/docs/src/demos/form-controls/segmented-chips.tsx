import { useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { ChipGroup, SegmentedControl } from "@adminui/react";
import { CUSTOMERS, INDUSTRIES } from "../../data/demo-data";

type Match = "all" | "any";
type View = "list" | "card";
type Industry = (typeof INDUSTRIES)[number];

/** 分段：浅底槽 + 白色凸起的选中块；多选筛选块：选中 = 主色边 + 浅底 + 勾，可带数量。 */
export function Demo() {
  const [match, setMatch] = useState<Match>("all");
  const [view, setView] = useState<View>("list");
  const [industries, setIndustries] = useState<Industry[]>(["制造"]);
  const count = (i: Industry) => CUSTOMERS.filter((c) => c.industry === i).length;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        <SegmentedControl<Match>
          label="条件关系"
          value={match}
          onValueChange={setMatch}
          options={[
            { value: "all", label: "全部满足" },
            { value: "any", label: "任一满足" },
          ]}
        />
        <SegmentedControl<View>
          label="视图"
          size="sm"
          value={view}
          onValueChange={setView}
          options={[
            { value: "list", label: "列表", icon: List },
            { value: "card", label: "卡片", icon: LayoutGrid },
          ]}
        />
      </div>
      <ChipGroup<Industry>
        label="行业"
        value={industries}
        onValueChange={setIndustries}
        options={INDUSTRIES.map((i) => ({ value: i, label: i, count: count(i), disabled: i === "金融" }))}
      />
      <span className="aui-text-note">
        {match === "all" ? "全部满足" : "任一满足"} · {view === "list" ? "列表" : "卡片"} · 行业：{industries.join("、") || "不限"}
      </span>
    </div>
  );
}
