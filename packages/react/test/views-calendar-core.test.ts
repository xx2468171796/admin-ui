import test from "node:test";
import assert from "node:assert/strict";
import {
  createRange,
  eventsOnDay,
  layoutMonth,
  layoutTimeGrid,
  minutesAt,
  monthMatrix,
  moveDays,
  moveTimed,
  overlapColumns,
  resizeTimed,
  resolveEvent,
  timedRange,
  weekDays,
  type CalendarEventInput,
  type ResolvedEvent,
} from "../src/views/calendar-core.ts";

const TZ = "Asia/Shanghai";
const resolve = (list: CalendarEventInput[]) => list.map((e) => resolveEvent(e, TZ)).filter((e): e is ResolvedEvent => e !== null);

test("月份矩阵：一周从周几开始可配，2026 年 10 月周一开始是 5 周", () => {
  const weeks = monthMatrix("2026-10-15", 1);
  assert.equal(weeks.length, 5);
  assert.equal(weeks[0]?.[0], "2026-09-28");
  assert.equal(weeks[4]?.[6], "2026-11-01");
  const sunday = monthMatrix("2026-10-15", 0);
  assert.equal(sunday[0]?.[0], "2026-09-27");
  assert.equal(monthMatrix("2026-10-15", 1, true).length, 6);
  assert.deepEqual(weekDays("2026-10-08", 1), ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
  assert.deepEqual(weekDays("2026-10-08", 1, 1), ["2026-10-08"]);
});

test("解析事件：全天按日子，定时按时区；结束在午夜算前一天 24:00", () => {
  assert.deepEqual(resolveEvent({ id: "a", start: "2026-10-13", end: "2026-10-15" }, TZ), { id: "a", allDay: true, startDay: "2026-10-13", endDay: "2026-10-15", startMin: null, endMin: null });
  assert.deepEqual(resolveEvent({ id: "b", start: "2026-10-05T01:30:00Z" }, TZ), { id: "b", allDay: false, startDay: "2026-10-05", endDay: "2026-10-05", startMin: 570, endMin: 630 }, "没有结束 = 默认 1 小时");
  assert.deepEqual(resolveEvent({ id: "c", start: "2026-10-05T14:00:00Z", end: "2026-10-05T16:00:00Z" }, TZ), { id: "c", allDay: false, startDay: "2026-10-05", endDay: "2026-10-05", startMin: 1320, endMin: 1440 });
  assert.equal(resolveEvent({ id: "d", start: "" }, TZ), null);
});

test("月视图：跨周的多日条拆成每周一段，标记续上周 / 续下周", () => {
  const weeks = monthMatrix("2026-10-15", 1);
  const events = resolve([{ id: "zjh", start: "2026-10-13", end: "2026-10-15" }, { id: "lj", start: "2026-10-23", end: "2026-10-27" }]);
  const layout = layoutMonth(events, weeks, 3);
  const w4 = layout[3]?.segments.find((s) => s.id === "lj");
  const w5 = layout[4]?.segments.find((s) => s.id === "lj");
  assert.deepEqual([w4?.startCol, w4?.endCol, w4?.continuesBefore, w4?.continuesAfter], [4, 6, false, true]);
  assert.deepEqual([w5?.startCol, w5?.endCol, w5?.continuesBefore, w5?.continuesAfter], [0, 1, true, false]);
  const w3 = layout[2]?.segments.find((s) => s.id === "zjh");
  assert.deepEqual([w3?.startCol, w3?.endCol, w3?.lane], [1, 3, 0]);
});

test("月视图：车道互不重叠，一天放不下时留 maxLanes−1 行加「+N 更多」", () => {
  const weeks = [monthMatrix("2026-10-15", 1)[1] ?? []];
  const events = resolve([
    { id: "bar", start: "2026-10-07", end: "2026-10-09" },
    { id: "t1", start: "2026-10-07T01:00:00Z" },
    { id: "t2", start: "2026-10-07T02:30:00Z" },
    { id: "t3", start: "2026-10-07T05:00:00Z" },
    { id: "t4", start: "2026-10-07T07:00:00Z" },
    { id: "x", start: "2026-10-08T02:00:00Z" },
  ]);
  const [week] = layoutMonth(events, weeks, 3);
  assert.ok(week);
  // 10-07 是第 3 列：5 个事件，显示 2 行 + 「+3 更多」
  const on7 = week.segments.filter((s) => s.startCol <= 2 && s.endCol >= 2);
  assert.equal(on7.length, 2);
  assert.equal(week.hidden[2], 3);
  assert.equal(on7[0]?.id, "bar", "多日条排最前");
  for (const a of week.segments) for (const b of week.segments) {
    if (a === b || a.lane !== b.lane) continue;
    assert.ok(a.endCol < b.startCol || b.endCol < a.startCol, `${a.id} 和 ${b.id} 同车道不重叠`);
  }
  assert.equal(eventsOnDay(events, "2026-10-07").length, 5);
});

test("月视图 reserveMore：每格最多 maxLanes 行事件，「+N 更多」另起一行（审阅 08）", () => {
  const weeks = [monthMatrix("2026-10-15", 1)[1] ?? []];
  const events = resolve([
    { id: "bar", start: "2026-10-07", end: "2026-10-09" },
    { id: "t1", start: "2026-10-07T01:00:00Z" },
    { id: "t2", start: "2026-10-07T02:30:00Z" },
    { id: "t3", start: "2026-10-07T05:00:00Z" },
    { id: "t4", start: "2026-10-07T07:00:00Z" },
    { id: "x", start: "2026-10-08T02:00:00Z" },
  ]);
  const [week] = layoutMonth(events, weeks, 3, { reserveMore: true });
  assert.ok(week);
  const on7 = week.segments.filter((s) => s.startCol <= 2 && s.endCol >= 2);
  assert.equal(on7.length, 3, "3 行事件");
  assert.equal(week.hidden[2], 2, "+2 更多");
  assert.ok(week.segments.every((s) => s.lane < 3));
  const [full] = layoutMonth(events.filter((e) => e.id !== "t4" && e.id !== "t3"), weeks, 3, { reserveMore: true });
  assert.equal(full?.hidden[2], 0, "正好 3 条：不出「更多」");
});

test("周视图：重叠的事件并排，不重叠的独占整列；全天行放多日条", () => {
  const events = resolve([
    { id: "a", start: "2026-10-06T02:00:00Z", end: "2026-10-06T03:00:00Z" }, // 10:00–11:00
    { id: "b", start: "2026-10-06T02:30:00Z", end: "2026-10-06T03:30:00Z" }, // 10:30–11:30
    { id: "c", start: "2026-10-06T03:00:00Z", end: "2026-10-06T04:00:00Z" }, // 11:00–12:00（a 结束时开始）
    { id: "d", start: "2026-10-06T07:00:00Z", end: "2026-10-06T08:00:00Z" }, // 15:00 独占
    { id: "all", start: "2026-10-08", end: "2026-10-09" },
  ]);
  const grid = layoutTimeGrid(events, ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]);
  const day = grid.timed["2026-10-06"] ?? [];
  const by = Object.fromEntries(day.map((p) => [p.id, p]));
  assert.deepEqual([by.a?.col, by.a?.cols], [0, 2]);
  assert.deepEqual([by.b?.col, by.b?.cols], [1, 2]);
  assert.deepEqual([by.c?.col, by.c?.cols], [0, 2], "c 复用 a 空出来的列");
  assert.deepEqual([by.d?.col, by.d?.cols], [0, 1]);
  assert.equal(grid.allDay.length, 1);
  assert.deepEqual([grid.allDay[0]?.startCol, grid.allDay[0]?.endCol], [3, 4]);
  assert.equal(overlapColumns([]).length, 0);
});

test("周视图：短事件显示时拉到 15 分钟，但真实结束时间单独保留，移动按真实时长", () => {
  const events = resolve([{ id: "short", start: "2026-10-06T02:00:00Z", end: "2026-10-06T02:05:00Z" }]); // 10:00–10:05
  const p = layoutTimeGrid(events, ["2026-10-06"]).timed["2026-10-06"]?.[0];
  assert.deepEqual([p?.startMin, p?.endMin, p?.realEndMin], [600, 615, 605]);
  assert.deepEqual(moveTimed(p?.startMin ?? 0, p?.realEndMin ?? 0, 30), { startMin: 630, endMin: 635 }, "挪半小时还是 5 分钟");
});

test("拖动吸附 30 分钟：移动保持时长、拉伸至少一格、拖空白新建", () => {
  assert.equal(minutesAt(260, 52, 8, 30), 13 * 60, "8 点起每小时 52px，260px ≈ 13:00");
  assert.deepEqual(moveTimed(600, 660, 40), { startMin: 630, endMin: 690 });
  assert.deepEqual(moveTimed(1380, 1440, 120), { startMin: 1380, endMin: 1440 }, "不跨过午夜");
  assert.deepEqual(resizeTimed(900, 960, 55), { startMin: 900, endMin: 1020 });
  assert.deepEqual(resizeTimed(900, 960, -200), { startMin: 900, endMin: 930 });
  assert.deepEqual(createRange(700, 610), { startMin: 600, endMin: 720 });
  assert.deepEqual(createRange(600, 600), { startMin: 600, endMin: 630 });
  assert.deepEqual(timedRange("2026-10-05", 14 * 60, 15 * 60, TZ), { start: "2026-10-05T06:00:00.000Z", end: "2026-10-05T07:00:00.000Z" });
  assert.deepEqual(moveDays({ startDay: "2026-10-13", endDay: "2026-10-15" }, "2026-10-20"), { startDay: "2026-10-20", endDay: "2026-10-22" });
});
