// 区块标题三级：卡片标题（48px：标题 + 灰数量 + ? + 右侧操作）· 卡片里的分组（PaneSection）· 贴边色带（flush 分组）。
// 「?」是 HelpTip：悬停 / 聚焦打开，点一下钉住，Esc 关。
import { Plus } from "lucide-react";
import { Button, HelpTip, IconButton, PaneSection, Panel } from "@adminui/react";
import { PEOPLE } from "../../data/demo-data";

export function Demo() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel
        title="成员"
        count={`${PEOPLE.length} 人`}
        description="能登录这家公司的人。停用后保留数据，不再能登录。"
        actions={<Button size="sm" variant="outline">邀请成员</Button>}
        flush
      >
        <PaneSection title="销售部" count={4} actions={<IconButton size="sm" label="在销售部加人" icon={<Plus />} />}>
          <p className="aui-note" style={{ padding: "0 16px 12px" }}>林晓、陈一鸣、王佳宁、赵思远</p>
        </PaneSection>
        <PaneSection title="研发部" count={2} flush>
          <p className="aui-note" style={{ padding: "8px 16px 12px" }}>吴昊、郑明轩</p>
        </PaneSection>
      </Panel>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <strong>客户健康分</strong>
        <HelpTip title="健康分怎么算" more={{ href: "https://example.com/docs/health", external: true }}>
          按最近 30 天的登录、使用席位和工单数算出来，0–100 分。
        </HelpTip>
      </div>
    </div>
  );
}
