/**
 * Page through rows that are already in memory (a loaded config list, a client-side filter result): the slice
 * for the current page plus a `pagination` object that plugs straight into DataTable / TableFooter
 * (`mode: "page"`). The page is clamped whenever the rows shrink (a filter left 2 pages while page 5 was open);
 * changing the page size keeps the first visible row on screen. For server-paged lists pass your own
 * PagePagination instead.
 */
import { useState } from "react";
import type { PagePagination } from "./data.tsx";

export type LocalPaginationOptions = {
  /** Rows per page (default 20). */
  pageSize?: number;
  /** 1-based page to start on (default 1). */
  initialPage?: number;
  /** Sizes offered in the footer (default DataTable's 10 / 20 / 50). */
  pageSizes?: readonly number[];
};

export type LocalPagination<T> = {
  /** 1-based, always within 1…pageCount. */
  page: number;
  pageSize: number;
  pageCount: number;
  /** Rows of the current page. */
  pageRows: T[];
  total: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  /** `<DataTable rows={pageRows} pagination={pagination} />`. */
  pagination: PagePagination;
};

const positive = (n: number, fallback: number) => (Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback);

/** The page count of `total` rows (at least 1, so an empty list is page 1 of 1). */
export function localPageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / positive(pageSize, 1)));
}

/** `page` clamped into 1…pageCount. */
export function clampLocalPage(page: number, total: number, pageSize: number): number {
  return Math.min(localPageCount(total, pageSize), positive(page, 1));
}

/** The rows of one page. Pure. */
export function localPageRows<T>(rows: readonly T[], page: number, pageSize: number): T[] {
  const size = positive(pageSize, 1);
  const at = (clampLocalPage(page, rows.length, size) - 1) * size;
  return rows.slice(at, at + size);
}

/** The page that keeps the first row of `page` (at `oldSize`) visible at `newSize`. */
export function pageAfterResize(page: number, oldSize: number, newSize: number): number {
  return Math.floor(((positive(page, 1) - 1) * positive(oldSize, 1)) / positive(newSize, 1)) + 1;
}

export function useLocalPagination<T>(rows: readonly T[], options: LocalPaginationOptions = {}): LocalPagination<T> {
  const [state, setState] = useState(() => ({ page: positive(options.initialPage ?? 1, 1), pageSize: positive(options.pageSize ?? 20, 20) }));
  const total = rows.length;
  const page = clampLocalPage(state.page, total, state.pageSize);
  // Rows shrank under the open page: remember the clamped page, so growing again does not jump back.
  if (page !== state.page) setState({ ...state, page });
  const setPage = (next: number) => setState((s) => ({ ...s, page: positive(next, 1) }));
  const setPageSize = (size: number) => setState((s) => ({ page: pageAfterResize(s.page, s.pageSize, size), pageSize: positive(size, s.pageSize) }));
  return {
    page,
    pageSize: state.pageSize,
    pageCount: localPageCount(total, state.pageSize),
    pageRows: localPageRows(rows, page, state.pageSize),
    total,
    setPage,
    setPageSize,
    pagination: { mode: "page", total, page, pageSize: state.pageSize, ...(options.pageSizes ? { pageSizes: options.pageSizes } : {}), onPageChange: setPage, onPageSizeChange: setPageSize },
  };
}
