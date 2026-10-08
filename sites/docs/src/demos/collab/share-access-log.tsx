import { useState } from "react";
import { Panel, ShareAccessLog, useNotify } from "@adminui/react";
import { ACCESS_LOG } from "../../data/collab-data";

/**
 * 单独打开的访问记录：时间 · IP（服务端已打码）+ 城市 · 设备 · 事件标签 + 说明；
 * 编辑写「旧 → 新」，风险行浅底 +「封这个 IP」。封过的 IP 再打开只会看到「链接已失效」。
 */
export function Demo() {
  const notify = useNotify();
  const [blocked, setBlocked] = useState<string[]>([]);
  return (
    <Panel title="访问记录 · 远航精密制造" flush>
      <ShareAccessLog
        events={ACCESS_LOG}
        blockedIps={blocked}
        onExport={() => notify("已开始导出访问记录（CSV）", "info")}
        onBlockIp={async (event) => {
          await new Promise((r) => setTimeout(r, 300));
          setBlocked((list) => [...list, event.ip]);
          notify(`已封 ${event.ip}`, "success");
        }}
      />
    </Panel>
  );
}
