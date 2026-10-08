import { useState } from "react";
import { SegmentedControl, Switch } from "@adminui/react";
import { RecordCard, type RecordCardDensity } from "@adminui/react/views";
import { DEAL_SLOTS, TODAY, TIME_ZONE, dealFields, initialDeals } from "../../data/views-data";

const deals = initialDeals();
const samples = [deals[0], deals[3], deals[5]].filter((d) => d !== undefined);

/**
 * 五个固定位：封面 → 标题 → 标签行 → 关键数行 → 底栏（负责人 | 评论数 + 下次跟进）。
 * 没填的字段不占行；默认不显示字段名，打开后变成两列对齐。
 */
export function Demo() {
  const [density, setDensity] = useState<RecordCardDensity>("normal");
  const [labels, setLabels] = useState(false);
  const [cover, setCover] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        <SegmentedControl size="sm" label="密度" value={density} onValueChange={setDensity} options={[{ value: "compact", label: "紧凑" }, { value: "normal", label: "常规" }]} />
        <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><Switch checked={labels} onCheckedChange={setLabels} />显示字段名</label>
        <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><Switch checked={cover} onCheckedChange={setCover} />封面</label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(236px, 1fr))", gap: 16 }}>
        {samples.map((d) => (
          <RecordCard
            key={d.id}
            record={d}
            title={d.name}
            {...DEAL_SLOTS}
            fields={dealFields(["industry", "seats"])}
            showLabels={labels}
            density={density}
            attachments={cover ? d.files : undefined}
            coverBadge="count"
            today={TODAY}
            timeZone={TIME_ZONE}
            selected={selected === d.id}
            onOpen={() => setSelected(d.id)}
          />
        ))}
      </div>
    </div>
  );
}
