import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { adminThemeBootScript, createPalette, PALETTES } from "../src/palette.ts";

/**
 * adminThemeBootScript (8.10): SSR hosts inline it so the user's stored 深浅 / 色卡 / 字号 paint before hydration.
 * Run in a tiny fake DOM: the `.adminui` root of the same storageKey gets data-aui-mode and the palette variables.
 */
type FakeRoot = { attrs: Record<string, string>; props: Record<string, string>; className: string };
function boot(script: string, stored: Record<string, string>, opts: { darkSystem?: boolean; storageKey?: string; throwStorage?: boolean } = {}) {
  const el: FakeRoot & Record<string, unknown> = { className: "adminui", attrs: { "data-aui-storage": opts.storageKey ?? "app" }, props: {} };
  const node = Object.assign(el, {
    getAttribute: (name: string) => el.attrs[name] ?? null,
    setAttribute: (name: string, value: string) => { el.attrs[name] = value; },
    style: { setProperty: (name: string, value: string) => { el.props[name] = value; } },
  });
  const localStorage = { getItem: (key: string) => { if (opts.throwStorage) throw new Error("denied"); return stored[key] ?? null; } };
  const window = { matchMedia: () => ({ matches: Boolean(opts.darkSystem) }) };
  const document = { readyState: "complete", getElementsByClassName: () => [node] };
  runInNewContext(script, { localStorage, window, document, String, Object });
  return el;
}

test("boot script paints the stored mode, palette and font size on the matching root", () => {
  const script = adminThemeBootScript("app");
  const el = boot(script, { "app:mode": "dark", "app:palette": "ocean", "app:font-size": "large" });
  assert.equal(el.attrs["data-aui-mode"], "dark");
  assert.equal(el.attrs["data-aui-palette"], "ocean");
  assert.equal(el.attrs["data-aui-font-size"], "large");
  const ocean = createPalette(PALETTES[1], "dark").vars;
  for (const key of ["surface", "canvas", "text", "primary", "focus", "control-border"]) assert.equal(el.props[`--aui-${key}`], ocean[key], key);
  assert.equal(el.props["--aui-font-scale"], "1.15");
});

test("boot script: no stored choice = the host defaults; system follows prefers-color-scheme; other keys untouched", () => {
  const script = adminThemeBootScript("app", { palette: "plum", mode: "system", defaultFontSize: "medium" });
  const light = boot(script, {});
  assert.equal(light.attrs["data-aui-mode"], "light");
  assert.equal(light.props["--aui-surface"], createPalette(PALETTES[5], "light").vars.surface);
  assert.equal(light.props["--aui-font-scale"], "1");
  assert.equal(boot(script, {}, { darkSystem: true }).attrs["data-aui-mode"], "dark");
  assert.equal(boot(script, { "app:mode": "light" }, { darkSystem: true }).attrs["data-aui-mode"], "light", "the stored choice wins");
  const other = boot(script, { "app:mode": "dark" }, { storageKey: "another-app" });
  assert.equal(other.attrs["data-aui-mode"], undefined, "a root with another storageKey is left alone");
  assert.equal(boot(script, { "app:mode": "dark" }, { throwStorage: true }).attrs["data-aui-mode"], "light", "storage that throws = defaults, no crash");
});

test("boot script: a saved custom colour falls back to the project palette; the JSON cannot close the <script>", () => {
  const el = boot(adminThemeBootScript("app"), { "app:palette": "#123456", "app:mode": "dark" });
  assert.equal(el.attrs["data-aui-palette"], "forest");
  assert.equal(el.props["--aui-surface"], createPalette(PALETTES[0], "dark").vars.surface);
  const script = adminThemeBootScript("</script><script>alert(1)</script>");
  assert.doesNotMatch(script, /<\/script/i);
  assert.ok(adminThemeBootScript("app", { presets: false }).length < script.length / 3, "presets: false embeds only the project palette");
});

test("boot script is exported from the root and AdminProvider marks its root for it (and reads storage without an effect)", () => {
  const theme = readFileSync(new URL("../src/theme.tsx", import.meta.url), "utf8");
  const index = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.match(index, /export \* from "\.\/theme\.tsx";/);
  assert.match(theme, /export \{ FONT_SIZE_PRESETS, adminThemeBootScript, type AdminFontSize, type AdminThemeBootOptions \} from "\.\/palette\.ts";/);
  assert.match(theme, /data-aui-storage=\{storageKey\} suppressHydrationWarning/);
  // 8.9 started from the defaults and read localStorage in useEffect: a white flash for dark users, ECharts initialised twice
  assert.doesNotMatch(theme, /useEffect\(\(\) => \{[^}]*localStorage\.getItem/);
  assert.match(theme, /useSyncExternalStore\(subscribeStored, \(\) => readStored\(key\), serverStored\)/);
});
