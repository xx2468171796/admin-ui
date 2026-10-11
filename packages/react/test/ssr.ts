/**
 * Test helper: render a .tsx module of the package on the server (react-dom/server) without a browser.
 * esbuild bundles only the package's own source (JSX → JS); every bare import (react, lucide-react, radix …)
 * stays external and is rewritten to the absolute file URL Node would load, so the bundle shares the one
 * React instance with react-dom/server here. CSS side-effect imports (#aui-css/*) are dropped. `stubs`
 * replaces a source module (by file name) — e.g. a popover layer that only shows after mount.
 */
import { build } from "esbuild";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** File name of a source module (e.g. "popover-panel.tsx") → the TSX that replaces it. */
export type Stubs = Record<string, string>;
const cache = new Map<string, Promise<unknown>>();
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function bundle(entry: URL, stubs: Stubs): Promise<unknown> {
  const result = await build({
    entryPoints: [fileURLToPath(entry)],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    jsx: "automatic",
    logLevel: "silent",
    plugins: [
      {
        name: "aui-test-externals",
        setup(b) {
          for (const name of Object.keys(stubs)) b.onResolve({ filter: new RegExp(`/${escape(name)}$`) }, () => ({ path: name, namespace: "aui-stub" }));
          b.onLoad({ filter: /.*/, namespace: "aui-stub" }, (args) => ({ contents: stubs[args.path] ?? "", loader: "tsx", resolveDir: fileURLToPath(new URL(".", import.meta.url)) }));
          b.onResolve({ filter: /^#aui-css\// }, () => ({ path: "css", namespace: "aui-empty" }));
          b.onLoad({ filter: /.*/, namespace: "aui-empty" }, () => ({ contents: "" }));
          b.onResolve({ filter: /^[^./#]/ }, (args) =>
            args.kind === "entry-point" || /^[A-Za-z]:[\\/]/.test(args.path) ? undefined : { path: import.meta.resolve(args.path), external: true },
          );
        },
      },
    ],
  });
  const dir = mkdtempSync(join(tmpdir(), "aui-ssr-"));
  const file = join(dir, "bundle.mjs");
  writeFileSync(file, result.outputFiles[0]?.text ?? "");
  try {
    return await import(pathToFileURL(file).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Import a .tsx source module (path relative to the package root, e.g. "src/data.tsx"). */
export function importTsx<M>(path: string, stubs: Stubs = {}): Promise<M> {
  const entry = new URL(`../${path}`, import.meta.url);
  const key = `${entry.href}|${JSON.stringify(stubs)}`;
  let loaded = cache.get(key);
  if (!loaded) {
    loaded = bundle(entry, stubs);
    cache.set(key, loaded);
  }
  return loaded as Promise<M>;
}
