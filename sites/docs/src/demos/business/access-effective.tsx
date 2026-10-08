import { useState } from "react";
import { Eye } from "lucide-react";
import { Button, useNotify } from "@adminui/react";
import { EffectiveAccessView } from "@adminui/react/access";
import { EFFECTIVE_MODULES, EFFECTIVE_PEOPLE, SCOPE_LABELS } from "../../data/business-data";

// 「预览 / 诊断」：左边选人，右边每个模块的最终档位、范围和来源标签；「明细」展开到每一项权限和拦住它的原因。

export function Demo() {
  const notify = useNotify();
  const [person, setPerson] = useState("u02");
  const picked = EFFECTIVE_PEOPLE.find((p) => p.id === person);
  return (
    <EffectiveAccessView
      people={EFFECTIVE_PEOPLE}
      selectedId={person}
      onPick={setPerson}
      subject={{ name: picked?.name ?? "", hint: `${picked?.hint ?? ""} · 角色：销售主管` }}
      modules={EFFECTIVE_MODULES}
      scopeLabels={SCOPE_LABELS}
      actions={<Button size="sm" variant="outline" onClick={() => notify("以他的身份打开只读预览（演示）", "info")}><Eye aria-hidden="true" />以他身份预览</Button>}
    />
  );
}
