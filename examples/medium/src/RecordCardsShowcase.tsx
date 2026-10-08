import { useMemo, useState } from "react";
import { MapPin, MessageCircle, MessageSquare, Mic, Paperclip, Phone, Store, Video } from "lucide-react";
import {
  ActivityComposer, ActivityComposerTool, ActivityFeed, Button, CellTags, Choice, CommentThread, Input, OptionsEditor, PageBody, PageHeader, Panel, RecordDetail, SegmentedControl, StagePath,
  RowActions, normalizeRecordDetailSpec, defaultRecordDetailSpec, setRecordDetailPreset, useNotify, useRecordDetail, RECORD_DETAIL_PRESETS, RECORD_DETAIL_PRESET_LABELS,
  type ActivityKind, type CommentDraft, type CommentItem, type EditableOption, type RecordDetailPreset, type RecordDetailScope, type RecordDetailSlot, type RecordDetailSpec, type RecordField,
  type RecordKeyNumber, type RecordLayout, type RecordMetaPart, type RecordLayoutEditor, type RecordStage, type StagePathStep,
} from "@adminui/react";
import type { GridField } from "@adminui/react/grid";
import { demoEdit, demoSave } from "./record-edit-demo";

// 记录详情 · 卡片分区（样稿 C）：一条客户记录，三种版式（卡片分区 / 单栏 / 左右分栏）、编辑布局、关注、
// 可点的阶段路径（丢单、作废在「更多」里）、关键数、分区卡片里的就地编辑和空字段收起。
// 布局存在浏览器里演示「团队默认 / 只改我的」；真实项目由宿主存到服务端（保存前用 normalizeRecordDetailSpec 校验）。

type Customer = { id: string; name: string } & Record<string, unknown>;
const CUSTOMERS: Customer[] = [
  { id: "c1", name: "赵静怡", phone: "135 1940 0678", line: "zhaojingyi0612", address: "上海市徐汇区衡山路 76 号 12 楼", region: "北", source: "官网表单", need: "新房 150 平，11 月交房。先做门锁和电动窗帘（静音款），照明下一期；预算 30 万内，先生决定。", interest: ["智能门锁", "窗帘", "照明"], quality: "A", dealAmount: null, dealDate: null, lostReason: null, code: "C-2026-00001", created: "管理员 建于 10月5日 14:02", updated: "小赵 改于 今天 09:41" },
  { id: "c2", name: "陈柏翰", phone: "138 0013 8000", line: null, address: "杭州市西湖区文三路 188 号", region: "北", source: "转介绍", need: "老屋翻新，想先看门锁样品。", interest: ["智能门锁"], quality: "B", dealAmount: null, dealDate: null, lostReason: null, code: "C-2026-00002", created: "小王 建于 10月3日 10:20", updated: "小王 改于 昨天 16:05" },
];
const FIELD_DEFS: Record<string, GridField<{ id: string } & Record<string, unknown>>> = {
  phone: { key: "phone", title: "手机", type: "text" },
  need: { key: "need", title: "需求", type: "longText" },
  quality: { key: "quality", title: "客户质量", type: "singleSelect", options: [{ value: "A", label: "A", tone: "green" }, { value: "B", label: "B", tone: "yellow" }, { value: "C", label: "C", tone: "gray" }] },
  dealAmount: { key: "dealAmount", title: "成交金额", type: "text" },
};
const STEPS: StagePathStep[] = [
  { id: "first", label: "首通" }, { id: "need", label: "需求确认" }, { id: "quote", label: "报价" }, { id: "talk", label: "谈判" },
  { id: "deal", label: "成交" }, { id: "install", label: "装机" }, { id: "visit", label: "回访" },
  { id: "lost", label: "丢单", kind: "lost" }, { id: "void", label: "作废", kind: "void" },
];
// 谈判 = 以前走到过又退回来（有天数，但在当前阶段后面：不填色）
const DAYS: Record<string, number> = { first: 1, need: 3, talk: 2 };
const KINDS: ActivityKind[] = [
  { value: "phone", label: "电话", icon: Phone }, { value: "line", label: "LINE", icon: MessageCircle }, { value: "visit", label: "拜访", icon: MapPin },
  { value: "store", label: "到店", icon: Store }, { value: "video", label: "视频", icon: Video }, { value: "other", label: "其他" },
];
const FOLLOW = [
  { id: "f1", at: new Date(Date.now() - 2 * 3600e3).toISOString(), who: "小赵", what: "LINE · 需求确认", text: "把门锁 + 窗帘的方案 PDF 传给客户，她说周末和先生一起看，想到门市摸一下样品。" },
  { id: "f2", at: new Date(Date.now() - 2 * 3600e3 + 60e3).toISOString(), who: "小赵", what: "把阶段改成 需求确认", text: "" },
  { id: "f3", at: new Date(Date.now() - 26 * 3600e3).toISOString(), who: "小赵", what: "电话 4:32 · 首通", text: "接通。新房 150 平，11 月交房，想先做门锁和窗帘，照明之后再说；预算 30 万内。" },
];
const FIRST_COMMENTS: CommentItem[] = [{ id: "m1", author: { id: "u-zhou", name: "周经理" }, createdAt: new Date(Date.now() - 2 * 3600e3).toISOString(), body: "@小赵 徐汇区的新案，报价前先找我看一下，可以给门锁加送一年保固。", mentions: [{ id: "u-zhao", name: "小赵" }] }];
const SECTIONS = [
  { id: "contact", title: "联系方式", fields: ["phone", "line", "address", "region", "source"] },
  { id: "needs", title: "需求", fields: ["need", "interest", "quality"] },
  { id: "deal", title: "成交", fields: ["dealAmount", "dealDate", "lostReason"] },
  { id: "system", title: "系统信息", fields: ["code", "created", "updated"] },
];
const META: RecordMetaPart[] = ["总部大客户", { person: "小赵", suffix: "负责" }, "官网表单进线", "建档 2 天"];
const STORE = "starter:demo:record-cards:layout";
type Saved = { default?: unknown; mine?: unknown };
const load = (): Saved => {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "{}") as Saved;
  } catch {
    return {};
  }
};

/** 写跟进（ActivityComposer）：方式小标签、短文本、底部一行（录音 / 附件 | 下次跟进 + 日期 + 1/3/7 天 + 保存跟进）。 */
function FollowComposerDemo() {
  const notify = useNotify();
  const [kind, setKind] = useState("phone");
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [files, setFiles] = useState(false);
  return (
    <ActivityComposer kinds={KINDS} kind={kind} onKindChange={setKind} kindLabel="跟进方式" label="跟进内容" placeholder="聊了什么、下一步做什么" value={text} onChange={setText}
      tools={<>
        <ActivityComposerTool label="录音" icon={Mic} onClick={() => notify("开始录音（演示）", "info")} />
        <ActivityComposerTool label="附件" icon={Paperclip} pressed={files} onClick={() => setFiles((v) => !v)} />
      </>}
      panel={files ? <p className="aui-note" style={{ margin: 0 }}>拖文件到这里，或点击选择（演示）</p> : undefined}
      due={{ value: due, onChange: setDue, min: new Date().toISOString().slice(0, 10) }}
      submitLabel="保存跟进" onSubmit={() => { notify(text.trim() ? "已记下跟进" : "先写几句聊了什么", text.trim() ? "success" : "error"); if (text.trim()) { setText(""); setDue(""); } }} />
  );
}

function useCustomerCards() {
  const notify = useNotify();
  const [patch, setPatch] = useState<Record<string, Record<string, unknown>>>({});
  const [stageOf, setStageOf] = useState<Record<string, string>>({ c1: "need", c2: "first" });
  const [following, setFollowing] = useState<Record<string, boolean>>({ c1: true });
  const [comments, setComments] = useState<CommentItem[]>(FIRST_COMMENTS);
  const [saved, setSaved] = useState<Saved>(load);
  const read = (c: Customer, key: string): unknown => patch[c.id]?.[key] ?? c[key] ?? null;
  const write = (c: Customer, key: string) => demoSave((value) => setPatch((all) => ({ ...all, [c.id]: { ...all[c.id], [key]: value } })));
  const edit = (key: string) => (c: Customer) => demoEdit(FIELD_DEFS[key]!, c.id, read(c, key), write(c, key));
  const text = (key: string) => (c: Customer) => { const v = read(c, key); return v === null || v === undefined ? "" : String(v); };
  const fields: RecordField<Customer>[] = [
    { key: "phone", label: "手机", description: "客户本人的手机，打之前先看 LINE 有没有新消息", value: text("phone"), copy: true, tel: (c) => text("phone")(c) || null, edit: edit("phone") },
    { key: "line", label: "LINE ID", description: "LINE 的 ID，不是显示名", value: text("line"), copy: true },
    { key: "address", label: "地址", value: text("address") },
    { key: "region", label: "区域", value: (c) => (read(c, "region") ? <CellTags items={[{ label: String(read(c, "region")), tone: "blue" }]} /> : null), text: text("region") },
    { key: "source", label: "来源", value: (c) => (read(c, "source") ? <CellTags items={[{ label: String(read(c, "source")), tone: "green" }]} /> : null), text: text("source") },
    { key: "need", label: "需求", value: text("need"), edit: edit("need") },
    { key: "interest", label: "感兴趣", value: (c) => <CellTags items={((read(c, "interest") as string[] | null) ?? []).map((label, i) => ({ label, tone: i === 2 ? "yellow" : "green" }))} />, text: (c) => ((read(c, "interest") as string[] | null) ?? []).join("、") },
    { key: "quality", label: "客户质量", value: text("quality"), edit: edit("quality") },
    { key: "dealAmount", label: "成交金额", value: text("dealAmount"), edit: edit("dealAmount") },
    { key: "dealDate", label: "成交日期", value: text("dealDate"), edit: () => null, lockedReason: "到成交阶段才能填" },
    { key: "lostReason", label: "丢单原因", value: text("lostReason") },
    { key: "code", label: "编号", value: text("code"), copy: true, mono: true },
    { key: "created", label: "创建", value: text("created") },
    { key: "updated", label: "最后修改", value: text("updated") },
  ];
  const stage = (c: Customer): RecordStage => {
    const current = stageOf[c.id] ?? "first";
    const at = STEPS.findIndex((s) => s.id === current);
    return {
      steps: STEPS.map((s) => ({ ...s, days: DAYS[s.id] })),
      current,
      onSelect: (id) => { setStageOf((all) => ({ ...all, [c.id]: id })); notify(`阶段改成「${STEPS.find((s) => s.id === id)?.label}」`, "success"); },
      onAdvance: () => { const next = STEPS[at + 1]; if (next && !next.kind) setStageOf((all) => ({ ...all, [c.id]: next.id })); },
      onMarkLost: () => setStageOf((all) => ({ ...all, [c.id]: "lost" })),
      labels: { markLost: "标记丢单" },
    };
  };
  const keyNumbers = (c: Customer): RecordKeyNumber[] => [
    { key: "amount", label: "预计金额", value: c.id === "c1" ? "¥286,000" : "¥68,000", hint: "赢率 30%" },
    { key: "next", label: "下次跟进", value: "10月9日", hint: "周四 · 2 天后", tone: "attention" },
    { key: "last", label: "最后跟进", value: "今天 09:40", hint: "LINE · 小赵" },
    { key: "count", label: "跟进次数", value: 3, hint: "建档 2 天" },
    { key: "rate", label: "赢率", value: "30%", hint: "按阶段默认" },
  ];
  const send = async (d: CommentDraft) => {
    await new Promise((r) => setTimeout(r, 150));
    setComments((all) => [{ id: `m${Date.now()}`, author: { id: "me", name: "小赵" }, createdAt: new Date().toISOString(), body: d.body, mentions: d.mentions }, ...all]);
  };
  const slots = (): Record<string, RecordDetailSlot> => ({
    activity: {
      title: "跟进", count: FOLLOW.length,
      actions: <Button size="sm" variant="ghost" onClick={() => notify("只看跟进", "info")}><MessageSquare aria-hidden="true" />只看跟进</Button>,
      render: () => (
        <>
          <FollowComposerDemo />
          <ActivityFeed caption="跟进记录" items={FOLLOW} getId={(f) => f.id} time={(f) => f.at} title={(f) => f.what} actor={(f) => f.who} description={(f) => f.text || null} />
        </>
      ),
    },
    comments: { title: "评论", count: comments.length, render: () => <CommentThread title={null} comments={comments} onSend={send} searchMentions={(q) => [{ id: "u-zhao", name: "小赵" }, { id: "u-zhou", name: "周经理" }].filter((p) => p.name.includes(q))} /> },
  });
  const catalog = { fields: fields.map((f) => f.key), slots: ["activity", "comments"], stage: true, keyNumbers: true };
  const companyDefault = normalizeRecordDetailSpec(saved.default, catalog, defaultRecordDetailSpec({ ...catalog, sections: SECTIONS }));
  const spec = normalizeRecordDetailSpec(saved.mine, catalog, companyDefault);
  const persist = (next: Saved) => {
    setSaved(next);
    localStorage.setItem(STORE, JSON.stringify(next));
  };
  const editor: RecordLayoutEditor = {
    canEditDefault: true,
    onSave: async (next: RecordDetailSpec, scope: RecordDetailScope) => {
      await new Promise((r) => setTimeout(r, 150));
      persist(scope === "default" ? { default: next } : { ...saved, mine: next });
      notify(scope === "default" ? "已保存为团队默认布局" : "已保存你的布局", "success");
    },
    onReset: () => {
      persist({ default: saved.default });
      notify("已恢复团队默认布局", "success");
    },
  };
  const setPreset = (preset: RecordDetailPreset) => persist({ ...saved, mine: setRecordDetailPreset(spec, preset) });
  const follow = (c: Customer) => ({ on: Boolean(following[c.id]), onToggle: () => setFollowing((all) => ({ ...all, [c.id]: !all[c.id] })) });
  return { fields, stage, keyNumbers, slots, spec, editor, setPreset, follow };
}

/** 阶段选项：每个选项带「类别」和「默认赢率」（OptionsEditor renderOptionExtra + option.meta）。 */
function StageOptionsDemo() {
  const [options, setOptions] = useState<EditableOption[]>(() => STEPS.map((s, i) => ({ id: s.id, label: s.label, tone: s.kind === "lost" ? "red" : s.kind === "void" ? "gray" : "green", meta: { kind: s.kind ?? "normal", winRate: s.kind ? 0 : Math.min(100, 10 + i * 15) } })));
  const [current, setCurrent] = useState("need");
  const steps: StagePathStep[] = options.filter((o) => o.label.trim()).map((o) => ({ id: o.id, label: o.label, kind: (o.meta?.kind as StagePathStep["kind"]) ?? "normal" }));
  return (
    <Panel title="阶段路径与阶段选项" description="StagePath 单独用：点一个阶段就改（Tab 到阶段按 Enter）；丢单、作废这类出口在「更多」里。下面的选项编辑器给每个选项加了类别和默认赢率。">
      <div style={{ display: "grid", gap: 20, marginBottom: 20 }}>
        <StagePath steps={steps} current={current} onSelect={setCurrent} variant="chevrons" label="阶段（箭头）" />
        <StagePath steps={steps} current={current} onSelect={setCurrent} label="阶段（分段）" />
        <StagePath steps={steps} current={current} readOnly label="阶段（只读）" />
      </div>
      <OptionsEditor label="阶段选项" options={options} onChange={setOptions}
        renderOptionExtra={(option, index, change) => (
          <>
            <Choice label={`选项 ${index + 1} 的类别`} value={String(option.meta?.kind ?? "normal")} onChange={(kind) => change({ meta: { ...option.meta, kind } })}
              options={[{ value: "normal", label: "进行中" }, { value: "lost", label: "丢单" }, { value: "void", label: "作废" }]} />
            <Input type="number" min={0} max={100} aria-label={`选项 ${index + 1} 的默认赢率（%）`} value={String(option.meta?.winRate ?? "")}
              onChange={(event) => change({ meta: { ...option.meta, winRate: Number(event.currentTarget.value) } })} />
          </>
        )} />
    </Panel>
  );
}

export function RecordCardsShowcase() {
  const cards = useCustomerCards();
  const [index, setIndex] = useState(0);
  const customer = CUSTOMERS[index]!;
  const layout = useMemo((): RecordLayout<Customer> => ({
    title: (c) => c.name,
    badges: (c) => [{ label: "跟进中", tone: "green" }, { label: `${String(c.quality)} 类`, tone: "blue" }],
    meta: () => META,
    subtitle: () => "总部大客户 · 小赵 负责",
    sections: [{ key: "all", fields: cards.fields }],
    cards: { spec: cards.spec, stage: cards.stage, keyNumbers: cards.keyNumbers, slots: cards.slots, follow: cards.follow, editor: cards.editor },
    actions: () => [{ key: "share", label: "分享", onSelect: () => undefined }, { key: "delete", label: "删除", destructive: true, onSelect: () => undefined }],
  }), [cards]);
  const dialog = useRecordDetail<Customer>({ rows: CUSTOMERS, rowKey: (c) => c.id, layout, defaultLevel: "expanded" });
  return (
    <>
      <PageHeader title="记录详情 · 卡片分区" description="阶段 + 关键数在顶上，左边跟进和评论，右边分区卡片；点「编辑布局」拖卡片、整理字段、换版式。" />
      <PageBody>
        <Panel title="客户详情" actions={<>
          <SegmentedControl<RecordDetailPreset> size="sm" label="版式" value={cards.spec.preset} onValueChange={cards.setPreset} options={RECORD_DETAIL_PRESETS.map((value) => ({ value, label: RECORD_DETAIL_PRESET_LABELS[value] }))} />
          <Button size="sm" variant="outline" onClick={() => dialog.open(customer.id)}>在弹框里打开</Button>
        </>} flush>
          <RecordDetail<Customer>
            row={customer} recordKey={customer.id} title={customer.name}
            badges={[{ label: "跟进中", tone: "green" }, { label: `${String(customer.quality)} 类`, tone: "blue" }]}
            meta={META}
            nav={{ index, total: CUSTOMERS.length, onMove: (d) => setIndex((i) => Math.min(CUSTOMERS.length - 1, Math.max(0, i + d))) }}
            fields={cards.fields} spec={cards.spec} stage={cards.stage(customer)} keyNumbers={cards.keyNumbers(customer)} slots={cards.slots()}
            follow={cards.follow(customer)} layoutEditor={cards.editor}
            actions={<RowActions label={`${customer.name}的更多操作`} actions={[{ key: "share", label: "分享", onSelect: () => undefined }, { key: "delete", label: "删除", destructive: true, onSelect: () => undefined }]} />} />
        </Panel>
        {dialog.element}
        <StageOptionsDemo />
      </PageBody>
    </>
  );
}
