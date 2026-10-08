// 表单逐项出错（FormDialog / FormField）：按控件 id 记错、找第一个出错的框聚焦并滚到中间、没有出错框时滚到整表的错误行。
import assert from "node:assert/strict";
import test from "node:test";
import { FormFieldErrors, isFormFieldErrors, pruneFieldErrors, revealFirstProblem, unplacedFieldErrors } from "../src/form-errors-core.ts";

test("FormFieldErrors carries messages by control id and a summary message", () => {
  const one = new FormFieldErrors({ name: "请填客户名称" });
  assert.equal(one.message, "请填客户名称");
  assert.deepEqual(one.fields, { name: "请填客户名称" });
  assert.equal(new FormFieldErrors({ a: "x", b: "y" }).message, "有 2 项要改");
  assert.ok(isFormFieldErrors(one));
  assert.ok(!isFormFieldErrors(new Error("x")));
  // A copy from another bundle (same name + fields) still counts.
  const foreign = Object.assign(new Error("x"), { name: "FormFieldErrors", fields: { a: "x" } });
  assert.ok(isFormFieldErrors(foreign));
});

test("pruneFieldErrors drops empty messages and the edited field, keeps identity when nothing changes", () => {
  const errors = { a: "x", b: "" };
  assert.deepEqual(pruneFieldErrors(errors), { a: "x" });
  const clean = { a: "x" };
  assert.equal(pruneFieldErrors(clean), clean);
  assert.deepEqual(pruneFieldErrors({ a: "x", c: "z" }, "a"), { c: "z" });
});

test("unplacedFieldErrors lists messages whose control isn't on the page", () => {
  assert.deepEqual(unplacedFieldErrors({ a: "x", b: "y" }, (id) => id === "a"), ["y"]);
});

type Call = { focus: number; scroll: string[] };
function node(name: string, calls: Record<string, Call>, opts: { focusable?: boolean; child?: ReturnType<typeof node> } = {}) {
  calls[name] = { focus: 0, scroll: [] };
  return {
    name,
    matches: () => opts.focusable ?? true,
    querySelector: () => opts.child ?? null,
    focus: () => { calls[name]!.focus += 1; },
    scrollIntoView: (o?: { block?: string }) => { calls[name]!.scroll.push(o?.block ?? ""); },
  };
}

test("revealFirstProblem focuses the first invalid control, centered", () => {
  const calls: Record<string, Call> = {};
  const input = node("name", calls);
  const alert = node("alert", calls);
  const root = { querySelector: (sel: string) => (sel.includes("aria-invalid") ? input : sel.includes("alert") ? alert : null) };
  assert.equal(revealFirstProblem(root), "field");
  assert.equal(calls.name!.focus, 1);
  assert.deepEqual(calls.name!.scroll, ["center"]);
  assert.equal(calls.alert!.scroll.length, 0);
});

test("revealFirstProblem focuses inside an invalid wrapper, else scrolls to the form-level alert", () => {
  const calls: Record<string, Call> = {};
  const inner = node("inner", calls);
  const box = node("box", calls, { focusable: false, child: inner });
  assert.equal(revealFirstProblem({ querySelector: (sel) => (sel.includes("aria-invalid") ? box : null) }), "field");
  assert.equal(calls.inner!.focus, 1);
  assert.equal(calls.box!.focus, 0);
  const alert = node("alert", calls);
  assert.equal(revealFirstProblem({ querySelector: (sel) => (sel.includes("alert") ? alert : null) }), "alert");
  assert.deepEqual(calls.alert!.scroll, ["nearest"]);
  assert.equal(revealFirstProblem({ querySelector: () => null }), null);
  assert.equal(revealFirstProblem(null), null);
});
