import { useState } from "react";
import { AsyncSwitch, Switch } from "@adminui/react";

/** 开关 32×18（小号 26×14），设置列表里放右边、立即生效；要等服务端保存的用 AsyncSwitch，失败自动弹回并提示。 */
export function Demo() {
  const [digest, setDigest] = useState(true);
  const [compact, setCompact] = useState(false);
  const [sync, setSync] = useState(true);
  const [webhook, setWebhook] = useState(false);
  const save = (ok: boolean) => new Promise<void>((resolve, reject) => window.setTimeout(() => (ok ? resolve() : reject(new Error("保存失败：网络中断，请稍后重试"))), 800));

  const rows = [
    { id: "sw-digest", title: "每日摘要邮件", note: "每天 9:00 发送昨天的新线索", control: <Switch id="sw-digest" checked={digest} onCheckedChange={setDigest} /> },
    { id: "sw-compact", title: "紧凑表格", note: "只影响你自己", control: <Switch id="sw-compact" size="sm" checked={compact} onCheckedChange={setCompact} /> },
    {
      id: "sw-sync",
      title: "同步到日历（保存成功）",
      note: "保存时开关锁住，成功后保持",
      control: <AsyncSwitch id="sw-sync" label="同步到日历" checked={sync} onChange={async (next) => { await save(true); setSync(next); }} />,
    },
    {
      id: "sw-webhook",
      title: "推送到外部系统（演示失败）",
      note: "保存失败时开关弹回原位，并出现错误提示",
      control: <AsyncSwitch id="sw-webhook" label="推送到外部系统" checked={webhook} onChange={async (next) => { await save(false); setWebhook(next); }} />,
    },
    { id: "sw-audit", title: "操作审计", note: "企业版才能关闭", control: <Switch id="sw-audit" checked disabled /> },
  ];

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 14, maxWidth: 520 }}>
      {rows.map((r) => (
        <li key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <label htmlFor={r.id} style={{ display: "grid", gap: 2 }}>
            <span>{r.title}</span>
            <span className="aui-text-note">{r.note}</span>
          </label>
          {r.control}
        </li>
      ))}
    </ul>
  );
}
