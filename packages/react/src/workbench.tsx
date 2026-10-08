"use client";
import { Fragment, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Choice } from "./primitives.tsx";
import { MenuButton } from "./menu.tsx";
import { FormDialog } from "./forms.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/workflows.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/workflows.css";
export { useAdminShortcuts } from "./admin-shortcuts.ts";
// 命令面板搬到 command-palette.tsx，公开名不变。
export { CommandPalette } from "./command-palette.tsx";
export type AdminPage = {
  id: string;
  title: string;
  feature?: string;
  permission?: string;
  render: () => ReactNode;
};
export function createPageRegistry(pages: readonly AdminPage[]) {
  if (new Set(pages.map((p) => p.id)).size !== pages.length)
    throw Error("页面 ID 重复");
  return {
    list: (context: {
      features: Readonly<Record<string, boolean>>;
      permissions: readonly string[];
    }) =>
      pages.filter(
        (p) =>
          (!p.feature || context.features[p.feature] === true) &&
          (!p.permission || context.permissions.includes(p.permission)),
      ),
  };
}
export function FeatureGate({
  name,
  flags,
  children,
  fallback = null,
}: {
  name: string;
  flags: Readonly<Record<string, boolean>>;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return flags[name] === true ? children : fallback;
}
export function WorkspaceSwitcher({
  value,
  options,
  dirty = false,
  onChange,
}: {
  value: string;
  options: readonly { value: string; label: string }[];
  dirty?: boolean;
  onChange: (id: string) => Promise<void>;
}) {
  const [next, setNext] = useState("");
  return (
    <>
      <Choice
        label="当前工作区"
        value={value}
        options={options}
        onChange={setNext}
      />
      <FormDialog
        open={Boolean(next)}
        title="切换工作区"
        description={
          dirty
            ? "当前有未保存内容，切换后将离开当前工作区。"
            : "任务、草稿和视图将切换到目标工作区。"
        }
        submitLabel="确认切换"
        onClose={() => setNext("")}
        onSubmit={() => onChange(next)}
      >
        <p>{options.find((o) => o.value === next)?.label}</p>
      </FormDialog>
    </>
  );
}
export type BreadcrumbItem = { label: string; onClick?: () => void };
/**
 * Breadcrumb: 13px grey steps that darken on hover (links when they have `onClick`),
 * small chevrons, the current page dark + bold and not clickable. More than `maxItems` (default 4): the middle
 * folds into 「…」 (a menu). Phones keep only 「← 上一级」 (the last step before the current one that has `onClick`).
 */
export function Breadcrumbs({ items, maxItems = 4 }: { items: readonly BreadcrumbItem[]; maxItems?: number }) {
  const fold = items.length > Math.max(3, maxItems);
  const hidden = fold ? items.slice(1, items.length - 2) : [];
  const shown: (BreadcrumbItem | "fold")[] = fold ? [items[0]!, "fold", ...items.slice(-2)] : [...items];
  const back = [...items.slice(0, -1)].reverse().find((item) => item.onClick);
  return (
    <nav aria-label="面包屑" className="aui-breadcrumbs aui-crumbs" data-has-back={back ? "" : undefined}>
      {back && (
        <button type="button" className="aui-crumb-link aui-crumb-back" onClick={back.onClick}>
          <ArrowLeft aria-hidden="true" />
          {back.label}
        </button>
      )}
      {shown.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <ChevronRight className="aui-crumb-sep" aria-hidden="true" />}
          {item === "fold" ? (
            <MenuButton label="更多层级" aria-label="更多层级" size="sm" align="start" className="aui-crumb-fold" sections={[{ items: hidden.map((h, j) => ({ key: String(j), label: h.label, disabled: !h.onClick, onSelect: h.onClick })) }]}>
              …
            </MenuButton>
          ) : i === shown.length - 1 ? (
            <span aria-current="page">{item.label}</span>
          ) : item.onClick ? (
            <button type="button" className="aui-crumb-link" onClick={item.onClick}>{item.label}</button>
          ) : (
            <span className="aui-crumb-text">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
