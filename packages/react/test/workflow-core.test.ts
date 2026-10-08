import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePreferences,
  parseCsv,
  readViewUrl,
  safeDownloadUrl,
  selectionCount,
  viewUrl,
} from "../src/workflow-core.ts";
test("CSV import preserves quoted fields and rejects malformed, duplicate and oversized data", () => {
  assert.deepEqual(parseCsv('\ufeffid,name\r\n1,"line\nwith,""quotes"""\r\n'), {
    headers: ["id", "name"],
    rows: [{ id: "1", name: 'line\nwith,"quotes"' }],
  });
  assert.throws(() => parseCsv("a,a\n1,2"), /重复/);
  assert.throws(() => parseCsv("a,b\n1"), /列数/);
  assert.throws(() => parseCsv('a\n"open'), /闭合/);
  assert.throws(() => parseCsv('a\n"closed"x'), /格式/);
  assert.throws(() => parseCsv("a\n1\n2", 1), /最多/);
  const row = parseCsv("__proto__,constructor\nsafe,value").rows[0]!;
  assert.equal(Object.getPrototypeOf(row), Object.prototype);
  assert.equal(row.__proto__, "safe");
});
test("preferences survive removed columns, duplicates and invalid page sizes without hiding every column", () => {
  assert.deepEqual(
    normalizePreferences(
      {
        density: "compact",
        columns: ["deleted", "b", "b"],
        hidden: ["a", "b"],
        pageSize: -100,
        pinned: "deleted",
      },
      ["a", "b"],
    ),
    {
      density: "compact",
      columns: ["b", "a"],
      hidden: ["b"],
      pageSize: 20,
      pinned: undefined,
    },
  );
});
test("query selection is explicit and ids are deduplicated", () => {
  assert.equal(selectionCount({ mode: "ids", ids: ["a", "a", "b"] }), 2);
  assert.equal(
    selectionCount({ mode: "query", token: "server-snapshot", count: 50000 }),
    50000,
  );
});
test("shared URL parsing validates untrusted inputs and task links reject executable protocols", () => {
  const validate = (value: unknown): value is { search: string } =>
    typeof (value as { search?: unknown })?.search === "string";
  assert.deepEqual(
    readViewUrl(
      viewUrl("https://example.test/admin?other=1", { search: "a&b" }),
      validate,
    ),
    { search: "a&b" },
  );
  assert.equal(readViewUrl("https://example.test?view=%7Bbad", validate), null);
  assert.equal(
    readViewUrl(viewUrl("https://example.test", { search: 42 }), validate),
    null,
  );
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,bad",
    "file:///etc/passwd",
  ])
    assert.equal(safeDownloadUrl(url), undefined);
  assert.equal(safeDownloadUrl("/api/results/1"), "/api/results/1");
});
