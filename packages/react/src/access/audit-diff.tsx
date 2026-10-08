"use client";
/**
 * AuditDiff — before / after of one audit event: a change list (字段 · 类型 · 原值 → 新值) or the two
 * JSON snapshots side by side (stacked on phones). Secret-looking keys are always hidden. Pure display;
 * the host passes snapshots it is allowed to show.
 */
import { useMemo, useState } from "react";
import { StatusBadge } from "../primitives.tsx";
import { SegmentedControl } from "../choices.tsx";
import type { JsonDiffKind } from "./contracts.ts";
import { DEFAULT_SECRET_KEYS, diffJson, formatJsonValue, isSecretPath } from "./diff-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type AuditDiffProps = {
  before: unknown;
  after: unknown;
  /** Path → Chinese label, e.g. { name: "角色名称", "permissions": "权限" }; prefix matches label nested paths. */
  labels?: Readonly<Record<string, string>>;
  /** Extra secret key fragments (merged with password / token / secret …). */
  secretKeys?: readonly string[];
  caption?: string;
  maxEntries?: number;
  /** Initial view (default "changes"). */
  defaultView?: "changes" | "json";
};

const KIND: Readonly<Record<JsonDiffKind, { label: string; tone: "success" | "danger" | "warning" }>> = {
  added: { label: "新增", tone: "success" },
  removed: { label: "删除", tone: "danger" },
  changed: { label: "修改", tone: "warning" },
};
const HIDDEN = "（已隐藏）";

function labelFor(path: string, labels?: Readonly<Record<string, string>>): string {
  if (!labels) return path;
  if (labels[path]) return labels[path]!;
  // Longest labelled prefix: members[id=2].level → 「成员」[id=2].level
  const prefix = Object.keys(labels).filter((k) => path.startsWith(k) && /[.[]/.test(path.charAt(k.length))).sort((a, b) => b.length - a.length)[0];
  return prefix ? `${labels[prefix]}${path.slice(prefix.length)}` : path;
}

function redact(value: unknown, secrets: readonly string[], path = ""): unknown {
  if (path && isSecretPath(path, secrets)) return value === undefined ? undefined : HIDDEN;
  if (Array.isArray(value)) return value.map((v, i) => redact(v, secrets, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, secrets, path ? `${path}.${k}` : k)]));
  return typeof value === "bigint" ? value.toString() : value;
}

export function AuditDiff({ before, after, labels, secretKeys = [], caption = "变更前后", maxEntries = 500, defaultView = "changes" }: AuditDiffProps) {
  const [view, setView] = useState(defaultView);
  const secrets = useMemo(() => [...DEFAULT_SECRET_KEYS, ...secretKeys], [secretKeys]);
  const entries = useMemo(() => diffJson(before, after, maxEntries), [before, after, maxEntries]);
  const json = (v: unknown) => (v === undefined ? "（无）" : JSON.stringify(redact(v, secrets), null, 2));
  return (
    <div className="aui-access-diff">
      <div className="aui-access-diff-head">
        <SegmentedControl label="显示方式" size="sm" value={view} onValueChange={setView} options={[{ value: "changes", label: `改动清单（${entries.length}${entries.length >= maxEntries ? "+" : ""}）` }, { value: "json", label: "前后对照" }]} />
      </div>
      {view === "changes" ? (
        entries.length === 0 ? (
          <p className="aui-note aui-access-empty">没有差异</p>
        ) : (
          <div className="aui-access-matrix-scroll">
            {/* admin-ui-audit-ignore raw-control: SDK 内部——AuditDiff 组件自己的四列差异表（字段 / 类型 / 原值 / 新值，密钥打码），宿主用的是 AuditDiff 组件 */}
            <table className="aui-access-diff-table">
              <caption className="aui-sr-only">{caption}</caption>
              <thead>
                <tr>
                  <th scope="col">字段</th>
                  <th scope="col">类型</th>
                  <th scope="col">原值</th>
                  <th scope="col">新值</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const secret = isSecretPath(e.path, secrets);
                  const show = (v: unknown, present: boolean) => (!present ? <span className="aui-note">—</span> : secret ? <span className="aui-note">{HIDDEN}</span> : <code data-tip={formatJsonValue(v, 4000)}>{formatJsonValue(v)}</code>);
                  return (
                    <tr key={`${e.kind}-${e.path}`} data-kind={e.kind}>
                      <th scope="row" data-tip={e.path}>{labelFor(e.path, labels)}</th>
                      <td><StatusBadge tone={KIND[e.kind].tone}>{KIND[e.kind].label}</StatusBadge></td>
                      <td className="aui-access-diff-before">{show(e.before, e.kind !== "added")}</td>
                      <td className="aui-access-diff-after">{show(e.after, e.kind !== "removed")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {entries.length >= maxEntries && <p className="aui-note">只显示前 {maxEntries} 处差异，完整内容看「前后对照」。</p>}
          </div>
        )
      ) : (
        <div className="aui-access-diff-json">
          <section aria-label="变更前">
            <h4>变更前</h4>
            <pre tabIndex={0}>{json(before)}</pre>
          </section>
          <section aria-label="变更后">
            <h4>变更后</h4>
            <pre tabIndex={0}>{json(after)}</pre>
          </section>
        </div>
      )}
    </div>
  );
}
