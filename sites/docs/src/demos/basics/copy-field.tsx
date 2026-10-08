import { CopyButton, CopyField } from "@adminui/react";

/** 字段行里的复制：24px 幽灵图标，悬停 / 聚焦整行才出现（手机上一直显示）；整段要拿走的值用 CopyField。 */
export function Demo() {
  const fields = [
    { label: "客户编号", value: "C1001" },
    { label: "联系邮箱", value: "purchase@example.com" },
  ];
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 520 }}>
      <dl style={{ display: "grid", gap: 4, margin: 0 }}>
        {fields.map((f) => (
          <div key={f.label} className="aui-copy-host" style={{ display: "grid", gridTemplateColumns: "88px minmax(0, 1fr) auto", gap: 8, alignItems: "center", minHeight: 32 }}>
            <dt className="aui-text-note">{f.label}</dt>
            <dd style={{ margin: 0 }}>{f.value}</dd>
            <CopyButton text={f.value} label={f.label} reveal />
          </div>
        ))}
      </dl>
      <CopyField label="公开登记链接" value="https://example.com/f/register-7Kx2" note="发给客户，打开即可填写" />
      <CopyField label="API 令牌" value="demo-token-0123456789abcdef" secret note="点「显示」后 30 秒自动隐藏" />
    </div>
  );
}
