import { useState } from "react";
import { AsyncSwitch, Choice, FormField, FormSection, Input, SaveBar, useChangeTracker } from "@adminui/react";

const SAVED = { company: "北辰云", city: "shanghai", reminder: "每天 9:00" };
const NAMES: Record<keyof typeof SAVED, string> = { company: "公司名称", city: "所在地", reminder: "提醒时间" };

/** 设置页：分区左标题 + 说明、右字段；整页一个吸底保存条，改了才出现；改过的字段标「已改」。 */
export function Demo() {
  const tracker = useChangeTracker(SAVED);
  const [notify, setNotify] = useState(true);
  return (
    <div>
      <FormSection layout="side" title="公司" description="出现在公开页和邮件落款上。">
        <FormField label="公司名称" htmlFor="st-company" changed={tracker.changed("company")}>
          <Input id="st-company" value={tracker.values.company} onChange={(e) => tracker.set("company", e.target.value)} />
        </FormField>
        <FormField label="所在地" htmlFor="st-city" changed={tracker.changed("city")} hint="决定手机区号和币种的默认值">
          <Choice
            label="所在地"
            value={tracker.values.city}
            onChange={(v) => tracker.set("city", v)}
            options={[{ value: "shanghai", label: "上海" }, { value: "shenzhen", label: "深圳" }, { value: "singapore", label: "新加坡" }]}
          />
        </FormField>
      </FormSection>
      <FormSection layout="side" title="提醒" description="开关立即生效，不用点保存。">
        <FormField label="提醒时间" htmlFor="st-reminder" changed={tracker.changed("reminder")}>
          <Input id="st-reminder" value={tracker.values.reminder} onChange={(e) => tracker.set("reminder", e.target.value)} />
        </FormField>
        <FormField label="跟进到期提醒" htmlFor="st-notify">
          <AsyncSwitch id="st-notify" label="跟进到期提醒" checked={notify} onChange={async (v) => setNotify(v)} />
        </FormField>
      </FormSection>
      <SaveBar
        count={tracker.count}
        summary={tracker.keys.map((k) => NAMES[k]).join("、")}
        onDiscard={tracker.reset}
        onSave={async () => {
          await new Promise((resolve) => window.setTimeout(resolve, 500));
          tracker.commit();
        }}
      />
      {tracker.count === 0 && <p className="aui-text-note" style={{ textAlign: "center" }}>改一个字段，保存条就会出现在底部。</p>}
    </div>
  );
}
