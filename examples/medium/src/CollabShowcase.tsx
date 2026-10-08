import { useState } from "react";
import {
  CellTags, ChangeValue, CommentThread, DescriptionList, PageBody, PageHeader, Panel, patchComment, removeComment, toggleReaction, useNotify,
  type CommentDraft, type CommentFilter, type CommentItem, type CommentPerson, type MediaItem,
} from "@adminui/react";
import { demoPhoto } from "./media-demo";

// 协作与分享：评论 CommentThread 是唯一的评论实现——
// 记录详情右栏、知识库划词评论都用它；所有「改前 → 改后」都用 ChangeValue。分享弹窗 / 公开页在「分享与历史」，审批在「审批」。
// 数据都在内存里；真实项目接服务端（CommentThreadAdapter）。

const ME = { id: "u-wang", name: "小王" };
const PEOPLE: CommentPerson[] = [
  { id: "u-wang", name: "小王", hint: "销售一组 · 负责人" },
  { id: "u-chen", name: "陈主管", hint: "销售一组 · 主管" },
  { id: "u-zhou", name: "周组长", hint: "销售二组" },
  { id: "u-li", name: "小李", hint: "销售一组" },
  { id: "u-lin", name: "林经理", hint: "智能家居线" },
  { id: "u-ming", name: "阿明", hint: "技术 · 安装" },
  { id: "u-ning", name: "林宁", unavailable: "看不到这条记录，提到也收不到" },
];
const person = (id: string) => PEOPLE.find((p) => p.id === id) ?? { id, name: id };
const today = (h: number, m: number) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };
const yesterday = (h: number, m: number) => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(h, m, 0, 0); return d.toISOString(); };

const FIRST: CommentItem[] = [
  { id: "c1", author: person("u-zhou"), createdAt: today(15, 2), body: "@小王 客户说周六想看样品间，记得带 KNX 面板和窗帘电机样品", mentions: [ME],
    reactions: [{ key: "ok", count: 2, mine: true, names: ["小王", "小李"] }, { key: "like", count: 1, names: ["陈主管"] }],
    replies: [{ id: "c1r", author: ME, createdAt: today(15, 10), body: "约好周六 10 点，样品间照片先发给客户看了", canEdit: true, canDelete: true,
      attachments: [{ id: "p1", name: "样品间-客厅.jpg", kind: "image", url: demoPhoto(0), thumbUrl: demoPhoto(0) }, { id: "p2", name: "样品间-主卧.jpg", kind: "image", url: demoPhoto(1), thumbUrl: demoPhoto(1) }] }] },
  { id: "c2", author: person("u-chen"), createdAt: today(14, 31), body: "报价单 v2 我看过了，折扣最多 6%，再多要找 @林经理", mentions: [person("u-lin")],
    attachments: [{ id: "f1", name: "报价单-赵静怡-v2.pdf", kind: "pdf", size: 1_258_291 }], reactions: [{ key: "seen", count: 1, names: ["周组长"] }],
    replies: [
      { id: "c2r1", author: ME, createdAt: today(14, 40), body: "收到，先按 94 折报", canEdit: true, canDelete: true },
      { id: "c2r2", author: person("u-lin"), createdAt: today(14, 52), body: "可以，门锁送安装", reactions: [{ key: "like", count: 1, mine: true, names: ["小王"] }] },
      { id: "c2r3", author: person("u-chen"), createdAt: today(14, 55), body: "好，按这个出 v3" },
    ] },
  { id: "c3", author: person("u-li"), createdAt: today(11, 20), editedAt: today(11, 24), body: "赵小姐想把门锁换成人脸款，@阿明 帮忙确认一下上海仓库存", mentions: [person("u-ming")],
    reactions: [{ key: "question", count: 1, names: ["阿明"] }] },
  { id: "c4", author: { id: "u-a", name: "小A" }, createdAt: yesterday(23, 30), body: "客户电话已核实，不是重复进线", resolved: true, resolvedBy: "小B" },
  { id: "c5", author: ME, createdAt: yesterday(18, 20), body: "我先报 9 折，等主管意见", canEdit: true, canDelete: true,
    replies: [{ id: "c5r", author: person("u-chen"), createdAt: yesterday(18, 31), body: "9 折不行，最多 94 折" }] },
];

// 知识库划词评论：线程挂在一段原文上（quote），点线程让正文滚到划词（onSelect），当前线程高亮（activeId）；原文删了标「原文已删除」。
const KNOWLEDGE: CommentItem[] = [
  { id: "k1", author: person("u-lin"), createdAt: today(10, 12), quote: { text: "窗帘电机断网后仍可本地控制，最长保留 72 小时的定时" }, body: "72 小时是哪个型号？@小王 确认一下", mentions: [ME] },
  { id: "k2", author: person("u-chen"), createdAt: today(9, 40), quote: { text: "", state: "page" }, body: "整页的价格表下个月要换新版" },
  { id: "k3", author: person("u-zhou"), createdAt: yesterday(17, 5), quote: { text: "门锁保修两年，人脸款三年", state: "orphaned" }, body: "这段被删了，保修期写到哪里去了？" },
];

function useThread(first: CommentItem[]) {
  const notify = useNotify();
  const [items, setItems] = useState(first);
  const wait = () => new Promise((r) => setTimeout(r, 200));
  return {
    comments: items,
    onSend: async (d: CommentDraft) => {
      await wait();
      if (d.body.includes("失败")) throw new Error("没发出去：网络中断，文字已保留");
      const item: CommentItem = { id: `n${Date.now()}`, author: ME, createdAt: new Date().toISOString(), body: d.body, mentions: d.mentions, attachments: d.attachments, canEdit: true, canDelete: true };
      setItems((all) => (d.replyTo ? all.map((c) => (c.id === d.replyTo ? { ...c, replies: [...(c.replies ?? []), item] } : c)) : [item, ...all]));
    },
    onEdit: async (id: string, body: string, mentions: CommentPerson[], extra: { attachments: MediaItem[] }) => {
      await wait();
      if (body.includes("失败")) throw new Error("保存失败：网络中断，改动已保留");
      setItems((all) => patchComment(all, id, (c) => ({ ...c, body, mentions, attachments: extra.attachments, editedAt: new Date().toISOString() })));
    },
    onDelete: async (id: string) => {
      await wait();
      setItems((all) => removeComment(all, id, { tombstone: Boolean(all.find((c) => c.id === id)?.replies?.length) }));
      notify("评论已删除", "success");
    },
    onReact: (id: string, key: string) => setItems((all) => patchComment(all, id, (c) => ({ ...c, reactions: toggleReaction(c.reactions, key).map((r) => (r.key === key ? { ...r, names: r.mine ? [...(r.names ?? []), ME.name] : (r.names ?? []).filter((n) => n !== ME.name) } : r)) }))),
    onResolve: (id: string, resolved: boolean) => setItems((all) => all.map((c) => (c.id === id ? { ...c, resolved, resolvedBy: resolved ? ME.name : undefined } : c))),
    onUpload: async (files: File[]) => files.map((f, i) => ({ id: `up${Date.now()}${i}`, name: f.name, size: f.size, mime: f.type })),
    searchMentions: (q: string) => PEOPLE.filter((p) => p.name.includes(q)),
  };
}

export function CollabShowcase() {
  const record = useThread(FIRST);
  const knowledge = useThread(KNOWLEDGE);
  const [filter, setFilter] = useState<CommentFilter>("open");
  const [active, setActive] = useState<string | null>("k1");
  const notify = useNotify();
  const own = (c: CommentItem) => c.author.id === ME.id;
  return (
    <>
      <PageHeader title="协作与分享" description="评论（记录详情右栏 / 知识库划词）和「改前 → 改后」。分享弹窗与公开页在「分享与历史」，审批在「审批」。" />
      <PageBody>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 16, alignItems: "start" }}>
          <Panel title="赵静怡（徐汇区别墅）" description="记录详情右栏的评论：评论栏自己滚、输入框贴底；悬停一条评论出小工具；打 @ 出选人；Ctrl + Enter 发送。">
            <DescriptionList items={[
              { label: "手机", value: "139-****-5781" },
              { label: "地区 · 来源", value: <CellTags items={[{ label: "上海", tone: "blue" }, { label: "转介绍", tone: "teal" }]} /> },
              { label: "预计金额", value: "¥2,180,000" },
              { label: "下次跟进", value: "10月9日 周五 · 2 天后" },
              { label: "需求", value: "别墅三层，想做全屋：门锁、窗帘电机、照明场景。太太在意老人好用和断网时还能用。" },
            ]} />
          </Panel>
          <div style={{ height: 640 }}>
            <CommentThread {...record} fill viewerId={ME.id} viewerName={ME.name} canEdit={own} canDelete={own} filter={filter} onFilterChange={setFilter} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 16, alignItems: "start", marginTop: 16 }}>
          <div style={{ height: 460 }}>
            <CommentThread title="页面评论" {...knowledge} fill viewerId={ME.id} viewerName={ME.name} canEdit={own} canDelete={own} defaultFilter="all" filters={["all", "open", "mine", "resolved"]}
              activeId={active} onSelect={(id) => { setActive(id); notify("正文滚到这段划词并闪一下", "info"); }} />
          </div>
          <Panel title="改前 → 改后（ChangeValue）" description="修改历史、操作记录、AI 建议、冲突、权限对比都是这一种写法：旧值灰色删除线 → 新值加粗。">
            <DescriptionList items={[
              { label: "预计金额", value: <ChangeValue before="¥1,980,000" after="¥2,180,000" /> },
              { label: "阶段", value: <ChangeValue before={<CellTags items={[{ label: "跟进中", tone: "blue" }]} />} after={<CellTags items={[{ label: "已成交", tone: "green" }]} />} /> },
              { label: "下次跟进", value: <ChangeValue before={null} after="10月9日" /> },
              { label: "折扣", value: <ChangeValue before="6" after="12" unit="%" /> },
              { label: "备注", value: <ChangeValue before="客户周六看样品间" after="" /> },
            ]} />
          </Panel>
          <Panel title="空的时候">
            <div style={{ height: 460 }}>
              <CommentThread title="空状态" comments={[]} onSend={async () => {}} searchMentions={record.searchMentions} defaultFilter="all" fill />
            </div>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
