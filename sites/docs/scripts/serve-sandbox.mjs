// Serves the sandbox build (build-sandbox/, npm run build:sandbox) the way sandboxed review tools do: every response
// carries `Content-Security-Policy: sandbox allow-scripts allow-forms` (opaque origin: no storage, no CORS-less module
// loading). Use it to check that the sandbox build still works there.   node scripts/serve-sandbox.mjs [port=5411]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../build-sandbox");
const port = Number(process.argv[2] ?? 5411);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".json": "application/json" };
createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  const file = normalize(join(root, path.endsWith("/") ? `${path}index.html` : path));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "content-security-policy": "sandbox allow-scripts allow-forms; form-action 'none'; frame-ancestors 'self'", "cache-control": "no-store" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("没有这个文件");
  }
}).listen(port, "127.0.0.1", () => console.log(`sandbox 预览：http://127.0.0.1:${port}/`));
