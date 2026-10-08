// bt/builders-a：表单搭建器示例（样稿 D08）。题目 = 「客户」表的字段；提交的每一份都会变成表里的一条记录。
// 公开填写页 D18 / D18m / D18s 在独立地址打开：#form-public=fill（加 &dark 看深色），提交后是成功页。
import { useState } from "react";
import { Calendar, CircleChevronDown, ExternalLink, Phone, Type } from "lucide-react";
import { Button, ConfirmDialog, PageBody, useNotify } from "@adminui/react";
import { FormBrand, FormBuilder, addFormQuestion, removeFormQuestion, type FormDefinition, type FormField, type FormSettings } from "@adminui/react/form-builder";
import { FORM_DEFINITION, FORM_FIELDS, FORM_SETTINGS, FORM_URL, demoUpload } from "./forms-demo";

const NEW_TYPES = [
  { type: "text", label: "文本", icon: <Type /> },
  { type: "singleSelect", label: "单选", icon: <CircleChevronDown /> },
  { type: "phone", label: "电话", icon: <Phone /> },
  { type: "date", label: "日期", icon: <Calendar /> },
];
const NOTIFY_CANDIDATES = [{ id: "u-chen", name: "陈主管" }, { id: "u-wang", name: "王小美" }];

export function FormsShowcase() {
  const notify = useNotify();
  const [fields, setFields] = useState<FormField[]>(FORM_FIELDS);
  const [form, setForm] = useState<FormDefinition>(FORM_DEFINITION);
  const [settings, setSettings] = useState<FormSettings>(FORM_SETTINGS);
  const [deleting, setDeleting] = useState<FormField | null>(null);
  return (
    <>
      <PageBody>
        <FormBuilder
          fields={fields}
          form={form}
          onFormChange={setForm}
          settings={settings}
          onSettingsChange={setSettings}
          shareUrl={FORM_URL}
          stats={{ total: 86, today: 5 }}
          help="表单收到的每一份提交都会变成「客户」表里的一条记录；题目就是表里的字段。公开填写页和提交成功页在独立地址打开（#form-public=fill）。"
          topExtra={<Button variant="outline" size="sm" onClick={() => window.open("#form-public=fill", "_blank")}><ExternalLink />打开填写页</Button>}
          pinned={["name"]}
          defaultSelected="products"
          brand={<FormBrand logo="A" name="Acme" subtitle="智能家居" />}
          onChangeCover={() => notify("演示：这里打开宿主的图片选择（封面用图片或纯色，不画插画）", "info")}
          onShare={() => notify("演示：这里打开 ShareDialog 分享表单", "info")}
          onEditField={(field) => notify(`演示：这里打开「${field.title}」的字段弹窗（FieldDialog）加选项`, "info")}
          onCopyQuestion={(question, field) => {
            const key = `${field.key}-copy-${fields.length}`;
            const copy: FormField = { ...field, key, title: `${field.title}（副本）` };
            setFields([...fields, copy]);
            const index = form.questions.findIndex((q) => q.field === question.field) + 1;
            setForm(addFormQuestion(form, copy, index));
          }}
          onDeleteField={setDeleting}
          newFieldTypes={NEW_TYPES}
          onNewField={(type) => {
            const key = `new-${fields.length}`;
            const field = { key, title: `新题目 ${fields.length - FORM_FIELDS.length + 1}`, type } as FormField;
            setFields([...fields, field]);
            setForm(addFormQuestion(form, field));
          }}
          onAddNotify={() => {
            const next = NOTIFY_CANDIDATES.find((c) => !settings.notify.some((n) => n.id === c.id));
            if (next) setSettings({ ...settings, notify: [...settings.notify, next] });
            else notify("演示：这里打开选人（GrantList）", "info");
          }}
          onRemind={() => notify("已提醒 3 个还没填的人", "success")}
          previewProps={{ upload: demoUpload, brand: <FormBrand logo="A" name="Acme" subtitle="智能家居" />, footer: "由 Acme 多维表格 提供 · 你的信息仅用于联系你" }}
          height="min(860px, calc(100dvh - 150px))"
        />
      </PageBody>
      <ConfirmDialog open={Boolean(deleting)} title={`删除题目「${deleting?.title ?? ""}」`} destructive confirmLabel="删除字段和数据"
        impact={`会删除「客户」表里的「${deleting?.title ?? ""}」字段和全部 1,284 条记录里的这一列数据，表单里的这一题也一起去掉。`}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          setForm(removeFormQuestion(form, deleting.key));
          setFields(fields.filter((f) => f.key !== deleting.key));
          setDeleting(null);
        }} />
    </>
  );
}
