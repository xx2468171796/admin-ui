import { useState } from "react";
import { BookOpen } from "lucide-react";
import { SourcedAnswer, SuggestionReview, useNotify, type FieldSuggestion } from "@adminui/react";
import { SUGGESTIONS } from "../../data/collab-data";

/**
 * 一次 AI 分析的结果：建议更新（采用 / 忽略 / 撤销 / 全部采用——点了采用才写进记录），
 * 和有出处的回答（句末 [1] [2] 对上出处，复制时不带编号）。
 */
const wait = () => new Promise((r) => setTimeout(r, 400));

export function Demo() {
  const notify = useNotify();
  const [items, setItems] = useState<FieldSuggestion[]>(SUGGESTIONS);
  const mark = (id: string, state: FieldSuggestion["state"]) => setItems((list) => list.map((s) => (s.id === id ? { ...s, state } : s)));
  const open = (label: string) => notify(`打开「${label}」`, "info");
  return (
    <div className="aui-stack" style={{ maxWidth: 640 }}>
      <SuggestionReview
        items={items}
        onAccept={async (s) => {
          await wait();
          mark(s.id, "applied");
        }}
        onIgnore={(s) => mark(s.id, "ignored")}
        onUndo={(s) => mark(s.id, "pending")}
      />
      <SourcedAnswer
        tone="attention"
        title="客户担心数据导出"
        quote
        copyable
        answer="导出在管理后台就有[1]，也可以设成每季度自动归档到客户自己的存储[1,2]。"
        sources={[
          { id: "m1", label: "管理员手册 · 数据导出 p.12", title: "打开原文第 12 页" },
          { id: "c1", label: "成功案例 · 季度归档", title: "打开案例" },
        ]}
        onOpenSource={(s) => open(s.label)}
      />
      <SourcedAnswer
        tone="attention"
        title="客户关注单点登录"
        collapsible
        defaultOpen={false}
        answer="支持标准的单点登录协议[1]，切换当天可以安排工程师在线陪同。"
        sources={[{ id: "t1", label: "知识库 · 单点登录接入", icon: <BookOpen /> }]}
        onOpenSource={(s) => open(s.label)}
      />
    </div>
  );
}
