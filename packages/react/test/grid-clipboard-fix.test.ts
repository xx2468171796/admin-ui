// Copy from the grid: cells a spreadsheet would run as formulas are escaped like the CSV export (reports-core).
import test from "node:test";
import assert from "node:assert/strict";
import { parseTsv, toHtmlTable, toTsv } from "../src/grid-edit-core.ts";
import { escapeFormula } from "../src/grid-clipboard-text.ts";

test("copy escapes cells starting with = + - @ (formula injection), paste back restores them", () => {
  const matrix = [["=HYPERLINK(\"http://x\",\"点我\")", "+86 138", "-1+2", "@SUM(A1)"], ["普通文本", "12", "−5", " =1"]];
  const tsv = toTsv(matrix);
  const cells = tsv.split("\r\n").flatMap((line) => line.split("\t"));
  assert.ok(cells[0]!.startsWith("\"'="), "quoted cell keeps the quote inside the field");
  assert.equal(cells[1], "'+86 138");
  assert.equal(cells[2], "'-1+2");
  assert.equal(cells[3], "'@SUM(A1)");
  assert.equal(cells[4], "普通文本");
  assert.equal(cells[5], "12");
  assert.equal(cells[6], "−5", "the grid's own minus sign (U+2212) is not a formula");
  assert.equal(cells[7], "' =1");
  assert.ok(toHtmlTable(matrix).includes("<td>'+86 138</td>"));
  assert.deepEqual(parseTsv(tsv), matrix, "pasting a copy back into the grid gives the original text");
  assert.equal(escapeFormula("abc"), "abc");
});
