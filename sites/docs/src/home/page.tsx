import { useMemo, useState } from "react";
import { ArrowRight, MousePointerClick } from "lucide-react";
import { AdminProvider, Button, CommandPalette, Kbd, PALETTES, SegmentedControl, isPaletteId, type AdminCommand, type CommandItem, type CommandProvider } from "@adminui/react";
import { AUDIT_BAD, AUDIT_OK, CRM_PAGES, EXPORTS_COUNT, NAV_LINKS, PALETTE_PAGES, PKG, RULES, VERSION, doc } from "./content";
import { searchDocsLazy } from "../shell/search-loader";
import { IslandSlot } from "./island-slot";
import { Badges, Compare, CountUp, Footer, GithubStar, InstallBlock, InstallLine, Logo, ModeToggle, PaletteDock, Reveal, SectionHead, StackStrip, Starters } from "./parts";
import { useHome } from "./store";

const scrollToLive = () => document.getElementById("live")?.scrollIntoView({ behavior: "smooth", block: "start" });

/** Full-text search over the component docs; the index (assets/search-index-*.js) loads on the first query. */
const DOC_PROVIDERS: readonly CommandProvider[] = [{ id: "content", label: "文档内容", minLength: 2, search: async (q, { limit }) => searchDocsLazy(q, limit) }];
const openDoc = (item: CommandItem) => {
  if (item.href) window.location.href = item.href;
};

function TopBar() {
  const { mode, set } = useHome();
  const commands = useMemo<AdminCommand[]>(
    () => [
      ...CRM_PAGES.map((p) => ({ id: `crm:${p.id}`, label: `打开「${p.title}」演示`, group: "演示", keywords: p.id, run: () => { set({ crm: p.id }); scrollToLive(); } })),
      { id: "mode", label: mode === "dark" ? "换成浅色" : "换成深色", group: "外观", keywords: "dark light 深色 浅色", run: () => set({ mode: mode === "dark" ? "light" : "dark" }) },
      ...PALETTES.map((p) => ({ id: `palette:${p.id}`, label: `色卡换成「${p.name}」`, group: "外观", keywords: `palette ${p.id}`, run: () => set({ palette: p.id }) })),
      ...PALETTE_PAGES.map(([slug, label, group]) => ({ id: `doc:${slug}`, label, group: `文档 · ${group}`, keywords: slug, run: () => { window.location.href = doc(slug); } })),
    ],
    [mode, set],
  );
  return (
    <header className="h-nav">
      <div className="h-wrap h-nav-in">
        <Logo />
        <nav className="h-nav-links" aria-label="主导航">
          {NAV_LINKS.map(([label, slug]) => <a key={slug} href={doc(slug)}>{label}</a>)}
        </nav>
        <div className="h-nav-right">
          <CommandPalette globalShortcut placeholder="搜索文档，或输入命令…" commands={commands} providers={DOC_PROVIDERS} onSelect={openDoc} />
          <GithubStar />
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const { crm } = useHome();
  const page = CRM_PAGES.find((p) => p.id === crm) ?? CRM_PAGES[0];
  return (
    <section id="hero" className="h-hero" aria-labelledby="h-title">
      <div className="h-wrap">
        <div className="h-hero-copy">
          <a className="h-pill" href={doc("changelog")}><b>v{VERSION}</b>开源 · MIT · 组织树选人已上线<ArrowRight aria-hidden="true" /></a>
          <h1 id="h-title">后台里最费工夫的那几块，<br /><em>已经做好了。</em></h1>
          <p>多维表格、看板 / 日历 / 甘特、看板搭建器、记录详情、权限与协作——为数据密集型管理后台而生的 React 组件库。下面这个 CRM 不是截图，是用它搭的。</p>
          <div className="h-cta">
            <Button size="lg" asChild><a href={doc("install")}>开始使用<ArrowRight aria-hidden="true" /></a></Button>
            <Button size="lg" variant="outline" asChild><a href={doc("button")}>浏览组件</a></Button>
            <InstallLine />
          </div>
        </div>
        <div id="live" className="h-live">
          <div className="h-hint" role="note">
            <MousePointerClick aria-hidden="true" />
            <span><b>试试看：</b>{page.hint}</span>
            <span className="h-hint-k">或按 <Kbd keys="Mod+K" /></span>
          </div>
          <div className="h-window">
            <div className="h-window-bar" aria-hidden="true"><i /><i /><i /><span>beichen.example/crm/{crm}</span></div>
            <IslandSlot name="hero" firstScreen minHeight="var(--h-crm-height)" className="h-crm-slot" label="能操作的 CRM" />
          </div>
        </div>
        <div className="h-trust"><Badges /><span>React 19 · TypeScript · 不依赖 Tailwind · 样式只作用在 .adminui 里</span></div>
      </div>
    </section>
  );
}

/** Dark band: the big numbers, then one data set in five views switching by itself. */
function Density() {
  const { palette } = useHome();
  return (
    <AdminProvider storageKey="aui-home-band" palette={isPaletteId(palette) ? palette : "forest"} mode="dark" className="h-band">
      <section id="views" aria-labelledby="h-density">
        <div className="h-band-glow" aria-hidden="true" />
        <div className="h-wrap h-nums">
          <div><strong><CountUp to={100000} /></strong><span>行服务端数据<br />浏览器测试覆盖</span></div>
          <div><strong>≈<CountUp to={24} /><small>KB</small></strong><span>核心样式 gzip<br />其余跟着组件按需进来</span></div>
          <div><strong><CountUp to={EXPORTS_COUNT} /></strong><span>个公开导出<br />组件、hooks、工具函数</span></div>
          <div><strong>6<small>+1</small></strong><span>套色卡 + 深色<br />对比度 ≥ 4.5 : 1</span></div>
        </div>
        <div className="h-wrap h-band-body">
          <SectionHead
            kicker="视图"
            title={<span id="h-density">同一份数据，换着看。</span>}
            sub="表格、看板、日历、甘特、画册共用一个字段清单：18 条商机，6 秒换一种。鼠标放上去就停，点标签自己挑。"
          />
          <IslandSlot name="views" minHeight={660} label="五种视图轮换" />
        </div>
      </section>
    </AdminProvider>
  );
}

function Theming() {
  return (
    <section id="theme" className="h-section h-theme" aria-labelledby="h-theme">
      <div className="h-blobs" aria-hidden="true"><i /><i /><i /></div>
      <div className="h-wrap h-theme-in">
        <div className="h-theme-head">
          <SectionHead
            kicker="主题与看板"
            title={<span id="h-theme">换个色卡，<br />整页一起变。</span>}
            sub="6 套色卡，一个主色系 + 三种点缀色，全部是 CSS 变量；深色由同一套色卡生成，文字对比度 ≥ 4.5:1。下面的看板搭建器也跟着变——拖一拖试试。"
          />
          <PaletteDock />
        </div>
        <IslandSlot name="builder" minHeight={720} label="看板搭建器" />
      </div>
    </section>
  );
}

function Audit() {
  const { palette } = useHome();
  const [after, setAfter] = useState("before");
  return (
    <div className="h-card h-term">
      <div className="h-card-head">
        <span className="h-file">audit · 16 条规则 · 能接进 CI</span>
        <SegmentedControl size="sm" label="修之前 / 修之后" value={after} onValueChange={setAfter} options={[{ value: "before", label: "修之前" }, { value: "after", label: "修之后" }]} />
      </div>
      <AdminProvider storageKey="aui-home-tty" palette={isPaletteId(palette) ? palette : "forest"} mode="dark" className="h-tty-theme">
      <pre className="h-tty">
        <code>
          {(after === "before" ? AUDIT_BAD : AUDIT_OK).split("\n").map((l, i) => (
            <span key={i} className={l.includes("错误 [") ? "h-err" : l.startsWith("✓") ? "h-ok" : l.startsWith("$") ? "h-cmd" : undefined}>{l}{"\n"}</span>
          ))}
        </code>
      </pre>
      </AdminProvider>
    </div>
  );
}

function ForAi() {
  return (
    <section id="ai" className="h-section h-aisec" aria-labelledby="h-ai">
      <div className="h-wrap">
        <SectionHead
          kicker="AI 写后台"
          title={<span id="h-ai">让 AI 写后台，写得和人一样规范。</span>}
          sub="文档同时写给人和 AI：规则告诉它怎么做，能力清单让它查而不是猜，audit 命令在提交前把关。都在包里，跟着版本走。"
        />
        <IslandSlot name="ai" part="demo" minHeight={560} label="AI 生成页面演示" />
        <div className="h-trio">
          <Reveal className="h-card h-rules">
            <div className="h-card-head"><span className="h-file">AI-RULES.md</span><span className="h-dim">≈ 500 行</span></div>
            <pre className="h-md"><code>{RULES}</code></pre>
          </Reveal>
          <IslandSlot name="ai" part="catalog" minHeight={300} label="能力清单搜索" />
          <Audit />
        </div>
        <a className="h-more h-ai-more" href={doc("ai")}>给 AI 用的文档：规则、能力清单、llms.txt<ArrowRight aria-hidden="true" /></a>
      </div>
    </section>
  );
}

function East() {
  return (
    <section id="east" className="h-section h-east" aria-labelledby="h-east">
      <div className="h-wrap">
        <SectionHead
          kicker="中文习惯"
          title={<span id="h-east">中文后台的细节，默认就对。</span>}
          sub="不是把英文组件翻译一遍：节假日与调休、金额按「万」、头像取姓、出错时说清原因和改法，这些规矩从第一个版本起就写在组件里。"
        />
        <IslandSlot name="east" part="details" minHeight={560} label="中文细节" />
        <figure className="h-east-fig">
          <figcaption><b>跟进日历</b>国庆七天「休」、10 日调休「班」· 拖动事件改日期</figcaption>
          <IslandSlot name="east" part="calendar" minHeight={780} label="节假日日历" />
        </figure>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <a className="h-skip" href="#main">跳到正文</a>
      <TopBar />
      <main id="main">
        <Hero />
        <Density />
        <Theming />
        <ForAi />
        <East />
        <section id="compare" className="h-section h-alt" aria-labelledby="h-compare">
          <div className="h-wrap">
            <SectionHead kicker="对比" title={<span id="h-compare">老实说，它适合谁</span>} sub="中文管理后台、表格 / 看板 / 记录详情是重点——选它。要多语言、Vue、营销官网——选别家。" />
            <Compare />
          </div>
        </section>
        <section id="stack" className="h-section" aria-labelledby="h-stack">
          <div className="h-wrap">
            <SectionHead kicker="技术栈" title={<span id="h-stack">React 前端，后端随意</span>} sub="组件只认 adapter（一个返回 Promise 的函数）；Go / Rust 示例把前端静态构建嵌进一个二进制。" />
            <StackStrip />
          </div>
        </section>
        <section id="start" className="h-section h-alt" aria-labelledby="h-start">
          <div className="h-wrap h-start">
            <div>
              <SectionHead kicker="开始" title={<span id="h-start">一行装好，三档起步</span>} sub={`包名 ${PKG}。按项目规模选样板，首屏体积有预算门禁，超了构建失败。`} />
              <InstallBlock />
              <div className="h-start-badges"><Badges /></div>
            </div>
            <Starters />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
