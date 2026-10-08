/** Messages between the docs page and the preview iframe (preview.html). */
export type PreviewMode = "light" | "dark";
export type PreviewState = {
  demo: string;
  mode: PreviewMode;
  palette: string;
  props: Record<string, unknown>;
  /** No padding around the demo (shells, grids, full pages). */
  bleed?: boolean;
};

export const MSG_STATE = "aui-site:state";
export const MSG_HEIGHT = "aui-site:height";

export function encodeState(state: PreviewState): string {
  return `#${encodeURIComponent(JSON.stringify(state))}`;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Parse untrusted input (location.hash / postMessage data) into a PreviewState, or null. */
export function parseState(raw: unknown): PreviewState | null {
  if (!isRecord(raw) || typeof raw.demo !== "string" || !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(raw.demo)) return null;
  return {
    demo: raw.demo,
    mode: raw.mode === "dark" ? "dark" : "light",
    palette: typeof raw.palette === "string" ? raw.palette : "forest",
    props: isRecord(raw.props) ? raw.props : {},
    bleed: raw.bleed === true,
  };
}

export function decodeHash(hash: string): PreviewState | null {
  if (!hash || hash.length < 2) return null;
  try {
    return parseState(JSON.parse(decodeURIComponent(hash.slice(1))));
  } catch {
    return null;
  }
}
