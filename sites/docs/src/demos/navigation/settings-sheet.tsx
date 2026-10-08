// 抽屉里的设置 SettingsSheet：880 宽、左 184 分节、右边一次一节、底部固定「改了 N 处 · 取消 · 保存」。
// 关的时候有没保存的改动会先问。手机铺满一屏，分节在上面。
import { useState } from "react";
import { FileText, Layers, ShieldCheck, Target, Trash2, Type, Zap } from "lucide-react";
import { Button, FormField, Input, SettingsSheet, useChangeTracker, useNotify } from "@adminui/react";

export function Demo() {
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const form = useChangeTracker({ limit: "200", days: "15", currency: "CNY" });
  const currencyBad = !/^[A-Z]{3}$/.test(form.values.currency);
  const note = (text: string) => <p className="aui-note">{text}</p>;
  const pipeline = (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
      <FormField label="每人认领上限" htmlFor="ss-limit" changed={form.changed("limit")}>
        <Input id="ss-limit" value={form.values.limit} suffix="条" onChange={(e) => form.set("limit", e.target.value)} />
      </FormField>
      <FormField label="几天没跟进退回公海" htmlFor="ss-days" changed={form.changed("days")}>
        <Input id="ss-days" value={form.values.days} suffix="天" onChange={(e) => form.set("days", e.target.value)} />
      </FormField>
      <FormField label="币种" htmlFor="ss-cur" changed={form.changed("currency")} error={currencyBad ? "要三位代码，例如 CNY、USD" : undefined}>
        <Input id="ss-cur" value={form.values.currency} onChange={(e) => form.set("currency", e.target.value)} />
      </FormField>
    </div>
  );
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>打开表设置</Button>
      <SettingsSheet
        open={open}
        onClose={() => setOpen(false)}
        title="表设置"
        subtitle="客户"
        changes={form.count}
        errors={currencyBad ? 1 : 0}
        summary={form.keys.join("、")}
        onDiscard={form.reset}
        onSave={async () => {
          if (currencyBad) throw Error("币种要三位代码");
          await new Promise((r) => window.setTimeout(r, 400));
          form.commit();
          notify("表设置已保存", "success");
        }}
        sections={[
          { id: "basic", group: "表格", label: "基本信息", icon: <FileText />, content: note("表名、图标、说明。") },
          { id: "fields", group: "表格", label: "字段", icon: <Type />, count: 24, content: note("字段列表。") },
          { id: "access", group: "表格", label: "权限", icon: <ShieldCheck />, content: note("谁能看、谁能改。") },
          { id: "pipeline", group: "销售流程", label: "公海与认领", hint: "中小企业", icon: <Layers />, dirty: form.count > 0, error: currencyBad ? "币种填错了" : undefined, content: pipeline },
          { id: "stages", group: "销售流程", label: "阶段与赢率", icon: <Target />, content: note("线索 → 赢单 各阶段的赢率。") },
          { id: "auto", group: "高级", label: "自动化", icon: <Zap />, count: 6, content: note("6 条自动化规则。") },
          { id: "trash", group: "高级", label: "回收站", icon: <Trash2 />, content: note("30 天内删除的记录。") },
        ]}
      />
    </>
  );
}
