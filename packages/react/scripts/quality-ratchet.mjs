#!/usr/bin/env node
// Quality ratchet: file size, Biome lint and known-bad patterns may only go DOWN.
//
// Why a ratchet and not a plain gate: the package grew to 85k lines with no line / lint gate at all
// (grid.tsx reached 1994 lines; 173 hook-dependency violations hid behind 53 `eslint-disable` comments
// that nothing ever ran). Turning the company limits on in one go would be all red, so every existing
// violation is recorded in quality-baseline.json and:
//   - lines: per file — a new oversized file fails, an oversized file that grows fails;
//   - patterns / lint: per RULE, package-wide total — the total may not grow. Per file would punish moving code
//     (splitting grid.tsx into 30 modules turned every moved suppression into a "new" one). When a total grows,
//     the files above their recorded `byFile` count are listed so you can find the new violation;
//   - a count that shrinks passes and asks you to run `--update`, which lowers the baseline (never raises it).
// Raising a cap is a hand edit of quality-baseline.json that shows up in review — say why in the commit.
//
//   node scripts/quality-ratchet.mjs            check (part of `npm run check`)
//   node scripts/quality-ratchet.mjs --update   lower the baseline to the current counts
//   node scripts/quality-ratchet.mjs --init     rebuild the baseline from scratch (only when adopting)
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = join(PKG, "quality-baseline.json");
const mode = process.argv.includes("--init") ? "init" : process.argv.includes("--update") ? "update" : "check";

/** Company limits (rules/coding-standards.md): components 300, source 500, tests 800 lines. */
const LIMITS = { component: 300, source: 500, test: 800 };
const limitFor = (path) =>
  /\.test\.[^.]+$/.test(path) ? LIMITS.test : path.endsWith(".tsx") ? LIMITS.component : LIMITS.source;

/**
 * Patterns that each caused a real defect in this package (2026-10-11 audit). Each rule is a line regex;
 * `// quality-ok: <rule> <reason>` on the same or previous line exempts one hit, with a reason.
 */
const PATTERNS = {
  // `String(e)` shows users "Error: …" or "[object Object]" — use errorText(e, fallback).
  "raw-error-string": /\bString\((?:e|err|error|reason|cause|ex)\)/,
  // A signal nobody can abort: the host thinks requests are cancellable, they are not.
  "fake-abort-signal": /new AbortController\(\)\.signal/,
  // Enter / Escape acted on without the IME guard: Chinese input commits pinyin or closes the dialog.
  "ime-unguarded-key": /(?:\.key\s*===?\s*["'](?:Enter|Escape)["']|case\s+["'](?:Enter|Escape)["']\s*:)/,
  // A host-provided function in effect deps: an inline adapter refetches forever. Keep it in a ref.
  "host-callback-dep": /\}\s*,\s*\[[^\]]*\b(?:adapter|loader|fetcher|subscribe)\b[^\]]*\]\s*\)/,
  // Nothing runs ESLint here; these comments silence nothing and hide real hook bugs. Use biome-ignore + reason.
  "eslint-disable": /eslint-disable/,
};
const IME_GUARD = /isComposing|isComposingEvent|keyCode\s*===?\s*229|composing/;

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "artifacts") return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const rel = (file) => relative(PKG, file).replaceAll("\\", "/");
const sourceFiles = () =>
  [...walk(join(PKG, "src")), ...walk(join(PKG, "test"))].filter(
    (f) => [".ts", ".tsx", ".mjs"].includes(extname(f)) && !f.endsWith(".d.ts"),
  );

function collectLines(files) {
  const out = {};
  for (const file of files) {
    const path = rel(file);
    const lines = readFileSync(file, "utf8").split("\n").length;
    if (lines > limitFor(path)) out[path] = lines;
  }
  return out;
}

function exempt(lines, i, rule) {
  const mark = new RegExp(`quality-ok:\\s*${rule}\\b\\s+\\S`);
  return mark.test(lines[i]) || (i > 0 && mark.test(lines[i - 1]));
}

function collectPatterns(files) {
  const out = {};
  for (const file of files) {
    const path = rel(file);
    if (!path.startsWith("src/")) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const [rule, re] of Object.entries(PATTERNS)) {
        if (!re.test(line) || exempt(lines, i, rule)) continue;
        if (rule === "ime-unguarded-key" && IME_GUARD.test(lines.slice(Math.max(0, i - 8), i + 3).join("\n"))) continue;
        out[`${path}|${rule}`] = (out[`${path}|${rule}`] ?? 0) + 1;
      }
    });
  }
  return out;
}

function collectBiome() {
  // Run Biome's JS launcher with this node (no shell: arguments stay arguments on Windows too).
  const launcher = createRequire(join(PKG, "package.json")).resolve("@biomejs/biome/bin/biome");
  const args = ["lint", "--reporter=json", "--max-diagnostics=none", "src"];
  let raw;
  try {
    raw = execFileSync(process.execPath, [launcher, ...args], {
      cwd: PKG, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    // biome exits 1 when it reports diagnostics; the JSON is still on stdout
    raw = error.stdout;
    if (!raw) throw new Error(`biome failed to run: ${error.stderr || error.message}`);
  }
  const json = JSON.parse(raw.slice(raw.indexOf("{")));
  const out = {};
  for (const d of json.diagnostics ?? []) {
    const file = (d.location?.path?.file ?? d.location?.path ?? "").replaceAll("\\", "/");
    const key = `${file.replace(/^.*?(?=src\/)/, "")}|${d.category}`;
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

/** `file|rule` counts → `rule` totals. */
const totals = (byFile) => {
  const out = {};
  for (const [key, n] of Object.entries(byFile)) {
    const rule = key.slice(key.lastIndexOf("|") + 1);
    out[rule] = (out[rule] ?? 0) + n;
  }
  return out;
};
/** Files whose count of `rule` is above the recorded detail — where a grown total most likely came from. */
const suspects = (rule, current, byFile) =>
  Object.entries(current)
    .filter(([key, n]) => key.endsWith(`|${rule}`) && n > (byFile[key] ?? 0))
    .map(([key, n]) => `    ${key.slice(0, key.lastIndexOf("|"))}: ${byFile[key] ?? 0} → ${n}`);

function compare(name, current, base) {
  const failures = [];
  const lowerable = [];
  for (const [key, n] of Object.entries(current)) {
    const cap = base[key];
    if (cap === undefined) failures.push(`${name}: new  ${key} = ${n}`);
    else if (n > cap) failures.push(`${name}: grew ${key} ${cap} → ${n}`);
    else if (n < cap) lowerable.push(key);
  }
  for (const key of Object.keys(base)) if (!(key in current)) lowerable.push(key);
  return { failures, lowerable };
}

const lower = (current, base) =>
  Object.fromEntries(
    Object.entries(base)
      .filter(([key]) => key in current)
      .map(([key, cap]) => [key, Math.min(cap, current[key])])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
const sorted = (obj) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));

const files = sourceFiles();
const current = { lines: collectLines(files), patterns: collectPatterns(files), biome: collectBiome() };
const README =
  "Counts may only go down. lines = per oversized file; patterns / biome = package-wide total per rule (byFile is detail for finding a new violation, not enforced). Run `node scripts/quality-ratchet.mjs --update` after fixing some. Raising a number needs a reason in the commit message.";
const baselineOf = (lines, patterns, biome) => ({
  "//": README,
  lines: sorted(lines),
  patterns: sorted(patterns),
  biome: sorted(biome),
  byFile: { patterns: sorted(current.patterns), biome: sorted(current.biome) },
});

if (mode === "init") {
  writeFileSync(BASELINE, `${JSON.stringify(baselineOf(current.lines, totals(current.patterns), totals(current.biome)), null, 2)}\n`);
  console.log(`quality baseline written: ${Object.keys(current.lines).length} oversized files; ${JSON.stringify(totals(current.patterns))}; ${JSON.stringify(totals(current.biome))}`);
  process.exit(0);
}

const base = JSON.parse(readFileSync(BASELINE, "utf8"));
const results = [
  compare("lines", current.lines, base.lines ?? {}),
  ...["patterns", "biome"].map((k) => {
    const res = compare(k, totals(current[k]), base[k] ?? {});
    // "grew <rule> a → b" / "new  <rule> = n": list the files that most likely carry the new violation
    res.failures = res.failures.flatMap((f) => [f, ...suspects(f.split(/\s+/)[2] ?? "", current[k], base.byFile?.[k] ?? {})]);
    return res;
  }),
];
const failures = results.flatMap((r) => r.failures);
const lowerable = results.reduce((n, r) => n + r.lowerable.length, 0);

if (mode === "update") {
  if (failures.length) {
    console.error(`refusing to update while there are new / grown violations:\n${failures.join("\n")}`);
    process.exit(1);
  }
  writeFileSync(BASELINE, `${JSON.stringify(baselineOf(lower(current.lines, base.lines ?? {}), lower(totals(current.patterns), base.patterns ?? {}), lower(totals(current.biome), base.biome ?? {})), null, 2)}\n`);
  console.log(`quality baseline lowered (${lowerable} entr${lowerable === 1 ? "y" : "ies"})`);
  process.exit(0);
}

if (failures.length) {
  console.error(failures.join("\n"));
  console.error(
    "\nquality ratchet: fix the new violations (split the file / follow the lint rule / use errorText, a real AbortController, isComposingEvent, a ref for host callbacks)." +
      "\nA justified exception: `// quality-ok: <rule> <reason>` on the line (patterns) or `// biome-ignore lint/<group>/<rule>: <reason>` (lint).",
  );
  process.exit(1);
}
console.log(`quality ratchet ok${lowerable ? ` — ${lowerable} baseline entr${lowerable === 1 ? "y" : "ies"} can be lowered: node scripts/quality-ratchet.mjs --update` : ""}`);
