import test from "node:test";
import assert from "node:assert/strict";
// Type-only imports are erased at runtime, so this file stays JSX-free for `node --test`.
import type { CursorResult, ListResult } from "../src/contracts.ts";
import type { DataTableProps, DataTablePagination } from "../src/data.tsx";
type Row = { id: string };
const base = {
  rows: [] as Row[],
  columns: [],
  rowKey: (row: Row) => row.id,
  caption: "账本",
};
// Page mode keeps requiring a real server-side total.
const pageMode: DataTableProps<Row> = {
  ...base,
  pagination: {
    mode: "page",
    total: 1200,
    page: 1,
    pageSize: 20,
    onPageChange: () => {},
    onPageSizeChange: () => {},
  },
};
// 5.0: the flat page props (total / page / pageSize / onPageChange …) are gone; pass `pagination`.
const legacyMode: DataTableProps<Row> = {
  ...base,
  // @ts-expect-error pagination is required; a flat total no longer type-checks
  total: 1200,
  page: 1,
  pageSize: 20,
  onPageChange: () => {},
  onPageSizeChange: () => {},
};
const cursorMode: DataTableProps<Row> = {
  ...base,
  pagination: {
    mode: "cursor",
    pageIndex: 1,
    pageSize: 20,
    onPageSizeChange: () => {},
    canPrev: false,
    canNext: true,
    onPrev: () => {},
    onNext: () => {},
  },
};
// @ts-expect-error 游标模式没有服务端总数，伪造 total 必须编译不过（错误报在整个字面量上）
const forgedTotal: DataTablePagination = {
  mode: "cursor",
  pageIndex: 1,
  pageSize: 20,
  onPageSizeChange: () => {},
  canPrev: false,
  canNext: true,
  onPrev: () => {},
  onNext: () => {},
  total: 9999,
};
// @ts-expect-error 游标模式没有页码，只有上一页/下一页
const forgedPage: DataTablePagination = {
  mode: "cursor",
  pageIndex: 1,
  pageSize: 20,
  onPageSizeChange: () => {},
  canPrev: false,
  canNext: true,
  onPrev: () => {},
  onNext: () => {},
  page: 3,
};
const forgedResult: CursorResult<Row> = {
  rows: [],
  hasMore: false,
  // @ts-expect-error 游标适配器的返回值里不允许出现 total
  total: 0,
};
// A page adapter result keeps total required, so the two modes cannot be swapped by accident.
const pageResult: ListResult<Row> = { rows: [], total: 0 };
test("pagination modes stay type-separated and cursor mode cannot carry a total", () => {
  assert.equal(
    (pageMode.pagination as { mode: string } | undefined)?.mode,
    "page",
  );
  assert.equal(legacyMode.pagination, undefined, "the flat props no longer type-check");
  assert.equal(
    (cursorMode.pagination as { mode: string } | undefined)?.mode,
    "cursor",
  );
  // The real guards above are compile-time; these keep the values referenced.
  assert.equal(forgedTotal.mode, "cursor");
  assert.equal(forgedPage.mode, "cursor");
  assert.deepEqual(forgedResult.rows, []);
  assert.equal(pageResult.total, 0);
});
