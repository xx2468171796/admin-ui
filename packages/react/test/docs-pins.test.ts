// Install pins in docs must be the current version. The git-tag pin is checked repo-wide by the
// monorepo's docs test; this covers adminUI's two public shapes, which that test does not see: the npm pin `"@adminui/react":"x.y.z"` and the GitHub Release tarball URL.
// On 2026-10-11 (package at 8.9.1) INTEGRATION.md still said 8.6.0 and README 8.2.0 — copy-paste
// installs an older build and nothing errors. Fix with: npm run sync-doc-pins (repo root).
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const VERSION = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;
/** Changelogs are history: "8.6.0 pinned #adminUI-v8.6.0" must keep saying 8.6.0. */
const isHistory = (name: string) => /^CHANGELOG[^/\\]*\.md$/i.test(name);

function markdowns(dir: string, out: string[] = []): string[] {
  // A nested checkout / worktree has its own versions (same rule as scripts/sync-doc-pins.mjs).
  if (dir !== ROOT && existsSync(join(dir, ".git"))) return out;
  for (const entry of readdirSync(dir)) {
    // .claude: agent worktrees (same rule as scripts/sync-doc-pins.mjs)
    if (entry === "node_modules" || entry === ".git" || entry === "dist" || entry === ".claude") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) markdowns(path, out);
    else if (entry.endsWith(".md") && !isHistory(entry)) out.push(path);
  }
  return out;
}

const SHAPES: [string, RegExp][] = [
  ["npm pin", /"@adminui\/react"\s*:\s*"(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)"/g],
  ["release tarball", /releases\/download\/v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\/adminui-react-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\.tgz/g],
];

test(`adminUI npm pins and release tarball URLs in docs are the current version (${VERSION})`, () => {
  const stale: string[] = [];
  for (const file of markdowns(ROOT)) {
    const text = readFileSync(file, "utf8");
    for (const [shape, re] of SHAPES) {
      for (const m of text.matchAll(re)) {
        const versions = m.slice(1).filter(Boolean);
        if (versions.some((v) => v !== VERSION)) stale.push(`${file.slice(ROOT.length)}: ${shape} ${versions.join(" / ")}`);
      }
    }
  }
  assert.deepEqual(stale, [], "run `npm run sync-doc-pins` at the repo root");
});
