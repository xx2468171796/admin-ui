import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement, useState, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Note } from "../src/note.ts";
import { clampLocalPage, localPageCount, localPageRows, pageAfterResize, useLocalPagination, type LocalPagination, type LocalPaginationOptions } from "../src/local-pagination.ts";
import { withWidth } from "../src/control-width.ts";
import type { PagePagination } from "../src/data.tsx";

test("Note renders .aui-note as p / span / div; tone colours the text, default stays the note grey", () => {
  assert.equal(renderToStaticMarkup(createElement(Note, null, "说明")), '<p class="aui-note">说明</p>');
  assert.equal(renderToStaticMarkup(createElement(Note, { as: "span", className: "x", id: "n" }, "提示")), '<span id="n" class="aui-note x">提示</span>');
  assert.equal(renderToStaticMarkup(createElement(Note, { as: "div", tone: "danger" }, "超出额度")), '<div class="aui-note" data-note-tone="danger" style="color:var(--aui-danger)">超出额度</div>');
  // A host style wins over the tone colour; other props pass through.
  assert.match(renderToStaticMarkup(createElement(Note, { tone: "warning", style: { color: "red", marginTop: 4 }, role: "status" }, "x")), /^<p role="status" class="aui-note" data-note-tone="warning" style="color:red;margin-top:4px">x<\/p>$/);
});

test("local page maths: page count ≥ 1, clamping, slices, resize keeps the first row visible", () => {
  assert.equal(localPageCount(0, 20), 1);
  assert.equal(localPageCount(41, 20), 3);
  assert.equal(clampLocalPage(5, 41, 20), 3);
  assert.equal(clampLocalPage(0, 41, 20), 1);
  assert.equal(clampLocalPage(Number.NaN, 41, 20), 1);
  const rows = Array.from({ length: 45 }, (_, i) => i + 1);
  assert.deepEqual(localPageRows(rows, 3, 20), [41, 42, 43, 44, 45]);
  assert.deepEqual(localPageRows(rows, 9, 20), [41, 42, 43, 44, 45], "out of range → last page");
  assert.deepEqual(localPageRows([], 1, 20), []);
  assert.equal(pageAfterResize(3, 20, 50), 1, "row 41 is on page 1 of 50");
  assert.equal(pageAfterResize(3, 10, 5), 5, "row 21 is on page 5 of 5");
});

/** Render the hook on the server and hand back what it returned (render-phase updates included). */
function runHook<T>(rows: readonly T[], options?: LocalPaginationOptions): LocalPagination<T> {
  let out: LocalPagination<T> | null = null;
  const Probe = (): ReactElement | null => {
    out = useLocalPagination(rows, options);
    return null;
  };
  renderToStaticMarkup(createElement(Probe));
  if (!out) throw new Error("hook did not run");
  return out;
}

test("useLocalPagination: rows of the page + a PagePagination for DataTable; the initial page is clamped when rows are fewer", () => {
  const rows = Array.from({ length: 45 }, (_, i) => ({ id: String(i + 1) }));
  const first = runHook(rows, { pageSize: 20, pageSizes: [20, 50] });
  assert.equal(first.page, 1);
  assert.equal(first.pageCount, 3);
  assert.equal(first.pageRows.length, 20);
  const pagination: PagePagination = first.pagination; // type-checks as DataTable's page pagination
  assert.equal(pagination.mode, "page");
  assert.equal(pagination.total, 45);
  assert.deepEqual(pagination.pageSizes, [20, 50]);
  assert.equal(pagination.onPageChange, first.setPage);
  assert.equal(pagination.onPageSizeChange, first.setPageSize);
  const late = runHook(rows, { pageSize: 20, initialPage: 7 });
  assert.equal(late.page, 3, "page 7 of 3 pages → 3");
  assert.deepEqual(late.pageRows.map((r) => r.id), ["41", "42", "43", "44", "45"]);
  assert.equal(late.pagination.page, 3);
  const empty = runHook([], {});
  assert.equal(empty.page, 1);
  assert.equal(empty.pageSize, 20, "default page size");
  assert.equal(empty.pagination.total, 0);
  assert.equal("pageSizes" in empty.pagination, false, "no pageSizes → DataTable default");
});

test("useLocalPagination: rows shrinking under the open page clamp it and the clamp sticks when rows grow back", () => {
  const big = Array.from({ length: 45 }, (_, i) => i);
  const small = big.slice(0, 10);
  const seen: number[] = [];
  const Probe = (): ReactElement | null => {
    const [rows, setRows] = useState<readonly number[]>(big);
    const [step, setStep] = useState(0);
    const p = useLocalPagination(rows, { pageSize: 20, initialPage: 3 });
    seen.push(p.page);
    // Render-phase updates re-run this component with its hook state kept: filter → 10 rows, then clear the filter.
    if (step === 0) {
      setStep(1);
      setRows(small);
    } else if (step === 1) {
      setStep(2);
      setRows(big);
    }
    return null;
  };
  renderToStaticMarkup(createElement(Probe));
  assert.deepEqual(seen.filter((p, i) => i === 0 || p !== seen[i - 1]), [3, 1], "page 3 → 1 when 10 rows are left, and stays 1 when 45 come back");
});

test("width prop: Input / Choice / MultiChoice / AsyncChoice map width to inline-size (px for numbers), capped at the container", () => {
  assert.equal(withWidth(undefined, undefined), undefined);
  assert.deepEqual(withWidth({ color: "red" }, undefined), { color: "red" });
  assert.deepEqual(withWidth(undefined, 160), { inlineSize: "160px", maxInlineSize: "100%" });
  assert.deepEqual(withWidth({ marginTop: 4 }, "12em"), { marginTop: 4, inlineSize: "12em", maxInlineSize: "100%" });
  const primitives = readFileSync(new URL("../src/primitives.tsx", import.meta.url), "utf8");
  assert.match(primitives, /width\?: number \| string;/);
  assert.match(primitives, /style=\{withWidth\(props\.style, width\)\}/, "bare input");
  assert.match(primitives, /style=\{withWidth\(undefined, width\)\}/, "boxed input: on the outer box");
  const select = readFileSync(new URL("../src/select.tsx", import.meta.url), "utf8");
  assert.match(select, /width\?: ControlWidth;/);
  assert.equal(select.match(/style=\{withWidth\(undefined, props\.width\)\}/g)?.length, 2, "Choice + MultiChoice triggers");
  const asyncChoice = readFileSync(new URL("../src/async-choice.tsx", import.meta.url), "utf8");
  assert.match(asyncChoice, /style=\{withWidth\(undefined, props\.width\)\}/);
});
