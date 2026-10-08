import { useState } from "react";
import { Button, EditConflictNotice, StaleRecordNotice, useNotify } from "@adminui/react";

/**
 * 就地改一格撞车：保留对方较新的值，自己填的不丢——「重新填入我的」放回编辑器，「用我的覆盖」故意覆盖。
 * 打开记录期间被别人改过：顶部一条「刷新」提醒。
 */
export function Demo() {
  const notify = useNotify();
  const [cell, setCell] = useState(true);
  const [stale, setStale] = useState(true);
  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
      {stale ? (
        <StaleRecordNotice by="陈一鸣" at="14:31" onRefresh={() => { setStale(false); notify("已刷新到最新"); }} onDismiss={() => setStale(false)} />
      ) : (
        <Button variant="outline" onClick={() => setStale(true)}>再来一次「别人刚改过」</Button>
      )}
      {cell ? (
        <EditConflictNotice
          by="陈一鸣"
          at="14:31"
          what="「联系电话」"
          theirs="138 0013 8000"
          mine="139 0013 9000"
          onRefill={() => { setCell(false); notify("已把你的值填回编辑器", "info"); }}
          onOverwrite={() => { setCell(false); notify("已用你的值覆盖"); }}
          onDismiss={() => setCell(false)}
        />
      ) : (
        <Button variant="outline" onClick={() => setCell(true)}>再撞一次车</Button>
      )}
    </div>
  );
}
