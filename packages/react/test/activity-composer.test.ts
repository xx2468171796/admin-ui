import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Phone } from "lucide-react";
import { importTsx } from "./ssr.ts";

type Any = ComponentType<Record<string, unknown>>;
const mod = await importTsx<{ ActivityComposer: Any; activityKindTone: (kind: { tone?: string; color?: string }) => string | undefined }>("src/activity-composer.tsx");
const { ActivityComposer, activityKindTone } = mod;
const noop = () => undefined;
const chip = (html: string, label: string) => html.match(new RegExp(`<button[^>]*class="aui-acomposer-kind"[^>]*>(?:(?!</button>).)*${label}</button>`))?.[0] ?? "";

test("activityKindTone: tone wins, a stored colour maps to the nearest hue, nothing = neutral", () => {
  assert.equal(activityKindTone({ tone: "blue", color: "red" }), "blue");
  assert.equal(activityKindTone({ tone: "orangeSolid" }), "orangeSolid");
  assert.equal(activityKindTone({ color: "red" }), "red");
  assert.equal(activityKindTone({ color: "紫色" }), "violet");
  assert.equal(activityKindTone({ color: "#e11d48" }), "red");
  assert.equal(activityKindTone({ color: "#16a34a" }), "green");
  assert.equal(activityKindTone({}), undefined);
  assert.equal(activityKindTone({ color: "not-a-colour" }), undefined);
});

test("ActivityComposer kind chips: coloured kinds carry data-tone; a kind without an icon gets a colour dot; plain kinds unchanged", () => {
  const html = renderToStaticMarkup(createElement(ActivityComposer, {
    value: "", onChange: noop, onSubmit: noop, kind: "phone", onKindChange: noop,
    kinds: [
      { value: "phone", label: "电话", icon: Phone, tone: "blue" },
      { value: "line", label: "LINE", color: "#16a34a" },
      { value: "visit", label: "拜访", icon: Phone },
      { value: "other", label: "其他" },
    ],
  }));
  const phone = chip(html, "电话");
  assert.match(phone, /data-tone="blue"/);
  assert.match(phone, /aria-pressed="true"/);
  assert.match(phone, /<svg/, "an icon stays an icon");
  assert.doesNotMatch(phone, /aui-tone-dot/);
  const line = chip(html, "LINE");
  assert.match(line, /data-tone="green"/, "a stored hex colour is mapped to a hue, never painted raw");
  assert.match(line, /<span class="aui-tone-dot" aria-hidden="true"><\/span>/, "no icon + a colour = a small dot");
  assert.doesNotMatch(line, /#16a34a/);
  for (const label of ["拜访", "其他"]) {
    const plain = chip(html, label);
    assert.ok(plain, label);
    assert.doesNotMatch(plain, /data-tone|aui-tone-dot/, `${label}: no colour, no dot`);
  }
});
