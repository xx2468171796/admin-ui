// 空 / 搜不到 / 出错 / 没权限 / 断网 / 404 分开（图标块 + 标题 + 原因 + 最多两个按钮，能重试的给重试）；
// 编辑冲突（就地撞车的小卡、保存时逐项选、别人刚改过的提醒）。
import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { Button, EditConflictNotice, Panel, SaveConflictDialog, SegmentedControl, StaleRecordNotice, StatePanel, type StateKind } from "@adminui/react";

const KINDS: { value: StateKind; label: string }[] = [
  { value: "empty", label: "还没有" },
  { value: "no-results", label: "搜不到" },
  { value: "error", label: "加载失败" },
  { value: "forbidden", label: "没权限" },
  { value: "offline", label: "断网" },
  { value: "not-found", label: "404" },
  { value: "loading", label: "加载中" },
];

function Example({ kind }: { kind: StateKind }) {
  switch (kind) {
    case "empty":
      return <StatePanel kind="empty" tone="brand" icon={<Users />} title="还没有客户" message="从 Excel 导入，或者先新建一位。" action={<Button size="sm"><Plus />新建客户</Button>} secondaryAction={<Button size="sm" variant="outline">从 Excel 导入</Button>} />;
    case "no-results":
      return <StatePanel kind="no-results" query="陈小姐" onClearSearch={() => undefined} />;
    case "error":
      return <StatePanel kind="error" title="操作记录加载失败" message="可能是网络或服务出了问题，再试一次看看。" onRetry={() => undefined} details={"GET /api/bitable/logs → 502\n请求编号 req_7f3a9c21\n2026-10-07 14:31:08"} />;
    case "forbidden":
      return <StatePanel kind="forbidden" title="没有权限查看「智能家居客户」" message="找管理员小陈申请，批了就能看。" action={<Button size="sm">申请查看</Button>} />;
    case "offline":
      return <StatePanel kind="offline" onRetry={() => undefined} />;
    case "not-found":
      return <StatePanel kind="not-found" size="page" action={<Button size="sm" variant="outline">回到首页</Button>} />;
    default:
      return <StatePanel kind="loading" />;
  }
}

export function StatesDemo() {
  const [kind, setKind] = useState<StateKind>("empty");
  return (
    <Panel title="空 / 出错 / 没权限 / 404" description="四种状态分开；口气配色：中性（空 / 搜不到）· 主色（首次上手）· 琥珀（没权限 / 断网）· 陶土红（出错）。">
      <div id="ov-states">
        <SegmentedControl label="状态" value={kind} onValueChange={setKind} options={KINDS} />
        <div data-state-kind={kind} style={{ marginTop: 12, border: "1px solid var(--aui-line)", borderRadius: 12 }}>
          <Example kind={kind} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12 }}>
          <div style={{ border: "1px solid var(--aui-line)", borderRadius: 12 }}>
            <StatePanel kind="forbidden" size="compact" title="看不到这一栏" message="只有财务能看底价。" />
          </div>
          <div style={{ border: "1px solid var(--aui-line)", borderRadius: 12 }}>
            <StatePanel kind="not-found" size="compact" title="这条记录不在了" message="可能被删了，去回收站找找。" action={<Button size="sm" variant="outline">去回收站</Button>} />
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function ConflictDemo() {
  const [cell, setCell] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [stale, setStale] = useState(true);
  const [result, setResult] = useState("");
  return (
    <Panel title="编辑冲突" description="默认保留别人较新的那份；我的输入留着，可以「重新填入我的」或「用我的覆盖」。">
      <div id="ov-conflict" style={{ display: "grid", gap: 12 }}>
        {stale && <StaleRecordNotice by="王小明" at="14:31" onRefresh={() => setStale(false)} onDismiss={() => setStale(false)} />}
        {cell ? (
          <EditConflictNotice by="王小明" at="14:31" what="「电话」" theirs="138 0013 8000" mine="139 3311 8552" onRefill={() => setCell(false)} onOverwrite={() => setCell(false)} onDismiss={() => setCell(false)} />
        ) : (
          <Button variant="outline" onClick={() => setCell(true)}>再撞一次车</Button>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button variant="outline" onClick={() => setDialog(true)}>保存时冲突</Button>
          {result && <span className="aui-note" data-conflict-result>{result}</span>}
        </div>
      </div>
      <SaveConflictDialog
        open={dialog}
        merged={2}
        rows={[
          { key: "stage", field: "阶段", theirs: "谈判", mine: "报价", by: "王小明", at: "14:31" },
          { key: "amount", field: "预计金额", theirs: "¥86,400", mine: "¥92,000", by: "王小明", at: "14:31" },
        ]}
        onSave={(picks) => setResult(Object.entries(picks).map(([k, v]) => `${k}=${v}`).join("，"))}
        onClose={() => setDialog(false)}
      />
    </Panel>
  );
}
