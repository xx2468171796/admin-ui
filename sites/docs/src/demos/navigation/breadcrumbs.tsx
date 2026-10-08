// 页面里的层级（记录页、文档页）用 Breadcrumbs：灰色可点、当前页深色加粗、小箭头分隔；
// 超过 maxItems 中间收成「…」菜单；窄到 390 只剩「← 上一级」。
import { useState } from "react";
import { Breadcrumbs, Button, type BreadcrumbItem } from "@adminui/react";

const PATH = ["知识库", "产品手册", "数据看板", "权限与分享", "按部门分享看板"];

export function Demo() {
  const [depth, setDepth] = useState(PATH.length);
  const deep: BreadcrumbItem[] = PATH.slice(0, depth).map((label, i) => ({
    label,
    onClick: i < depth - 1 ? () => setDepth(i + 1) : undefined,
  }));
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <Breadcrumbs items={[{ label: "客户", onClick: () => undefined }, { label: "华东销售组", onClick: () => undefined }, { label: "远航精密制造" }]} />
      <Breadcrumbs items={deep} />
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <p className="aui-note">点第二条里的任意一级，会回到那一级。</p>
        {depth < PATH.length && <Button size="sm" variant="outline" onClick={() => setDepth(PATH.length)}>恢复</Button>}
      </div>
    </div>
  );
}
