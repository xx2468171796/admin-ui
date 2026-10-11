import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Availability, OrgIndex, PickedSubject, SubjectRef } from "../src/org-picker/org-picker-core.ts";
import type { OrgPickOptions, PickerModel } from "../src/org-picker/org-picker-model.ts";
import { importTsx } from "./ssr.ts";

const { usePickerModel, blockedReason } = await importTsx<{ usePickerModel: (o: OrgPickOptions, v: readonly PickedSubject[], s: () => void, i: OrgIndex) => PickerModel; blockedReason: (m: PickerModel, ref: SubjectRef, own?: Availability, status?: "left" | "disabled") => { kind: string } | null }>("src/org-picker/org-picker-model.ts");

/** Run the hook once (SSR) and hand back the model. */
function modelOf(options: OrgPickOptions): PickerModel {
  let out: PickerModel | null = null;
  const Probe = () => {
    out = usePickerModel(options, [], () => undefined, new Map());
    return null;
  };
  renderToStaticMarkup(createElement(Probe));
  if (!out) throw new Error("no model");
  return out;
}

const availability = (ref: SubjectRef): Availability | undefined =>
  ref.id === "out" ? { state: "locked", reason: "不在你的管理范围" } : ref.id === "other-co" ? { state: "hidden" } : ref.id === "half" ? { state: "partial" } : undefined;
const me = { kind: "person", id: "me" } as const;
const out = { kind: "person", id: "out" } as const;

test("hideUnselectable off (default): nothing is omitted, locked stays locked (greyed with a reason)", () => {
  const m = modelOf({ availability });
  assert.equal(m.hideUnselectable, false);
  for (const [ref, status] of [[out, undefined], [me, "left"], [{ kind: "dept", id: "other-co" }, undefined]] as const) assert.equal(m.omits(ref, undefined, status), false);
  assert.equal(m.avail(out).state, "locked");
  assert.equal(blockedReason(m, out)?.kind, "locked");
});

test("hideUnselectable: locked → hidden (left out of the tree / lists), departed / disabled omitted, the rest untouched", () => {
  const m = modelOf({ availability, hideUnselectable: true, existing: { "person:granted": "已授权" } });
  assert.equal(m.hideUnselectable, true);
  assert.deepEqual(m.avail(out), { state: "hidden", reason: "不在你的管理范围" });
  assert.equal(m.omits(out), true, "locked person");
  assert.equal(m.omits({ kind: "dept", id: "out" }), true, "locked department");
  assert.equal(m.omits({ kind: "company", id: "other-co" }), true, "hidden stays hidden");
  assert.equal(m.omits(me, undefined, "left"), true, "departed");
  assert.equal(m.omits(me, undefined, "disabled"), true, "disabled account");
  assert.equal(m.omits(me, { state: "locked" }), true, "the data's own availability counts too");
  assert.equal(blockedReason(m, out)?.kind, "locked", "still never pickable if it shows up anyway (defaultFocus on it)");
  assert.equal(blockedReason(m, me), null);
  assert.equal(m.omits(me), false, "a pickable person stays");
  assert.equal(m.omits({ kind: "dept", id: "half" }), false, "partial departments stay: they can be opened");
  assert.equal(m.avail({ kind: "dept", id: "half" }).state, "partial");
  assert.equal(m.omits({ kind: "person", id: "granted" }), false, "already granted stays: it says why it can't be picked again");
  assert.equal(blockedReason(m, { kind: "person", id: "granted" })?.kind, "existing");
});
