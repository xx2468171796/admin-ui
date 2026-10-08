// build-dist.mjs 与 check-dist.mjs 共用的规则：哪些入口要编译、编译范围、产物路径、输入哈希。
// 两边必须用同一份，否则「编译时」和「检查时」对范围的理解会漂开，检查就成了摆设。
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const TS_TARGET = /\.tsx?$/;

/** exports 的值里指向源码的那个路径（字符串本身，或转换后对象的 source） */
export function sourceTarget(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.source === "string") return value.source;
  return undefined;
}

export function isTsTarget(target) {
  return TS_TARGET.test(target) && !target.endsWith(".d.ts");
}

/** ./src/a.ts → ./dist/src/a.js（或 .d.ts）；通配入口 ./src/x/*.ts 同理 */
export function distTarget(source, extension) {
  return `./dist/${source.replace(/^\.\//, "")}`.replace(TS_TARGET, extension);
}

/** 编译范围：TS 入口所在的顶层目录（src、drizzle …），按字母排序 */
export function sourceRoots(exportsField) {
  const roots = new Set();
  for (const value of Object.values(exportsField)) {
    const source = sourceTarget(value);
    if (source && isTsTarget(source)) roots.add(source.replace(/^\.\//, "").split("/")[0]);
  }
  return [...roots].sort();
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "test" || entry.name === "__tests__" || entry.name === "node_modules") return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

/** 编译输入的哈希：范围内全部文件（路径 + 内容，换行统一成 \n）+ tsconfig.json */
export function sourceHash(packageDir, roots) {
  const hash = createHash("sha256");
  const files = roots.flatMap((root) => listFiles(join(packageDir, root)));
  const tsconfig = join(packageDir, "tsconfig.json");
  if (existsSync(tsconfig)) files.push(tsconfig);
  for (const file of files.map((f) => relative(packageDir, f).replaceAll("\\", "/")).sort()) {
    if (/\.test\.tsx?$/.test(file)) continue;
    hash.update(`${file}\n`);
    hash.update(readFileSync(join(packageDir, file), "utf8").replaceAll("\r\n", "\n"));
  }
  return hash.digest("hex");
}
