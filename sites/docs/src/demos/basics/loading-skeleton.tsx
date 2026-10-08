import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button, ContentSkeleton, PersonChip, Refreshing, Spinner } from "@adminui/react";
import { PEOPLE } from "../../data/demo-data";

type Phase = "first" | "ready" | "refreshing";

/** 第一次加载：原位置出骨架、数量显示「—」；再次刷新：旧数据留着变淡 + 顶上 2px 细进度条。 */
export function Demo() {
  const [phase, setPhase] = useState<Phase>("first");
  useEffect(() => {
    if (phase === "ready") return;
    const timer = window.setTimeout(() => setPhase("ready"), 1600);
    return () => window.clearTimeout(timer);
  }, [phase]);
  const people = PEOPLE.slice(0, 4);
  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <b>团队成员</b>
        <span className="aui-text-note">{phase === "first" ? "—" : `共 ${people.length} 人`}</span>
        <span style={{ flex: 1 }} />
        <Button size="sm" variant="ghost" onClick={() => setPhase("first")}>模拟首次加载</Button>
        <Button size="sm" variant="outline" disabled={phase !== "ready"} onClick={() => setPhase("refreshing")}>
          {phase === "refreshing" ? <Spinner /> : <RefreshCw aria-hidden="true" />}刷新
        </Button>
      </div>
      {phase === "first" ? (
        <ContentSkeleton rows={4} label="正在加载成员…" />
      ) : (
        <Refreshing refreshing={phase === "refreshing"}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
            {people.map((p) => (
              <li key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <PersonChip name={p.name} id={p.id} plain />
                <span className="aui-text-note">{p.title}</span>
              </li>
            ))}
          </ul>
        </Refreshing>
      )}
    </div>
  );
}
