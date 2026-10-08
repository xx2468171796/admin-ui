#!/usr/bin/env node
// CSS chunks: core styles (src/styles.css = styles/tokens.css + styles/core.css) plus one file per
// area under src/styles/. A module imports the chunks of the classes it renders — `import "#aui-css/<chunk>.css";`
// (package.json "imports": bundlers get the CSS, Node gets an empty module) — so a page only ships the CSS of what
// it uses, and a chunk that is not used by any component on the page is tree-shaken with its module.
//   node scripts/css-chunks.mjs          → check: every class a module renders is styled by core or by a chunk it imports;
//                                           no import of a chunk the module does not use; every chunk is imported somewhere
//   node scripts/css-chunks.mjs --fix    → rewrite each module's `// aui-css` import block
//   node scripts/css-chunks.mjs --report → which chunk styles each class (JSON)
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");
const args = process.argv.slice(2);
const FIX = args.includes("--fix");
const BLOCK = "// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)";
const EXCLUDE = new Set(["catalog.ts", "index.ts", "contracts.ts"]);
const CORE = new Set(["tokens", "core"]);

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

/** Chunk name → classes that are the subject (rightmost compound) of one of its rules. */
function chunkClasses() {
  const out = new Map();
  for (const file of readdirSync(join(src, "styles")).filter((n) => n.endsWith(".css"))) {
    const css = readFileSync(join(src, "styles", file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const own = new Set();
    for (const block of css.split("}")) {
      const prelude = (block.split("{")[0] ?? "").trim();
      if (!prelude || prelude.startsWith("@")) continue;
      for (const sel of splitTop(prelude, ",")) {
        const subject = splitTop(sel.replace(/\s*([>+~])\s*/g, " "), " ").at(-1) ?? "";
        for (const m of subject.matchAll(/\.(aui-[a-z0-9-]+)/g)) own.add(m[1]);
        // an anonymous child of an SDK element (`.aui-x > *`): the parent class needs the chunk
        if (!/\.aui-/.test(subject)) for (const m of sel.matchAll(/\.(aui-[a-z0-9-]+)/g)) own.add(m[1]);
      }
    }
    own.delete("adminui");
    out.set(file.slice(0, -4), own);
  }
  return out;
}
function splitTop(text, sep) {
  const parts = [];
  let depth = 0, from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (depth === 0 && c === sep) { parts.push(text.slice(from, i)); from = i + 1; }
  }
  parts.push(text.slice(from));
  return parts.map((p) => p.trim()).filter(Boolean);
}

const chunks = chunkClasses();
const definers = new Map(); // class → chunks that style it
for (const [chunk, classes] of chunks) for (const c of classes) definers.set(c, [...(definers.get(c) ?? []), chunk]);
const ORDER = ["tokens", "core", ...[...chunks.keys()].filter((c) => !CORE.has(c)).sort()];

const modules = walk(src).filter((p) => /\.tsx?$/.test(p) && !p.endsWith(".d.ts") && !EXCLUDE.has(p.split(/[\\/]/).pop()));
const problems = [];
const used = new Set();
for (const path of modules) {
  const rel = relative(src, path).split("\\").join("/");
  const text = readFileSync(path, "utf8");
  const body = text.replace(/^\/\/ aui-css:[^\r\n]*\r?\n(?:import "#aui-css\/[^"]+";\r?\n)+/m, "");
  const mentioned = new Set();
  for (const m of body.matchAll(/(?<![a-z0-9-])(aui-[a-z0-9-]+)(?![a-z0-9-])/g)) mentioned.add(m[1].replace(/-$/, ""));
  // `aui-button-${variant}` is a class prefix; ids (`id={`aui-page-${id}`}`, aria-controls) are not classes
  const prefixes = [...body.matchAll(/(aui-[a-z0-9-]+-)\$\{/g)]
    .filter((m) => !/(\bid|aria-[a-z]+|htmlFor)=\{`$/.test(body.slice(Math.max(0, m.index - 24), m.index)))
    .map((m) => m[1]);
  for (const cls of definers.keys()) if (prefixes.some((p) => cls.startsWith(p))) mentioned.add(cls);
  const imported = [...text.matchAll(/^import "#aui-css\/([\w-]+)\.css";/gm)].map((m) => m[1]);
  const need = new Set();
  for (const cls of mentioned) {
    const by = definers.get(cls);
    if (!by || by.some((c) => CORE.has(c))) continue;
    if (by.some((c) => imported.includes(c))) { for (const c of by) if (imported.includes(c)) need.add(c); continue; }
    need.add([...by].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))[0]);
    if (!FIX) problems.push(`${rel}: renders .${cls} but imports none of ${by.map((c) => `#aui-css/${c}.css`).join(" / ")}`);
  }
  for (const c of imported) {
    if (!chunks.has(c) && c !== "core") problems.push(`${rel}: imports #aui-css/${c}.css, which does not exist`);
    else if (c !== "core" && !need.has(c) && !FIX) problems.push(`${rel}: imports #aui-css/${c}.css but renders none of its classes`);
  }
  const want = rel === "theme.tsx" ? ["core", ...[...need].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))] : [...need].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  for (const c of want) used.add(c);
  if (FIX) {
    const lines = want.map((c) => `import "#aui-css/${c}.css";`);
    let next = body;
    if (lines.length) {
      const imports = [...next.matchAll(/^import [^;]*?;\r?\n/gms)];
      const at = imports.length ? imports.at(-1).index + imports.at(-1)[0].length : 0;
      next = `${next.slice(0, at)}${BLOCK}\n${lines.join("\n")}\n${next.slice(at)}`;
    }
    if (next !== text) writeFileSync(path, next);
  }
}
for (const c of chunks.keys()) if (!CORE.has(c) && !used.has(c) && !FIX) problems.push(`src/styles/${c}.css is not imported by any module (dead chunk?)`);
if (args.includes("--report")) {
  console.log(JSON.stringify(Object.fromEntries([...definers].sort()), null, 1));
} else if (FIX) {
  console.log("css-chunks: import blocks rewritten");
} else if (problems.length) {
  console.error(`css-chunks: ${problems.length} problem(s)\n- ${problems.join("\n- ")}\nFix: node scripts/css-chunks.mjs --fix (then review the diff)`);
  process.exit(1);
} else {
  console.log(`css-chunks ok: ${chunks.size} files, ${modules.length} modules`);
}
