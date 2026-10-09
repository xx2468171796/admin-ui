/**
 * `@adminui/react/vite` — build-time options for the kit, used in a consumer's `vite.config.ts` (Node only;
 * nothing here reaches the browser bundle).
 *
 * `adminUiLocale({ locale: "zh-Hant" })` shows all of the kit's built-in UI text in Traditional Chinese with
 * Taiwan wording: the kit's own modules (its JS and CSS, nothing else) are converted while Vite loads them —
 * through the dependency pre-bundle in dev (an esbuild plugin) and the transform pipeline in dev and build.
 * The app's own code, other packages and any data shown at runtime are never touched. `zh-Hans` / no locale = off.
 * Needs the optional peer `opencc-js` only when `zh-Hant` is on.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { convertModuleText, createHantConverter, hasHanInCode, HANT_UI_PHRASES, type AdminUiLocale, type TextConverter } from "./locale-core.ts";

export { convertModuleText, createHantConverter, HANT_UI_PHRASES } from "./locale-core.ts";
export type { AdminUiLocale, HantConverterOptions, PhraseRule, TextConverter } from "./locale-core.ts";

export type AdminUiLocaleOptions = {
  /** `zh-Hans` (default) = the kit's text as written; `zh-Hant` = Traditional Chinese, Taiwan wording. */
  locale?: AdminUiLocale;
  /** Applied after the conversion: 「what the screen shows」 → 「what it should show」, e.g. `{ "簽核": "審批" }`. Keys must contain a Chinese character. */
  overrides?: Readonly<Record<string, string>>;
};

const PLUGIN_NAME = "admin-ui-locale";
const CODE_FILE = /\.(?:[cm]?js|jsx|tsx?|css)$/;
const ESBUILD_FILTER = /\.(?:[cm]?js|jsx)$/;

/** Forward slashes, no query / hash, lower case on Windows (drive letters and folders are case-insensitive there). */
function normalizePath(path: string, windows: boolean): string {
  const clean = path.replace(/[?#].*$/, "").replace(/\\/g, "/");
  return windows ? clean.toLowerCase() : clean;
}

export type LibraryFileOptions = {
  /** Package folders on disk (as linked and as resolved). */
  roots: readonly string[];
  /** Folder names under node_modules the package can be installed as (package name, alias). */
  names: readonly string[];
  /** Compare case-insensitively (default: running on Windows). */
  windows?: boolean;
};

/**
 * `(id) => true` for files that belong to this package (by folder, or by its node_modules folder — also inside
 * pnpm's `.pnpm/…/node_modules/<name>/`), never for the package's own nested node_modules, other packages,
 * virtual modules or non-code files.
 */
export function libraryFileMatcher({ roots, names, windows = process.platform === "win32" }: LibraryFileOptions): (id: string) => boolean {
  const rootPrefixes = [...new Set(roots.map((root) => `${normalizePath(root, windows).replace(/\/+$/, "")}/`))];
  const nameMarks = [...new Set(names.filter(Boolean).map((name) => normalizePath(`/node_modules/${name}/`, windows)))];
  return (id) => {
    if (!id || id.startsWith("\0") || id.startsWith("virtual:")) return false;
    const path = normalizePath(id, windows);
    if (!CODE_FILE.test(path)) return false;
    const inside = (rest: string) => !rest.startsWith("node_modules/") && !rest.includes("/node_modules/");
    for (const prefix of rootPrefixes) if (path.startsWith(prefix)) return inside(path.slice(prefix.length));
    for (const mark of nameMarks) {
      const at = path.lastIndexOf(mark);
      if (at >= 0) return inside(path.slice(at + mark.length));
    }
    return false;
  };
}

/** This package's folder (where its package.json is) and the names it can be installed under. */
function ownPackage(): { roots: string[]; names: string[]; version: string } {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "package.json")) && dirname(dir) !== dir) dir = dirname(dir);
  const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name?: string; version?: string };
  const roots = [dir];
  try {
    roots.push(realpathSync(dir));
  } catch {
    // keep the path as found
  }
  const names = [manifest.name ?? ""];
  for (const root of roots) {
    const path = root.replace(/\\/g, "/");
    const at = path.lastIndexOf("/node_modules/");
    if (at >= 0) names.push(path.slice(at + "/node_modules/".length));
  }
  return { roots, names, version: manifest.version ?? "0" };
}

async function loadOpenCC(): Promise<TextConverter> {
  try {
    const { Converter } = await import("opencc-js/cn2t");
    return Converter({ from: "cn", to: "twp" });
  } catch (error) {
    throw new Error(`${PLUGIN_NAME}: locale "zh-Hant" needs the package opencc-js — install it as a dev dependency (npm i -D opencc-js).`, { cause: error });
  }
}

/**
 * Vite plugin: the language of the kit's built-in UI text. Put it in `plugins` of `vite.config.ts`.
 * `zh-Hans` / omitted returns an inert plugin, so the kit's output stays byte-for-byte as before.
 */
export function adminUiLocale(options: AdminUiLocaleOptions = {}): Plugin {
  const locale = options.locale ?? "zh-Hans";
  if (locale !== "zh-Hans" && locale !== "zh-Hant") throw new Error(`${PLUGIN_NAME}: unknown locale "${String(locale)}" (use "zh-Hans" or "zh-Hant")`);
  if (locale === "zh-Hans") return { name: PLUGIN_NAME };
  const overrides = options.overrides ?? {};
  createHantConverter((text) => text, { overrides }); // validates the overrides now, not at the first file
  const pkg = ownPackage();
  const isLibraryFile = libraryFileMatcher({ roots: pkg.roots, names: pkg.names });
  // The name goes into Vite's dependency-cache hash: changing the locale, overrides or kit version re-bundles.
  const fingerprint = createHash("sha256").update(JSON.stringify([locale, pkg.version, HANT_UI_PHRASES.map(([from, to]) => [String(from), to]), Object.entries(overrides).sort()])).digest("hex").slice(0, 12);
  let converter: Promise<TextConverter> | undefined;
  const convert = async (code: string, id: string) => {
    converter ??= loadOpenCC().then((opencc) => createHantConverter(opencc, { overrides }));
    return convertModuleText(code, await converter, /\.css(?:[?#]|$)/.test(id) ? "css" : "js");
  };
  const esbuildPlugin = {
    name: `${PLUGIN_NAME}:${locale}:${fingerprint}`,
    setup(build: { onLoad(options: { filter: RegExp }, callback: (args: { path: string }) => Promise<{ contents: string; loader: "js"; resolveDir: string } | undefined>): void }) {
      build.onLoad({ filter: ESBUILD_FILTER }, async (args) => {
        if (!isLibraryFile(args.path)) return undefined;
        const code = await readFile(args.path, "utf8");
        if (!hasHanInCode(code)) return undefined;
        return { contents: await convert(code, args.path), loader: "js", resolveDir: dirname(args.path) };
      });
    },
  };
  return {
    name: PLUGIN_NAME,
    enforce: "pre",
    config() {
      return { optimizeDeps: { esbuildOptions: { plugins: [esbuildPlugin] } } };
    },
    async transform(code, id) {
      if (!isLibraryFile(id) || !hasHanInCode(code)) return null;
      const next = await convert(code, id);
      return next === code ? null : { code: next, map: null };
    },
  };
}
