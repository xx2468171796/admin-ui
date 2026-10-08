import { Box, Link2Off } from "lucide-react";
import { PublicResult, SharedPageShell } from "@adminui/react";

/**
 * 链接已失效：到期、作废、次数用完、IP 被封、链接不存在——统一一个图标 + 一句「请联系分享给你的人」，不说原因。
 */
export function Demo() {
  return (
    <div style={{ height: 440, overflow: "auto" }}>
      <SharedPageShell
        brand={
          <>
            <Box aria-hidden="true" />
            北辰云
          </>
        }
        variant="narrow"
        product="北辰云"
      >
        <PublicResult tone="danger" icon={<Link2Off />} title="链接已失效" description="请联系分享给你的人，让对方重新分享。" />
      </SharedPageShell>
    </div>
  );
}
