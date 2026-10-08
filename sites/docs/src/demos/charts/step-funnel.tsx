import { useState } from "react";
import { Panel, SegmentedControl, StepFunnel } from "@adminui/react";
import { TRIAL_FUNNEL } from "../../data/charts-data";

/** 试用漏斗：每步一行（人数在条内），右侧写转化率、分母和变化；可切换按流失人数或按最低转化率标「流失最多」。 */
export function Demo() {
  const [dropBy, setDropBy] = useState<"count" | "rate">("count");
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <SegmentedControl
        size="sm"
        label="标出哪一步"
        value={dropBy}
        onValueChange={setDropBy}
        options={[{ value: "count", label: "按流失人数" }, { value: "rate", label: "按转化率" }]}
      />
      <Panel title="9 月试用卡在哪一步" count="9 月注册的试用 · 30 天读数">
        <StepFunnel
          steps={TRIAL_FUNNEL}
          label="9 月注册的试用卡在哪一步"
          comparison="比 8 月同天龄"
          firstNote="9 月注册的试用"
          dropBy={dropBy}
          format={(n) => `${n.toLocaleString("zh-CN")} 人`}
        />
      </Panel>
    </div>
  );
}
