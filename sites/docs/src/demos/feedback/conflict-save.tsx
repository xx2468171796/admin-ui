import { useState } from "react";
import { Button, SaveConflictDialog, type ConflictPick } from "@adminui/react";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 详情里多项一起保存撞车：每项两张选择卡，默认选对方较新的那份；没人碰过的项已自动合好。 */
export function Demo() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Record<string, ConflictPick> | null>(null);
  return (
    <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
      <Button variant="outline" onClick={() => setOpen(true)}>保存客户资料</Button>
      {result && (
        <span className="aui-note">
          已保存：阶段用{result.stage === "mine" ? "我的" : "他的"}，年费用{result.amount === "mine" ? "我的" : "他的"}
        </span>
      )}
      <SaveConflictDialog
        open={open}
        merged={2}
        rows={[
          { key: "stage", field: "阶段", theirs: "商务谈判", mine: "方案报价", by: "陈一鸣", at: "14:31" },
          { key: "amount", field: "年费", theirs: "¥128,000", mine: "¥136,000", by: "陈一鸣", at: "14:31" },
        ]}
        onSave={async (picks) => {
          await wait(500);
          setResult({ stage: picks.stage ?? "theirs", amount: picks.amount ?? "theirs" });
        }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
