import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, FormDialog, FormField, Input, Textarea, useUndoToast } from "@adminui/react";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 表单弹框：填了内容再点 × / Esc / 取消，会在弹框上叠一个小确认；保存时转圈并锁住；
 * 客户名称填「失败」试试保存失败——顶部出一条提示，输入都保留。
 */
export function Demo() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const undoable = useUndoToast();
  const start = () => {
    setName("");
    setNote("");
    setOpen(true);
  };
  return (
    <>
      <Button onClick={start}>新建客户</Button>
      <FormDialog
        open={open}
        title="新建客户"
        description="客户名称必填，其余可以以后补。"
        dirty={Boolean(name || note)}
        submitLabel="保存"
        onClose={() => setOpen(false)}
        onSubmit={async () => {
          await wait(800);
          if (name.trim() === "失败") throw new Error("服务暂时不可用，输入都还在，稍后再保存一次。");
        }}
        dangerAction={
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false);
              void undoable({ title: "已删除草稿", description: name || "未命名客户", undo: () => setOpen(true) });
            }}
          >
            <Trash2 aria-hidden="true" />
            删除草稿
          </Button>
        }
      >
        <FormField label="客户名称" htmlFor="dlg-form-name" required hint="填「失败」试试保存失败">
          <Input id="dlg-form-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：青禾教育" />
        </FormField>
        <FormField label="备注" htmlFor="dlg-form-note" optional>
          <Textarea id="dlg-form-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
      </FormDialog>
    </>
  );
}
