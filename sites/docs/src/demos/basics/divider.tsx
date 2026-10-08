import { Filter, Layers, Search } from "lucide-react";
import { Divider, IconButton } from "@adminui/react";

/** 分隔线只有 1px 实线一种：分区、带字（时间线）、工具栏竖线；能用留白就不画线。 */
export function Demo() {
  return (
    <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <IconButton label="搜索" icon={<Search />} />
        <IconButton label="筛选" icon={<Filter />} />
        <Divider orientation="vertical" />
        <IconButton label="分组" icon={<Layers />} />
      </div>
      <Divider />
      <p style={{ margin: 0 }}>林晓 把阶段改成了「方案报价」</p>
      <Divider label="昨天" />
      <p style={{ margin: 0 }}>陈一鸣 添加了跟进记录</p>
      <Divider label="更早" align="start" />
      <p style={{ margin: 0 }}>周可欣 新建了这条客户</p>
    </div>
  );
}
