import { useState } from "react";
import { Choice, FormField, type SelectItem } from "@adminui/react";
import { CITIES, PEOPLE, STAGES, personName } from "../../data/demo-data";

const TONES = ["green", "teal", "blue", "violet", "pink", "orange", "yellow", "olive"] as const;

/** 分组 + 不能选的原因；搜不到时「＋ 新建选项」；选人带头像和部门；清空是悬停出现的 ×。 */
export function Demo() {
  const [stage, setStage] = useState("negotiation");
  const [city, setCity] = useState("");
  const [owner, setOwner] = useState("u02");
  const [cities, setCities] = useState<SelectItem[]>(() => CITIES.map((c, i) => ({ value: c, label: c, tone: TONES[i % TONES.length] })));

  const stages: SelectItem[] = STAGES.map((s) => ({
    value: s.value,
    label: s.label,
    tone: s.tone,
    group: s.value === "won" || s.value === "lost" ? "已结束" : "进行中",
    disabledReason: s.value === "lost" ? "要先填丢单原因" : undefined,
  }));
  const people: SelectItem[] = PEOPLE.map((p) => ({ value: p.id, label: p.name, avatar: "", hint: p.title, keywords: p.email }));

  const createCity = (label: string) => {
    const tone = TONES[cities.length % TONES.length];
    setCities((list) => [...list, { value: label, label, tone }]);
    return label;
  };

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 360 }}>
      <FormField label="阶段" htmlFor="ss-stage">
        <Choice id="ss-stage" label="阶段" options={stages} value={stage} onChange={setStage} />
      </FormField>
      <FormField label="所在城市" htmlFor="ss-city" hint="搜一个列表里没有的城市，回车直接新建">
        <Choice id="ss-city" label="所在城市" options={cities} value={city} onChange={setCity} onCreate={createCity} clearable placeholder="选择或新建城市" />
      </FormField>
      <FormField label="负责人" htmlFor="ss-owner" hint={owner ? `当前：${personName(owner)}` : undefined}>
        <Choice id="ss-owner" label="负责人" options={people} value={owner} onChange={setOwner} clearable />
      </FormField>
    </div>
  );
}
