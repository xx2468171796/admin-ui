// Builds the static site (see vite.config.ts for the two targets).
//   node scripts/build.mjs            web build → build/ (ES modules, absolute paths from /, hashed assets, 404.html)
//   node scripts/build.mjs --sandbox  review-sandbox build → build-sandbox/ (classic bundles, relative paths)
import { build } from "vite";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

// The site imports the library's built dist; a fresh clone has none yet, so build it first.
const packages = resolve(root, "../../packages");
const library = readdirSync(packages).map((name) => join(packages, name)).find((dir) => {
  const manifest = join(dir, "package.json");
  return existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).name === "@adminui/react";
});
if (library && !existsSync(join(library, "dist/src/index.js"))) {
  console.log("组件库还没构建 dist，先构建它");
  const run = spawnSync("npm run build", { cwd: library, stdio: "inherit", shell: true });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
const sandbox = process.argv.includes("--sandbox");
const ISLANDS = ["hero", "crm", "views", "builder", "ai", "east"];
process.env.SITE_BUILD_ID = Date.now().toString(36);
process.env.NODE_ENV = "production";
process.env.SITE_TARGET = sandbox ? "sandbox" : "web";
const steps = sandbox ? ["index", "docs", "preview", ...ISLANDS.map((n) => `island:${n}`)] : ["web"];
for (const step of steps) {
  process.env.SITE_STEP = step;
  await build({ root, configFile: resolve(root, "vite.config.ts"), logLevel: "warn", mode: "production" });
  console.log(`已构建 ${sandbox ? `沙箱版 ${step}` : "正式版"}`);
}
