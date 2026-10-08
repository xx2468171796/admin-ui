import { useState } from "react";
import { FormField, PercentInput, Rating, Slider } from "@adminui/react";

const INTENT = ["很低", "较低", "一般", "较高", "很高"];
const SATISFY = ["很不满意", "不满意", "一般", "满意", "很满意"];
const grid = { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", alignItems: "start" } as const;

/** 评分：实心星 + 文字（「较高」），悬停预览、再点当前那颗清空。滑块：只给大概值，旁边永远配一个数字框。 */
export function Demo() {
  const [intent, setIntent] = useState<number | null>(4);
  const [satisfy, setSatisfy] = useState<number | null>(null);
  const [win, setWin] = useState<number | null>(60);
  const [budget, setBudget] = useState<number | null>(35);
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={grid}>
        <FormField label="购买意向" htmlFor="rt-intent">
          <span id="rt-intent"><Rating label="购买意向" value={intent} onChange={setIntent} size="md" labels={INTENT} /></span>
        </FormField>
        <FormField label="满意度（未评）" htmlFor="rt-satisfy">
          <span id="rt-satisfy"><Rating label="满意度" value={satisfy} onChange={setSatisfy} size="md" labels={SATISFY} /></span>
        </FormField>
        <FormField label="只读（格子 13px）/ 禁用" htmlFor="rt-ro">
          <span id="rt-ro" style={{ display: "inline-flex", gap: 16, alignItems: "center" }}>
            <Rating label="客户评分" value={3} />
            <Rating label="禁用的评分" value={2} onChange={() => undefined} disabled />
          </span>
        </FormField>
      </div>
      <div style={{ maxWidth: 560 }}>
        <FormField label="赢率" htmlFor="sl-win" hint="一格 10%；← → 也能调">
          <span id="sl-win"><PercentInput slider label="赢率" value={win} onChange={setWin} step={10} /></span>
        </FormField>
      </div>
      <div style={grid}>
        <FormField label="预算上限（带刻度）" htmlFor="sl-budget">
          <span id="sl-budget"><Slider label="预算上限" value={budget} onChange={setBudget} step={5} unit=" 万" scale withInput /></span>
        </FormField>
        <FormField label="禁用" htmlFor="sl-off">
          <span id="sl-off"><Slider label="禁用的滑块" value={40} onChange={() => undefined} disabled /></span>
        </FormField>
      </div>
    </div>
  );
}
