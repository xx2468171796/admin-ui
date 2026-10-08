import { useRef, useState } from "react";
import { GrantList, type GrantEntry } from "@adminui/react";
import { SHARE_PEOPLE } from "../../data/collab-data";

/**
 * 页面权限：GrantList mode="picked" + apply="instant"——没有保存按钮，改一项立即生效；负责人锁住去不掉。
 * 第一次给「可管理」演示保存失败：改回原值，行内写原因 + 重试。
 */
const LEVELS = [
  { value: "view", label: "可查看" },
  { value: "comment", label: "可评论" },
  { value: "edit", label: "可编辑" },
  { value: "manage", label: "可管理" },
];
const OWNER = { id: "u02", name: "陈一鸣", tag: "负责人", hint: "华东销售组 · 默认能管，去不掉", level: "manage" };

export function Demo() {
  const [value, setValue] = useState<GrantEntry[]>([{ id: "u06", level: "view" }, { id: "g1", level: "edit" }]);
  const failedOnce = useRef(false);
  return (
    <GrantList
      mode="picked"
      label="页面权限"
      subjects={SHARE_PEOPLE}
      value={value}
      onChange={setValue}
      levels={LEVELS}
      levelPicker="menu"
      locked={[OWNER]}
      addPlaceholder="添加人、部门或角色"
      summary={<>共 <b>{value.length + 1}</b> 个人或组能看这个页面</>}
      apply="instant"
      onApply={async (change) => {
        await new Promise((r) => setTimeout(r, 400));
        if (change.type === "level" && change.level === "manage" && !failedOnce.current) {
          failedOnce.current = true;
          throw new Error("只有空间管理员能给「可管理」");
        }
      }}
    />
  );
}
