import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { Button, SegmentedControl, StatePanel, type StateKind } from "@adminui/react";

const KINDS: { value: StateKind; label: string }[] = [
  { value: "empty", label: "还没有" },
  { value: "no-results", label: "搜不到" },
  { value: "error", label: "加载失败" },
  { value: "forbidden", label: "没权限" },
  { value: "offline", label: "断网" },
  { value: "not-found", label: "不在了" },
  { value: "loading", label: "加载中" },
];

/** 每种状态各有图标和口气：一句标题 + 一句原因 + 最多两个按钮。出错给重试和可复制的错误详情。 */
function Example({ kind, onClear }: { kind: StateKind; onClear: () => void }) {
  switch (kind) {
    case "empty":
      return <StatePanel kind="empty" tone="brand" icon={<Users />} title="还没有客户" message="从 Excel 导入，或者先新建一位。" action={<Button size="sm"><Plus aria-hidden="true" />新建客户</Button>} secondaryAction={<Button size="sm" variant="outline">从 Excel 导入</Button>} />;
    case "no-results":
      return <StatePanel kind="no-results" query="陈小姐" onClearSearch={onClear} />;
    case "error":
      return <StatePanel kind="error" title="操作记录加载失败" onRetry={() => undefined} details={"GET /api/logs → 502\n请求编号 req_7f3a9c21\n2026-10-08 14:31:08"} />;
    case "forbidden":
      return <StatePanel kind="forbidden" title="没有权限查看「华东大客户」" message="找管理员林晓申请，批了就能看。" action={<Button size="sm">申请查看</Button>} />;
    case "offline":
      return <StatePanel kind="offline" onRetry={() => undefined} />;
    case "not-found":
      return <StatePanel kind="not-found" title="这条记录不在了" message="可能被删了，去回收站找找。" action={<Button size="sm" variant="outline">去回收站</Button>} />;
    default:
      return <StatePanel kind="loading" />;
  }
}

export function Demo() {
  const [kind, setKind] = useState<StateKind>("empty");
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <SegmentedControl label="状态" value={kind} onValueChange={setKind} options={KINDS} />
      <div className="aui-panel">
        <Example kind={kind} onClear={() => setKind("empty")} />
      </div>
    </div>
  );
}
