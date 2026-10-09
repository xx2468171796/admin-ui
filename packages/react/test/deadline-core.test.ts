// Deadline dates: calendar days in a time zone (overdue / today / soon / none), datetimes by their day, closed rows.
import test from "node:test";
import assert from "node:assert/strict";
import { deadlineState, deadlineText, deadlineTone, fieldDeadline } from "../src/deadline-core.ts";
import { deadlineEvents } from "../src/views/calendar-core.ts";

const SH = "Asia/Shanghai";
const NY = "America/New_York";
// 2026-10-09 10:00 in Shanghai = 2026-10-09 02:00Z = 2026-10-08 22:00 in New York.
const now = new Date("2026-10-09T02:00:00Z");

test("deadlineState: day keys against today in the zone", () => {
  assert.deepEqual(deadlineState("2026-10-08", { now, timeZone: SH }), { kind: "overdue", days: 1 });
  assert.deepEqual(deadlineState("2026-09-29", { now, timeZone: SH }), { kind: "overdue", days: 10 });
  assert.deepEqual(deadlineState("2026-10-09", { now, timeZone: SH }), { kind: "today", days: 0 });
  assert.deepEqual(deadlineState("2026-10-10", { now, timeZone: SH }), { kind: "soon", days: 1 });
  assert.deepEqual(deadlineState("2026-10-11", { now, timeZone: SH }), { kind: "soon", days: 2 });
  assert.deepEqual(deadlineState("2026-10-12", { now, timeZone: SH }), { kind: "none", days: 0 });
});

test("deadlineState: today differs by zone at the same instant", () => {
  assert.equal(deadlineState("2026-10-08", { now, timeZone: SH }).kind, "overdue");
  assert.equal(deadlineState("2026-10-08", { now, timeZone: NY }).kind, "today");
  assert.deepEqual(deadlineState("2026-10-09", { now, timeZone: NY }), { kind: "soon", days: 1 });
});

test("deadlineState: a datetime counts by its calendar day (due this afternoon = today, not overdue)", () => {
  // 15:00 Shanghai today, later than now → today.
  assert.equal(deadlineState("2026-10-09T07:00:00Z", { now, timeZone: SH }).kind, "today");
  // 08:00 Shanghai today (already past) → still today, not overdue.
  assert.equal(deadlineState("2026-10-09T00:00:00Z", { now, timeZone: SH }).kind, "today");
  // 23:30 Shanghai yesterday → overdue 1 day.
  assert.deepEqual(deadlineState("2026-10-08T15:30:00Z", { now, timeZone: SH }), { kind: "overdue", days: 1 });
  // The same instant read in New York is the 8th there, and New York's today is the 8th → today.
  assert.equal(deadlineState("2026-10-08T15:30:00Z", { now, timeZone: NY }).kind, "today");
  assert.equal(deadlineState(new Date("2026-10-10T16:00:00Z"), { now, timeZone: SH }).kind, "soon");
});

test("deadlineState: boundaries around midnight and empty input", () => {
  const justBefore = new Date("2026-10-09T15:59:59Z"); // 23:59:59 Shanghai on the 9th
  const justAfter = new Date("2026-10-09T16:00:00Z"); // 00:00 Shanghai on the 10th
  assert.equal(deadlineState("2026-10-09", { now: justBefore, timeZone: SH }).kind, "today");
  assert.deepEqual(deadlineState("2026-10-09", { now: justAfter, timeZone: SH }), { kind: "overdue", days: 1 });
  for (const empty of [null, undefined, "", "not a date"]) assert.deepEqual(deadlineState(empty, { now, timeZone: SH }), { kind: "none", days: 0 });
});

test("deadlineTone / deadlineText", () => {
  assert.equal(deadlineTone({ kind: "overdue", days: 3 }), "danger");
  assert.equal(deadlineTone({ kind: "today", days: 0 }), "warning");
  assert.equal(deadlineTone({ kind: "soon", days: 2 }), "warning");
  assert.equal(deadlineTone({ kind: "none", days: 0 }), null);
  assert.equal(deadlineText({ kind: "overdue", days: 3 }), "已逾期 3 天");
  assert.equal(deadlineText({ kind: "overdue", days: 3 }, true), "逾期 3 天");
  assert.equal(deadlineText({ kind: "today", days: 0 }), "今天到期");
  assert.equal(deadlineText({ kind: "soon", days: 1 }), "明天到期");
  assert.equal(deadlineText({ kind: "soon", days: 2 }), "2 天后到期");
  assert.equal(deadlineText({ kind: "none", days: 0 }), "");
});

test("fieldDeadline: only date / datetime deadline fields; closed rows and the field zone", () => {
  type Row = { due: string | null; done?: boolean };
  const field = { key: "due", type: "date", deadline: { closed: (r: Row) => r.done === true } };
  assert.deepEqual(fieldDeadline(field, { due: "2026-10-01" }, { now, timeZone: SH }), { kind: "overdue", days: 8 });
  assert.equal(fieldDeadline(field, { due: "2026-10-01", done: true }, { now, timeZone: SH }), null);
  assert.equal(fieldDeadline({ key: "due", type: "date" }, { due: "2026-10-01" }, { now }), null);
  assert.equal(fieldDeadline({ key: "due", type: "text", deadline: true }, { due: "2026-10-01" }, { now }), null);
  assert.equal(fieldDeadline({ key: "due", type: "datetime", deadline: true, timeZone: NY }, { due: "2026-10-08T15:30:00Z" }, { now, timeZone: SH })?.kind, "today");
  const at = { key: "at", type: "datetime", deadline: true, value: (r: { at: number }) => r.at };
  assert.equal(fieldDeadline(at, { at: Date.parse("2026-10-07T03:00:00Z") }, { now, timeZone: SH })?.days, 2);
});

test("deadlineEvents: calendar events marked as deadlines turn red (overdue) / yellow (today, soon)", () => {
  const events = [
    { id: "a", start: "2026-10-07", tone: "green" as const, deadline: true },
    { id: "b", start: "2026-10-09", deadline: true },
    { id: "c", start: "2026-10-05", end: "2026-10-10", deadline: true },
    { id: "d", start: "2026-10-20", tone: "blue" as const, deadline: true },
    { id: "e", start: "2026-10-01", tone: "teal" as const },
  ];
  const out = deadlineEvents(events, "2026-10-09", SH);
  assert.deepEqual(out.map((e) => e.tone), ["red", "yellow", "yellow", "blue", "teal"]);
  const plain = [{ id: "x", start: "2026-10-01" }];
  assert.equal(deadlineEvents(plain, "2026-10-09", SH), plain, "no deadline events: same array");
});
