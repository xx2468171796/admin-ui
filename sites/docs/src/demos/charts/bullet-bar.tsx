import { BulletBar, Tag } from "@adminui/react";

/** 子弹图的几种情况：实心条 = 当前，竖实线 = 目标，竖虚线 = 按时间进度应该到哪；右侧必写判断。 */
const fmt = (n: number) => `${n} 万`;
const ROWS = [
  { name: "华东区 · 领先", verdict: "领先 9pp", bullet: { value: 120, target: 340, timeProgress: 0.26 } },
  { name: "华南区 · 落后", verdict: "落后 12pp", bullet: { value: 48, target: 340, timeProgress: 0.26 } },
  { name: "西南区 · 超额", verdict: "已达成 112%", bullet: { value: 224, target: 200, max: 240 } },
  { name: "续费率 · 分档", verdict: "良好", bullet: { value: 88, target: 92, max: 100, bands: [70, 85] } },
  { name: "11 月目标 · 没开始", verdict: "11-01 开始", bullet: { value: null, target: 260 } },
  { name: "本月 · 进行中", verdict: "进行中", bullet: { value: 58, target: 240, timeProgress: 0.26, inProgress: true } },
] as const;

export function Demo() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      {ROWS.map((row) => (
        <div key={row.name} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 104px", gap: "4px 16px", alignItems: "start" }}>
          <span>{row.name}</span>
          <span style={{ gridRow: "span 2", alignSelf: "center", justifySelf: "end" }}>
            <Tag variant={row.verdict.startsWith("落后") || row.verdict.includes("开始") ? "plain" : "soft"}>{row.verdict}</Tag>
          </span>
          <BulletBar {...row.bullet} label={row.name} format={row.name.startsWith("续费率") ? (n) => `${n}%` : fmt} />
        </div>
      ))}
    </div>
  );
}
