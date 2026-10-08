import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Choice, FormDialog, FormField, FormFieldErrors, FormSection, Input, PhoneInput, Textarea } from "@adminui/react";
import { STAGES } from "../../data/demo-data";

/** 点「新建」直接提交：顶部汇总（可点跳过去）+ 每个框红边 + 焦点到第一个错 + 底栏「N 项要改」。 */
export function Demo() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState<string | null>("+86138001");
  const [stage, setStage] = useState("");
  const [need, setNeed] = useState("");
  const close = () => {
    setOpen(false);
    setName("");
    setStage("");
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus aria-hidden="true" />新建客户</Button>
      <FormDialog
        open={open}
        title="新建客户"
        description="带 * 的必填。不填直接点「新建」，看出错的样子。"
        onClose={close}
        dirty={Boolean(name || stage || need)}
        submitLabel="新建"
        onSubmit={async () => {
          await new Promise((resolve) => window.setTimeout(resolve, 300));
          const errors: Record<string, string> = {};
          if (!name.trim()) errors["fd-name"] = "请填客户名称";
          if (!phone || phone.replace(/\D/g, "").length < 13) errors["fd-phone"] = "手机号要 11 位、1 开头，例如 138 0013 8000";
          if (!stage) errors["fd-stage"] = "请选一个阶段";
          if (Object.keys(errors).length) throw new FormFieldErrors(errors);
          close();
        }}
      >
        <FormSection>
          <FormField label="客户名称" htmlFor="fd-name" required>
            <Input id="fd-name" value={name} placeholder="例如：远航精密制造" onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="手机" htmlFor="fd-phone" required>
            <PhoneInput id="fd-phone" value={phone} onChange={setPhone} defaultCountry="+86" mobile showError={false} />
          </FormField>
          <FormField label="阶段" htmlFor="fd-stage" required>
            <Choice label="阶段" value={stage} onChange={setStage} options={STAGES.map((s) => ({ value: s.value, label: s.label }))} placeholder="选择阶段" />
          </FormField>
          <FormField label="需求" htmlFor="fd-need" optional>
            <Textarea id="fd-need" value={need} maxLength={500} showCount onChange={(e) => setNeed(e.target.value)} />
          </FormField>
        </FormSection>
      </FormDialog>
    </>
  );
}
