import { useState } from "react";
import { Choice, FormField, MultiChoice, type SelectItem } from "@adminui/react";
import { STAGES } from "../../data/demo-data";

type Props = { multiple?: boolean; size?: string; clearable?: boolean; searchable?: string; disabled?: boolean; readOnly?: boolean; placeholder?: string };

const OPTIONS: SelectItem[] = STAGES.map((s) => ({ value: s.value, label: s.label, tone: s.tone }));

/** 一种触发器 + 一种弹层：单选勾在右，多选勾选框在左；选项多于 6 个自动出搜索。 */
export function Demo({ multiple = false, size = "md", clearable = true, searchable = "auto", disabled = false, readOnly = false, placeholder = "请选择阶段" }: Props) {
  const [one, setOne] = useState("proposal");
  const [many, setMany] = useState<string[]>(["qualified", "proposal"]);
  const shared = {
    label: "商机阶段",
    options: OPTIONS,
    size: size === "sm" ? ("sm" as const) : ("md" as const),
    searchable: searchable === "auto" ? ("auto" as const) : searchable === "true",
    disabled,
    readOnly,
    placeholder,
  };
  return (
    <div style={{ maxWidth: 360 }}>
      <FormField label="商机阶段" htmlFor="pg-stage">
        {multiple ? (
          <MultiChoice id="pg-stage" {...shared} value={many} onChange={setMany} />
        ) : (
          <Choice id="pg-stage" {...shared} value={one} onChange={setOne} clearable={clearable} />
        )}
      </FormField>
    </div>
  );
}
