#!/usr/bin/env node
// 门禁：已切到编译产物的包（files 里有 "dist"），dist 必须和源码一致、每个入口都真有文件。
//
// 防什么：源码改了、发了版，却忘了重新编译 —— typecheck 绿、测试绿（测试跑的是源码），
// 下游装到的却是旧的 dist，表现成「修了的 bug 在线上还在」，而且看不出错。
// 也防入口写错：exports 指向一个不存在的 dist 文件，只有下游运行时才 ERR_MODULE_NOT_FOUND。
//
// 用法：node scripts/check-dist.mjs            （检查全部已切换的包）
//       node scripts/check-dist.mjs packages/x （只查指定的包）
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { distTarget, isTsTarget, sourceHash, sourceRoots, sourceTarget } from "./dist-lib.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readManifest(dir) {
  return JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
}

function exportProblems(dir, manifest) {
  const problems = [];
  for (const [key, value] of Object.entries(manifest.exports ?? {})) {
    const source = sourceTarget(value);
    if (!source || !isTsTarget(source)) continue;
    if (typeof value === "string") {
      problems.push(`exports["${key}"] 还指向源码 ${source}（跑 node scripts/build-dist.mjs ${relative(repoRoot, dir)}）`);
      continue;
    }
    for (const [field, extension] of [["types", ".d.ts"], ["default", ".js"]]) {
      const expected = distTarget(source, extension);
      if (value[field] !== expected) problems.push(`exports["${key}"].${field} 应为 ${expected}`);
      else if (!expected.includes("*") && !existsSync(join(dir, expected))) problems.push(`缺文件 ${expected}`);
    }
  }
  return problems;
}

export function checkPackage(dir) {
  const manifest = readManifest(dir);
  const problems = exportProblems(dir, manifest);
  const hashFile = join(dir, "dist", ".source-hash");
  if (!existsSync(hashFile)) {
    problems.push("没有 dist/.source-hash（没编译过）");
  } else {
    const expected = sourceHash(dir, sourceRoots(manifest.exports ?? {}));
    if (readFileSync(hashFile, "utf8").trim() !== expected) problems.push("源码改了但 dist 没重新编译");
  }
  return problems.map((problem) => `${manifest.name}: ${problem}`);
}

function switchedPackages() {
  const packagesDir = join(repoRoot, "packages");
  return readdirSync(packagesDir)
    .map((name) => join(packagesDir, name))
    .filter((dir) => existsSync(join(dir, "package.json")) && (readManifest(dir).files ?? []).includes("dist"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const targets = args.length ? args.map((arg) => resolve(arg)) : switchedPackages();
  const problems = targets.flatMap(checkPackage);
  if (problems.length) {
    console.error(problems.join("\n"));
    console.error("修法：node scripts/build-dist.mjs <包目录>，把 dist 和 package.json 一起提交。");
    process.exitCode = 1;
  } else {
    console.log(`dist up to date (${targets.length} package(s))`);
  }
}
