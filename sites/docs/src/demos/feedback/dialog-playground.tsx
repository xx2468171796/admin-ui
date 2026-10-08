import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, Dialog, DialogFooter, type DialogSize } from "@adminui/react";

type Props = { size?: string; title?: string; description?: string; longBody?: boolean; withDanger?: boolean; hint?: string };

/** 在线调试：改右侧属性后点按钮打开弹框。正文变长时才在头部下面出现分隔线。 */
export function Demo({ size = "md", title = "导入预览", description = "确认没问题再导入；可以先下载核对。", longBody = false, withDanger = false, hint = "共 128 行，3 行有问题" }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const paragraphs = longBody ? 16 : 2;
  return (
    <>
      <Button onClick={() => setOpen(true)}>打开弹框</Button>
      <Dialog
        open={open}
        size={size as DialogSize}
        title={title || "未命名"}
        description={description || undefined}
        onClose={close}
        footer={
          <DialogFooter
            hint={hint || undefined}
            danger={
              withDanger ? (
                <Button variant="ghost" onClick={close}>
                  <Trash2 aria-hidden="true" />
                  删除这批数据
                </Button>
              ) : undefined
            }
          >
            <Button variant="outline" onClick={close}>取消</Button>
            <Button variant="outline">下载核对表</Button>
            <Button onClick={close}>导入 125 行</Button>
          </DialogFooter>
        }
      >
        {Array.from({ length: paragraphs }, (_, i) => (
          <p key={i}>第 {i + 1} 行：远航精密制造 · 上海 · 客户经理陈一鸣 · 年费 ¥128,000。核对后再导入。</p>
        ))}
      </Dialog>
    </>
  );
}
