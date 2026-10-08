import { useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { ChoiceTiles, FormField, RadioGroup } from "@adminui/react";

type Rule = "round" | "least" | "manual";
type Device = "desktop" | "tablet" | "phone";

/** 圆点单选：文字可点、说明写第二行；2–4 个带说明的大选项用选项卡片 ChoiceTiles。方向键移动并选中。 */
export function Demo() {
  const [rule, setRule] = useState<Rule>("round");
  const [device, setDevice] = useState<Device>("desktop");
  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 560 }}>
      <FormField label="线索分配方式" htmlFor="rg-rule">
        <RadioGroup<Rule>
          label="线索分配方式"
          value={rule}
          onValueChange={setRule}
          options={[
            { value: "round", label: "轮流分配", description: "按顺序一人一个" },
            { value: "least", label: "优先给手上少的人", description: "按未跟进的线索数" },
            { value: "manual", label: "手动分配", description: "进入公海，由主管分配", disabled: true },
          ]}
        />
      </FormField>
      <ChoiceTiles<Device>
        label="预览设备"
        value={device}
        onValueChange={setDevice}
        columns={3}
        options={[
          { value: "desktop", label: "电脑", hint: "1440 宽", icon: <Monitor aria-hidden="true" /> },
          { value: "tablet", label: "平板", hint: "768 宽", icon: <Tablet aria-hidden="true" /> },
          { value: "phone", label: "手机", hint: "390 宽", icon: <Smartphone aria-hidden="true" /> },
        ]}
      />
    </div>
  );
}
