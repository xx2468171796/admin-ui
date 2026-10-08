import { useState } from "react";
import { ChoiceTags, FormField } from "@adminui/react";

/** 表单里 ≤ 6 个选项的单选：平铺成带选项颜色的标签按钮；方向键移动并选中。多了用 Choice。 */
export function Demo() {
  const [level, setLevel] = useState("b");
  const [source, setSource] = useState("");
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 480 }}>
      <FormField label="客户等级" htmlFor="ct-level" required>
        <ChoiceTags
          label="客户等级"
          value={level}
          onChange={setLevel}
          options={[
            { value: "a", label: "A 类", tone: "red" },
            { value: "b", label: "B 类", tone: "orange" },
            { value: "c", label: "C 类", tone: "blue" },
            { value: "d", label: "D 类", tone: "gray", disabledReason: "D 类已停用" },
          ]}
        />
      </FormField>
      <FormField label="来源" htmlFor="ct-source" error={source ? undefined : "请选一个来源"}>
        <ChoiceTags
          label="来源"
          value={source}
          onChange={setSource}
          options={[
            { value: "web", label: "官网", tone: "green" },
            { value: "event", label: "线下活动", tone: "violet" },
            { value: "referral", label: "老客户介绍", tone: "teal" },
          ]}
        />
      </FormField>
    </div>
  );
}
