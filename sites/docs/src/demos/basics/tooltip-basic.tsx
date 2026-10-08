import { Download, Filter, RefreshCw, Search, Settings2 } from "lucide-react";
import { Button, IconButton, Tooltip } from "@adminui/react";

/** 深色提示气泡：图标按钮自带（label）；普通元素用 Tooltip 包一层；被截断的文字只在真的截断时出；禁用按钮说原因。 */
export function Demo() {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        <IconButton label="搜索" icon={<Search />} shortcut="Mod+K" />
        <IconButton label="筛选" icon={<Filter />} />
        <IconButton label="刷新" icon={<RefreshCw />} shortcut="Mod+R" />
        <IconButton label="导出" icon={<Download />} />
        <IconButton label="表设置" icon={<Settings2 />} />
        <Button variant="outline" size="sm" disabled disabledReason="只有管理员可以改权限">权限</Button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        <Tooltip content="按下单时间倒序" side="bottom">
          <span tabIndex={0}>最近订单（悬停或 Tab 聚焦）</span>
        </Tooltip>
        <Tooltip content="远航精密制造（华东）股份有限公司 · 苏州工业园区分公司" truncated>
          <span tabIndex={0} style={{ display: "inline-block", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            远航精密制造（华东）股份有限公司 · 苏州工业园区分公司
          </span>
        </Tooltip>
      </div>
    </div>
  );
}
