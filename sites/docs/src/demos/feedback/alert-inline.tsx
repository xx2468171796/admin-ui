import { useState } from "react";
import { Button, InlineAlert } from "@adminui/react";

/** 行内提示：页面 / 卡片的状态。四种口气 × 三种密度（标准 / 紧凑 / 淡），banner 贴边横幅。 */
export function Demo() {
  const [banner, setBanner] = useState(true);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {banner && <InlineAlert tone="info" banner title="系统将于今晚 23:00 维护 30 分钟" onClose={() => setBanner(false)} />}
      <InlineAlert title="这张表开启了字段权限">销售看不到「底价」，表管理员可以在表设置里调整。</InlineAlert>
      <InlineAlert tone="success" title="同步完成" action={<Button size="sm" variant="outline">查看</Button>}>
        128 条邮件已归档到客户记录。
      </InlineAlert>
      <InlineAlert tone="warning" density="compact" title="还有 3 位客户没分配负责人" action={<Button size="sm" variant="text">去分配</Button>} />
      <InlineAlert tone="error" density="subtle" title="手机号格式不对">请填 11 位数字，例如 13800000000。</InlineAlert>
    </div>
  );
}
