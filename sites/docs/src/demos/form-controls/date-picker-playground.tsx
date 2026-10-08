import { useState } from "react";
import { DatePicker, FormField, type DatePickerSize } from "@adminui/react";

type Props = { size?: string; clearable?: boolean; relative?: boolean; deadline?: boolean; disabled?: boolean; placeholder?: string };

// 演示把「今天」固定在 2026-10-08（周四），截图和说明才对得上。
const now = () => new Date(2026, 9, 8, 10, 0);

/** 能直接打字（2026-10-12、10/12），也能点开月历；值后面跟「周几 · 离今天几天」。 */
export function Demo({ size = "md", clearable = true, relative = true, deadline = true, disabled = false, placeholder = "选择日期" }: Props) {
  const [value, setValue] = useState("2026-10-09");
  return (
    <div style={{ maxWidth: 320 }}>
      <FormField label="下次跟进" htmlFor="dp-next" hint={value ? `提交的值：${value}` : "提交的值：空"}>
        <DatePicker
          id="dp-next"
          value={value}
          onChange={setValue}
          size={size as DatePickerSize}
          clearable={clearable}
          relative={relative}
          deadline={deadline}
          disabled={disabled}
          placeholder={placeholder}
          now={now}
        />
      </FormField>
    </div>
  );
}
