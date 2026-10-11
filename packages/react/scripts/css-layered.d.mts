export declare const LAYERED_DIR: string;
export declare const LAYER_ORDER: string;
export declare const AUI_LAYERS: string;
/** Top-level statements of a stylesheet. */
export declare function topLevel(css: string): string[];
/** Layer (reset / tokens / core / chunk / state) of one top-level statement of a chunk. */
export declare function layerOf(chunk: string, statement: string): "reset" | "tokens" | "core" | "chunk" | "state";
/** File name in src/styles-layered → expected content. */
export declare function layeredFiles(): Map<string, string>;
/** Why the committed layered copies are stale ([] = up to date). */
export declare function layeredProblems(): string[];
