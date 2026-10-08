// 列表 + 详情 ListDetailLayout（放在一张 flush Panel 里）：桌面两栏；窄屏先列表，点一行滑进详情，← 回列表。
// 不要再做「换角色」按钮，也不要上下叠成一张长卡。
import { useState } from "react";
import { ListDetailLayout, Pane, Panel, SelectList } from "@adminui/react";

const ROLES = [
  { key: "rep", title: "客户经理", hint: "5 人 · 只看自己的客户", group: "本公司" },
  { key: "lead", title: "销售组长", hint: "2 人 · 看整组", group: "本公司" },
  { key: "director", title: "销售总监", hint: "1 人 · 看部门及下级", group: "本公司" },
  { key: "owner", title: "公司管理员", hint: "全部权限", group: "内置 · 只读" },
];

export function Demo() {
  const [selected, setSelected] = useState("rep");
  const [detailOpen, setDetailOpen] = useState(false);
  const role = ROLES.find((r) => r.key === selected) ?? ROLES[0];
  return (
    <Panel title="角色与权限" count={`${ROLES.length} 个`} flush>
      <ListDetailLayout
        minHeight={320}
        detailOpen={detailOpen}
        onBack={() => setDetailOpen(false)}
        backLabel="返回角色"
        detailTitle={role?.title}
        list={<SelectList label="角色" search="搜角色" items={ROLES} selected={selected} onSelect={(key) => { setSelected(key); setDetailOpen(true); }} />}
      >
        <Pane title={role?.title} hint={role?.hint} padding="md" bare>
          <p className="aui-note">这里放这个角色的权限矩阵。</p>
        </Pane>
      </ListDetailLayout>
    </Panel>
  );
}
