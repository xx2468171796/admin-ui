import { useState } from "react";
import { FormField, Input } from "@adminui/react";

type Props = { size?: string; clearable?: boolean; showCount?: boolean; prefix?: string; suffix?: string; disabled?: boolean; error?: string };

/** 一个文本框的全部开关：尺寸、清空、字数、前后缀、禁用、出错。 */
export function Demo({ size = "md", clearable = true, showCount = false, prefix = "", suffix = "", disabled = false, error = "" }: Props) {
  const [value, setValue] = useState("北辰云华东分公司");
  return (
    <div style={{ width: "min(360px, 100%)" }}>
      <FormField label="客户名称" htmlFor="pg-name" required hint="和营业执照上的名称一致" error={error || undefined}>
        <Input
          id="pg-name"
          size={size === "sm" ? "sm" : "md"}
          value={value}
          maxLength={30}
          clearable={clearable}
          showCount={showCount}
          prefix={prefix || undefined}
          suffix={suffix || undefined}
          disabled={disabled}
          placeholder="例如：远航精密制造"
          onChange={(e) => setValue(e.target.value)}
        />
      </FormField>
    </div>
  );
}
