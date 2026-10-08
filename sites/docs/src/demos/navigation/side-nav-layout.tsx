// 设置页 SideNavLayout：左 200 直接在画布上（不包卡片）、分组小标题 + 34px 行；改过的节琥珀圆点、出错的节红叹号。
// 整页只有一条吸底 SaveBar（改了 N 处 · 放弃 · 保存），每节不各放「保存」。1100px 以下左导航变一排胶囊。
import { Bell, Globe, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { FormField, Input, Panel, SaveBar, SideNavLayout, useChangeTracker, useNotify } from "@adminui/react";

export function Demo() {
  const notify = useNotify();
  const form = useChangeTracker({ name: "林晓", title: "销售总监", timezone: "UTC+8" });
  const timezoneBad = !/^UTC[+-]\d{1,2}$/.test(form.values.timezone);
  return (
    <SideNavLayout
      label="我的资料分节"
      footer={
        <SaveBar
          count={form.count}
          errors={timezoneBad ? 1 : 0}
          summary={form.keys.join("、")}
          onDiscard={form.reset}
          onSave={async () => {
            if (timezoneBad) throw Error("时区要写成 UTC+8 这样");
            await new Promise((r) => window.setTimeout(r, 400));
            form.commit();
            notify("已保存", "success");
          }}
        />
      }
      sections={[
        {
          id: "profile", group: "个人", label: "基本资料", icon: <UserRound size={16} />,
          dirty: form.changed("name") || form.changed("title"),
          content: (
            <Panel title="基本资料">
              <div style={{ display: "grid", gap: 16, maxWidth: 420 }}>
                <FormField label="姓名" htmlFor="sn-name" changed={form.changed("name")}>
                  <Input id="sn-name" value={form.values.name} onChange={(e) => form.set("name", e.target.value)} />
                </FormField>
                <FormField label="岗位" htmlFor="sn-title" changed={form.changed("title")}>
                  <Input id="sn-title" value={form.values.title} onChange={(e) => form.set("title", e.target.value)} />
                </FormField>
              </div>
            </Panel>
          ),
        },
        {
          id: "region", group: "个人", label: "语言与时区", icon: <Globe size={16} />,
          dirty: form.changed("timezone"), error: timezoneBad ? "时区格式不对" : undefined,
          content: (
            <Panel title="语言与时区">
              <FormField label="时区" htmlFor="sn-tz" changed={form.changed("timezone")} error={timezoneBad ? "要写成 UTC+8 这样" : undefined}>
                <Input id="sn-tz" value={form.values.timezone} onChange={(e) => form.set("timezone", e.target.value)} />
              </FormField>
            </Panel>
          ),
        },
        { id: "notify", group: "个人", label: "通知", icon: <Bell size={16} />, content: <Panel title="通知"><p className="aui-note">哪些事发站内信、哪些发邮件。</p></Panel> },
        { id: "security", group: "安全", label: "登录与安全", icon: <ShieldCheck size={16} />, content: <Panel title="登录与安全"><p className="aui-note">改密码、登录设备。</p></Panel> },
        { id: "tokens", group: "安全", label: "API 令牌", icon: <KeyRound size={16} />, content: <Panel title="API 令牌"><p className="aui-note">个人令牌列表。</p></Panel> },
      ]}
    />
  );
}
