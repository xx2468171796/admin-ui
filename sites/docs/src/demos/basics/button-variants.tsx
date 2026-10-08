import { Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@adminui/react";

/** 7 种样式：一个区域只放一个主按钮；危险实心只在确认框里用。 */
export function Demo() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      <Button><Plus aria-hidden="true" />新建客户</Button>
      <Button variant="secondary">保存为草稿</Button>
      <Button variant="outline"><Download aria-hidden="true" />导出</Button>
      <Button variant="ghost">字段配置</Button>
      <Button variant="text">查看详情</Button>
      <Button variant="destructive-outline"><Trash2 aria-hidden="true" />删除</Button>
      <Button variant="destructive">确认删除</Button>
    </div>
  );
}
