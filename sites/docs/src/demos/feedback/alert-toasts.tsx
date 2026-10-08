import { Button, useNotify, useUndoToast } from "@adminui/react";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 操作结果提示（右下角）：成功 4 秒、带操作 8 秒（按钮倒数）、失败不自动消失；
 * 鼠标放上去暂停；最多叠 3 条；进行中完成后原地变成结果。
 */
export function Demo() {
  const notify = useNotify();
  const undoable = useUndoToast();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <Button variant="outline" onClick={() => notify.show({ title: "已保存", description: "远航精密制造 · 客户资料" })}>成功</Button>
      <Button
        variant="outline"
        onClick={() => notify.show({ title: "已生成报价单", description: "Q-2026-0412", action: { label: "打开", onClick: () => notify("打开报价单", "info") } })}
      >
        带操作
      </Button>
      <Button variant="outline" onClick={() => void undoable({ title: "已移到「商务谈判」", description: "青禾教育", undo: () => undefined })}>能撤销</Button>
      <Button
        variant="outline"
        onClick={() => notify.show({ title: "导入了 125 行，3 行没导入", description: "第 12、48、90 行电话格式不对", tone: "warning", action: { label: "看明细", onClick: () => undefined } })}
      >
        部分成功
      </Button>
      <Button
        variant="outline"
        onClick={() => notify.show({ title: "复制失败", description: "浏览器不允许写剪贴板，请用 Ctrl + C", tone: "error", action: { label: "再试一次", onClick: () => undefined } })}
      >
        失败
      </Button>
      <Button
        variant="outline"
        onClick={async () => {
          const job = notify.progress({ title: "正在导出…", description: "24 位客户" });
          await wait(2000);
          job.update({ title: "导出好了", description: "客户 2026-10-08.xlsx", action: { label: "下载", onClick: () => undefined } });
        }}
      >
        进行中 → 完成
      </Button>
    </div>
  );
}
