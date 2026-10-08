import { useState } from "react";
import { Button, PublicPageLayout, PublicResult, SegmentedControl } from "@adminui/react";

type Kind = "expired" | "revoked" | "done";

/** 不是表单的公开页（链接已失效、已撤回、已处理）：PublicPageLayout（窄栏 440）+ PublicResult。 */
export function Demo() {
  const [kind, setKind] = useState<Kind>("expired");
  return (
    <div style={{ height: 640, overflow: "auto" }}>
      {/* 只是演示用的切换，真实页面没有这一行 */}
      <div style={{ display: "flex", justifyContent: "center", padding: 12 }}>
        <SegmentedControl size="sm" label="演示哪种结果" value={kind} onValueChange={(v) => setKind(v as Kind)} options={[{ value: "expired", label: "已失效" }, { value: "revoked", label: "已撤回" }, { value: "done", label: "已处理" }]} />
      </div>
      <PublicPageLayout brand="北辰云" logo="北" brandNote="客户管理与服务平台" width="narrow" footer="由 北辰云 提供">
        {kind === "expired" && (
          <PublicResult
            tone="warning"
            title="这个链接已过期"
            description="满意度回访链接的有效期是 7 天。如果还想反馈，请回复邮件或联系您的客户成功经理。"
            meta="北辰云 · 客户成功部"
            actions={<Button variant="outline" size="lg">打开帮助中心</Button>}
            note="可以关闭这个页面了"
          />
        )}
        {kind === "revoked" && (
          <PublicResult tone="danger" title="分享已被撤回" description="分享人已经关闭了这个记录的公开访问。需要查看请联系分享人重新开启。" note="链接 ID：SH-7F3A" />
        )}
        {kind === "done" && (
          <PublicResult tone="success" title="工单 T-2043 已确认解决" description="感谢您的确认。如果问题再次出现，直接回复原邮件即可重新打开工单。" meta="2026-10-08 10:42 确认" note="可以关闭这个页面了" />
        )}
      </PublicPageLayout>
    </div>
  );
}
