import { useState } from "react";
import { StagePath } from "@adminui/react";
import { DEAL_DAYS, DEAL_STEPS } from "../../data/business-data";

// StagePath 单独用：分段（卡片分区里）、箭头（单栏版式）、只读。点一个阶段就改；输单、作废在末尾「更多」里。
const STEPS = DEAL_STEPS.map((s) => ({ ...s, days: DEAL_DAYS[s.id] }));

export function Demo() {
  const [current, setCurrent] = useState("proposal");
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <StagePath steps={STEPS} current={current} onSelect={setCurrent} label="商机阶段（分段）" />
      <StagePath steps={STEPS} current={current} onSelect={setCurrent} variant="chevrons" label="商机阶段（箭头）" />
      <StagePath steps={STEPS} current={current} readOnly label="商机阶段（只读）" />
    </div>
  );
}
