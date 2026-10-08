import { useState } from "react";
import { CommentThread, type CommentDraft, type CommentItem } from "@adminui/react";
import { DOC_COMMENTS, ME, searchPeople } from "../../data/collab-data";

/**
 * 文档划词评论：每条线程挂在一段原文上（quote）；点线程 → onSelect 让正文滚到那段，当前线程高亮（activeId）。
 * 整页评论 state="page"，原文被删了 state="orphaned" 显示「原文已删除」。
 */
const PARAGRAPHS = [
  { id: "k1", text: "超过 30 天未登录的席位会在下个账单周期自动回收" },
  { id: "p2", text: "新增席位按剩余天数折算，当月账单一并结算。" },
];

export function Demo() {
  const [items, setItems] = useState<CommentItem[]>(DOC_COMMENTS);
  const [active, setActive] = useState<string | null>("k1");
  const send = async (d: CommentDraft) => {
    const item: CommentItem = { id: `n${Date.now()}`, author: ME, createdAt: new Date().toISOString(), body: d.body, mentions: d.mentions };
    setItems((all) => (d.replyTo ? all.map((c) => (c.id === d.replyTo ? { ...c, replies: [...(c.replies ?? []), item] } : c)) : [{ ...item, quote: { text: "", state: "page" } }, ...all]));
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 16, alignItems: "start" }}>
      <article className="aui-stack" aria-label="席位计费说明">
        <h3>席位计费说明</h3>
        {PARAGRAPHS.map((p) => (
          <p key={p.id}>{active === p.id ? <mark>{p.text}</mark> : p.text}</p>
        ))}
      </article>
      <div style={{ height: 460 }}>
        <CommentThread
          fill
          title="页面评论"
          comments={items}
          viewerId={ME.id}
          viewerName={ME.name}
          defaultFilter="all"
          filters={["all", "open", "mine", "resolved"]}
          activeId={active}
          onSelect={setActive}
          onSend={send}
          searchMentions={searchPeople}
        />
      </div>
    </div>
  );
}
