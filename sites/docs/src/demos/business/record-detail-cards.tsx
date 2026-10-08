import { useState } from "react";
import { Mail, MapPin, MessageSquare, Phone, Video } from "lucide-react";
import {
  ActivityComposer, ActivityFeed, Button, CommentThread, Input, RecordDetail, RowActions, defaultRecordDetailSpec, useNotify,
  type ActivityKind, type CommentDraft, type CommentItem, type RecordField, type RecordStage,
} from "@adminui/react";
import { DEAL_DAYS, DEAL_FIELDS, DEAL_SECTIONS, DEAL_STEPS, DEALS, FIRST_COMMENTS, FOLLOW_UPS, dealKeyNumbers, type Deal } from "../../data/business-data";

// 卡片分区：阶段 + 关键数在顶上，左栏「跟进」「评论」（宿主画的块），右栏字段分区卡片。
// 点阶段直接改；「需求说明」点值就地编辑；空字段收成一行「N 个空字段已收起 · 显示」。

const KINDS: ActivityKind[] = [
  { value: "phone", label: "电话", icon: Phone }, { value: "visit", label: "拜访", icon: MapPin },
  { value: "video", label: "视频会", icon: Video }, { value: "mail", label: "邮件", icon: Mail },
];
const SPEC = defaultRecordDetailSpec({ fields: DEAL_FIELDS.map((f) => f.key), slots: ["activity", "comments"], stage: true, keyNumbers: true, sections: DEAL_SECTIONS });

function NeedEditor({ initial, label, onSave, onDone }: { initial: string; label: string; onSave: (v: string) => void; onDone: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <Input autoFocus aria-label={label} value={value} onChange={(e) => setValue(e.currentTarget.value)} onBlur={onDone}
      onKeyDown={(e) => { if (e.key === "Enter") { onSave(value); onDone(); } if (e.key === "Escape") onDone(); }} />
  );
}

export function Demo() {
  const notify = useNotify();
  const [index, setIndex] = useState(0);
  const [patch, setPatch] = useState<Record<string, Partial<Deal>>>({});
  const [stageOf, setStageOf] = useState<Record<string, string>>({ [DEALS[0]?.id ?? ""]: "proposal" });
  const [following, setFollowing] = useState(true);
  const [kind, setKind] = useState("phone");
  const [draft, setDraft] = useState("");
  const [due, setDue] = useState("");
  const [comments, setComments] = useState<CommentItem[]>(FIRST_COMMENTS);

  const base = DEALS[index] ?? DEALS[0];
  if (!base) return null;
  const deal: Deal = { ...base, ...patch[base.id] };
  const current = stageOf[deal.id] ?? "lead";

  const fields: RecordField<Deal>[] = DEAL_FIELDS.map((f) => f.key !== "need" ? f : {
    ...f,
    edit: (d) => ({ render: (ctx) => <NeedEditor initial={d.need} label={ctx.label} onDone={ctx.done} onSave={(need) => setPatch((all) => ({ ...all, [d.id]: { ...all[d.id], need } }))} /> }),
  });
  const at = DEAL_STEPS.findIndex((s) => s.id === current);
  const stage: RecordStage = {
    steps: DEAL_STEPS.map((s) => ({ ...s, days: DEAL_DAYS[s.id] })),
    current,
    onSelect: (id) => setStageOf((all) => ({ ...all, [deal.id]: id })),
    onAdvance: () => { const next = DEAL_STEPS[at + 1]; if (next && !next.kind) setStageOf((all) => ({ ...all, [deal.id]: next.id })); },
    onMarkLost: () => setStageOf((all) => ({ ...all, [deal.id]: "lost" })),
    labels: { markLost: "标记输单" },
  };
  const send = async (d: CommentDraft) => {
    await new Promise((r) => setTimeout(r, 200));
    setComments((all) => [{ id: `m${Date.now()}`, author: { id: "u02", name: "陈一鸣" }, createdAt: new Date().toISOString(), body: d.body, mentions: d.mentions }, ...all]);
  };

  return (
    <RecordDetail<Deal>
      row={deal} recordKey={deal.id} title={deal.name}
      badges={[{ label: "跟进中", tone: "green" }, { label: deal.industry, tone: "blue" }]}
      meta={[deal.customer, { person: "陈一鸣", suffix: "负责" }, deal.city]}
      nav={{ index, total: DEALS.length, onMove: (d) => setIndex((i) => Math.min(DEALS.length - 1, Math.max(0, i + d))) }}
      fields={fields} spec={SPEC} stage={stage} keyNumbers={dealKeyNumbers(deal)}
      follow={{ on: following, onToggle: () => setFollowing((v) => !v) }}
      actions={<RowActions label={`${deal.name}的更多操作`} actions={[{ key: "share", label: "分享", onSelect: () => notify("已复制分享链接", "success") }, { key: "delete", label: "删除", destructive: true, onSelect: () => notify("删除前会先确认", "info") }]} />}
      slots={{
        activity: {
          title: "跟进", count: FOLLOW_UPS.length,
          actions: <Button size="sm" variant="ghost"><MessageSquare aria-hidden="true" />只看跟进</Button>,
          render: () => (
            <>
              <ActivityComposer kinds={KINDS} kind={kind} onKindChange={setKind} kindLabel="跟进方式" label="跟进内容" placeholder="聊了什么、下一步做什么"
                value={draft} onChange={setDraft} due={{ value: due, onChange: setDue }} submitLabel="保存跟进"
                onSubmit={() => { notify(draft.trim() ? "已记下跟进" : "先写几句聊了什么", draft.trim() ? "success" : "error"); if (draft.trim()) setDraft(""); }} />
              <ActivityFeed caption="跟进记录" items={FOLLOW_UPS} getId={(f) => f.id} time={(f) => f.at} title={(f) => f.what} actor={(f) => f.who} description={(f) => f.text || null} />
            </>
          ),
        },
        comments: { title: "评论", count: comments.length, render: () => <CommentThread title={null} comments={comments} onSend={send} /> },
      }}
    />
  );
}
