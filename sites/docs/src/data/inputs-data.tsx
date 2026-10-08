/**
 * Demo data for the 「输入与表单」 pages: a fake upload adapter (no network), placeholder photos drawn on a canvas
 * from the theme's own colours, and the form / field definitions shared by the form-builder demos.
 */
import { AlignLeft, AtSign, Calendar, CalendarClock, CircleDollarSign, CircleDot, ExternalLink, Hash, Link2, ListChecks, MapPin, MousePointerClick, Paperclip, Percent, Phone, Search, Sigma, SquareCheck, Star, Type, User, UserPlus } from "lucide-react";
import type { EditableOption, FieldTypeTile, UploadQueueAdapter, UploadResult } from "@adminui/react";
import type { FormDefinition, FormField, FormSettings } from "@adminui/react/form-builder";

/**
 * Fake upload: progress ticks every 160 ms. A file whose name contains 「失败」 fails once at 30% and resumes from
 * there on retry; names starting with 「大」 upload slowly.
 */
const resumeAt = new Map<string, number>();
export const fakeUpload: UploadQueueAdapter<UploadResult> = (file, { signal, onProgress, key, attempt }) =>
  new Promise((resolve, reject) => {
    let progress = resumeAt.get(key) ?? 0;
    const step = file.name.startsWith("大") ? 1.5 : 9;
    const timer = window.setInterval(() => {
      progress = Math.min(100, progress + step);
      onProgress(progress);
      if (file.name.includes("失败") && attempt === 1 && progress >= 30) {
        window.clearInterval(timer);
        resumeAt.set(key, 30);
        reject(new Error("网络中断，已传 30%，重试会接着传"));
      } else if (progress >= 100) {
        window.clearInterval(timer);
        resolve({ id: key, name: file.name, url: `https://files.example.com/${encodeURIComponent(file.name)}` });
      }
    }, 160);
    signal.addEventListener("abort", () => window.clearInterval(timer));
  });

/** Make demo files without asking the visitor to pick any (「模拟上传」 buttons). */
export const fakeFiles = (names: readonly string[], type = "application/pdf"): File[] =>
  names.map((name) => new File([new Uint8Array(180_000)], name, { type }));

/** Resolve a theme colour (CSS variable) to something a canvas understands. */
function themeColour(variable: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${variable})`;
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

/** A simple 「photo」 (sky + hill) in one of the option tones, as a data URL. Call it in the browser only. */
export function placeholderPhoto(tone: "blue" | "green" | "yellow" | "violet"): string {
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 240;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = themeColour(`--aui-option-${tone}-soft`);
  ctx.fillRect(0, 0, 240, 240);
  ctx.fillStyle = themeColour(`--aui-option-${tone}`);
  ctx.beginPath();
  ctx.arc(176, 64, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = themeColour(`--aui-option-${tone}-solid`);
  ctx.beginPath();
  ctx.moveTo(0, 240);
  ctx.lineTo(0, 170);
  ctx.quadraticCurveTo(80, 100, 150, 160);
  ctx.quadraticCurveTo(200, 200, 240, 150);
  ctx.lineTo(240, 240);
  ctx.closePath();
  ctx.fill();
  return canvas.toDataURL("image/png");
}

// ---------------------------------------------------------------- forms (FormBuilder / PublicForm)

export const FORM_FIELDS: FormField[] = [
  { key: "name", title: "联系人", type: "text", primary: true },
  { key: "company", title: "公司名称", type: "text" },
  { key: "phone", title: "手机", type: "phone" },
  { key: "city", title: "所在城市", type: "singleSelect", options: [{ value: "sh", label: "上海" }, { value: "hz", label: "杭州" }, { value: "sz", label: "深圳" }, { value: "cd", label: "成都" }] },
  {
    key: "modules",
    title: "想了解的模块",
    type: "multiSelect",
    options: [
      { value: "crm", label: "客户管理", tone: "blue" },
      { value: "ticket", label: "工单", tone: "green" },
      { value: "bi", label: "数据看板", tone: "violet" },
      { value: "api", label: "开放接口", tone: "yellow" },
    ],
  },
  { key: "seats", title: "预计席位", type: "singleSelect", options: [{ value: "s1", label: "50 人以下" }, { value: "s2", label: "50 – 200 人" }, { value: "s3", label: "200 人以上" }] },
  { key: "files", title: "需求文档", type: "attachment" },
  { key: "demoAt", title: "方便演示的日期", type: "date" },
  { key: "owner", title: "负责人", type: "user" },
  { key: "amount", title: "预计金额", type: "money", currency: "¥", precision: 0 },
  { key: "no", title: "线索编号", type: "autoNumber" },
];

export const FORM_DEFINITION: FormDefinition = {
  title: "预约产品演示",
  description: "留下联系方式，北辰云的顾问会在 1 个工作日内联系你，安排 30 分钟的线上演示。",
  successMessage: "顾问会在 1 个工作日内联系你",
  questions: [
    { field: "name", title: "你的称呼", required: true, placeholder: "例如：林女士" },
    { field: "company", required: true },
    { field: "phone", required: true },
    { field: "city" },
    { field: "modules", required: true, description: "可多选，我们会按你选的模块准备演示" },
    {
      field: "files",
      title: "上传需求文档",
      description: "选了「开放接口」才出现：接口清单、对接说明都可以",
      condition: { id: "root", conjunction: "and", items: [{ id: "c1", field: "modules", op: "hasAny", value: ["api"] }] },
    },
    { field: "seats" },
    { field: "demoAt" },
  ],
};

export const FORM_SETTINGS: FormSettings = {
  submitLimit: "unlimited",
  loginRequired: false,
  allowEditOwn: false,
  notify: [{ id: "u01", name: "林晓" }, { id: "g-sales", name: "销售部", kind: "group" }],
  audience: "anyone",
  collecting: true,
};

export const FORM_URL = "https://forms.example.com/f/demo-booking";

// ---------------------------------------------------------------- field types (FieldDialog / FieldTypePicker)

export type DemoFieldType =
  | "text" | "longText" | "number" | "money" | "percent" | "date" | "checkbox" | "singleSelect" | "multiSelect" | "rating"
  | "user" | "phone" | "email" | "url" | "attachment" | "link" | "lookup" | "rollup" | "autoNumber" | "createdBy" | "createdAt";

export const FIELD_TYPES: FieldTypeTile<DemoFieldType>[] = [
  { label: "文本", icon: <Type />, value: "text" },
  { label: "多行文本", icon: <AlignLeft />, value: "longText" },
  { label: "数字", icon: <Hash />, value: "number" },
  { label: "货币", icon: <CircleDollarSign />, value: "money", example: "¥86,000" },
  { label: "百分比", icon: <Percent />, value: "percent" },
  { label: "日期", icon: <Calendar />, value: "date" },
  { label: "复选框", icon: <SquareCheck />, value: "checkbox" },
  { label: "单选", icon: <CircleDot />, value: "singleSelect", keywords: "select 下拉" },
  { label: "多选", icon: <ListChecks />, value: "multiSelect", keywords: "select 标签" },
  { label: "评分", icon: <Star />, value: "rating" },
  { label: "人员", icon: <User />, value: "user" },
  { label: "电话", icon: <Phone />, value: "phone", example: "138 0013 8000" },
  { label: "邮箱", icon: <AtSign />, value: "email" },
  { label: "超链接", icon: <ExternalLink />, value: "url" },
  { label: "附件", icon: <Paperclip />, value: "attachment" },
  { label: "关联", icon: <Link2 />, value: "link" },
  { label: "查找引用", icon: <Search />, value: "lookup" },
  { label: "汇总", icon: <Sigma />, value: "rollup" },
  { label: "自动编号", icon: <Hash />, value: "autoNumber" },
  { label: "创建人", icon: <UserPlus />, value: "createdBy" },
  { label: "创建时间", icon: <CalendarClock />, value: "createdAt" },
  { label: "公式", icon: <Sigma />, later: "接入计算引擎之后" },
  { label: "按钮", icon: <MousePointerClick />, later: "接入自动化之后" },
  { label: "地理位置", icon: <MapPin />, later: "以后" },
];
export const OPTION_TYPES: readonly DemoFieldType[] = ["singleSelect", "multiSelect"];

export const LEVEL_OPTIONS: EditableOption[] = [
  { id: "olevel1", label: "普通", tone: "gray" },
  { id: "olevel2", label: "重点", tone: "blue" },
  { id: "olevel3", label: "战略", tone: "violet" },
  { id: "olevel4", label: "老客户转介绍", tone: "green" },
];
/** Option id → records using it: 「61 条」 on the right; deleting one in use asks first. */
export const LEVEL_USAGE: Readonly<Record<string, number>> = { olevel1: 61, olevel2: 24, olevel3: 9, olevel4: 4 };
