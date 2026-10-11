"use client";
/** ViewLockNotice (D16): why a standard / shared view's conditions can't be changed, with 「复制为我的视图」. */
import { Copy, X } from "lucide-react";
import { Button } from "../primitives.tsx";
import { InlineAlert } from "../layout.tsx";
import { IconButton } from "../buttons.tsx";
import type { ViewSummary } from "./view-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

export type ViewLockNoticeProps = {
  view: Pick<ViewSummary, "name" | "tier">;
  /** 「复制为我的视图」 */
  onDuplicate?: () => void;
  onDismiss?: () => void;
};
/**
 * Shown when someone tries to change the filter / group / sort of a view they don't maintain (D16):
 * explains why, and offers 「复制为我的视图」. Temporary search stays allowed.
 */
export function ViewLockNotice({ view, onDuplicate, onDismiss }: ViewLockNoticeProps) {
  const what = view.tier === "standard" ? "业务线标准视图" : "共享视图";
  return (
    <div className="aui-vlock">
      <InlineAlert
        tone="warning"
        title={`这是${what}，不能修改筛选、分组、排序。`}
        action={
          <span className="aui-vlock-actions">
            {onDuplicate && (
              <Button size="sm" onClick={onDuplicate}>
                <Copy size={14} aria-hidden="true" />
                复制为我的视图
              </Button>
            )}
            {onDismiss && (
              <IconButton label="关闭提示" onClick={onDismiss} icon={<X size={15} aria-hidden="true" />} />
            )}
          </span>
        }
      >
        可以临时搜索；想换条件，复制一份到「我的视图」再改。
      </InlineAlert>
    </div>
  );
}
