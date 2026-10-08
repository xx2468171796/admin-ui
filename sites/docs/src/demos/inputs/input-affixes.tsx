import { useState } from "react";
import { AtSign, Paperclip, Search } from "lucide-react";
import { FormField, IconButton, Input, Kbd, Textarea } from "@adminui/react";

/** 前缀 / 后缀 / 框里的一格（segment）、多行自动长高、框内底行放字数和工具按钮。 */
export function Demo() {
  const [site, setSite] = useState("northstar");
  const [sms, setSms] = useState("您好，您预约的产品演示时间是 10 月 9 日上午 10 点，届时顾问会给您来电。");
  const [note, setNote] = useState("");
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 16 }}>
        <FormField label="公开页地址" htmlFor="af-site" hint="只能用小写字母、数字和 -">
          <Input id="af-site" value={site} segment={<span className="aui-input-seg">https://</span>} suffix=".example.com" onChange={(e) => setSite(e.target.value)} />
        </FormField>
        <FormField label="单价" htmlFor="af-price">
          <Input id="af-price" defaultValue="1,280" inputMode="decimal" prefix="¥" suffix="元 / 席位" />
        </FormField>
        <FormField label="邮箱" htmlFor="af-mail" error="邮箱少了 @：例如 lin.xiao@example.com">
          <Input id="af-mail" defaultValue="lin.xiao.example.com" prefix={<AtSign />} />
        </FormField>
        <FormField label="小号（筛选行）" htmlFor="af-sm" optional>
          <Input id="af-sm" size="sm" prefix={<Search />} placeholder="28px 小号" />
        </FormField>
      </div>
      <FormField label="短信内容" htmlFor="af-sms" help="超过 70 个字会拆成两条短信计费。">
        <Textarea id="af-sms" value={sms} maxLength={70} showCount onChange={(e) => setSms(e.target.value)} />
      </FormField>
      <FormField label="跟进记录" htmlFor="af-note">
        <Textarea
          id="af-note"
          value={note}
          placeholder="写点什么…（自动长高，最多 10 行）"
          onChange={(e) => setNote(e.target.value)}
          footer={
            <>
              <IconButton size="xs" label="附件" icon={<Paperclip />} />
              <IconButton size="xs" label="提到同事" icon={<AtSign />} />
              <span className="aui-text-note"><Kbd keys="Mod+Enter" size="sm" flat /> 保存</span>
            </>
          }
        />
      </FormField>
    </div>
  );
}
