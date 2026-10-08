import { useState } from "react";
import { Button, FormErrorSummary, FormField, FormSection, Input, jumpToField, type FormErrorItem } from "@adminui/react";

/** 页面里的表单（不在弹框里）：左标签 112px；提交后顶部汇总，点一条跳到那个框；改好一个就少一条。 */
export function Demo() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("lin.xiao.example.com");
  const [tried, setTried] = useState(false);
  const errors: FormErrorItem[] = [];
  if (!name.trim()) errors.push({ id: "es-name", label: "联系人", message: "请填写联系人" });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push({ id: "es-email", label: "邮箱", message: "邮箱少了 @，例如 lin.xiao@example.com" });
  const errorOf = (id: string) => (tried ? errors.find((e) => e.id === id)?.message : undefined);
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 560 }}>
      {tried && <FormErrorSummary errors={errors} />}
      <FormSection labels="side">
        <FormField label="联系人" htmlFor="es-name" required error={errorOf("es-name")}>
          <Input id="es-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="邮箱" htmlFor="es-email" required error={errorOf("es-email")}>
          <Input id="es-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="公司" htmlFor="es-company" hint="选填，开发票时会用到">
          <Input id="es-company" defaultValue="远航精密制造" />
        </FormField>
      </FormSection>
      <div>
        <Button onClick={() => { setTried(true); if (errors[0]) jumpToField(errors[0].id); }}>提交</Button>
      </div>
    </div>
  );
}
