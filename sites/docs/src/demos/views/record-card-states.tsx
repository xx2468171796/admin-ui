import { RecordCard } from "@adminui/react/views";
import { DEAL_SLOTS, TODAY, TIME_ZONE, initialDeals } from "../../data/views-data";

const deal = initialDeals()[1];
const STATES = [
  { key: "default", label: "默认（悬停边加深 + 轻阴影）", props: {} },
  { key: "selected", label: "选中 selected（主色边 + 光圈）", props: { selected: true } },
  { key: "dragging", label: "拖动中 dragging", props: { dragging: true } },
  { key: "ghost", label: "原位置 ghost（35% 透明）", props: { ghost: true } },
  { key: "locked", label: "锁住 locked（悬停看原因）", props: { locked: "赢单只有销售总监能改阶段" } },
  { key: "loading", label: "加载 loading（骨架）", props: { loading: true } },
] as const;

/** 一套状态：所有视图里的卡片都长这样。 */
export function Demo() {
  if (!deal) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
      {STATES.map((s) => (
        <figure key={s.key} style={{ margin: 0, display: "grid", gap: 8, alignContent: "start" }}>
          <RecordCard record={deal} title={deal.name} {...DEAL_SLOTS} today={TODAY} timeZone={TIME_ZONE} onOpen={() => undefined} {...s.props} />
          <figcaption className="aui-note">{s.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}
