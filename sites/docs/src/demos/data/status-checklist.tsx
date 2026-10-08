import { useState } from "react";
import { Panel, StatusChecklist, useNotify, type CheckStatus } from "@adminui/react";

type Check = { id: string; name: string; state: CheckStatus; detail: string; version?: string };

const START: Check[] = [
  { id: "db", name: "数据库连接", state: "ok", detail: "延迟 12 ms", version: "PostgreSQL 17" },
  { id: "mail", name: "邮件服务", state: "error", detail: "SMTP 认证失败：密码已过期" },
  { id: "sso", name: "单点登录", state: "warning", detail: "证书 12 天后到期" },
  { id: "storage", name: "文件存储", state: "ok", detail: "已用 61%" },
  { id: "sms", name: "短信通知", state: "off", detail: "没有启用" },
];

/** 几项检查各有一个状态：顶部汇总「1 项异常 · …」，每项图标 + 文字 + 原因 + 最多一个操作。点「重新连接」看进行中。 */
export function Demo() {
  const notify = useNotify();
  const [checks, setChecks] = useState(START);
  const fix = (id: string) => {
    setChecks((list) => list.map((c) => (c.id === id ? { ...c, state: "pending", detail: "正在重新连接…" } : c)));
    window.setTimeout(() => {
      setChecks((list) => list.map((c) => (c.id === id ? { ...c, state: "ok", detail: "刚刚检查通过" } : c)));
      notify("邮件服务已恢复", "success");
    }, 1500);
  };
  return (
    <div style={{ maxWidth: 560 }}>
      <Panel title="连接自检">
        <StatusChecklist
          caption="连接自检"
          items={checks}
          getId={(c) => c.id}
          label={(c) => c.name}
          status={(c) => c.state}
          reason={(c) => c.detail}
          meta={(c) => c.version}
          action={(c) => (c.state === "error" ? { label: "重新连接", onSelect: () => fix(c.id) } : c.state === "warning" ? { label: "更新证书", onSelect: () => notify("打开证书设置", "info") } : null)}
        />
      </Panel>
    </div>
  );
}
