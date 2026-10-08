import assert from "node:assert/strict";
import test from "node:test";
import {
  computeDelta,
  deltaTone,
  effectiveSampleSize,
  formatNumber,
  freshnessOf,
  funnelLimits,
  judgeAgainstBand,
  pickBucketMs,
  pollDelayMs,
  roundShares,
  roundsForTolerance,
  toleranceBand,
} from "../src/dashboard-core.ts";

test("好坏色看指标方向，不看涨跌：成本上涨是坏事", () => {
  assert.equal(computeDelta(120, 100, { better: "up" })?.tone, "good");
  assert.equal(computeDelta(120, 100, { better: "down" })?.tone, "bad");
  assert.equal(computeDelta(80, 100, { better: "down" })?.tone, "good");
  assert.equal(computeDelta(120, 100, { better: "neutral" })?.tone, "neutral");
  assert.equal(computeDelta(120, 100)?.text, "+20.0%");
  assert.equal(computeDelta(80, 100)?.text, "−20.0%");
});

test("缺对比值时返回 null（显示 —），不能冒充 0%", () => {
  assert.equal(computeDelta(100, null), null);
  assert.equal(computeDelta(null, 100), null);
  assert.equal(computeDelta(Number.NaN, 100), null);
});

test("从零增长没有百分比：显示「新增」而不是 ∞%", () => {
  const d = computeDelta(5, 0);
  assert.equal(d?.text, "新增");
  assert.equal(d?.direction, "up");
  assert.equal(d?.value, null);
  assert.equal(computeDelta(0, 0)?.direction, "flat");
});

test("跨零（扭亏为盈）不算百分比", () => {
  const d = computeDelta(10, -5);
  assert.equal(d?.text, "由负转正");
  assert.equal(d?.value, null);
  assert.equal(d?.tone, "good");
  assert.equal(computeDelta(-3, 8)?.text, "由正转负");
  assert.equal(computeDelta(-10, -5)?.text, "−100.0%");
});

test("比率类用百分点，不用相对百分比", () => {
  const d = computeDelta(0.253, 0.241, { mode: "points" });
  assert.equal(d?.text, "+1.2pp");
  assert.ok(Math.abs((d?.value ?? 0) - 1.2) < 1e-9);
  assert.equal(computeDelta(0.95, 0.95, { mode: "points" })?.text, "持平");
});

test("微小变化显示持平且为中性色", () => {
  const d = computeDelta(100.01, 100);
  assert.equal(d?.direction, "flat");
  assert.equal(d?.tone, "neutral");
  assert.equal(d?.text, "持平");
});

test("万/亿缩写确定且负号用真减号", () => {
  assert.equal(formatNumber(9999), "9,999");
  assert.equal(formatNumber(12_345, { compact: true }), "1.2万");
  assert.equal(formatNumber(10_000, { compact: true }), "1万");
  assert.equal(formatNumber(123_456_789, { compact: true }), "1.23亿");
  assert.equal(formatNumber(-12_345, { compact: true }), "−1.2万");
  assert.equal(formatNumber(null), "—");
  assert.equal(formatNumber(0), "0");
});


test("占比用最大余数法，显示的和恰好是 100", () => {
  const shares = roundShares([1, 1, 1]);
  assert.equal(shares.reduce((s, v) => s + v, 0), 100);
  assert.deepEqual(roundShares([0, 0]), [0, 0]);
  const one = roundShares([2, 3, 5], 1);
  assert.equal(Math.round(one.reduce((s, v) => s + v, 0) * 10), 1000);
});

test("有效样本量：大注主导时远小于局数", () => {
  // 1000 注 × 100 与 10 注 × 10000 流水相同
  assert.equal(effectiveSampleSize(1000 * 100, 1000 * 100 ** 2), 1000);
  assert.equal(effectiveSampleSize(10 * 10000, 10 * 10000 ** 2), 10);
  assert.equal(effectiveSampleSize(0, 0), 0);
});

test("容差带与 UKGC 官方算例一致（理论 91.68%，σ=5.6）", () => {
  const cases: [number, number][] = [
    [50_000, 0.0491],
    [100_000, 0.0347],
    [400_000, 0.0175],
    [1_000_000, 0.011],
  ];
  for (const [n, half] of cases) {
    const band = toleranceBand(0.9168, 5.6, n);
    assert.ok(band && Math.abs(band.half - half) < 0.0003, `${n} 局容差 ${band?.half}`);
  }
  assert.equal(toleranceBand(0.95, 5, 0), null);
  // 误差减半需要 4 倍局数
  assert.equal(roundsForTolerance(5, 0.01), 960_400);
  assert.ok(Math.abs(roundsForTolerance(5, 0.005) / roundsForTolerance(5, 0.01) - 4) < 1e-6);
});

test("比率判定：小样本不告警，按 σ/√N 而不是固定百分比", () => {
  assert.equal(judgeAgainstBand(0.8, 0.95, 10, 500).level, "insufficient");
  // σ=10、1 万局：实际 90% 仍在 ±19.6pp 容差内，固定 3% 阈值会误报
  assert.equal(judgeAgainstBand(0.9, 0.95, 10, 10_000).level, "normal");
  // σ=2、100 万局：偏 1pp 已远超 3.09σ
  assert.equal(judgeAgainstBand(0.94, 0.95, 2, 1_000_000).level, "alert");
  assert.equal(judgeAgainstBand(0.9453, 0.95, 2, 1_000_000).level, "watch");
});

test("漏斗图控制线随样本增大而收窄", () => {
  const [inner, outer] = funnelLimits(0.95, 5, 1000, 1_000_000, 10);
  assert.ok(inner && outer);
  const width = (i: number) => inner.upper[i]![1] - inner.lower[i]![1];
  assert.ok(width(0) > width(9));
  assert.ok(outer.upper[0]![1] > inner.upper[0]![1]);
  assert.equal(inner.upper.length, 10);
});

test("新鲜度按数据自身时间算，并支持时钟校正", () => {
  const now = 1_000_000;
  assert.equal(freshnessOf(now - 2000, 3000, { now }).state, "live");
  assert.equal(freshnessOf(now - 7000, 3000, { now }).state, "delayed");
  assert.equal(freshnessOf(now - 16_000, 3000, { now }).state, "down");
  assert.equal(freshnessOf(null, 3000).state, "unknown");
  // 客户端时钟慢 10 秒：不校正会误判为 live
  assert.equal(freshnessOf(now - 5000, 3000, { now: now - 10_000, clockOffsetMs: 10_000 }).state, "live");
  assert.equal(freshnessOf(now - 5000, 3000, { now: now - 10_000 }).state, "live");
  assert.equal(freshnessOf(now - 12_000, 3000, { now: now - 10_000, clockOffsetMs: 10_000 }).state, "delayed");
});

test("3 秒轮询：连续失败 3 次后退避，封顶 30 秒", () => {
  assert.equal(pollDelayMs(3000, 0), 3000);
  assert.equal(pollDelayMs(3000, 2), 3000);
  assert.equal(pollDelayMs(3000, 3), 6000);
  assert.equal(pollDelayMs(3000, 4), 12_000);
  assert.equal(pollDelayMs(3000, 10), 30_000);
});

test("时间粒度随范围自动选择", () => {
  assert.equal(pickBucketMs(3_600_000), 60_000);
  assert.equal(pickBucketMs(86_400_000), 15 * 60_000);
  assert.equal(pickBucketMs(7 * 86_400_000), 3_600_000);
  assert.equal(pickBucketMs(30 * 86_400_000), 86_400_000);
  assert.equal(pickBucketMs(365 * 86_400_000), 7 * 86_400_000);
});

test("迷你趋势线：缺失值断线、进行中的最后一段单独画", async () => {
  const { sparklinePath } = await import("../src/dashboard-core.ts");
  const p = sparklinePath([1, 2, null, 4, 5], 100, 32);
  assert.equal((p.main.match(/M/g) ?? []).length, 2, "null 处断开成两段");
  assert.equal(p.tail, "");
  const q = sparklinePath([1, 2, 3, 2], 100, 32, { inProgress: true });
  assert.ok(q.tail.startsWith("M") && q.tail.includes("L"));
  assert.ok(!q.main.includes("100 "), "进行中的点不画进实线");
  assert.deepEqual(sparklinePath([null, null]).last, null);
  const flat = sparklinePath([3, 3, 3], 100, 32);
  assert.ok(flat.main.includes(" 16"), "全相等时居中，不贴边");
});

test("deltaTone: 越小越好的指标（响应时长）下降是好事；持平 / 中性不分好坏（审阅 05）", () => {
  assert.equal(deltaTone("down", "down"), "good");
  assert.equal(deltaTone("up", "down"), "bad");
  assert.equal(deltaTone("down"), "bad", "默认越大越好");
  assert.equal(deltaTone("up"), "good");
  assert.equal(deltaTone("flat", "down"), "neutral");
  assert.equal(deltaTone("up", "neutral"), "neutral");
  assert.equal(computeDelta(18, 25, { better: "down", mode: "absolute" })?.tone, "good");
});
