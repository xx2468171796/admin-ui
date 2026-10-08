import { useState } from "react";
import { FieldTypePicker, OptionsEditor, type EditableOption } from "@adminui/react";
import { FIELD_TYPES, LEVEL_OPTIONS, LEVEL_USAGE, type DemoFieldType } from "../../data/inputs-data";

/**
 * 两块可以单独用：FieldTypePicker（分组、搜索、方向键、选中后说明卡，还没做的收在最后）；
 * OptionsEditor（拖柄 + 色点 + 框 + 已用条数；重名标红；删正在用的选项先问）。
 */
export function Demo() {
  const [type, setType] = useState<DemoFieldType | null>("singleSelect");
  const [options, setOptions] = useState<EditableOption[]>(LEVEL_OPTIONS);
  const [allow, setAllow] = useState(true);
  return (
    <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", alignItems: "start" }}>
      <FieldTypePicker<DemoFieldType> types={FIELD_TYPES} value={type} onChange={setType} />
      <OptionsEditor
        label="客户等级选项"
        options={options}
        onChange={setOptions}
        usage={LEVEL_USAGE}
        fieldName="客户等级"
        recordNoun="客户"
        allowCreate={allow}
        onAllowCreateChange={setAllow}
        allowCreateLabel="格子里能直接新建"
      />
    </div>
  );
}
