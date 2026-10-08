// Types for scripts/ui-audit.mjs (the admin-ui-audit bin), so tests and tooling can import it.
export type AuditLevel = "error" | "warn";
export type AuditRuleId = "raw-control" | "hard-colour" | "colour-bar" | "sdk-override" | "row-actions" | "intro-paragraph" | "page-title" | "no-template" | "native-date" | "bad-ignore"
  | "removed-api" | "removed-prop" | "removed-class" | "removed-css-var" | "legacy-tone" | "deep-import";
export interface AuditFinding { rule: AuditRuleId; line: number; level: AuditLevel; hint: string; text: string; detail: string; file?: string }
export interface AuditBaseline { tool: "admin-ui-audit"; version: 1; note?: string; findings: { file: string; rule: string; text: string }[] }
export declare const RULES: Record<AuditRuleId, { level: AuditLevel; hint: string }>;
export declare const TEMPLATE_BLOCKS: readonly string[];
/** The 8.0 migration table: removed exports / props / classes / CSS variables / old tone names → replacement. */
export declare const MIGRATION_8: {
  exports: Record<string, string>;
  props: readonly { component: string; prop: string; value?: string; hint: string }[];
  keys: readonly { pattern: string; hint: string }[];
  classes: Record<string, string>;
  cssVars: Record<string, string>;
  tones: Record<string, string>;
  entries: readonly string[];
};
export declare function hasHardColour(value: string, prop?: string): boolean;
export declare function overridesSdk(selector: string): boolean;
export declare function maskSource(text: string): { code: string; bare: string };
export interface AuditOptions { /** Package names whose imports are checked (default DEFAULT_PACKAGES + aliases from package.json). */ packages?: readonly string[] }
export declare const DEFAULT_PACKAGES: readonly string[];
export declare function packageAliases(manifest: { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; peerDependencies?: Record<string, string>; optionalDependencies?: Record<string, string> }): string[];
export declare function detectPackages(target: string): string[];
export declare function auditText(text: string, file?: string, options?: AuditOptions): AuditFinding[];
export declare function listFiles(target: string): string[];
export declare function auditPaths(targets: string[], base?: string, options?: AuditOptions): (AuditFinding & { file: string })[];
export declare function makeBaseline(findings: (AuditFinding & { file: string })[]): AuditBaseline;
export declare function compareBaseline<T extends AuditFinding & { file: string }>(findings: T[], baseline: AuditBaseline | undefined): { fresh: T[]; known: T[]; stale: number };
export declare function main(argv: string[], log?: (line: string) => void): number;
