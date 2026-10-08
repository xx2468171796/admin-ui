// Which `aui-*` classes the components use vs. which ones the stylesheets define.
// node scripts/css-classes.mjs [--json]  → unused (defined, never used) and missing (used, never defined).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const walk = (dir, test) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules") return [];
    return statSync(path).isDirectory() ? walk(path, test) : test(name) ? [path] : [];
  });

const source = walk(join(root, "src"), (n) => /\.(tsx?|mjs)$/.test(n) && !n.endsWith(".d.ts"));
const styles = walk(join(root, "src"), (n) => n.endsWith(".css"));

const CLASS = /aui-[a-z0-9-]+/g;
const used = new Map();
for (const file of source) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(CLASS)) {
    // `aui-button-${variant}` style templates: keep the static prefix as a wildcard.
    const name = m[0].replace(/-$/, "");
    if (!used.has(name)) used.set(name, new Set());
    used.get(name).add(relative(root, file));
  }
}
const prefixes = [...used.keys()].filter((k) => source.some((f) => readFileSync(f, "utf8").includes(`${k}-\${`)));
const defined = new Map();
for (const file of styles) {
  const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const block of css.split("}")) {
    const selector = block.split("{")[0] ?? "";
    for (const m of selector.matchAll(/\.(aui-[a-z0-9-]+)/g)) {
      if (!defined.has(m[1])) defined.set(m[1], new Set());
      defined.get(m[1]).add(relative(root, file));
    }
  }
}
const isUsed = (name) => used.has(name) || prefixes.some((p) => name.startsWith(`${p}-`));
const unused = [...defined.keys()].filter((name) => !isUsed(name)).sort();
const missing = [...used.keys()].filter((name) => !defined.has(name) && !prefixes.includes(name)).sort();
if (process.argv.includes("--json")) console.log(JSON.stringify({ used: [...used.keys()].sort(), defined: [...defined.keys()].sort(), unused, missing }, null, 2));
else {
  console.log(`used ${used.size}, defined ${defined.size}, unused ${unused.length}, missing ${missing.length}`);
  console.log("unused:", unused.join(" "));
  console.log("missing:", missing.join(" "));
}
