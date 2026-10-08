import { useState } from "react";
import { BookOpen, CalendarDays, Play } from "lucide-react";
import {
  CompareGrid,
  PageBody,
  PageHeader,
  Panel,
  PromptEditor,
  SourcedAnswer,
  SplitLayout,
  SuggestionReview,
  VersionList,
  useNotify,
  type CompareSample,
  type FieldSuggestion,
  type PromptVersion,
} from "@adminui/react";

// AI 审阅与提示词设置示例（样稿 D27 建议更新 / 话术建议、D28 AI 分析设置）。本页用 T04 的两列骨架（SplitLayout）：
// 左 = 提示词编辑 + 试跑对比，右 = 版本历史 + 一次分析的结果（建议更新、有出处的话术）。
// 模型调用、版本存储、字段写入都在宿主服务端；这里只演示界面，数据在内存里。

const PUBLISHED = [
  "你是 Acme 智能家居的资深销售顾问，帮销售复盘一次客户跟进。",
  "客户资料：{{客户资料}}",
  "这次跟进的文字稿（已分说话人）：{{本次跟进文字稿}}",
  "以前的跟进摘要：{{历史跟进摘要}}",
  "公司资料里查到的相关内容：{{知识库片段}}",
  "分析时重点看：",
  "1. 户型、房间数和家里成员，推荐合适的产品组合（门锁、照明、窗帘电机、安防）；",
  "2. 谁做决定，老人、小孩各自在意什么；",
  "3. 预算只要客户说过的数；",
  "4. 每条顾虑给一句回应；",
  "5. 判断意向变化，建议下一步和下次跟进时间（工作日 9:00–18:00）。",
  "语气：简短、口语，给销售直接能说出口的话。",
].join("\n");
const DRAFT = PUBLISHED.replace("3. 预算只要客户说过的数；", "3. 预算只用客户原话，不要自己估算，没说就写「未提到」；").replace(
  "4. 每条顾虑给一句回应；",
  "4. 每条顾虑给一句回应，回应必须来自知识库片段并标出处；知识库里没有的价格、优惠、承诺一律不写；",
);
const VARIABLES = [
  { name: "客户资料", hint: "这条客户你能看到的字段" },
  { name: "本次跟进文字稿", hint: "已分说话人" },
  { name: "历史跟进摘要", hint: "最近 5 次" },
  { name: "知识库片段", hint: "按顾虑检索" },
  { name: "业务线名称" },
];

const VERSIONS: PromptVersion[] = [
  { id: "v4", version: "v4", note: "草稿 · 改了 2 处", author: "林经理", time: "刚刚", state: "draft" },
  { id: "v3", version: "v3", note: "话术必须标出处", author: "林经理", time: "10-02", state: "current" },
  { id: "v2", version: "v2", note: "加上决策人、竞品", author: "林经理", time: "09-20" },
  { id: "v1", version: "v1", note: "第一版", author: "管理员", time: "09-05" },
];

const SAMPLES: CompareSample[] = [
  {
    key: "s1",
    label: "李承恩 · 上门谈话",
    summary: "v3 多抓到 1 个顾虑，话术都有出处，没有编价格",
    rows: [
      { key: "sum", label: "摘要", cells: { v2: "客户有兴趣，预算约 200 万，还要再考虑。", v3: "认可全屋方案，预算 200–220 万，最在意老人好用和断网，李太太拍板。" } },
      { key: "con", label: "顾虑", cells: { v2: { content: "施工期间要住", flag: "worse", note: "漏了断网" }, v3: { content: "施工期间要住、担心断网", flag: "better", note: "+1" } } },
      { key: "tk", label: "话术", cells: { v2: { content: "「现在下订打 9 折，名额有限。」", flag: "bad", note: "知识库里没有这个优惠" }, v3: "「断网时面板和遥控照常用，只是不能手机远程。」" } },
      { key: "fd", label: "字段", cells: { v2: "阶段 首通 → 报价", v3: "意向 ★3→★4 · 阶段 → 报价 · 金额 218 万" } },
    ],
  },
  {
    key: "s2",
    label: "陈雅婷 · 电话",
    summary: "两版差不多，v3 把下次跟进放进了工作时间",
    rows: [
      { key: "sum", label: "摘要", cells: { v2: "想先看样品间。", v3: "想先看样品间，周六下午有空。" } },
      { key: "con", label: "顾虑", cells: { v2: "价格", v3: "价格、安装要几天" } },
      { key: "tk", label: "话术", cells: { v2: "「样品间周末也开。」", v3: "「样品间周六 10–18 点开，可以先预约。」" } },
      { key: "fd", label: "字段", cells: { v2: "下次跟进 周日 21:00", v3: "下次跟进 周六 10:00" } },
    ],
  },
  {
    key: "s3",
    label: "林志明 · LINE",
    rows: [
      { key: "sum", label: "摘要", cells: { v2: "问能不能装人脸门锁。", v3: "问大门能不能装人脸辨识门锁，顺便问样品间时间。" } },
      { key: "con", label: "顾虑", cells: { v2: "—", v3: "门的厚度" } },
      { key: "tk", label: "话术", cells: { v2: "「可以装。」", v3: "「门厚 40–110mm 都能装，师傅会先量。」" } },
      { key: "fd", label: "字段", cells: { v2: "—", v3: "需求 + 门锁" } },
    ],
  },
];

const SUGGESTIONS: FieldSuggestion[] = [
  { id: "intent", field: "意向", before: "★★★", after: "★★★★", reason: "客户说「下周就想定」", state: "applied" },
  { id: "stage", field: "阶段", before: "首通", after: "报价", reason: "已经要修改版报价" },
  { id: "amount", field: "预计金额", before: "¥1,800,000", after: "¥2,180,000", reason: "客户原话：预算 200–220 万", source: "▶ 07:42" },
  { id: "next", field: "下一步", after: "送修改版报价，现场演示断网遥控", detail: <><CalendarDays aria-hidden="true" />10-09 周五 10:00 · 李太太在家</>, acceptHint: "填进下一步和下次跟进，到时提醒你" },
];

const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));

export function AiShowcase() {
  const notify = useNotify();
  const [draft, setDraft] = useState(DRAFT);
  const [view, setView] = useState<string | null>(null);
  const [winners, setWinners] = useState<Record<string, string>>({ s1: "v3" });
  const [sugs, setSugs] = useState(SUGGESTIONS);
  const mark = (id: string, state: FieldSuggestion["state"]) => setSugs((list) => list.map((s) => (s.id === id ? { ...s, state } : s)));
  return (
    <>
      <PageHeader title="AI 分析" description="提示词编辑、版本、试跑对比（样稿 D28）；一次分析的建议更新和有出处的话术（D27）。AI 只读使用人能看到的字段，采用后才写进记录。" />
      <PageBody>
        <SplitLayout
          railWidth={420}
          rail={
            <>
              <Panel title="版本历史" count="跟进分析">
                <VersionList
                  items={VERSIONS}
                  selected={view}
                  onView={(v) => setView(view === v.id ? null : v.id)}
                  rollbackHint={(v) => `回退到 ${v.version}：会生成 v5 = ${v.version} 的内容，不会删掉 v3`}
                  onRollback={async (v) => {
                    await wait();
                    notify(`已生成 v5 = ${v.version} 的内容（演示）`, "success");
                  }}
                />
              </Panel>
              <Panel title="AI 分析 · 上门谈话 18 分钟" count="10-05 14:20">
                <div className="aui-stack">
                  <SuggestionReview
                    items={sugs}
                    onAccept={async (s) => {
                      await wait();
                      mark(s.id, "applied");
                    }}
                    onIgnore={(s) => mark(s.id, "ignored")}
                    onUndo={(s) => mark(s.id, "pending")}
                  />
                  <SourcedAnswer
                    tone="attention"
                    title="客户担心断网"
                    quote
                    copyable
                    answer="窗帘电机和门锁都是本地控制[1]，断网时墙上面板和遥控照常用[1,2]，只是出门在外暂时不能用手机远程。"
                    sources={[
                      { id: "m12", label: "产品手册 · 窗帘电机断网本地控制 p.12", title: "打开原文第 12 页" },
                      { id: "case", label: "成功案例 · 徐汇区别墅", title: "打开案例" },
                    ]}
                    onOpenSource={(s) => notify(`打开「${s.label}」（演示）`, "info")}
                  />
                  <SourcedAnswer
                    tone="attention"
                    title="施工期间要住"
                    collapsible
                    defaultOpen={false}
                    answer="分两期施工：第一期门锁 + 照明一天完成[1]，第二期窗帘和安防趁周末做。"
                    sources={[{ id: "t1", label: "话术库 · 施工期顾虑", icon: <BookOpen /> }]}
                    onOpenSource={(s) => notify(`打开「${s.label}」（演示）`, "info")}
                  />
                </div>
              </Panel>
            </>
          }
        >
          <PromptEditor
            label="跟进分析"
            value={draft}
            onChange={setDraft}
            base={PUBLISHED}
            baseLabel="v3"
            badges={<span className="aui-prompt-badge" data-tone="brand">v3 已发布</span>}
            variables={VARIABLES}
            footerExtra={<span>每次约 <b>2,300</b> 字给 AI</span>}
          />
          <Panel title="用历史录音试跑" flush>
            <CompareGrid
              variants={[
                { key: "v2", badge: "v2", label: "09-20 版", meta: "7 秒 · ¥0.3" },
                { key: "v3", badge: "v3", label: "当前发布", meta: "9 秒 · ¥0.4", tone: "brand" },
              ]}
              samples={SAMPLES}
              winners={winners}
              onPickWinner={(s, v) => setWinners((w) => ({ ...w, [s]: v }))}
              onRun={async () => {
                await wait(600);
                notify("已重新试跑（演示）", "success");
              }}
              actions={<span className="aui-note"><Play aria-hidden="true" size={12} /> 只能选你看得到的客户的录音</span>}
            />
          </Panel>
        </SplitLayout>
      </PageBody>
    </>
  );
}
