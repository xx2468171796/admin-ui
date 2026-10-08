import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_UNDO_WINDOW_DAYS,
  clampToScale,
  conflictChoice,
  conflictTally,
  countByKind,
  filterByKind,
  inUndoWindow,
  inlineChange,
  justBefore,
  nothingToRollBack,
  opsAfter,
  quickTimes,
  scrubberDayTicks,
  scrubberPercent,
  scrubberScale,
  scrubberTimeAt,
  setConflictChoice,
  setConflictMode,
  shortMoment,
  splitUndoWindow,
  stepIndex,
  undoWindowStart,
  zonedClock,
  zonedTime,
} from "../src/history-core.ts";

// 上海 2026-10-05 15:40（星期一）
const NOW = Date.parse("2026-10-05T07:40:00Z");
const at = (iso: string) => Date.parse(iso);
const SH = "Asia/Shanghai";

test("undo window: default 3 days, boundary inclusive, unknown times outside", () => {
  assert.equal(DEFAULT_UNDO_WINDOW_DAYS, 3);
  assert.equal(undoWindowStart(NOW), NOW - 3 * 86_400_000);
  assert.ok(inUndoWindow(NOW - 3 * 86_400_000, NOW), "正好 3 天还能撤回");
  assert.ok(!inUndoWindow(NOW - 3 * 86_400_000 - 1, NOW));
  assert.ok(!inUndoWindow(null, NOW));
  assert.ok(inUndoWindow(NOW - 6 * 86_400_000, NOW, 7), "窗口可调长");
  const items = [{ id: "a", t: NOW - 3600_000 }, { id: "b", t: NOW - 4 * 86_400_000 }, { id: "c", t: NOW - 86_400_000 }];
  const split = splitUndoWindow(items, (i) => i.t, NOW);
  assert.deepEqual(split.recent.map((i) => i.id), ["a", "c"]);
  assert.deepEqual(split.old.map((i) => i.id), ["b"]);
});

test("kind counts and filter", () => {
  const items = [{ k: "data" }, { k: "field" }, { k: "data" }, { k: "view" }];
  assert.deepEqual([...countByKind(items, (i) => i.k)], [["data", 2], ["field", 1], ["view", 1]]);
  assert.equal(filterByKind(items, (i) => i.k, "data").length, 2);
  assert.equal(filterByKind(items, (i) => i.k, "all").length, 4);
  assert.equal(filterByKind(items, (i) => i.k, null).length, 4);
});

test("conflict decisions: default + per-cell exceptions, minimal value", () => {
  let d = setConflictMode("keep");
  assert.equal(conflictChoice("a", d), "keep");
  d = setConflictChoice(d, "a", "revert");
  assert.deepEqual(d, { mode: "keep", overrides: { a: "revert" } });
  assert.equal(conflictChoice("a", d), "revert");
  assert.equal(conflictChoice("b", d), "keep");
  assert.deepEqual(conflictTally(["a", "b", "c"], d), { keep: 2, revert: 1 });
  d = setConflictChoice(d, "a", "keep");
  assert.deepEqual(d, { mode: "keep" }, "和默认一样的例外去掉");
  assert.deepEqual(setConflictMode("revert"), { mode: "revert" }, "换默认清掉例外");
});

test("zoned clock round-trips in Shanghai and across a DST change", () => {
  assert.deepEqual(zonedClock(NOW, SH), { date: "2026-10-05", time: "15:40" });
  assert.equal(zonedTime("2026-10-05", "15:40", SH), NOW);
  assert.equal(zonedTime("2026-10-5", "15:40", SH), null);
  assert.equal(zonedTime("2026-10-05", "9:00", SH), null);
  // New York: 2026-11-01 01:30 happens twice; 2026-03-08 03:00 exists (02:xx is skipped).
  const ny = zonedTime("2026-03-08", "03:00", "America/New_York");
  assert.ok(ny !== null);
  assert.deepEqual(zonedClock(ny!, "America/New_York"), { date: "2026-03-08", time: "03:00" });
  assert.equal(shortMoment(at("2026-10-05T01:00:00Z"), NOW, SH), "今天 09:00");
  assert.equal(shortMoment(at("2026-10-04T01:00:00Z"), NOW, SH), "昨天 09:00");
  assert.equal(shortMoment(at("2026-10-03T07:40:00Z"), NOW, SH), "10-03 15:40");
});

test("scrubber scale: 72 h ending now, positions, inverse, clamping, day ticks", () => {
  const s = scrubberScale(NOW);
  assert.equal(s.end - s.start, 72 * 3_600_000);
  assert.equal(scrubberPercent(s, s.start), 0);
  assert.equal(scrubberPercent(s, NOW), 100);
  assert.equal(scrubberPercent(s, NOW + 999), 100);
  assert.equal(scrubberPercent(s, s.start - 999), 0);
  assert.equal(Math.round(scrubberPercent(s, NOW - 36 * 3_600_000)), 50);
  assert.equal(scrubberTimeAt(s, 50), NOW - 36 * 3_600_000);
  assert.equal(scrubberTimeAt(s, 120), NOW);
  assert.equal(clampToScale(s, 0), s.start);
  const ticks = scrubberDayTicks(s, SH);
  assert.deepEqual(ticks.map((t) => t.label), ["10-03", "10-04", "10-05"], "10-02 15:40 → 10-05 15:40 有三个零点");
  assert.equal(ticks[0]!.at, zonedTime("2026-10-03", "00:00", SH));
  assert.ok(ticks.every((t) => t.percent > 0 && t.percent < 100));
});

test("operations after a target, just-before, quick picks, arrow stepping", () => {
  const ops = [{ t: at("2026-10-03T07:40:00Z") }, { t: at("2026-10-04T03:30:00Z") }, { t: at("2026-10-05T06:20:00Z") }];
  const target = zonedTime("2026-10-04", "09:00", SH)!;
  assert.equal(opsAfter(ops, (o) => o.t, target).length, 2);
  assert.equal(opsAfter(ops, (o) => o.t, NOW).length, 0);
  assert.equal(justBefore(at("2026-10-03T07:40:30Z")), at("2026-10-03T07:39:00Z"));
  const q = quickTimes(NOW, scrubberScale(NOW), SH);
  assert.deepEqual(q.map((x) => x.label), ["1 小时前", "今天 09:00", "昨天 09:00", "昨天 18:00", "10-03 18:00"]);
  assert.equal(q[0]!.at, NOW - 3_600_000);
  const early = Date.parse("2026-10-05T00:30:00Z"); // 08:30, before today 09:00
  assert.ok(!quickTimes(early, scrubberScale(early), SH).some((x) => x.key === "today-9"), "今天 9 点还没到不给");
  assert.ok(!quickTimes(NOW, scrubberScale(NOW, 24), SH).some((x) => x.key === "before-18"), "超出范围的不给");
  assert.equal(stepIndex(5, -1, 1), 0);
  assert.equal(stepIndex(5, -1, -1), 4);
  assert.equal(stepIndex(5, 4, 1), 4);
  assert.equal(stepIndex(0, 0, 1), -1);
});

test("表时光机：没有可回退的修改（审阅 07：改动为 0 时确认还能点）", () => {
  assert.equal(nothingToRollBack({ counts: { change: 0, add: 0, remove: 0 }, conflicts: [] }), true);
  assert.equal(nothingToRollBack({ conflicts: [] }), true, "没给数 = 没有改动");
  assert.equal(nothingToRollBack({ counts: { change: 0, add: 1 }, conflicts: [] }), false);
  assert.equal(nothingToRollBack({ counts: {}, conflicts: [{}] }), false, "有冲突就有东西可退");
  assert.equal(nothingToRollBack({ cards: [{}], conflicts: [] }), false, "宿主自己写的卡片读不懂，按有改动算");
  assert.equal(nothingToRollBack({ cards: [{}], conflicts: [], empty: true }), true, "宿主说了算");
  assert.equal(nothingToRollBack({ counts: { change: 0 }, conflicts: [], empty: false }), false);
});

test("记录修改历史：只有一处改动才在行里写「旧 → 新」（审阅 07：只写「修改了「状态」」）", () => {
  const one = { field: "状态", before: "跟进中", after: "已成交" };
  assert.equal(inlineChange({ changes: [one] }), one);
  assert.equal(inlineChange({ changes: [one, one] }), null, "多处改动展开看表");
  assert.equal(inlineChange({ changes: [] }), null);
  assert.equal(inlineChange(null), null);
  assert.equal(inlineChange(undefined), null);
});
