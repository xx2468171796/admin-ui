import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { importTsx } from "./ssr.ts";

type Any = ComponentType<Record<string, unknown>>;
const { AdminProvider } = await importTsx<{ AdminProvider: Any }>("src/theme.tsx");
const { NotificationProvider } = await importTsx<{ NotificationProvider: Any }>("src/notifications.tsx");
const render = (node: ReactNode) => renderToString(createElement(AdminProvider, {}, createElement(NotificationProvider, {}, node)));
const tag = (html: string, pattern: RegExp) => html.match(pattern)?.[0] ?? "";

type Row = { id: string; name: string };
const tableProps = (loading: boolean, extra: Record<string, unknown> = {}) => ({
  rows: [{ id: "3f2a-uuid", name: "赵静怡" }],
  columns: [{ key: "name", title: "姓名", sortable: true, render: (r: Row) => r.name }],
  rowKey: (r: Row) => r.id,
  caption: "客户",
  loading,
  onSortChange: () => {},
  selected: [],
  onSelectionChange: () => {},
  pagination: { mode: "page", total: 30, page: 2, pageSize: 10, onPageChange: () => {}, onPageSizeChange: () => {} },
  ...extra,
});

test("DataTable while loading: sort, select-all and pager stay focusable (aria-disabled, not disabled)", async () => {
  const { DataTable } = await importTsx<{ DataTable: Any }>("src/data.tsx");
  const html = render(createElement(DataTable, tableProps(true)));
  const sort = tag(html, /<button[^>]*class="aui-sort"[^>]*>/);
  assert.match(sort, /aria-disabled="true"/);
  assert.doesNotMatch(sort, /\sdisabled=""/);
  const all = tag(html, /<button[^>]*aria-label="选择当前页"[^>]*>/);
  assert.match(all, /aria-disabled="true"/);
  assert.doesNotMatch(all, /\sdisabled=""/);
  for (const label of ["上一页", "下一页", "第 1 页"]) {
    const button = tag(html, new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`));
    assert.match(button, /aria-disabled="true"/, label);
    assert.doesNotMatch(button, /\sdisabled=""/, label);
  }
});

test("DataTable row checkbox is named by the row, not by its key", async () => {
  const { DataTable } = await importTsx<{ DataTable: Any }>("src/data.tsx");
  assert.match(render(createElement(DataTable, tableProps(false))), /aria-label="选择 赵静怡"/);
  assert.match(render(createElement(DataTable, tableProps(false, { rowLabel: (r: Row) => `客户 ${r.name}` }))), /aria-label="选择 客户 赵静怡"/);
});

test("SaveBar renders an array summary with separators (no [object Object])", async () => {
  const { SaveBar } = await importTsx<{ SaveBar: Any }>("src/page-templates.tsx");
  const html = render(createElement(SaveBar, { count: 2, summary: [createElement("b", { key: "a" }, "更新通道"), "语音播报"], onDiscard: () => {}, onSave: () => {} }));
  assert.doesNotMatch(html, /object Object/);
  assert.match(html, /<b>更新通道<\/b>、(<!-- -->)?语音播报/);
});

test("NotificationProvider: the toast stack is a persistent live region; error cards are alerts; text is not duplicated", () => {
  // Present before any toast (so the first one is read out) …
  const html = render(createElement("p", {}, "页面"));
  assert.match(html, /class="aui-notices" role="status" aria-live="polite"/);
  // … and no hidden copies of the toast text: a duplicate makes every host e2e `getByText(toast)` ambiguous.
  assert.doesNotMatch(html, /aui-sr-only/);
  const source = readFileSync(new URL("../src/notifications.tsx", import.meta.url), "utf8");
  assert.ok(source.includes('role={t.tone === "error" ? "alert" : undefined}'), "error cards are alerts");
});

test("LoginForm never shows the raw error of a failed sign-in", async () => {
  const { loginFailureText, LOGIN_FAILED_TEXT } = await importTsx<{ loginFailureText: (e: unknown, vet?: (e: unknown) => string | undefined) => string; LOGIN_FAILED_TEXT: string }>("src/auth-layout.tsx");
  assert.equal(loginFailureText(new Error("账号不存在")), LOGIN_FAILED_TEXT);
  assert.equal(loginFailureText(new TypeError("Failed to fetch")), LOGIN_FAILED_TEXT);
  assert.equal(loginFailureText(new Error("还能试 3 次"), (e) => (e instanceof Error ? e.message : undefined)), "还能试 3 次");
});

test("CellHistoryPopover offers 加载更多 when the host pages the versions", async () => {
  // The real layer only shows after mount (position measured); render its children directly.
  const { CellHistoryPopover } = await importTsx<{ CellHistoryPopover: Any }>("src/cell-history.tsx", { "popover-panel.tsx": "export const PopoverLayer = (p: { open: boolean; children: unknown }) => (p.open ? p.children : null);" });
  const versions = [{ id: "v1", at: 0, actor: { name: "周敏" }, source: "grid", before: "1", after: "2" }];
  const html = render(createElement(CellHistoryPopover, { open: true, onClose: () => {}, anchorRect: { left: 0, top: 0, width: 10, height: 10, right: 10, bottom: 10 }, subject: "金额", versions, scope: "cell", onLoadMore: () => {}, hasMore: true }));
  assert.match(html, /aui-loadmore/);
});

test("useDashboardFilters: the first render uses the defaults even when the URL has filters (no hydration mismatch)", async () => {
  const { useDashboardFilters } = await importTsx<{ useDashboardFilters: (d: Record<string, unknown>) => readonly [Record<string, unknown>, unknown] }>("src/dashboard-filters.tsx");
  const Probe = () => createElement("output", {}, String(useDashboardFilters({ time: "month", compare: "none", dims: {} })[0].time));
  Object.assign(globalThis, { window: { location: { search: "?t=week", pathname: "/", hash: "" } } });
  try {
    assert.match(renderToString(createElement(Probe)), /<output>month<\/output>/);
  } finally {
    Reflect.deleteProperty(globalThis, "window");
  }
});

test("ApprovalDetail starts over for another request (keyed by request.id: no comment typed for A reaches B)", async () => {
  const { ApprovalDetail } = await importTsx<{ ApprovalDetail: (p: Record<string, unknown>) => { key: string | null } }>("src/approval.tsx");
  assert.equal(ApprovalDetail({ request: { id: "A" } }).key, "A");
  assert.equal(ApprovalDetail({ request: { id: "B" } }).key, "B");
});
