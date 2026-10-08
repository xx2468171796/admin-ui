// 时间线 / 动态 / 评论底部用 LoadMore：一整行「加载更多 · 已显示 4 / 共 10 条」→ 加载中转圈 →
// 失败（异常色说明 + 重试）→ 到底（「已经到底了 · 共 10 条」）。第二次加载故意失败，点重试继续。
import { useState } from "react";
import { LoadMore } from "@adminui/react";
import { CUSTOMERS } from "../../data/demo-data";

const TOTAL = 10;

export function Demo() {
  const [shown, setShown] = useState(4);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [tries, setTries] = useState(0);
  const load = () => {
    setState("loading");
    window.setTimeout(() => {
      setTries((t) => t + 1);
      if (tries === 1) return setState("error");
      setShown((s) => Math.min(TOTAL, s + 3));
      setState("idle");
    }, 500);
  };
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
        {CUSTOMERS.slice(0, shown).map((c) => (
          <li key={c.id} className="aui-note">{c.createdAt} · 新增客户「{c.name}」</li>
        ))}
      </ul>
      <LoadMore
        shown={shown}
        total={TOTAL}
        loading={state === "loading"}
        error={state === "error" ? "没加载出来，网络断了一下" : undefined}
        onLoadMore={load}
      />
    </div>
  );
}
