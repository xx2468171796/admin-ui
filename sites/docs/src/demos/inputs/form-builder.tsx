import { useState } from "react";
import { CircleChevronDown, Phone, Type } from "lucide-react";
import { useNotify } from "@adminui/react";
import { FormBrand, FormBuilder, addFormQuestion, type FormDefinition, type FormField, type FormSettings } from "@adminui/react/form-builder";
import { FORM_DEFINITION, FORM_FIELDS, FORM_SETTINGS, FORM_URL, fakeUpload } from "../../data/inputs-data";

const NEW_TYPES = [
  { type: "text", label: "文本", icon: <Type /> },
  { type: "singleSelect", label: "单选", icon: <CircleChevronDown /> },
  { type: "phone", label: "电话", icon: <Phone /> },
];

/**
 * 表单搭建器：左「已添加 / 可以加 / 不能放进表单」，中间所见即所得（真实控件），选中的题下面设必填、说明、显示条件；
 * 右栏是表单设置。题目就是表里的字段，每份提交变成一条记录。
 */
export function Demo() {
  const notify = useNotify();
  const [fields, setFields] = useState<FormField[]>(FORM_FIELDS);
  const [form, setForm] = useState<FormDefinition>(FORM_DEFINITION);
  const [settings, setSettings] = useState<FormSettings>(FORM_SETTINGS);
  return (
    <FormBuilder
      height={620}
      fields={fields}
      form={form}
      onFormChange={setForm}
      settings={settings}
      onSettingsChange={setSettings}
      shareUrl={FORM_URL}
      stats={{ total: 86, today: 5 }}
      help="每一份提交都会变成「线索」表里的一条记录；题目就是表里的字段。"
      pinned={["name"]}
      defaultSelected="modules"
      defaultCountry="+86"
      brand={<FormBrand logo="北" name="北辰云" subtitle="Northstar Cloud" />}
      previewProps={{ upload: fakeUpload, footer: "你的信息只用于安排演示" }}
      onShare={() => notify("这里打开分享弹窗（复制链接、二维码）", "info")}
      onEditField={(field) => notify(`这里打开「${field.title}」的字段弹窗`, "info")}
      onCopyQuestion={(question, field) => {
        const copy: FormField = { ...field, key: `${field.key}-copy-${fields.length}`, title: `${field.title}（副本）` };
        setFields([...fields, copy]);
        setForm(addFormQuestion(form, copy, form.questions.findIndex((q) => q.field === question.field) + 1));
      }}
      newFieldTypes={NEW_TYPES}
      onNewField={(type) => {
        const label = NEW_TYPES.find((t) => t.type === type)?.label ?? "新题目";
        const field: FormField = { key: `new-${fields.length}`, title: `新${label}题`, type: type === "singleSelect" ? "singleSelect" : type === "phone" ? "phone" : "text" };
        setFields([...fields, field]);
        setForm(addFormQuestion(form, field));
      }}
      onAddNotify={() => notify("这里打开选人弹窗", "info")}
    />
  );
}
