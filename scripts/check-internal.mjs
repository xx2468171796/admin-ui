#!/usr/bin/env node
// Leak guard: fails when a tree contains names or references that belong to the private upstream.
//
//   node scripts/check-internal.mjs [dir...]          scan dirs (default: cwd) with the hashed term list
//   node scripts/check-internal.mjs --report out/x     also write out/x.json + out/x.md
//   node scripts/check-internal.mjs --quiet            summary only
//
// Upstream-only options (need files that are never published):
//   --internal                scan the upstream package + docs site as if exported (same rewrites, same paths)
//   --plain <terms.json>      plaintext term list (default: terms.internal.json next to this script)
//   --names <names.txt>       person names (default: names.txt next to this script)
//   --emit-hashed <file>      write the hashed term list used by the public copy of this script
//
// Two kinds of rules:
// - term rules: case-insensitive substrings. The public copy only knows salted SHA-256 hashes of them
//   (scripts/guard-terms.json), so the list itself does not leak what it protects. A 12-bit rolling-hash
//   bucket per window keeps the scan fast; only bucket hits are hashed with SHA-256.
// - pattern rules: generic regexes (private IPv4 ranges, decision references, emails, asset references,
//   self-hosted forge URLs, the docs domain outside the files allowed to mention it).
// Exit code: 0 clean, 1 hits, 2 usage / missing term list (fails closed).
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const HERE = dirname(SELF);
const BUCKET_SHIFT = 20; // keep the top 12 bits of the 32-bit rolling hash
const BASE = 131;

const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", "coverage", "artifacts", ".vite", "target", ".turbo"]);
const TEXT_EXT = new Set([
  "ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs", "json", "md", "markdown", "html", "htm", "css", "txt",
  "yml", "yaml", "toml", "go", "mod", "sum", "rs", "lock", "svg", "xml", "example", "sh", "ps1", "cmd", "env",
]);
const TEXT_NAMES = new Set(["LICENSE", ".gitignore", ".npmignore", ".gitattributes", ".editorconfig", ".nvmrc", "CODEOWNERS"]);

const DOCS_HOST = "adminui.zygskins.cn";
/** Public paths allowed to mention the docs host (and only as that host). */
const DOCS_HOST_FILES = [
  /^package\.json$/,
  /^packages\/react\/package\.json$/,
  /^(README|README\.zh-CN|SECURITY|CONTRIBUTING|CONTRIBUTING\.zh-CN)\.md$/,
  /^packages\/react\/README(\.zh-CN)?\.md$/,
  /^examples\/README\.md$/,
  /^\.github\//,
  /^sites\/docs\//,
  /^scripts\/check-internal\.mjs$/, // this file's own DOCS_HOST constant
];

/** Placeholder addresses used by demos and tests; everything else that looks like an email is reported. */
const PLACEHOLDER_EMAIL = /@(?:(?:[\w-]+\.)+(?:example|test|invalid|localhost)|example\.(?:com|org|net)|users\.noreply\.github\.com|(?:mail|company|domain|acme|b)\.com)$/i;

const GITHUB_REF = /(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?|refs?|see|issue|issues|pr|pull request|pull)\s*$/i;
const BARE_NUMBER_FILES = [/(^|\/)\.github\//, /(^|\/)CONTRIBUTING(\.zh-CN)?\.md$/];
function bareNumberAllowed(line, index, path) {
  if (BARE_NUMBER_FILES.some((r) => r.test(path))) return true;
  const before = line.slice(0, index);
  if (/[:="',]\s*$/.test(before)) return true; // colour values / literals: color: #111, fill="#123"
  return GITHUB_REF.test(before);
}

const PATTERNS = [
  { category: "internal-ip", re: /\b(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g },
  { category: "decision-ref", re: /(?:决策|decision)\s*#\s*\d+|#\d{2,3}\s*[①-⑳]/gi },
  // Bare decision numbers (a hash + 1xx, or a range of them) in comments and docs. Not: CSS colours (#111 after `:` `=` or a
  // quote), GitHub refs (`Fixes #123`, `PR #123`), and the GitHub templates / contributing guides.
  { category: "decision-ref", re: /(?<![\w&#])#1\d{2}(?:\s*[–—~-]\s*#?1\d{2})?(?![\w-])/g, allowAt: bareNumberAllowed },
  // design/ is internal review material: only the curated screenshots under design/templates/ are published
  // (a non-png file there is dropped by the export, so it can't leak either).
  { category: "design-ref", re: /(?<![\w.-])design\/(?!templates(?:\/|\b))[\w./-]*/g },
  { category: "forge-url", re: /\bgitea\b/gi },
  { category: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g, allow: (m) => PLACEHOLDER_EMAIL.test(m) },
  { category: "asset-ref", re: /资产[「"“]|\basset\s*(?:id|#)\s*\d+/gi },
  // Seed / demo login names of internal environments follow `demo_<name>` (demo_lead, demo_hq_zhou …): demos and tests
  // use neutral accounts (tester, lead01) instead, so a real seed account can't slip into the public tree.
  { category: "seed-account", re: /(?<![A-Za-z0-9_])demo_[a-z][a-z0-9_]*/g },
  { category: "docs-domain", re: /zygskins/gi, allowAt: (line, index, path) => DOCS_HOST_FILES.some((r) => r.test(path)) && line.slice(Math.max(0, index - 8), index + 11).toLowerCase() === DOCS_HOST },
];

// ---------- term hashing ----------

function rolling(text, start, length) {
  let h = 0;
  for (let i = start; i < start + length; i++) h = (Math.imul(h, BASE) + text.charCodeAt(i)) >>> 0;
  return h;
}

function powBase(length) {
  let p = 1;
  for (let i = 1; i < length; i++) p = Math.imul(p, BASE) >>> 0;
  return p;
}

const digest = (salt, term) => createHash("sha256").update(`${salt}\0${term}`).digest("hex").slice(0, 20);

/** plaintext {category: [term]} → hashed list {salt, lengths: {len: {buckets, hashes}}} */
export function hashTerms(byCategory, salt = randomBytes(12).toString("hex")) {
  const lengths = {};
  for (const [category, terms] of Object.entries(byCategory)) {
    for (const raw of terms) {
      // A leading "=" makes a whole-word term (no ASCII letter / digit right before or after): short Latin
      // abbreviations that are also pieces of ordinary words.
      const whole = raw.trim().startsWith("=");
      const term = raw.trim().replace(/^=/, "").toLowerCase();
      if (term.length < 2) continue;
      const slot = (lengths[term.length] ??= { buckets: [], hashes: {} });
      const bucket = rolling(term, 0, term.length) >>> BUCKET_SHIFT;
      if (!slot.buckets.includes(bucket)) slot.buckets.push(bucket);
      const hash = digest(salt, term);
      slot.hashes[hash] = category;
      if (whole) (slot.whole ??= []).push(hash);
    }
  }
  for (const slot of Object.values(lengths)) slot.buckets.sort((a, b) => a - b);
  return { version: 1, salt, lengths };
}

function compileTerms(hashed) {
  return Object.entries(hashed.lengths).map(([len, slot]) => ({
    length: Number(len), pow: powBase(Number(len)), buckets: new Set(slot.buckets), hashes: new Map(Object.entries(slot.hashes)), whole: new Set(slot.whole ?? []),
  }));
}

function termHits(lowerLine, compiled, salt) {
  const hits = [];
  const wordChar = (i) => i >= 0 && i < lowerLine.length && /[a-z0-9]/.test(lowerLine[i]);
  for (const { length, pow, buckets, hashes, whole } of compiled) {
    if (lowerLine.length < length) continue;
    let h = rolling(lowerLine, 0, length);
    for (let i = 0; ; i++) {
      if (buckets.has(h >>> BUCKET_SHIFT)) {
        const word = lowerLine.slice(i, i + length);
        const hash = digest(salt, word);
        const category = hashes.get(hash);
        if (category && !(whole.has(hash) && (wordChar(i - 1) || wordChar(i + length)))) hits.push({ index: i, length, category });
      }
      if (i + length >= lowerLine.length) break;
      h = (Math.imul((h - Math.imul(lowerLine.charCodeAt(i), pow)) >>> 0, BASE) + lowerLine.charCodeAt(i + length)) >>> 0;
    }
  }
  return hits;
}

// ---------- scanning ----------

export function isTextFile(path) {
  const name = path.split("/").pop() ?? "";
  if (TEXT_NAMES.has(name)) return true;
  const dot = name.lastIndexOf(".");
  return dot > 0 && TEXT_EXT.has(name.slice(dot + 1).toLowerCase());
}

function walk(root) {
  const out = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) visit(join(dir, entry.name));
      } else if (entry.isFile()) out.push(join(dir, entry.name));
    }
  };
  visit(root);
  return out;
}

/**
 * files: [{ abs, path, label? }] — path is the public (repo-relative, forward-slash) path used for allowlists;
 * label (default: path) is what reports show.
 * transform(path, text) optionally rewrites the text before scanning (internal mode).
 */
export function scanFiles(files, hashed, transform = (_p, t) => t) {
  const compiled = compileTerms(hashed);
  const hits = [];
  let scanned = 0;
  for (const { abs, path, label } of files) {
    if (resolve(abs) === SELF || !isTextFile(path)) continue;
    scanned++;
    const text = transform(path, readFileSync(abs, "utf8"));
    const lines = text.split(/\r?\n/);
    for (let n = 0; n < lines.length; n++) {
      const line = lines[n] ?? "";
      const lower = line.toLowerCase();
      const found = termHits(lower, compiled, hashed.salt).map((h) => ({ ...h, match: line.slice(h.index, h.index + h.length) }));
      for (const rule of PATTERNS) {
        for (const m of line.matchAll(rule.re)) {
          if (rule.allow?.(m[0])) continue;
          if (rule.allowAt?.(line, m.index ?? 0, path)) continue;
          found.push({ index: m.index ?? 0, category: rule.category, match: m[0] });
        }
      }
      for (const f of found) {
        hits.push({ file: label ?? path, line: n + 1, col: f.index + 1, category: f.category, match: f.match, text: line.trim().slice(0, 160) });
      }
    }
  }
  return { scanned, hits };
}

export function summarize(hits) {
  const byCategory = {};
  const byFile = {};
  for (const h of hits) {
    byCategory[h.category] = (byCategory[h.category] ?? 0) + 1;
    const f = (byFile[h.file] ??= { total: 0 });
    f.total++;
    f[h.category] = (f[h.category] ?? 0) + 1;
  }
  return { byCategory, byFile };
}

function markdownReport({ scanned, hits }, title) {
  const { byCategory, byFile } = summarize(hits);
  const files = Object.entries(byFile).sort((a, b) => b[1].total - a[1].total);
  const cats = Object.keys(byCategory).sort();
  const lines = [
    `# ${title}`,
    "",
    `Scanned ${scanned} text files; ${hits.length} hits in ${files.length} files.`,
    "",
    "| category | hits | files |",
    "|---|---|---|",
    ...cats.map((c) => `| ${c} | ${byCategory[c]} | ${files.filter(([, v]) => v[c]).length} |`),
    "",
    "## Files",
    "",
    `| file | total | ${cats.join(" | ")} |`,
    `|---|---|${cats.map(() => "---").join("|")}|`,
    ...files.map(([file, v]) => `| ${file} | ${v.total} | ${cats.map((c) => v[c] ?? "").join(" | ")} |`),
    "",
  ];
  return lines.join("\n");
}

// ---------- term sources ----------

function readPlain(plainFile, namesFile) {
  const plain = JSON.parse(readFileSync(plainFile, "utf8"));
  const byCategory = { ...plain.terms };
  if (namesFile && existsSync(namesFile)) {
    byCategory["person-name"] = readFileSync(namesFile, "utf8").split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim()).filter(Boolean);
  }
  return { ...byCategory, ...excludedTopicTerms(join(dirname(plainFile), "export-exclude.json")) };
}

/**
 * Upstream only: the guard terms of the export-only exclusions (export-exclude.json) while its switch is on —
 * material that stays internal must not show up anywhere that is still exported.
 */
export function excludedTopicTerms(file) {
  if (!existsSync(file)) return {};
  const config = JSON.parse(readFileSync(file, "utf8"));
  return config.enabled ? (config.guardTerms ?? {}) : {};
}

function argValue(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const valued = new Set(["--plain", "--names", "--terms", "--report", "--emit-hashed"]);
  const dirs = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1] ?? ""));
  const internal = args.includes("--internal");
  const plainFile = argValue(args, "--plain");
  const namesFile = argValue(args, "--names") ?? join(HERE, "names.txt");
  const termsFile = argValue(args, "--terms") ?? join(HERE, "guard-terms.json");

  let hashed;
  const localPlain = plainFile ?? (existsSync(join(HERE, "terms.internal.json")) ? join(HERE, "terms.internal.json") : undefined);
  if (localPlain && !argValue(args, "--terms")) {
    hashed = hashTerms(readPlain(localPlain, namesFile));
  } else if (existsSync(termsFile)) {
    hashed = JSON.parse(readFileSync(termsFile, "utf8"));
  } else {
    console.error(`check-internal: no term list (${termsFile}); refusing to pass without it`);
    process.exit(2);
  }

  const emit = argValue(args, "--emit-hashed");
  if (emit) {
    writeFileSync(emit, `${JSON.stringify(hashed)}\n`);
    if (!dirs.length && !internal) return;
  }

  let files;
  let transform;
  if (internal) {
    const repoRoot = resolve(HERE, "../..");
    const mapping = await import(pathToFileURL(join(HERE, "mapping.mjs")).href);
    const listed = execFileSync("git", ["ls-files", "-z", "--", ...mapping.PATH_MAP.map(([from]) => from)], { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    files = listed.split("\0").filter(Boolean)
      .filter((p) => !p.split("/").some((seg) => SKIP_DIRS.has(seg)) && existsSync(join(repoRoot, p)) && mapping.isExportedPath(mapping.toPublicPath(p)))
      .map((p) => ({ abs: join(repoRoot, p), path: mapping.toPublicPath(p), label: p }));
    transform = mapping.rewriteText;
  } else {
    const roots = dirs.length ? dirs : ["."];
    files = roots.flatMap((root) => walk(resolve(root)).map((abs) => ({ abs, path: relative(resolve(root), abs).replaceAll("\\", "/") })));
  }

  const result = scanFiles(files, hashed, transform);
  const { byCategory } = summarize(result.hits);
  const report = argValue(args, "--report");
  if (report) {
    mkdirSync(dirname(resolve(report)), { recursive: true });
    writeFileSync(`${report}.json`, `${JSON.stringify({ scanned: result.scanned, summary: summarize(result.hits), hits: result.hits }, null, 1)}\n`);
    writeFileSync(`${report}.md`, markdownReport(result, internal ? "Leak guard: upstream tree (as exported)" : "Leak guard"));
  }
  if (!args.includes("--quiet")) {
    for (const h of result.hits) console.log(`${h.file}:${h.line}:${h.col}  [${h.category}]  ${h.match}`);
  }
  const counts = Object.entries(byCategory).map(([c, n]) => `${c}=${n}`).join(" ");
  if (result.hits.length) {
    console.error(`check-internal: ${result.hits.length} hit(s) in ${result.scanned} files  ${counts}`);
    process.exitCode = 1;
  } else {
    console.log(`check-internal: clean (${result.scanned} text files)`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === SELF) await main();
