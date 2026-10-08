import { useState } from "react";
import { Button } from "@adminui/react";
import { ViewLockNotice, ViewTabs, type ViewSummary } from "@adminui/react/views";

const VIEWS: ViewSummary[] = [
  { id: "all", name: "全部商机", kind: "grid", tier: "standard", mustSee: true },
  { id: "board", name: "阶段看板", kind: "kanban", tier: "standard" },
  { id: "east", name: "华东组商机", kind: "grid", tier: "shared" },
  { id: "mine", name: "我负责的", kind: "grid", tier: "mine" },
];

/**
 * 普通成员改了标准视图的筛选：标签上一个注意色小点（modified），只对自己生效。
 * 想长期保留就「复制为我的视图」—— ViewLockNotice 说明原因并给出这个入口。
 */
export function Demo() {
  const [active, setActive] = useState("all");
  const [modified, setModified] = useState(true);
  const [notice, setNotice] = useState(true);
  const views = VIEWS.map((v) => (v.id === "all" ? { ...v, modified } : v));
  const current = views.find((v) => v.id === active) ?? VIEWS[0];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <ViewTabs views={views} activeId={active} onSelect={setActive} />
      {current && current.tier !== "mine" && notice && (
        <ViewLockNotice view={current} onDuplicate={() => setNotice(false)} onDismiss={() => setNotice(false)} />
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button variant="outline" size="sm" onClick={() => setModified((m) => !m)}>{modified ? "恢复共享设置" : "改一下筛选"}</Button>
        <Button variant="ghost" size="sm" onClick={() => setNotice(true)}>再显示提示</Button>
      </div>
    </div>
  );
}
