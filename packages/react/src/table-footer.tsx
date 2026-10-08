"use client";
/**
 * DataTable's pagination footer: left 「共 168 条」 (with a selection 「已选 2 / 共 168 条」),
 * right page size + page numbers with the current page on the primary soft background. Cursor lists have no
 * total: left 「已显示 1–20 条」, right only ‹ › — never 「第 1 页」. Styles: styles/table.css (.aui-pagination).
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Choice } from "./primitives.tsx";
import { pageSizeOptions, pageWindow } from "./contracts.ts";
import { cursorRange, footerCountText } from "./data-card-core.ts";
import type { CursorPagination, DataTablePagination, PagePagination } from "./data.tsx";
import { IconButton } from "./buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/table.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/table.css";

export type TableFooterProps = {
  pagination: DataTablePagination;
  /** Rows on this page (cursor range, 「全部」 count). */
  rowCount: number;
  loading?: boolean;
  /** false while loading / failed: the pager is disabled. */
  interactive: boolean;
  /** Selected row count (「已选 2 / 共 168 条」). */
  selected: number;
};

function SizeChoice({ sizes, value, disabled, onChange }: { sizes: readonly number[]; value: number; disabled: boolean; onChange: (size: number) => void }) {
  if (sizes.length < 2) return null;
  return (
    <Choice
      label="每页条数"
      value={String(value)}
      options={sizes.map((n) => ({ value: String(n), label: `${n} 条/页` }))}
      disabled={disabled}
      onChange={(v) => onChange(Number(v))}
    />
  );
}

function PagePager({ pagination, interactive }: { pagination: PagePagination; interactive: boolean }) {
  const pageCount = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const sizes = pageSizeOptions(pagination.pageSizes ?? [10, 20, 50], pagination.pageSize);
  return (
    <div className="aui-pager">
      <SizeChoice sizes={sizes} value={pagination.pageSize} disabled={!interactive} onChange={pagination.onPageSizeChange} />
      <IconButton label="上一页" disabled={!interactive || pagination.page <= 1} onClick={() => pagination.onPageChange(pagination.page - 1)} icon={<ChevronLeft />} />
      <span className="aui-page-numbers">
        {pageWindow(pagination.page, pageCount).map((n) => (
          <Button key={n} variant="ghost" size="sm" className="aui-page-num" aria-label={`第 ${n} 页`} aria-current={pagination.page === n ? "page" : undefined} disabled={!interactive} onClick={() => pagination.onPageChange(n)}>{n}</Button>
        ))}
      </span>
      {/* Narrow phones: 「3 / 9」 between ‹ › instead of five page buttons, so the footer never wraps. */}
      <span className="aui-page-compact">
        {pagination.page} / {pageCount}
      </span>
      <IconButton label="下一页" disabled={!interactive || pagination.page >= pageCount} onClick={() => pagination.onPageChange(pagination.page + 1)} icon={<ChevronRight />} />
    </div>
  );
}

function CursorPager({ pagination, interactive }: { pagination: CursorPagination; interactive: boolean }) {
  // Page size only when the host offers several sizes on purpose (the cursor footer is ‹ › by default).
  const sizes = pagination.pageSizes ? pageSizeOptions(pagination.pageSizes, pagination.pageSize) : [];
  return (
    <div className="aui-pager">
      <SizeChoice sizes={sizes} value={pagination.pageSize} disabled={!interactive} onChange={pagination.onPageSizeChange} />
      <IconButton label="上一页" disabled={!interactive || !pagination.canPrev} onClick={pagination.onPrev} icon={<ChevronLeft />} />
      <IconButton label="下一页" disabled={!interactive || !pagination.canNext} onClick={pagination.onNext} icon={<ChevronRight />} />
    </div>
  );
}

/** The footer under a DataTable (also usable under a custom list with the same pagination object). */
export function TableFooter({ pagination, rowCount, loading, interactive, selected }: TableFooterProps) {
  if (pagination.mode === "all") {
    return (
      <footer className="aui-pagination" data-mode="all">
        <span className="aui-pagination-count">{footerCountText(loading ? null : rowCount, selected)}</span>
      </footer>
    );
  }
  if (pagination.mode === "cursor") {
    const range = loading ? null : cursorRange(pagination.pageIndex, pagination.pageSize, rowCount);
    return (
      <footer className="aui-pagination" data-mode="cursor">
        <span className="aui-pagination-count">
          {selected > 0 && <>已选 <b>{selected.toLocaleString("zh-CN")}</b> · </>}
          {loading ? "已显示 — 条" : range ? <>已显示 <b>{range.from.toLocaleString("zh-CN")}–{range.to.toLocaleString("zh-CN")}</b> 条</> : "没有更多了"}
        </span>
        <CursorPager pagination={pagination} interactive={interactive} />
      </footer>
    );
  }
  return (
    <footer className="aui-pagination" data-mode="page">
      <span className="aui-pagination-count">
        {loading ? "共 — 条" : selected > 0 ? <>已选 <b>{selected.toLocaleString("zh-CN")}</b> / 共 <b>{pagination.total.toLocaleString("zh-CN")}</b> 条</> : <>共 <b>{pagination.total.toLocaleString("zh-CN")}</b> 条</>}
      </span>
      <PagePager pagination={pagination} interactive={interactive} />
    </footer>
  );
}
