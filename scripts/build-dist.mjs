#!/usr/bin/env node
// 把一个包编译成 dist/（JS + .d.ts + 声明 map），并把 package.json 的 TS 入口改成指向编译产物。
//
// 为什么要有它：本仓的包以前直接分发 TS 源码（exports 指向 ./src/*.ts）。Node 故意不剥离
// node_modules 里的 TS（ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING，Node 26 仍是如此），
// 所以按 git tag 安装的下游全都得装 tsx；tsc 还会按下游自己的严格度去检查我们的源码，
// esbuild --packages=external 打包后上线也加载不了。发编译产物后这三件事都没了。
//
// 用法：node scripts/build-dist.mjs <包目录>...   （例：node scripts/build-dist.mjs packages/quanxian）
//       node scripts/build-dist.mjs --all          （所有已切到 dist 的包，即 files 里有 "dist" 的）
//
// 规则：
// - 编译范围 = exports 里 TS 入口所在的顶层目录（src/、drizzle/ …），排除测试；输出目录结构与源码一一对应
//   （src/a.ts → dist/src/a.js），所以 drizzle/ 与 src/ 之间的相对 import 照样成立。
// - 相对 import 的 .ts/.tsx 后缀由 tsc 的 rewriteRelativeImportExtensions 改成 .js。
// - 范围内的非 TS 文件（CSS、JSON、图片、手写 .d.ts）原样复制到 dist 对应位置。
// - TS 入口改成 { types, source, default }：types / default 指向 dist；source 指回源码（打包器或仓内想直接用源码时用）。
//   CSS、SQL、静态资源等非 TS 入口不动。
// - dist/.source-hash 记录编译输入的哈希，scripts/check-dist.mjs 据此判断「源码改了没重新编译」。
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { distTarget, isTsTarget, sourceHash, sourceRoots, sourceTarget } from "./dist-lib.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tscBin = join(repoRoot, "node_modules", "typescript", "bin", "tsc");

function readManifest(packageDir) {
  return JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
}

function writeManifest(packageDir, manifest) {
  writeFileSync(join(packageDir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

/** exports 的一个值 → 编译后的形状（只处理 TS 入口；已经转换过的从 source 重新推导，脚本可重复跑） */
function convertExport(value) {
  const source = sourceTarget(value);
  if (!source || !isTsTarget(source)) return value;
  return { types: distTarget(source, ".d.ts"), source, default: distTarget(source, ".js") };
}

function compile(packageDir, roots) {
  const config = {
    extends: "./tsconfig.json",
    compilerOptions: {
      noEmit: false,
      emitDeclarationOnly: false,
      declaration: true,
      declarationMap: true,
      sourceMap: false,
      outDir: "dist",
      rootDir: ".",
      rewriteRelativeImportExtensions: true,
      allowImportingTsExtensions: true,
      incremental: false,
      composite: false,
      tsBuildInfoFile: null,
    },
    include: roots.flatMap((root) => [`${root}/**/*.ts`, `${root}/**/*.tsx`]),
    exclude: ["**/*.test.ts", "**/*.test.tsx", "**/test/**", "**/__tests__/**", "dist", "node_modules"],
  };
  const configPath = join(packageDir, "tsconfig.dist.json");
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  try {
    const result = spawnSync(process.execPath, [tscBin, "-p", configPath], { cwd: packageDir, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`tsc failed in ${relative(repoRoot, packageDir)}:\n${result.stdout}${result.stderr}`);
    }
  } finally {
    rmSync(configPath, { force: true });
  }
}

/** 范围内的非 TS 文件（含手写 .d.ts）复制进 dist；测试目录不复制 */
function copyAssets(packageDir, roots) {
  const isSkipped = (name) => name === "test" || name === "__tests__" || name === "node_modules";
  const isCompiled = (name) => /\.tsx?$/.test(name) && !name.endsWith(".d.ts");
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!isSkipped(entry.name)) walk(path);
      } else if (!isCompiled(entry.name)) {
        const target = join(packageDir, "dist", relative(packageDir, path));
        mkdirSync(dirname(target), { recursive: true });
        cpSync(path, target);
      }
    }
  };
  for (const root of roots) walk(join(packageDir, root));
}

export function buildPackage(packageDir) {
  const manifest = readManifest(packageDir);
  const roots = sourceRoots(manifest.exports ?? {});
  if (roots.length === 0) throw new Error(`${manifest.name}: exports 里没有 TS 入口，不需要编译`);
  rmSync(join(packageDir, "dist"), { recursive: true, force: true });
  compile(packageDir, roots);
  copyAssets(packageDir, roots);
  manifest.exports = Object.fromEntries(
    Object.entries(manifest.exports).map(([key, value]) => [key, convertExport(value)]),
  );
  manifest.files = [...new Set([...(manifest.files ?? []), "dist"])];
  writeManifest(packageDir, manifest);
  writeFileSync(join(packageDir, "dist", ".source-hash"), `${sourceHash(packageDir, roots)}\n`);
  return { name: manifest.name, roots };
}

function packagesToBuild(args) {
  if (!args.includes("--all")) return args.map((arg) => resolve(arg));
  const packagesDir = join(repoRoot, "packages");
  return readdirSync(packagesDir)
    .map((name) => join(packagesDir, name))
    .filter((dir) => existsSync(join(dir, "package.json")) && (readManifest(dir).files ?? []).includes("dist"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const targets = packagesToBuild(process.argv.slice(2));
  if (targets.length === 0) {
    console.error("用法：node scripts/build-dist.mjs <包目录>... | --all");
    process.exit(1);
  }
  for (const dir of targets) {
    const { name, roots } = buildPackage(dir);
    console.log(`built ${name} (${roots.join(", ")}) → dist/`);
  }
}
