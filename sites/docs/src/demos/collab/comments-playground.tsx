import { useState } from "react";
import { CommentThread, patchComment, toggleReaction, type CommentDraft, type CommentFilter, type CommentItem } from "@adminui/react";
import { ME, RECORD_COMMENTS, searchPeople } from "../../data/collab-data";

type Props = { defaultFilter?: string; readOnly?: boolean; groupByDay?: boolean; title?: string; placeholder?: string };

/** 在线调试：默认分段、只读、按天分隔、标题。改「默认分段」会重新挂载评论栏。 */
export function Demo({ defaultFilter = "open", readOnly = false, groupByDay = true, title = "评论", placeholder = "写评论，@ 提到同事" }: Props) {
  const [items, setItems] = useState<CommentItem[]>(RECORD_COMMENTS);
  const send = async (d: CommentDraft) => {
    const item: CommentItem = { id: `n${Date.now()}`, author: ME, createdAt: new Date().toISOString(), body: d.body, mentions: d.mentions };
    setItems((all) => (d.replyTo ? all.map((c) => (c.id === d.replyTo ? { ...c, replies: [...(c.replies ?? []), item] } : c)) : [item, ...all]));
  };
  return (
    <div style={{ height: 520, maxWidth: 480, margin: "0 auto" }}>
      <CommentThread
        key={defaultFilter}
        fill
        title={title || null}
        comments={items}
        viewerId={ME.id}
        viewerName={ME.name}
        defaultFilter={defaultFilter as CommentFilter}
        filters={["all", "open", "mine", "resolved"]}
        readOnly={readOnly}
        groupByDay={groupByDay}
        placeholder={placeholder}
        onSend={send}
        onReact={(id, key) => setItems((all) => patchComment(all, id, (c) => ({ ...c, reactions: toggleReaction(c.reactions, key) })))}
        onResolve={(id, resolved) => setItems((all) => all.map((c) => (c.id === id ? { ...c, resolved } : c)))}
        searchMentions={searchPeople}
      />
    </div>
  );
}
