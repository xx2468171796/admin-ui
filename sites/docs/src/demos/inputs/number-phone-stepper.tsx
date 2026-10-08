import { useState, type ReactNode } from "react";
import { FormField, NumberStepper, PhoneInput } from "@adminui/react";

function Row({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "10px 0" }}>
      <div style={{ flex: "1 1 160px", minWidth: 0 }}>
        <b style={{ display: "block", fontWeight: 500 }}>{title}</b>
        <small className="aui-text-note">{note}</small>
      </div>
      {children}
    </div>
  );
}

/** 电话：区号一格 + 号码按当地习惯分组，值存 E.164，离开才校验。步进器：只给 1–30 的小整数。 */
export function Demo() {
  const [mobile, setMobile] = useState<string | null>("+8613800138000");
  const [error, setError] = useState<string | null>(null);
  const [bad, setBad] = useState<string | null>("+86138001");
  const [days, setDays] = useState<number | null>(3);
  const [opens, setOpens] = useState<number | null>(1);
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", alignItems: "start" }}>
        <FormField label="手机" htmlFor="ph-a" required hint="区号默认是本公司所在地" error={error ?? undefined}>
          <PhoneInput id="ph-a" value={mobile} onChange={setMobile} defaultCountry="+86" mobile showError={false} onValidate={setError} />
        </FormField>
        <FormField label="出错（离开输入框才判断）" htmlFor="ph-b">
          <PhoneInput id="ph-b" value={bad} onChange={setBad} defaultCountry="+86" mobile />
        </FormField>
      </div>
      <p className="aui-text-note" style={{ margin: 0 }}>存成 <code>{mobile ?? "—"}</code>，用来查重。</p>
      <div>
        <Row title="提前提醒" note="下次跟进前几天提醒负责人">
          <NumberStepper label="提前提醒天数" value={days} onChange={setDays} min={1} max={7} unit="天" size="default" />
        </Row>
        <Row title="最多打开次数" note="到下限时 − 自动变灰">
          <NumberStepper label="最多打开次数" value={opens} onChange={setOpens} min={1} max={10} unit="次" size="default" />
        </Row>
        <Row title="禁用" note="没有权限改">
          <NumberStepper label="禁用的步进器" value={5} onChange={() => undefined} unit="次" size="default" disabled />
        </Row>
      </div>
    </div>
  );
}
