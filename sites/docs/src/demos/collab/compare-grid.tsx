import { useState } from "react";
import { CitationChips, CompareGrid, Panel, useNotify } from "@adminui/react";
import { COMPARE_SAMPLES } from "../../data/collab-data";

/**
 * 发布新提示词前，用历史样本试跑对比：两版输出并排，一次看一段样本；有问题的格子标出来（编造的优惠、漏掉的顾虑），
 * 每段选一个更好的版本。下面是单独使用的出处小标 CitationChips。
 */
export function Demo() {
  const notify = useNotify();
  const [winners, setWinners] = useState<Record<string, string>>({ s1: "v3" });
  return (
    <div className="aui-stack">
      <Panel title="用历史录音试跑" flush>
        <CompareGrid
          variants={[
            { key: "v2", badge: "v2", label: "09-20 版", meta: "7 秒" },
            { key: "v3", badge: "v3", label: "当前发布", meta: "9 秒", tone: "brand" },
          ]}
          samples={COMPARE_SAMPLES}
          winners={winners}
          onPickWinner={(s, v) => setWinners((w) => ({ ...w, [s]: v }))}
          onRun={async () => {
            await new Promise((r) => setTimeout(r, 600));
            notify("已重新试跑", "success");
          }}
        />
      </Panel>
      <CitationChips
        numbered
        sources={[
          { id: "m1", label: "管理员手册 · 数据导出 p.12" },
          { id: "c1", label: "成功案例 · 季度归档" },
        ]}
        onOpen={(s) => notify(`打开「${s.label}」`, "info")}
      />
    </div>
  );
}
