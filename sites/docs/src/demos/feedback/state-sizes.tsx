import { Button, StatePanel } from "@adminui/react";

/** 三种尺寸：紧凑（弹层 / 卡片里）· 标准（面板）· 整页（404 保留外壳，只占内容区）。 */
export function Demo() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div className="aui-panel">
          <StatePanel kind="forbidden" size="compact" title="看不到这一栏" message="只有财务能看底价。" />
        </div>
        <div className="aui-panel">
          <StatePanel kind="timeout" size="compact" onRetry={() => undefined} />
        </div>
      </div>
      <div className="aui-panel">
        <StatePanel kind="not-found" size="page" action={<Button size="sm" variant="outline">回到首页</Button>} />
      </div>
    </div>
  );
}
