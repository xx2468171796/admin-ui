// 纯规则：提示气泡 / 说明卡的位置、快捷键写法、头像按人分色、改动计数、搜索高亮、字数档位、骨架宽度、固定的动作图标。
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { detectPlatform, formatShortcut, matchShortcut, placeCard, placeTip, shortcutKeys, shortcutLabel, tipDelay, TIP_DELAY } from "../src/tooltip-core.ts";
import { AVATAR_TONES, avatarLetter, avatarSize, avatarTone, hashKey } from "../src/avatar-core.ts";
import { changedKeys, sameValue } from "../src/change-tracker.ts";
import { ACTION_ICONS, ACTION_ICON_LABELS, iconStroke, REPLACED_ICONS } from "../src/icons.ts";

const view = { width: 1440, height: 900 };
const rect = (left: number, top: number, width = 24, height = 24) => ({ left, top, width, height, right: left + width, bottom: top + height });

test("tooltip: above by default, flips below at the top edge, stays inside the viewport, arrow at the anchor", () => {
  const above = placeTip(rect(600, 400), { width: 80, height: 26 }, view);
  assert.equal(above.side, "top");
  assert.equal(above.top, 400 - 26 - 8);
  assert.equal(above.left + above.arrow, 612, "箭头指着锚点中线");
  const flipped = placeTip(rect(600, 10), { width: 80, height: 26 }, view);
  assert.equal(flipped.side, "bottom");
  const edge = placeTip(rect(1430, 400, 10), { width: 200, height: 26 }, view);
  assert.ok(edge.left + 200 <= 1440 - 8, "贴右边往回挪");
});

test("help card: below and left-aligned with the 「?」, shifts back only at the edge, above when no room", () => {
  const card = placeCard(rect(260, 100), { width: 320, height: 120 }, view);
  assert.equal(card.side, "bottom");
  assert.equal(card.left, 256, "和「?」左对齐（不往左长盖住侧栏）");
  const right = placeCard(rect(1400, 100), { width: 320, height: 120 }, view);
  assert.equal(right.left, 1440 - 320 - 8);
  assert.ok(right.arrow >= 290, "挪回来后箭头仍指着「?」");
  const low = placeCard(rect(260, 860), { width: 320, height: 120 }, view);
  assert.equal(low.side, "top");
});

test("tooltip delay: 0.4 s, instant while sweeping (warm) or when one is already open", () => {
  assert.equal(tipDelay(10_000, 0, false), TIP_DELAY);
  assert.equal(tipDelay(10_000, 9_800, false), 0);
  assert.equal(tipDelay(10_000, 0, true), 0);
});

test("shortcuts: only the current system's notation, one cap per key", () => {
  assert.deepEqual(formatShortcut("Mod+K", "other"), ["Ctrl", "K"]);
  assert.deepEqual(formatShortcut("Mod+K", "mac"), ["⌘", "K"]);
  assert.deepEqual(formatShortcut("Mod+Shift+z", "mac"), ["⌘", "⇧", "Z"]);
  assert.deepEqual(formatShortcut(["Alt", "Enter"], "other"), ["Alt", "Enter"]);
  assert.deepEqual(shortcutKeys("Ctrl++"), ["Ctrl", "+"]);
  assert.equal(shortcutLabel("Mod+K", "mac"), "Command 加 K");
  assert.equal(detectPlatform({ platform: "MacIntel" }), "mac");
  assert.equal(detectPlatform({ platform: "Win32", userAgent: "Windows NT" }), "other");
  const ev = (key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });
  assert.equal(matchShortcut(ev("k", { ctrlKey: true }), "Mod+K", "other"), true);
  assert.equal(matchShortcut(ev("k", { metaKey: true }), "Mod+K", "other"), false);
  assert.equal(matchShortcut(ev("k", { metaKey: true }), "Mod+K", "mac"), true);
  assert.equal(matchShortcut(ev("?", { shiftKey: true }), "?", "other"), true, "符号键不管 Shift");
});

test("avatars: same person same colour, gray never used, five sizes", () => {
  assert.equal(avatarTone("u_1024"), avatarTone("u_1024"));
  assert.ok(!AVATAR_TONES.includes("gray"));
  const tones = new Set(["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8", "u9", "u10", "u11", "u12"].map(avatarTone));
  assert.ok(tones.size >= 6, `12 个人至少分到 6 种颜色：${[...tones].join(",")}`);
  assert.notEqual(avatarTone("赵静怡"), avatarTone("赵明轩"), "同姓也分得开");
  assert.equal(avatarTone(""), "green");
  assert.equal(hashKey("abc"), hashKey("abc"));
  assert.equal(avatarLetter(" 赵静怡"), "赵");
  assert.equal(avatarLetter("alice"), "A");
  assert.equal(avatarLetter(""), "?");
  assert.deepEqual([20, 24, undefined, 30, 48, 70].map((s) => avatarSize(s)), [20, 24, 32, 32, 40, 64]);
});

test("change tracker: only real changes count; empty values are the same", () => {
  const saved = { name: "Acme", tags: ["a", "b"], region: "TW", note: "" };
  assert.deepEqual(changedKeys(saved, { ...saved }), []);
  assert.deepEqual(changedKeys(saved, { ...saved, name: "Acme 华南", tags: ["a", "b"] }), ["name"]);
  assert.deepEqual(changedKeys(saved, { ...saved, tags: ["b", "a"], note: "x" }), ["tags", "note"]);
  assert.equal(sameValue("", null), true);
  assert.equal(sameValue(undefined, ""), true);
  assert.equal(sameValue({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), true);
  assert.equal(sameValue(new Date(1), new Date(1)), true);
});

test("action icons: 24 fixed meanings, one icon each; stroke by size", () => {
  assert.equal(Object.keys(ACTION_ICONS).length, 24);
  assert.deepEqual(Object.keys(ACTION_ICON_LABELS).sort(), Object.keys(ACTION_ICONS).sort());
  assert.equal(new Set(Object.values(ACTION_ICONS)).size, 24, "一个意思一个图标，没有两个意思共用");
  assert.deepEqual([12, 14, 16, 20, 24].map(iconStroke), [2, 2, 1.75, 1.75, 1.5]);
});

test("the SDK uses the canonical action icons (no Settings / SlidersHorizontal / PenLine / MoreHorizontal / ListFilter)", () => {
  const root = join(import.meta.dirname, "../src");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name));
      else if (entry.name.endsWith(".tsx")) files.push(join(dir, entry.name));
    }
  };
  walk(root);
  // RotateCw stays where it means 「rotate」 / 「skip forward」, not 「refresh」.
  const banned = Object.keys(REPLACED_ICONS).filter((name) => name !== "RotateCw" && name !== "Share");
  const offenders: string[] = [];
  for (const file of files) {
    const imports = [...readFileSync(file, "utf8").matchAll(/import \{([^}]*)\} from "lucide-react"/g)].flatMap((m) => (m[1] ?? "").split(",").map((s) => s.trim()));
    for (const name of banned) if (imports.includes(name)) offenders.push(`${file}: ${name}`);
  }
  assert.deepEqual(offenders, []);
});
