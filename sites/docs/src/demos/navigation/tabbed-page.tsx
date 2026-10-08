// 分区页 TabbedPage：标签直接画在画布上，和下面的卡片左边对齐，选中没有浅底块。
// 去过的分区默认保持挂载（筛选、页码、没存的输入都在）；render 的 active 为 false 时暂停轮询。
import { useState } from "react";
import { Button, Panel, TabbedPage } from "@adminui/react";
import { PEOPLE } from "../../data/demo-data";

export function Demo() {
  const [section, setSection] = useState("members");
  return (
    <TabbedPage
      title="华东分公司"
      description="分公司的成员、部门和公司级设置。"
      value={section}
      onValueChange={setSection}
      sections={[
        { id: "overview", label: "概览" },
        { id: "members", label: "成员", count: PEOPLE.length },
        { id: "depts", label: "部门", count: 6 },
        { id: "invites", label: "邀请", count: 2, countTone: "attention" },
      ]}
      render={(id) =>
        id === "members" ? (
          <Panel title="成员" count={`${PEOPLE.length} 人`} actions={<Button size="sm">邀请成员</Button>}>
            <p className="aui-note">{PEOPLE.map((p) => p.name).join("、")}</p>
          </Panel>
        ) : (
          <Panel title="内容">
            <p className="aui-note">这个分区的内容。切回「成员」时，之前的状态还在。</p>
          </Panel>
        )
      }
    />
  );
}
