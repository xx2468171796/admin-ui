import { useState } from "react";
import { Button, Dialog, DialogFooter, type DialogSize } from "@adminui/react";

const SIZES: readonly { size: DialogSize; label: string; title: string }[] = [
  { size: "sm", label: "sm 420", title: "重命名视图" },
  { size: "md", label: "md 560", title: "新建字段" },
  { size: "lg", label: "lg 800", title: "导入预览" },
  { size: "xl", label: "xl 1080", title: "对比两个版本" },
  { size: "full", label: "全屏", title: "报价单预览" },
];

/** 五档宽度：按内容选，不要把大内容硬塞进 lg。手机上 sm / md 从底部升起，lg 以上整屏。 */
export function Demo() {
  const [current, setCurrent] = useState<(typeof SIZES)[number] | null>(null);
  const close = () => setCurrent(null);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {SIZES.map((item) => (
        <Button key={item.size} variant="outline" onClick={() => setCurrent(item)}>
          {item.label}
        </Button>
      ))}
      <Dialog
        open={current !== null}
        size={current?.size ?? "md"}
        title={current?.title ?? ""}
        description={current ? `size="${current.size}"` : undefined}
        onClose={close}
        footer={
          <DialogFooter>
            <Button variant="outline" onClick={close}>取消</Button>
            <Button onClick={close}>确定</Button>
          </DialogFooter>
        }
      >
        <p>弹框圆角 12，遮罩不模糊背景，底栏白底。正文超出时自己滚动，头部和底栏不动。</p>
      </Dialog>
    </div>
  );
}
