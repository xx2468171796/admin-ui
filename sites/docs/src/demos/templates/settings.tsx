import { useState } from "react";
import { Bell, Building2, Copy, Receipt, Shield } from "lucide-react";
import {
  Button, Choice, DescriptionList, FormField, FormSection, Input, PageHeader, Panel, SaveBar, SideNavLayout, StatusBadge, Switch, useNotify,
} from "@adminui/react";

const SAVED = { digest: "daily", mentions: true, quiet: "22-8", lock: "5-15", session: "12", mfa: true, invoiceEmail: "finance@example.com", taxId: "91310000MA1K00XX0X" };
type Settings = typeof SAVED;
const LABELS: Record<keyof Settings, string> = { digest: "每日摘要", mentions: "被提及时通知", quiet: "免打扰时段", lock: "登录失败锁定", session: "会话时长", mfa: "强制两步验证", invoiceEmail: "发票接收邮箱", taxId: "纳税人识别号" };

/** T08 设置 / 表单页：左分节导航（改过的带小点）+ 右边一节一张卡 + 有改动时底部浮起保存条。 */
export function Demo() {
  const notify = useNotify();
  const [saved, setSaved] = useState(SAVED);
  const [draft, setDraft] = useState<Settings>({ ...SAVED, digest: "weekly" });
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const changed = (Object.keys(SAVED) as (keyof Settings)[]).filter((k) => draft[k] !== saved[k]);
  const isChanged = (k: keyof Settings) => changed.includes(k);
  const emailError = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.invoiceEmail) ? undefined : "邮箱格式不对，例如 finance@example.com";

  return (
    <div style={{ height: 680, overflow: "auto", padding: 16, background: "var(--aui-canvas)" }}>
      <PageHeader title="设置" />
      <SideNavLayout
        label="设置分节"
        sections={[
          {
            id: "company", label: "公司信息", icon: <Building2 />, group: "组织",
            content: (
              <Panel title="公司信息" description="订阅合同里的内容；要改请联系客户成功经理。" actions={<Button size="sm" variant="outline" onClick={() => notify("已复制租户编号")}><Copy />复制租户编号</Button>}>
                <DescriptionList columns={3} items={[
                  { label: "公司名称", value: "北辰云示例租户" },
                  { label: "套餐", value: <>企业版 <StatusBadge tone="success">生效中</StatusBadge></> },
                  { label: "到期", value: "2027-03-31 · 还剩 174 天" },
                  { label: "席位", value: "86 / 100" },
                  { label: "存储", value: "212 GB / 1 TB" },
                  { label: "租户编号", value: "NS-7F3A-91C2" },
                ]} />
              </Panel>
            ),
          },
          {
            id: "security", label: "安全", icon: <Shield />, group: "组织", dirty: (["lock", "session", "mfa"] as const).some(isChanged),
            content: (
              <Panel title="安全" description="登录和会话的限制，对全公司生效。">
                <FormSection>
                  <FormField label="登录失败锁定" htmlFor="tpl-lock" changed={isChanged("lock")}><Choice label="登录失败锁定" value={draft.lock} onChange={(v) => set("lock", v)} options={[{ value: "5-15", label: "连错 5 次锁 15 分钟" }, { value: "3-60", label: "连错 3 次锁 1 小时" }]} /></FormField>
                  <FormField label="会话时长" htmlFor="tpl-session" changed={isChanged("session")}><Choice label="会话时长" value={draft.session} onChange={(v) => set("session", v)} options={[{ value: "12", label: "12 小时" }, { value: "24", label: "24 小时" }, { value: "168", label: "7 天" }]} /></FormField>
                  <FormField label="强制两步验证" htmlFor="tpl-mfa" hint="没开两步验证的成员下次登录时必须先设置" changed={isChanged("mfa")}><Switch id="tpl-mfa" checked={draft.mfa} onCheckedChange={(v) => set("mfa", v)} /></FormField>
                </FormSection>
              </Panel>
            ),
          },
          {
            id: "billing", label: "账单", icon: <Receipt />, group: "组织", dirty: isChanged("invoiceEmail") || isChanged("taxId"), error: emailError,
            content: (
              <Panel title="账单" description="开票信息；每月 1 日自动开上月发票。">
                <FormSection>
                  <FormField label="发票接收邮箱" htmlFor="tpl-email" required error={emailError} changed={isChanged("invoiceEmail")}><Input id="tpl-email" value={draft.invoiceEmail} onChange={(e) => set("invoiceEmail", e.target.value)} /></FormField>
                  <FormField label="纳税人识别号" htmlFor="tpl-tax" changed={isChanged("taxId")}><Input id="tpl-tax" value={draft.taxId} onChange={(e) => set("taxId", e.target.value)} /></FormField>
                </FormSection>
              </Panel>
            ),
          },
          {
            id: "notify", label: "通知", icon: <Bell />, group: "个人", dirty: (["digest", "mentions", "quiet"] as const).some(isChanged),
            content: (
              <Panel title="通知" description="消息发给谁、什么时候发。">
                <FormSection>
                  <FormField label="每日摘要" htmlFor="tpl-digest" changed={isChanged("digest")}><Choice label="每日摘要" value={draft.digest} onChange={(v) => set("digest", v)} options={[{ value: "daily", label: "每天 9:00" }, { value: "weekly", label: "每周一 9:00" }, { value: "off", label: "不发" }]} /></FormField>
                  <FormField label="免打扰时段" htmlFor="tpl-quiet" changed={isChanged("quiet")}><Choice label="免打扰时段" value={draft.quiet} onChange={(v) => set("quiet", v)} options={[{ value: "22-8", label: "22:00 – 08:00" }, { value: "off", label: "不设置" }]} /></FormField>
                  <FormField label="被提及时通知" htmlFor="tpl-mentions" hint="评论里 @ 到你时发站内信和邮件" changed={isChanged("mentions")}><Switch id="tpl-mentions" checked={draft.mentions} onCheckedChange={(v) => set("mentions", v)} /></FormField>
                </FormSection>
              </Panel>
            ),
          },
        ]}
        footer={
          <SaveBar
            count={changed.length}
            errors={emailError ? 1 : 0}
            summary={changed.map((k) => LABELS[k]).join(" · ")}
            onDiscard={() => setDraft(saved)}
            onSave={async () => {
              if (emailError) throw new Error("发票接收邮箱有误，改好再保存");
              await new Promise((r) => setTimeout(r, 400));
              setSaved(draft);
            }}
          />
        }
      />
    </div>
  );
}
