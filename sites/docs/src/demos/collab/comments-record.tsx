import { useState } from "react";
import {
  CommentThread, DescriptionList, Panel, patchComment, removeComment, toggleReaction, useNotify,
  type CommentDraft, type CommentFilter, type CommentItem, type CommentPerson, type MediaItem,
} from "@adminui/react";
import { ME, RECORD_COMMENTS, searchPeople } from "../../data/collab-data";

/**
 * 记录详情右栏的评论：评论栏自己滚、输入框贴底；悬停一条评论出小工具（回应 · 回复 · 解决 · ⋯）；
 * 打 @ 出选人（「外部顾问」看不到这条记录，灰掉不能选）；Ctrl + Enter 发送。正文含「失败」演示发送失败。
 */
const wait = () => new Promise((r) => setTimeout(r, 300));

export function Demo() {
  const notify = useNotify();
  const [items, setItems] = useState<CommentItem[]>(RECORD_COMMENTS);
  const [filter, setFilter] = useState<CommentFilter>("open");
  const own = (c: CommentItem) => c.author.id === ME.id;

  const send = async (d: CommentDraft) => {
    await wait();
    if (d.body.includes("失败")) throw new Error("没发出去：网络中断，文字已保留");
    const item: CommentItem = { id: `n${Date.now()}`, author: ME, createdAt: new Date().toISOString(), body: d.body, mentions: d.mentions, attachments: d.attachments, canEdit: true, canDelete: true };
    setItems((all) => (d.replyTo ? all.map((c) => (c.id === d.replyTo ? { ...c, replies: [...(c.replies ?? []), item] } : c)) : [item, ...all]));
  };
  const edit = async (id: string, body: string, mentions: CommentPerson[], extra: { attachments: MediaItem[] }) => {
    await wait();
    setItems((all) => patchComment(all, id, (c) => ({ ...c, body, mentions, attachments: extra.attachments, editedAt: new Date().toISOString() })));
  };
  const remove = async (id: string) => {
    await wait();
    // 有回复的留一条墓碑「评论已删除」，回复保留
    setItems((all) => removeComment(all, id, { tombstone: Boolean(all.find((c) => c.id === id)?.replies?.length) }));
    notify("评论已删除", "success");
  };
  const react = (id: string, key: string) => setItems((all) => patchComment(all, id, (c) => ({ ...c, reactions: toggleReaction(c.reactions, key) })));
  const resolve = (id: string, resolved: boolean) => setItems((all) => all.map((c) => (c.id === id ? { ...c, resolved, resolvedBy: resolved ? ME.name : undefined } : c)));
  const upload = async (files: File[]) => files.map((f, i) => ({ id: `up${Date.now()}${i}`, name: f.name, size: f.size, mime: f.type }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 16, alignItems: "start" }}>
      <Panel title="远航精密制造">
        <DescriptionList
          columns={1}
          items={[
            { label: "阶段", value: "方案报价" },
            { label: "席位", value: "200 个 · 活跃 168" },
            { label: "续约日期", value: "2026-11-30" },
            { label: "负责人", value: "陈一鸣" },
          ]}
        />
      </Panel>
      <div style={{ height: 560 }}>
        <CommentThread
          fill
          comments={items}
          viewerId={ME.id}
          viewerName={ME.name}
          filter={filter}
          onFilterChange={setFilter}
          onSend={send}
          onEdit={edit}
          onDelete={remove}
          onReact={react}
          onResolve={resolve}
          onUpload={upload}
          canEdit={own}
          canDelete={own}
          searchMentions={searchPeople}
        />
      </div>
    </div>
  );
}
