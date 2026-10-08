// bt/builders-a：表单搭建器 / 公开填写页的演示数据（样稿 D08 / D18）。字段就是多维表格的字段（GridField）。
import { FORM_SUBMIT_LIMITS, type FormDefinition, type FormField, type FormSettings, type FormUploadAdapter } from "@adminui/react/form-builder";

export const FORM_FIELDS: FormField[] = [
  { key: "name", title: "客户名称", type: "text", primary: true },
  { key: "phone", title: "手机", type: "phone" },
  { key: "region", title: "地区", type: "singleSelect", options: [{ value: "sh", label: "上海" }, { value: "hz", label: "杭州" }, { value: "sz", label: "苏州" }, { value: "nj", label: "南京" }] },
  {
    key: "products",
    title: "想了解的产品",
    type: "multiSelect",
    options: [
      { value: "lock", label: "智能门锁", tone: "green" },
      { value: "light", label: "智能照明", tone: "teal" },
      { value: "curtain", label: "窗帘电机", tone: "yellow" },
      { value: "camera", label: "安防摄像", tone: "blue" },
      { value: "whole", label: "全屋方案", tone: "gray" },
    ],
  },
  { key: "files", title: "现场资料", type: "attachment" },
  {
    key: "budget",
    title: "预算",
    type: "singleSelect",
    options: [{ value: "b1", label: "¥10 万以下" }, { value: "b2", label: "¥10 万 – 20 万" }, { value: "b3", label: "¥20 万 – 50 万" }, { value: "b4", label: "¥50 万以上" }, { value: "b0", label: "还没想好" }],
  },
  { key: "contactAt", title: "方便联系的时间", type: "date" },
  { key: "owner", title: "负责人", type: "user" },
  { key: "intent", title: "意向", type: "rating" },
  { key: "expected", title: "预计金额", type: "money", currency: "¥", precision: 0 },
  { key: "deal", title: "成交价", type: "money", currency: "¥", precision: 0, locked: "有字段权限的字段：表单里只写不读" },
  { key: "nextAt", title: "下次跟进", type: "date" },
  { key: "source", title: "来源", type: "singleSelect", options: [{ value: "web", label: "官网" }, { value: "expo", label: "展会" }, { value: "ref", label: "转介绍" }] },
  { key: "no", title: "客户编号", type: "autoNumber" },
];

export const FORM_DEFINITION: FormDefinition = {
  title: "官网咨询表单",
  description: "留下联系方式，Acme 专属顾问会在 1 个工作日内联系您。想先了解产品，请看 Acme 智能家居官网。",
  successMessage: "顾问会在 1 个工作日内联系您",
  questions: [
    { field: "name", title: "您的称呼", required: true, placeholder: "例如：陈小姐" },
    { field: "phone", required: true, placeholder: "请输入手机号" },
    { field: "region" },
    { field: "products", required: true, description: "可多选，我们会按您选的产品准备资料" },
    {
      field: "files",
      title: "上传户型图",
      description: "户型图、现场照片、视频都可以，也可以直接录一段语音说明；单个文件不超过 2GB",
      condition: { id: "root", conjunction: "and", items: [{ id: "f1", field: "products", op: "hasAny", value: ["lock"] }] },
    },
    { field: "budget" },
    { field: "contactAt" },
  ],
};

export const FORM_SETTINGS: FormSettings = {
  submitLimit: "once",
  loginRequired: true,
  allowEditOwn: true,
  notify: [{ id: "u-lin", name: "林经理" }, { id: "u-zhou", name: "周组长" }, { id: "g-south", name: "华南销售群", kind: "group" }],
  audience: "anyone",
  collecting: true,
};
/** Hosts that turned on weekly / monthly limits pass all five. */
export const ALL_SUBMIT_LIMITS = FORM_SUBMIT_LIMITS.map((l) => l.value);

export const FORM_URL = "https://app.example.com/f/kH8x2Q";

/**
 * Fake storage: progress ticks; videos are slow, 「主卧」 files fail the first time (「网络中断，已保留文件」)
 * and succeed on 重试 (attempt 2). `window.__formUploadSpeed` (ms per 10%) lets tests speed it up.
 */
export const demoUpload: FormUploadAdapter = (file, { signal, onProgress, attempt }) =>
  new Promise((resolve, reject) => {
    const speed = (globalThis as { __formUploadSpeed?: number }).__formUploadSpeed ?? (file.type.startsWith("video/") ? 400 : 120);
    let progress = 0;
    const timer = setInterval(() => {
      progress += 10;
      onProgress(Math.min(progress, 100));
      if (file.name.includes("主卧") && attempt === 1 && progress >= 40) {
        clearInterval(timer);
        reject(new Error("网络中断，已保留文件"));
        return;
      }
      if (progress >= 100) {
        clearInterval(timer);
        resolve({ id: `file-${Date.now()}-${file.name}`, name: file.name, url: file.type.startsWith("image/") || file.type.startsWith("audio/") ? URL.createObjectURL(file) : undefined });
      }
    }, speed);
    signal.addEventListener("abort", () => {
      clearInterval(timer);
      reject(new DOMException("aborted", "AbortError"));
    });
  });
