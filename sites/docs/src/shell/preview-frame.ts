import { encodeState, type PreviewState } from "./preview-protocol";

declare const __PREVIEW_SCRIPT__: string;
declare const __SITE_ESM__: boolean;

/**
 * How to load the demo frame. Dev and the web build (ES modules, same-origin static host): `preview.html#state`.
 * Sandbox build: an `srcdoc` document that loads the classic preview bundle by relative URL — sandboxed review tools
 * and strict doc hosts send `frame-ancestors 'self'`, which blocks a nested preview.html when the docs page itself
 * runs in a sandboxed (opaque-origin) frame; an srcdoc frame has no response of its own, so nothing blocks it, and it
 * resolves relative URLs against the docs page.
 */
export function previewFrameProps(state: PreviewState): { src?: string; srcDoc?: string } {
  if (import.meta.env.DEV || __SITE_ESM__) return { src: `${import.meta.env.BASE_URL}preview.html${encodeState(state)}` };
  const json = JSON.stringify(state).replace(/</g, "\\u003c");
  const base = document.baseURI.replace(/"/g, "%22");
  return {
    srcDoc: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base href="${base}"><script>window.__PREVIEW_STATE__=${json}</script><script defer src="${__PREVIEW_SCRIPT__}"></script></head><body><div id="root"></div></body></html>`,
  };
}
