// Grid date fixes (8.9.x audit): calendar days never shift in a time zone, one date parser, 「今天」 in a zone.
import test from "node:test";
import assert from "node:assert/strict";
import { calendarDay, formatDateTime } from "../src/format.ts";
import { editorText, parseDateText, parseFieldInput } from "../src/grid-edit-core.ts";
import { fieldText, filterGridRows, gridGroupKey, normalizeGridView, summarizeField, type GridField } from "../src/grid-core.ts";
import { parseDateParts, todayKey } from "../src/date-picker-core.ts";

type Row = { id: string; due: string | null };
const ZONES = ["America/Los_Angeles", "Pacific/Auckland", "Asia/Shanghai", "UTC"];

test("date field: a calendar day round-trips through editor → save → display in every zone (no day shift)", () => {
  for (const timeZone of ZONES) {
    const field: GridField<Row> = { key: "due", title: "截止", type: "date", editable: true, timeZone };
    let value: unknown = "2026-09-30";
    for (let i = 0; i < 3; i++) {
      const text = editorText(field, value);
      assert.equal(text, "2026-09-30", `${timeZone}: editor starts with the stored day`);
      const parsed = parseFieldInput(field, text);
      assert.ok(parsed.ok);
      value = parsed.value;
    }
    assert.equal(value, "2026-09-30", `${timeZone}: three edits later the day is unchanged`);
    assert.equal(fieldText(field, { id: "a", due: "2026-09-30" }), "2026-09-30", `${timeZone}: cell text`);
    assert.equal(gridGroupKey(field, { id: "a", due: "2026-09-30" }), "2026-09-30", `${timeZone}: group key`);
  }
});

test("date field: day filters, min / max summaries and formatDateTime treat YYYY-MM-DD as a calendar day", () => {
  const timeZone = "America/Los_Angeles";
  const field: GridField<Row> = { key: "due", title: "截止", type: "date", timeZone };
  const rows: Row[] = [{ id: "a", due: "2026-09-30" }, { id: "b", due: "2026-10-01" }];
  assert.equal(formatDateTime("2026-09-30", { timeZone }), "2026-09-30");
  assert.equal(formatDateTime("2026-09-30", { timeZone, time: true }), "2026-09-30 00:00");
  // Instants are still shown in the zone.
  assert.equal(formatDateTime("2026-09-30T03:00:00Z", { timeZone }), "2026-09-29");
  assert.equal(summarizeField(field, rows, "min").text, "2026-09-30");
  assert.equal(summarizeField(field, rows, "max").text, "2026-10-01");
  const view = normalizeGridView({ filters: [{ id: "f", field: "due", op: "is", value: "2026-09-30" }] }, [field]);
  assert.deepEqual(filterGridRows(rows, [field], view).map((r) => r.id), ["a"]);
  assert.equal(calendarDay("2026-02-30"), null);
  assert.equal(calendarDay("2026-09-30T00:00:00Z"), null);
});

test("one date parser: the grid accepts what the date picker accepts (10/5, 20261005, full-width digits, seconds)", () => {
  const now = new Date(2026, 5, 1);
  const day = (text: string) => { const p = parseDateText(text, now); return p ? `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}` : null; };
  assert.equal(day("10/5"), "2026-10-05");
  assert.equal(day("20261005"), "2026-10-05");
  assert.equal(day("２０２６－１０－０５".replace("－", "/").replace("－", "/")), "2026-10-05");
  assert.equal(day("２０２６年１０月５日"), "2026-10-05");
  assert.equal(day("2026年9月30日"), "2026-09-30");
  assert.equal(day("2026/2/30"), null);
  assert.deepEqual(parseDateText("2026-09-30 14:05:09", now), { y: 2026, m: 9, d: 30, hh: 14, mm: 5, ss: 9, time: true });
  assert.deepEqual(parseDateText("2026-09-30T14:05", now), { y: 2026, m: 9, d: 30, hh: 14, mm: 5, ss: 0, time: true });
  assert.equal(parseDateText("2026-09-30 25:00", now), null);
  assert.equal(parseDateText("45000", now)?.y, 2023, "Excel serial days still work");
  const field: GridField<Row> = { key: "due", title: "截止", type: "date", editable: true };
  assert.deepEqual(parseFieldInput(field, "20261005"), { ok: true, value: "2026-10-05" });
  assert.equal(parseDateParts("2026 年 10 月 5 日 21点30", now)?.hh, 21);
});

test("todayKey answers the day in a given time zone (grid date editors pass the field's zone)", () => {
  const now = new Date("2026-10-01T02:00:00Z");
  assert.equal(todayKey(now, "America/Los_Angeles"), "2026-09-30");
  assert.equal(todayKey(now, "Asia/Shanghai"), "2026-10-01");
  assert.equal(todayKey(new Date("2026-10-01T13:00:00Z"), "Pacific/Auckland"), "2026-10-02");
});
