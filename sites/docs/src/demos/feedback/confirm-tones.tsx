import { useState } from "react";
import { LayoutDashboard, Link2, Users } from "lucide-react";
import { Button, ConfirmDialog } from "@adminui/react";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
type Which = "" | "transfer" | "disable" | "delete" | "fail";

/** 三种口气 + 失败：标题直接问对象，按钮写动作；默认焦点在「取消」，回车不会误删。 */
export function Demo() {
  const [open, setOpen] = useState<Which>("");
  const close = () => setOpen("");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <Button variant="outline" onClick={() => setOpen("transfer")}>转交客户（普通）</Button>
      <Button variant="outline" onClick={() => setOpen("disable")}>停用账号（写原因）</Button>
      <Button variant="destructive-outline" onClick={() => setOpen("delete")}>删除业务线（输入名称）</Button>
      <Button variant="outline" onClick={() => setOpen("fail")}>失败的确认</Button>

      <ConfirmDialog
        open={open === "transfer"}
        title="把 23 位客户转交给王佳宁？"
        description="她会收到通知，原负责人仍能看到历史记录。"
        confirmLabel="转交 23 位"
        onConfirm={() => wait(500)}
        onClose={close}
      />
      <ConfirmDialog
        open={open === "disable"}
        tone="warning"
        title="停用「赵思远」的账号？"
        description="他会立刻被登出，名下 18 位客户需要转交。"
        reason={{ label: "原因", required: true, placeholder: "例如：离职交接" }}
        confirmLabel="停用账号"
        onConfirm={() => wait(500)}
        onClose={close}
      />
      <ConfirmDialog
        open={open === "delete"}
        destructive
        title="删除业务线「华东大客户」？"
        description="删除后不能恢复。"
        impact={[
          <><Users aria-hidden="true" /> <b>168 位客户</b>和他们的跟进记录</>,
          <><LayoutDashboard aria-hidden="true" /> 两个仪表盘</>,
          <><Link2 aria-hidden="true" /> 所有分享链接立即失效</>,
        ]}
        typeToConfirm="华东大客户"
        confirmLabel="删除业务线"
        onConfirm={() => wait(600)}
        onClose={close}
      />
      <ConfirmDialog
        open={open === "fail"}
        destructive
        title="作废报价单 Q-2026-0412？"
        description="作废后客户打开链接会看到「已作废」。"
        confirmLabel="作废"
        onConfirm={async () => {
          await wait(500);
          throw new Error("这张报价单已经签约，请先作废合同。");
        }}
        onClose={close}
      />
    </div>
  );
}
