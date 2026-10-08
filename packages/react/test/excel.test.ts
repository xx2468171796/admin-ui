import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseSpreadsheet } from "../src/excel.ts";
test("optional XLSX adapter reads a real workbook without losing numeric precision and honors cancellation", async () => {
  const file = new File(
    [readFileSync(new URL("fixtures/import.xlsx", import.meta.url))],
    "data.xlsx",
  );
  assert.deepEqual(await parseSpreadsheet(file, new AbortController().signal), {
    headers: ["name", "count"],
    rows: [{ name: "Alice", count: "12345678901234567" }],
  });
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(parseSpreadsheet(file, aborted.signal), {
    name: "AbortError",
  });
  await assert.rejects(
    parseSpreadsheet(
      new File(["bad"], "bad.xlsx"),
      new AbortController().signal,
    ),
  );
});
