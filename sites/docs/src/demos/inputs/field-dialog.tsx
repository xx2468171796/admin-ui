import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Choice, FieldDialog, useNotify, type FieldDraft } from "@adminui/react";
import { FIELD_TYPES, LEVEL_OPTIONS, LEVEL_USAGE, OPTION_TYPES, type DemoFieldType } from "../../data/inputs-data";

const EMPTY: FieldDraft<DemoFieldType> = { name: "客户等级", type: "singleSelect", options: LEVEL_OPTIONS, allowCreate: true, description: "" };

/** 新建字段：类型分组 + 可搜索 + 说明卡；选单选 / 多选出选项编辑，选货币出币种设置；重名当场提示。 */
export function Demo() {
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [currency, setCurrency] = useState("CNY");
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus aria-hidden="true" />新建字段</Button>
      <FieldDialog<DemoFieldType>
        open={open}
        onClose={() => setOpen(false)}
        value={draft}
        onChange={setDraft}
        types={FIELD_TYPES}
        optionTypes={OPTION_TYPES}
        optionUsage={LEVEL_USAGE}
        recordNoun="客户"
        existingNames={["客户名称", "阶段", "负责人"]}
        footerNote="以后在表头菜单里还能改"
        settings={
          draft.type === "money" ? (
            <Choice
              label="币种"
              value={currency}
              onChange={setCurrency}
              options={[{ value: "CNY", label: "人民币 ¥" }, { value: "USD", label: "美元 US$" }, { value: "EUR", label: "欧元 €" }]}
            />
          ) : undefined
        }
        onSubmit={async (d) => {
          await new Promise((resolve) => window.setTimeout(resolve, 300));
          notify(`已新建字段「${d.name}」`, "success");
          setOpen(false);
          setDraft(EMPTY);
        }}
      />
    </>
  );
}
