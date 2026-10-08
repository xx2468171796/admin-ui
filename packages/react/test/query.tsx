import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AdminProvider, Choice, QueryBar } from "../src/index.ts";
import "../src/styles.css";
/**
 * Adversarial query harness: a real user list filters on five dimensions. At 390 the
 * selects must stay readable (wrap) instead of shrinking to the bare chevron.
 */
const filters = [
  { id: "role", label: "角色", options: ["全部角色", "管理员", "普通玩家"] },
  { id: "status", label: "账号状态", options: ["全部状态", "正常", "停用"] },
  { id: "recharge", label: "充值情况", options: ["全部充值", "已充值", "未充值"] },
  { id: "member", label: "会员等级", options: ["全部等级", "LV1 以上", "LV5 以上"] },
  { id: "opens", label: "开箱数", options: ["全部开箱数", "100 次以上", "无开箱"] },
];
function Harness() {
  const [search, setSearch] = useState("");
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(filters.map((f) => [f.id, f.options[0]!])),
  );
  return (
    <div className="aui-content">
      <QueryBar
        value={search}
        onChange={setSearch}
        onSearch={() => {}}
        onReset={() => setSearch("")}
      >
        {filters.map((filter) => (
          <Choice
            key={filter.id}
            label={filter.label}
            value={values[filter.id] ?? filter.options[0]!}
            options={filter.options.map((option) => ({
              value: option,
              label: option,
            }))}
            onChange={(next) =>
              setValues((current) => ({ ...current, [filter.id]: next }))
            }
          />
        ))}
      </QueryBar>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <AdminProvider storageKey="test-query">
    <Harness />
  </AdminProvider>,
);
