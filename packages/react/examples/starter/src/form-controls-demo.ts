import type { OptionTone, SelectItem } from "@adminui/react";

// 「表单控件」页的演示选项（智能家居客户表里的真实选项名，配色按 10 色）。
export const NOW = new Date(2026, 9, 7, 10, 0); // 演示固定在 2026-10-07（周三）10:00
export const now = () => NOW;

export const STAGES: SelectItem[] = [
  { value: "s1", label: "首通", tone: "blue", group: "进行中", hint: "1 天" },
  { value: "s2", label: "需求确认", tone: "teal", group: "进行中", hint: "3 天" },
  { value: "s3", label: "报价", tone: "yellow", group: "进行中" },
  { value: "s4", label: "谈判", tone: "orange", group: "进行中" },
  { value: "s5", label: "成交", tone: "greenSolid", group: "已结束" },
  { value: "s6", label: "装机", tone: "olive", group: "已结束" },
  { value: "s7", label: "回访", tone: "violet", group: "已结束" },
  { value: "s8", label: "丢单", tone: "red", group: "已结束", disabledReason: "要先填丢单原因" },
];
export const STAGES_FLAT: SelectItem[] = STAGES.map(({ group: _group, hint: _hint, disabledReason: _reason, ...rest }) => rest);

export const REGIONS: SelectItem[] = [
  { value: "r1", label: "上海", tone: "blue" },
  { value: "r2", label: "杭州", tone: "teal" },
  { value: "r3", label: "南京", tone: "green" },
  { value: "r4", label: "苏州", tone: "yellow" },
  { value: "r5", label: "宁波", tone: "orange" },
  { value: "r6", label: "广州", tone: "pink" },
  { value: "r7", label: "深圳", tone: "violet" },
  { value: "r8", label: "其他", tone: "gray" },
];

export const PRODUCTS: SelectItem[] = [
  { value: "p1", label: "智能门锁", tone: "green" },
  { value: "p2", label: "窗帘", tone: "teal" },
  { value: "p3", label: "照明", tone: "yellow" },
  { value: "p4", label: "安防", tone: "red" },
  { value: "p5", label: "影音", tone: "violet" },
  { value: "p6", label: "空调", tone: "blue" },
  { value: "p7", label: "地暖", tone: "orange" },
  { value: "p8", label: "网络", tone: "gray" },
];

export const PEOPLE: SelectItem[] = [
  { value: "u1", label: "小王", avatar: "王", hint: "销售一组", keywords: "xiaowang" },
  { value: "u2", label: "小李", avatar: "李", hint: "销售一组", keywords: "xiaoli" },
  { value: "u3", label: "陈组长", avatar: "长", hint: "销售一组 · 主管", keywords: "chen" },
  { value: "u4", label: "管理员", avatar: "员", hint: "总部", keywords: "admin" },
];

export const STATUS: SelectItem[] = [
  { value: "t1", label: "待分配", tone: "gray" },
  { value: "t2", label: "跟进中", tone: "blue" },
  { value: "t3", label: "已成交", tone: "green" },
  { value: "t4", label: "无效", tone: "red" },
];

export const OPERATORS: SelectItem[] = [
  { value: "is", label: "是" },
  { value: "not", label: "不是" },
  { value: "any", label: "是其中之一" },
  { value: "empty", label: "为空" },
  { value: "filled", label: "不为空" },
];

/** 旧 7 色名 → 新色（同一组标签，用来对照「旧数据不用迁移」）。 */
export const LEGACY_SAMPLE: { label: string; tone: OptionTone }[] = [
  { label: "brand", tone: "green" },
  { label: "brandMid", tone: "teal" },
  { label: "info", tone: "blue" },
  { label: "warning", tone: "yellow" },
  { label: "danger", tone: "red" },
  { label: "neutral", tone: "gray" },
  { label: "solid", tone: "greenSolid" },
];

/** 色板上每个颜色配的示例标签。 */
export const SAMPLE_OF: Record<string, string> = {
  green: "官网表单", teal: "需求确认", blue: "首通", violet: "转介绍", pink: "影音", red: "丢单", orange: "谈判", yellow: "报价", olive: "装机", gray: "其他",
};
