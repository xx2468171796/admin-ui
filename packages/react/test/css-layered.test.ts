import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AUI_LAYERS, LAYER_ORDER, layerOf, layeredFiles, layeredProblems, topLevel } from "../scripts/css-layered.mjs";

/**
 * Opt-in layered CSS (8.10): src/styles-layered/ is generated from src/styles/ (node scripts/css-layered.mjs --write)
 * and served under the "aui-layered" condition. A stale copy would silently ship old styles to the hosts that opted in.
 */
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { imports: Record<string, Record<string, string>> };
const stylesDir = fileURLToPath(new URL("../src/styles/", import.meta.url));

test("layered copies are up to date (run node scripts/css-layered.mjs --write after editing src/styles)", () => {
  assert.deepEqual(layeredProblems(), []);
});

test("every source statement lands in exactly one layer; the layer order puts aui between Tailwind's base and components", () => {
  const files = layeredFiles();
  for (const name of readdirSync(stylesDir).filter((n) => n.endsWith(".css"))) {
    const source = readFileSync(stylesDir + name, "utf8").replace(/\r\n/g, "\n");
    const out = files.get(name)!;
    assert.ok(out.includes(`${LAYER_ORDER}\n${AUI_LAYERS}\n`), `${name}: layer order statements`);
    const blocks = topLevel(out).filter((s) => s.startsWith("@layer aui.") && s.endsWith("}"));
    const inner = blocks.flatMap((b) => topLevel(b.slice(b.indexOf("{") + 1, b.lastIndexOf("}"))));
    assert.equal(inner.length, topLevel(source).length, `${name}: same number of statements`);
  }
  assert.match(files.get("styles.css")!, /@import "\.\/tokens\.css";\n@import "\.\/core\.css";/);
});

test("layer assignment: root tokens / keyframes, resets, core, chunks, and state overrides", () => {
  assert.equal(layerOf("tokens", ".adminui { --aui-x: 1px; }"), "tokens");
  assert.equal(layerOf("tokens", ".adminui[data-aui-mode=dark] { --aui-x: 1px; }"), "tokens");
  assert.equal(layerOf("tokens", "@keyframes aui-spin { to { transform: rotate(1turn); } }"), "tokens");
  assert.equal(layerOf("tokens", "@media (max-width: 760px) { .adminui { --aui-fs-title: 20px; } }"), "tokens");
  assert.equal(layerOf("tokens", ".adminui :where(h1, h2, h3, p) { margin: 0; }"), "reset");
  assert.equal(layerOf("tokens", "@media (prefers-reduced-motion: reduce) { .adminui * { animation: none !important; } }"), "state");
  assert.equal(layerOf("tokens", '.adminui[data-aui-motion="none"] * { animation: none !important; }'), "state");
  assert.equal(layerOf("core", ".adminui .aui-button { height: 36px; }"), "core");
  assert.equal(layerOf("core", "@media (forced-colors: active) { .adminui .aui-switch { border: 1px solid CanvasText; } }"), "state");
  assert.equal(layerOf("grid", ".adminui .aui-grid { display: grid; }"), "chunk");
  assert.equal(layerOf("grid", "@media (prefers-reduced-motion: no-preference) { .adminui .x { animation: y 1s; } }"), "chunk");
});

test("package imports: the aui-layered condition points at the layered copies, before default; node still gets no CSS", () => {
  for (const [key, layered] of [["#aui-css/core.css", "./src/styles-layered/styles.css"], ["#aui-css/*", "./src/styles-layered/*"]] as const) {
    const map = pkg.imports[key]!;
    const keys = Object.keys(map);
    assert.equal(map["aui-layered"], layered);
    assert.ok(keys.indexOf("node") < keys.indexOf("aui-layered") && keys.indexOf("aui-layered") < keys.indexOf("default"), `${key}: node → aui-layered → default`);
  }
});
