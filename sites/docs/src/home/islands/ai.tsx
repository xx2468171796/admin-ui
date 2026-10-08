import { useEffect, useMemo, useState } from "react";
import { Bot, Check, FileText, RotateCcw, Search, Terminal, User } from "lucide-react";
import { AdminProvider, Button, DataTable, Input, PageBody, PageHeader, QueryBar, ResourcePanel, StatusBadge, Tag, isPaletteId, type Column } from "@adminui/react";
import { CAPABILITIES } from "@adminui/react/catalog";
import { CUSTOMERS, formatAmount, personName, stageLabel, type Customer } from "../../data/demo-data";
import { PKG } from "../content";
import { useHome } from "../store";
import { defineIsland } from "./runtime";
import "./ai.css";

const PROMPT = "给北辰云做一个客户列表页：能搜索、按阶段看状态、金额右对齐。用 admin-ui，按 AI-RULES 来。";
const STEPS = [
  { icon: FileText, text: "读 AI-RULES.md：先选模板 → T02 资源列表" },
  { icon: Search, text: "查能力清单：ResourcePanel · QueryBar · DataTable · StatusBadge" },
  { icon: Terminal, text: "写 src/pages/customers.tsx（46 行）" },
  { icon: Check, text: `npx ${PKG} audit src → 0 个错误，0 个提醒` },
];
const CODE = `<ResourcePanel title="全部客户" count={rows.length} unit="家"
  filters={<QueryBar value={q} onChange={setQ} />}>
  <DataTable caption="客户" columns={columns} rows={rows}
    pagination={{ mode: "page", page, pageSize: 6, total }} />
</ResourcePanel>`;

function GeneratedPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const rows = useMemo(() => CUSTOMERS.filter((c) => c.name.includes(q) || c.city.includes(q)), [q]);
  const columns: Column<Customer>[] = [
    { key: "name", title: "客户", render: (c) => <strong>{c.name}</strong>, mobile: "primary" },
    { key: "industry", title: "行业", width: 80, render: (c) => <Tag>{c.industry}</Tag> },
    { key: "stage", title: "阶段", width: 112, render: (c) => <StatusBadge tone={c.stage === "won" ? "success" : c.stage === "lost" ? "danger" : "info"}>{stageLabel(c.stage)}</StatusBadge>, mobile: "status" },
    { key: "amount", title: "预计金额", width: 110, align: "right", render: (c) => formatAmount(c.amount) },
    { key: "owner", title: "负责人", width: 84, render: (c) => personName(c.owner) },
  ];
  return (
    <PageBody>
      <PageHeader title="客户" actions={<Button size="sm">新建客户</Button>} />
      <ResourcePanel
        title="全部客户"
        count={rows.length}
        unit="家"
        filters={<QueryBar value={q} onChange={(v) => { setQ(v); setPage(1); }} onSearch={() => setPage(1)} onReset={() => setQ("")} variant="flush" placeholder="搜索客户、城市" />}
      >
        <DataTable
          caption="客户"
          columns={columns}
          rows={rows.slice((page - 1) * 6, page * 6)}
          rowKey={(c) => c.id}
          pagination={{ mode: "page", page, pageSize: 6, total: rows.length, onPageChange: setPage, onPageSizeChange: () => setPage(1) }}
        />
      </ResourcePanel>
    </PageBody>
  );
}

/** Prompt typed out → 4 agent steps → the page appears. Reduced motion: everything at once. */
function AiDemo() {
  const { reduced, palette } = useHome();
  const total = PROMPT.length;
  const [run, setRun] = useState(0);
  const [chars, setChars] = useState(() => (reduced ? total : 0));
  const [step, setStep] = useState(() => (reduced ? STEPS.length + 1 : 0));
  useEffect(() => {
    if (reduced) {
      setChars(total);
      setStep(STEPS.length + 1);
      return;
    }
    setChars(0);
    setStep(0);
    let c = 0;
    const typing = window.setInterval(() => {
      c += 2;
      setChars(Math.min(c, total));
      if (c >= total) window.clearInterval(typing);
    }, 35);
    const timers = [1300, 2100, 2900, 3800, 4700].map((ms, k) => window.setTimeout(() => setStep(k + 1), ms + 400));
    return () => {
      window.clearInterval(typing);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [run, total, reduced]);
  const done = step > STEPS.length;
  return (
    <div className="h-ai">
      {/* The agent side is always a dark terminal: its own dark provider, so the colours stay palette tokens. */}
      <AdminProvider storageKey="aui-home-term" palette={isPaletteId(palette) ? palette : "forest"} mode="dark" className="h-ai-term">
      <div className="h-ai-chat">
        <div className="h-ai-head">
          <Bot aria-hidden="true" />
          <span>你的 AI 编程助手</span>
          <Button size="sm" variant="outline" onClick={() => setRun((n) => n + 1)}>
            <RotateCcw aria-hidden="true" />重放
          </Button>
        </div>
        <div className="h-ai-msg">
          <User aria-hidden="true" />
          <p>{PROMPT.slice(0, chars)}{chars < total && <span className="h-ai-caret" />}</p>
        </div>
        <ol className="h-ai-steps">
          {STEPS.map((s, k) => (
            <li key={s.text} data-state={step > k + 1 || done ? "done" : step === k + 1 ? "run" : "wait"}>
              <s.icon aria-hidden="true" />
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
        <pre className="h-ai-code" data-show={step >= 3 ? "1" : undefined}><code>{CODE}</code></pre>
      </div>
      </AdminProvider>
      <div className="h-ai-preview" data-show={done ? "1" : undefined}>
        <div className="h-ai-bar">
          <span>预览 · src/pages/customers.tsx</span>
          {done ? <StatusBadge tone="success">audit 通过</StatusBadge> : <StatusBadge tone="info" pulse>生成中</StatusBadge>}
        </div>
        <div className="h-ai-body">{done ? <GeneratedPage /> : <div className="h-ai-skel"><i /><i /><i /><i /><i /></div>}</div>
      </div>
    </div>
  );
}

/** Live search over the package's machine-readable capability list — what an AI reads instead of guessing imports. */
function Catalog() {
  const [q, setQ] = useState("看板");
  const all = useMemo(
    () =>
      CAPABILITIES.map((c) => ({
        id: c.id,
        entry: c.entry.replace("@adminui/react", PKG),
        exports: c.exports as readonly string[],
        text: `${c.id} ${c.exports.join(" ")} ${c.rule}`.toLowerCase(),
      })),
    [],
  );
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hits = all.filter((c) => words.every((w) => c.text.includes(w)));
  const exportCount = useMemo(() => new Set(all.flatMap((c) => c.exports)).size, [all]);
  return (
    <div className="h-card h-catalog">
      <div className="h-card-head">
        <span className="h-file">{PKG}/catalog</span>
        <span className="h-dim">{all.length} 组能力 · {exportCount} 个导出</span>
      </div>
      <Input value={q} onChange={(e) => setQ(e.currentTarget.value)} placeholder="查一个能力：表格、权限、上传…" aria-label="查能力清单" />
      <div className="h-hits" aria-live="polite">
        {hits.slice(0, 4).map((h) => (
          <div key={h.id} className="h-hit">
            <div><strong>{h.id}</strong><code>{h.entry}</code></div>
            <p>{h.exports.slice(0, 7).join(" · ")}{h.exports.length > 7 ? ` … +${h.exports.length - 7}` : ""}</p>
          </div>
        ))}
        {!hits.length && <p className="h-dim">没有匹配的能力。AI 会照实说「套件里没有」，而不是编一个 import。</p>}
        {hits.length > 4 && <p className="h-dim">还有 {hits.length - 4} 组…</p>}
      </div>
    </div>
  );
}

defineIsland("ai", { demo: { view: AiDemo }, catalog: { view: Catalog } });
