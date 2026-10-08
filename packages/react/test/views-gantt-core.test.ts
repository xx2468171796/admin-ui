import test from "node:test";
import assert from "node:assert/strict";
import {
  barBox,
  clampSplit,
  dragDays,
  dragSpan,
  durationText,
  GANTT_SPLIT,
  ganttAutoSplit,
  ganttFrame,
  ganttListColumns,
  ganttResizable,
  ganttScaleLabel,
  ganttRows,
  ganttSpan,
  ganttTicks,
  ganttWindow,
  groupKeys,
  nonWorkRuns,
  shiftAnchor,
  spanChange,
  spanText,
  windowTitle,
  type GanttGroup,
} from "../src/views/gantt-core.ts";
import type { WorkCalendar } from "../src/views/date-core.ts";

const CN: WorkCalendar = {
  holidays: Object.fromEntries(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"].map((d) => [d, "国庆"])),
  workdays: { "2026-10-10": "国庆调休" },
};

test("窗口与刻度：周 / 两周 / 季 / 年，‹ › 按刻度翻", () => {
  const w = ganttWindow("2026-10-05", "month", 712);
  assert.deepEqual(w, { start: "2026-10-03", days: 20 }, "两周刻度从锚点前两天开始，一天 36px");
  assert.equal(windowTitle(w, "month"), "2026 年 10 月");
  assert.equal(windowTitle({ start: "2026-09-26", days: 15 }, "month"), "2026 年 9 – 10 月", "跨月写起止月");
  assert.equal(windowTitle({ start: "2026-12-25", days: 15 }, "month"), "2026 年 12 月 – 2027 年 1 月");
  assert.equal(ganttWindow("2026-10-08", "week", 800).start, "2026-10-05");
  assert.equal(ganttWindow("2026-11-20", "quarter", 800).start, "2026-10-01");
  assert.equal(windowTitle(ganttWindow("2026-11-20", "quarter", 800), "quarter"), "2026 年第 4 季度");
  assert.equal(ganttWindow("2026-11-20", "year", 800).start, "2026-01-01");
  assert.equal(shiftAnchor("2026-10-05", "month", 1), "2026-10-20", "两周刻度翻 15 天");
  assert.equal(shiftAnchor("2026-10-05", "month", -1, 10), "2026-09-25");
  assert.equal(shiftAnchor("2026-10-05", "quarter", -1), "2026-07-05");
  assert.equal(shiftAnchor("2026-10-05", "week", -1), "2026-09-28");
});

test("默认分栏：时间轴 15 天、每天 36px，左侧拿剩下的宽度；窄了先压天宽到 28，再压左侧到 320", () => {
  assert.deepEqual(ganttAutoSplit(1170), { listWidth: 630, dayWidth: 36 }, "1440 宽屏：15 × 36 = 540，左侧 1170 − 540");
  assert.deepEqual(ganttAutoSplit(800), { listWidth: 320, dayWidth: 32 }, "窄一些：天宽先变窄，左侧不低于 320");
  assert.deepEqual(ganttAutoSplit(700), { listWidth: 320, dayWidth: 28 }, "天宽到底后左侧停在 320，时间轴装不下 15 天");
  const wide = ganttAutoSplit(2400);
  assert.ok(wide.listWidth >= GANTT_SPLIT.listMax && wide.listWidth < GANTT_SPLIT.listMax + 15, "左侧最多约 880，多出来的给天宽");
  assert.equal(wide.dayWidth, 101);
  assert.deepEqual(ganttAutoSplit(1170, 7), { listWidth: 883, dayWidth: 41 }, "visibleDays 可改；左侧超过上限时天宽变大");
});

test("画面：默认两周正好 15 天、今天在第 3 列；周 7 天；拖过分隔条 / 宿主给宽度 / 收起后铺满", () => {
  const two = ganttFrame({ anchor: "2026-10-05", scale: "month", bodyWidth: 1170 });
  assert.deepEqual(two, { listWidth: 630, dayWidth: 36, auto: true, window: { start: "2026-10-03", days: 15 } });
  const week = ganttFrame({ anchor: "2026-10-08", scale: "week", bodyWidth: 1170 });
  assert.deepEqual([week.listWidth, week.window], [630, { start: "2026-10-05", days: 7 }], "周刻度左侧宽度不变，7 天铺满时间轴");
  assert.equal(Math.round(week.dayWidth * 7), 540);
  const narrow = ganttFrame({ anchor: "2026-10-05", scale: "month", bodyWidth: 700 });
  assert.deepEqual([narrow.listWidth, narrow.dayWidth, narrow.window.days], [320, 28, 14], "装不下 15 天：28px 一天能放几天放几天");
  const dragged = ganttFrame({ anchor: "2026-10-05", scale: "month", bodyWidth: 1170, listWidth: 460 });
  assert.deepEqual([dragged.listWidth, dragged.dayWidth, dragged.auto, dragged.window.days], [460, 36, false, 20], "定了左侧宽度：时间轴按 36px 一天铺满");
  const collapsed = ganttFrame({ anchor: "2026-10-05", scale: "month", bodyWidth: 1170, collapsed: true });
  assert.deepEqual([collapsed.listWidth, collapsed.window.days], [0, 33]);
  const quarter = ganttFrame({ anchor: "2026-11-20", scale: "quarter", bodyWidth: 1170 });
  assert.deepEqual([quarter.listWidth, quarter.dayWidth, quarter.window], [630, 8, { start: "2026-10-01", days: 68 }], "季刻度照旧铺满");
  assert.equal(ganttFrame({ anchor: "2026-10-05", scale: "month", bodyWidth: 1170, visibleDays: 3 }).window.start, "2026-10-05", "很短的窗口不留前导天");
  assert.equal(ganttScaleLabel("month"), "两周");
  assert.equal(ganttScaleLabel("month", 30), "30 天");
  assert.equal(ganttScaleLabel("week", 30), "周");
});

test("左侧列：按字段类型和表头字数定基准宽，随左侧变宽按比例变宽", () => {
  const cols = ganttListColumns([{ type: "text", title: "客户名称" }, { type: "user", title: "安装负责人" }, { type: "date", title: "安装日期" }]);
  assert.equal(cols, "minmax(109px, 156fr) minmax(76px, 109fr) minmax(67px, 96fr)", "「安装负责人」五个字比默认的 96 宽");
});

test("工期：结束字段 / 工期字段（只算工作日）/ 固定时长", () => {
  assert.deepEqual(ganttSpan("2026-10-09", "2026-10-15", null, { endMode: "field" }, CN), { start: "2026-10-09", end: "2026-10-15", days: 7, workdays: 6 });
  assert.equal(ganttSpan("2026-10-09", "2026-10-01", null, { endMode: "field" })?.end, "2026-10-09", "结束早于开始按一天");
  assert.equal(ganttSpan("2026-10-09", null, 6, { endMode: "duration", workdaysOnly: true }, CN)?.end, "2026-10-15");
  assert.equal(ganttSpan("2026-10-09", null, 6, { endMode: "duration" }, CN)?.end, "2026-10-14");
  assert.equal(ganttSpan("2026-10-09", null, null, { endMode: "fixed", fixedDays: 3, workdaysOnly: true }, CN)?.end, "2026-10-12", "跳过周日 10-11");
  assert.equal(ganttSpan(null, "2026-10-09", null, { endMode: "field" }), null);
  const span = ganttSpan("2026-10-09", "2026-10-15", null, { endMode: "field" }, CN);
  assert.ok(span);
  assert.equal(durationText(span, true), "6 个工作日（含 1 天休息日不计）");
  assert.equal(durationText(span, false), "7 天");
  assert.deepEqual(nonWorkRuns(span, CN), [{ offset: 2, length: 1 }]);
  assert.deepEqual(nonWorkRuns({ start: "2026-09-30", end: "2026-10-08" }, CN), [{ offset: 1, length: 7 }]);
});

test("拖动：整天吸附，移动保持长度，拖两端不短于一天", () => {
  assert.equal(dragDays(37, 25), 1);
  assert.equal(dragDays(-12, 25), 0);
  assert.equal(dragDays(-13, 25), -1);
  const span = { start: "2026-10-13", end: "2026-10-15" };
  assert.deepEqual(dragSpan(span, "move", 3), { start: "2026-10-16", end: "2026-10-18" });
  assert.deepEqual(dragSpan(span, "end", -5), { start: "2026-10-13", end: "2026-10-13" });
  assert.deepEqual(dragSpan(span, "start", 5), { start: "2026-10-15", end: "2026-10-15" });
  assert.deepEqual(spanChange({ start: "2026-10-09", end: "2026-10-15" }, { endMode: "duration", workdaysOnly: true }, CN), { start: "2026-10-09", end: "2026-10-15", duration: 6 });
  assert.equal(spanText({ start: "2026-09-28", end: "2026-09-30" }), "09-28 → 09-30");
});

test("拖动：工期只算工作日时移动保持工作日数，工期固定时两端不动", () => {
  const span = { start: "2026-10-14", end: "2026-10-16" }; // 周三到周五，3 个工作日
  const duration = { options: { endMode: "duration" as const, workdaysOnly: true }, calendar: {} };
  const moved = dragSpan(span, "move", 1, duration);
  assert.deepEqual(moved, { start: "2026-10-15", end: "2026-10-19" }, "跨周末顺延到下周一");
  assert.equal(spanChange(moved, duration.options, {}).duration, 3);
  assert.deepEqual(dragSpan(span, "move", 1, { options: { endMode: "field", workdaysOnly: true } }), { start: "2026-10-15", end: "2026-10-17" }, "结束日期字段照日历天平移");
  const fixed = { options: { endMode: "fixed" as const, fixedDays: 3 } };
  assert.equal(ganttResizable(fixed.options), false);
  assert.equal(ganttResizable(duration.options), true);
  assert.deepEqual(dragSpan(span, "end", 2, fixed), span);
  assert.deepEqual(dragSpan(span, "start", -2, fixed), span);
  assert.deepEqual(dragSpan(span, "move", 2, fixed), { start: "2026-10-16", end: "2026-10-18" });
});

test("条形几何：窗口外的条给出左右边缘，跨边界的被裁剪", () => {
  const w = { start: "2026-10-01", days: 28 };
  assert.deepEqual(barBox({ start: "2026-09-28", end: "2026-09-30" }, w, 25), { visible: false, side: "before" });
  assert.deepEqual(barBox({ start: "2026-10-29", end: "2026-11-03" }, w, 25), { visible: false, side: "after" });
  assert.deepEqual(barBox({ start: "2026-10-09", end: "2026-10-15" }, w, 25), { visible: true, left: 200, width: 175, clippedStart: false, clippedEnd: false });
  assert.deepEqual(barBox({ start: "2026-09-29", end: "2026-10-02" }, w, 25), { visible: true, left: 0, width: 50, clippedStart: true, clippedEnd: false });
});

test("表头刻度：月刻度每天一格，补班日写「班」，非工作日、今天有标记", () => {
  const ticks = ganttTicks({ start: "2026-10-01", days: 28 }, "month", "2026-10-05", CN);
  assert.equal(ticks.top.length, 1);
  assert.equal(ticks.top[0]?.label, "2026 年 10 月");
  assert.equal(ticks.bottom.length, 28);
  const d10 = ticks.bottom.find((t) => t.key === "2026-10-10");
  assert.deepEqual([d10?.sub, d10?.makeup, d10?.nonWork], ["班", true, false]);
  assert.equal(ticks.bottom.find((t) => t.key === "2026-10-05")?.today, true);
  assert.equal(ticks.days.filter((d) => d.nonWork).length, 12, "国庆 7 天 + 10-11、10-17、10-18、10-24、10-25（10-10 补班不算）");
  const two = ganttTicks({ start: "2026-09-29", days: 15 }, "month", "2026-10-01", {}, 1, 36);
  assert.deepEqual(two.top.map((t) => [t.label, t.left, t.width]), [["9 月", 0, 72], ["2026 年 10 月", 72, 468]], "窗口边上只剩两天的月份写短名；按传入的天宽排");
  assert.equal(two.bottom[2]?.left, 72);
  const q = ganttTicks({ start: "2026-10-01", days: 92 }, "quarter", "2026-10-05");
  assert.equal(q.top.length, 3);
  assert.equal(q.bottom[1]?.label, "10-05", "季刻度下排按周");
  const sunday = ganttTicks({ start: "2026-10-01", days: 92 }, "quarter", "2026-10-05", {}, 0);
  assert.equal(sunday.bottom[1]?.label, "10-04", "周从周日开始时季刻度也从周日分周");
  const y = ganttTicks({ start: "2026-01-01", days: 365 }, "year", "2026-10-05");
  assert.equal(y.bottom.length, 12);
  assert.equal(y.days.length, 0);
});

test("左侧行：最多两级分组，收起的组藏起下面的行，组路径做键", () => {
  type R = { id: string };
  const groups: GanttGroup<R>[] = [
    { key: "阿明", label: "阿明", person: true, groups: [{ key: "上海", label: "上海", records: [{ id: "1019" }, { id: "1028" }] }, { key: "杭州", label: "杭州", records: [{ id: "1035" }] }] },
    { key: "未分配", label: "未分配", records: [{ id: "x" }, { id: "y" }] },
  ];
  const rows = ganttRows(groups, (r) => r.id, new Set(["未分配", "阿明/杭州"]));
  assert.deepEqual(rows.map((r) => (r.kind === "group" ? `${r.key}(${r.count})` : r.key)), ["阿明(3)", "阿明/上海(2)", "1019", "1028", "阿明/杭州(1)", "未分配(2)"]);
  assert.equal(rows[2]?.depth, 2);
  assert.deepEqual(groupKeys(groups), ["阿明", "阿明/上海", "阿明/杭州", "未分配"]);
  assert.equal(clampSplit(90), 200);
  assert.equal(clampSplit(2000, 200, 600), 600);
});

test("ganttAutoSplit：列表放不下它的列时先把天缩窄（不低于 dayMin），再给列表", async () => {
  const { ganttAutoSplit, GANTT_SPLIT } = await import("../src/views/gantt-core.ts");
  const roomy = ganttAutoSplit(1200, 15, 500);
  assert.equal(roomy.dayWidth, GANTT_SPLIT.dayComfort);
  const tight = ganttAutoSplit(970, 15, 560);
  assert.ok(tight.dayWidth < GANTT_SPLIT.dayComfort && tight.dayWidth >= GANTT_SPLIT.dayMin);
  assert.ok(tight.listWidth >= 540);
});

test("条上文字放不下：挪到条右边，靠右边界时挪到左边（审阅 08）", async () => {
  const { barTextPlace, barTextWidth } = await import("../src/views/gantt-core.ts");
  assert.equal(barTextWidth("赵静怡"), 44);
  assert.equal(barTextWidth("ab"), 22);
  assert.equal(barTextPlace({ left: 100, width: 200 }, 80, 600), "inside");
  assert.equal(barTextPlace({ left: 100, width: 60 }, 80, 600), "after");
  assert.equal(barTextPlace({ left: 480, width: 60 }, 80, 600), "before", "右边放不下：放左边");
  assert.equal(barTextPlace({ left: 20, width: 560 }, 900, 600), "after", "两边都放不下：仍放右边（被裁）");
});

test("手机列表进度小轨道：窗口里的部分（0–1），窗口外 = null", async () => {
  const { ganttTrack } = await import("../src/views/gantt-core.ts");
  const w = { start: "2026-10-05", days: 20 };
  assert.deepEqual(ganttTrack({ start: "2026-10-05", end: "2026-10-08" }, w), { from: 0, to: 0.2 });
  assert.deepEqual(ganttTrack({ start: "2026-09-28", end: "2026-10-06" }, w), { from: 0, to: 0.1 }, "裁掉窗口前");
  assert.deepEqual(ganttTrack({ start: "2026-10-20", end: "2026-11-30" }, w), { from: 0.75, to: 1 });
  assert.equal(ganttTrack({ start: "2026-09-28", end: "2026-10-02" }, w), null);
});

test("节假日：刻度带宿主的名称，表头写「休」，补班优先", async () => {
  const { ganttTicks } = await import("../src/views/gantt-core.ts");
  const t = ganttTicks({ start: "2026-09-30", days: 12 }, "month", "2026-10-07", { holidays: { "2026-10-01": "国庆日", "2026-10-10": "x" }, workdays: { "2026-10-10": "国庆调休" } });
  const oct1 = t.bottom.find((d) => d.key === "2026-10-01");
  assert.equal(oct1?.holiday, "国庆日");
  assert.equal(oct1?.sub, "休");
  assert.equal(t.days.find((d) => d.key === "2026-10-01")?.holiday, "国庆日");
  const oct10 = t.bottom.find((d) => d.key === "2026-10-10");
  assert.equal(oct10?.holiday, undefined);
  assert.equal(oct10?.sub, "班");
});
