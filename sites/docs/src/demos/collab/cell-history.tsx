import { useRef, useState } from "react";
import { History } from "lucide-react";
import { Button, CellHistoryPopover, useNotify, type CellHistoryScope, type CellVersion } from "@adminui/react";
import { CELL_VERSIONS, RECORD_VERSIONS, demoNow } from "../../data/collab-data";

/**
 * 单元格修改历史：竖线时间轴，每个版本写「旧 → 新」+ 谁 / 何时 / 来源；「恢复」只在悬停那一行出现，
 * 点了就地确认，恢复本身记成一个新版本。在表格里由右键「修改历史」或格子角标打开，这里用按钮代替格子。
 */
export function Demo() {
  const notify = useNotify();
  const cell = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<CellHistoryScope>("cell");
  const [versions, setVersions] = useState<CellVersion[]>(CELL_VERSIONS);

  const restore = async (v: CellVersion) => {
    await new Promise((r) => setTimeout(r, 300));
    setVersions((list) => [
      { ...v, id: `v${list.length + 1}`, at: demoNow(), actor: { name: "陈一鸣" }, source: "restore", before: list[0]?.after ?? null, note: "恢复到之前的版本", current: true },
      ...list.map((x) => ({ ...x, current: false })),
    ]);
    notify(`已恢复成 ${String(v.after)}`, "success");
  };

  return (
    <>
      <Button ref={cell} variant="outline" onClick={() => setOpen(true)} aria-label="远航精密制造的预计金额 ¥480,000，查看修改历史">
        远航精密制造 · 预计金额：{String(versions[0]?.after ?? "")}
        <History aria-hidden="true" />
      </Button>
      <CellHistoryPopover
        open={open}
        onClose={() => setOpen(false)}
        anchor={cell.current}
        subject="远航精密制造 · 预计金额"
        versions={scope === "cell" ? versions : RECORD_VERSIONS}
        scope={scope}
        onScopeChange={setScope}
        onRestore={restore}
        retentionNote="保留 180 天，超过 3 天的版本也能在这里逐条恢复"
        onOpenLog={() => notify("打开操作记录", "info")}
        now={demoNow}
      />
    </>
  );
}
