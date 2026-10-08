// G1 金额小数位（¥2,379,000.00 这类多余小数）：值始终是「分」，只改显示。
import test from "node:test";
import assert from "node:assert/strict";
import { formatMinorMoney, roundMinor } from "../src/format.ts";
import { summarizeField, valueText, type GridField } from "../src/grid-core.ts";
import { parseFieldInput } from "../src/grid-edit-core.ts";

test("digits 0：237900000 分 → ¥2,379,000，值不变", () => {
  assert.equal(formatMinorMoney(237900000n, { symbol: "¥", digits: 0 }), "¥2,379,000");
  assert.equal(formatMinorMoney(237900000n, { symbol: "¥" }), "¥2,379,000.00", "不给 digits 照旧两位");
  assert.equal(formatMinorMoney(12345n, { symbol: "¥", digits: 1 }), "¥123.5", "一位小数：123.45 → 123.5（四舍五入，远离零）");
});

test("舍入规则：远离零的四舍五入；舍成 0 不带负号", () => {
  assert.equal(formatMinorMoney(12350n, { symbol: "¥", digits: 0 }), "¥124");
  assert.equal(formatMinorMoney(12349n, { symbol: "¥", digits: 0 }), "¥123");
  assert.equal(formatMinorMoney(-12350n, { symbol: "¥", digits: 0 }), "−¥124");
  assert.equal(formatMinorMoney(-40n, { symbol: "¥", digits: 0 }), "¥0");
  assert.equal(formatMinorMoney(-5n, { symbol: "¥", digits: 1 }), "−¥0.1");
  assert.equal(roundMinor(12350n, 0), 12400n);
  assert.equal(roundMinor(-12349n, 0), -12300n);
  assert.equal(roundMinor(12345n, 2), 12345n);
});

test("digits 越界会被夹住；minorDigits 0 的币种（如日元）", () => {
  assert.equal(formatMinorMoney(12345n, { symbol: "¥", digits: 5 }), "¥123.45");
  assert.equal(formatMinorMoney(12345n, { symbol: "¥", digits: -1 }), "¥123");
  assert.equal(formatMinorMoney(12345n, { symbol: "JP¥", minorDigits: 0 }), "JP¥12,345");
  assert.equal(formatMinorMoney(900719925474099350n, { symbol: "", digits: 0 }), "9,007,199,254,740,994", "超过 2^53 仍精确");
});

type Row = { amount: number | null };
const money = (extra: Partial<GridField<Row>> = {}): GridField<Row> => ({ key: "amount", title: "金额", type: "money", currency: "¥", editable: true, ...extra });

test("表格：格子文字和统计都按 precision 显示金额", () => {
  const field = money({ precision: 0 });
  assert.equal(valueText(field, 237900000), "¥2,379,000");
  const rows: Row[] = [{ amount: 237900000 }, { amount: 50 }, { amount: null }];
  assert.equal(summarizeField(field, rows, "sum").text, "¥2,379,001");
  assert.equal(summarizeField(field, rows, "sum").value, 237900050n, "统计值本身仍是精确的分");
  assert.equal(summarizeField(field, rows, "avg").text, "¥1,189,500");
  assert.equal(valueText(money(), 237900000), "¥2,379,000.00", "不写 precision 照旧两位");
});

test("表格：输入按 precision 取整，仍存分", () => {
  assert.deepEqual(parseFieldInput(money({ precision: 0 }), "¥2,379,000"), { ok: true, value: 237900000 });
  assert.deepEqual(parseFieldInput(money({ precision: 0 }), "12.5"), { ok: true, value: 1300 });
  assert.deepEqual(parseFieldInput(money({ precision: 1 }), "12.34"), { ok: true, value: 1230 });
  assert.deepEqual(parseFieldInput(money(), "12.34"), { ok: true, value: 1234 });
  assert.equal(parseFieldInput(money({ precision: 0 }), "abc").ok, false);
});
