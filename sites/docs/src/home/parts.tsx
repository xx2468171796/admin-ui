import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";
import { IconButton, PALETTES, SegmentedControl, StatusBadge, Tag } from "@adminui/react";
import { FOOTER, INSTALL, PKG, RELEASES, RIVALS, STACKS, STARTERS, USAGE, VERSION, WEAK_SPOTS, doc, starterCmd, type PackageManager } from "./content";
import { SiteLogo } from "../shell/site-header";
import { useHome } from "./store";

/** Sets data-in="1" once the element scrolls into view (CSS only animates without reduced motion). */
export function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) {
        setSeen(true);
        io.disconnect();
      }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.12);
  return <div ref={ref} className={`h-reveal ${className}`} data-in={seen ? "1" : undefined}>{children}</div>;
}

/** Counts up to `to` once visible; shows the final number straight away under reduced motion. */
export function CountUp({ to, format = (n: number) => n.toLocaleString("zh-CN") }: { to: number; format?: (n: number) => string }) {
  const { reduced } = useHome();
  const [ref, seen] = useInView<HTMLSpanElement>(0.5);
  const [n, setN] = useState(to);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!seen || reduced || started) return;
    setStarted(true);
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 1100);
      setN(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, reduced, started, to]);
  return <span ref={ref}>{format(n)}</span>;
}

export function Badges() {
  return (
    <div className="h-badges" aria-label="徽章">
      <span className="h-badge"><i>license</i><b>MIT</b></span>
      <span className="h-badge"><i>version</i><b>v{VERSION}</b></span>
      <span className="h-badge"><i>react</i><b>19</b></span>
      <span className="h-badge"><i>css gzip</i><b>≈ 24 KB</b></span>
      <span className="h-badge"><i>types</i><b>TypeScript</b></span>
    </div>
  );
}

export function CopyText({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* sandboxed frames may refuse the clipboard */
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 1400);
  };
  return (
    <IconButton size="sm" label={done ? "已复制" : `复制${label}`} icon={done ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} onClick={copy} />
  );
}

export function InstallLine() {
  return (
    <div className="h-installline">
      <code><span className="h-prompt">$</span> {INSTALL.npm}</code>
      <CopyText text={INSTALL.npm} label="安装命令" />
    </div>
  );
}

/** The npm note: until the package is on npm, installs go through the GitHub Release tarball. */
export function ReleaseNote() {
  return (
    <p className="h-release-note">
      npm 上架之前，先从 <a href={RELEASES}>GitHub Release</a> 下载 .tgz，再 <code>npm i ./下载的文件.tgz</code>。
    </p>
  );
}

export function InstallBlock() {
  const [pm, setPm] = useState<PackageManager>("npm");
  return (
    <div className="h-install">
      <div className="h-install-head">
        <SegmentedControl size="sm" label="包管理器" value={pm} onValueChange={setPm} options={[{ value: "npm", label: "npm" }, { value: "pnpm", label: "pnpm" }, { value: "yarn", label: "yarn" }]} />
        <span className="h-install-note">React 19 · TypeScript</span>
      </div>
      <div className="h-code h-code-line">
        <code><span className="h-prompt">$</span> {INSTALL[pm]}</code>
        <CopyText text={INSTALL[pm]} label="安装命令" />
      </div>
      <ReleaseNote />
      <pre className="h-code h-code-block"><code>{USAGE}</code></pre>
    </div>
  );
}

export function Starters() {
  return (
    <div className="h-starters">
      {STARTERS.map((s) => (
        <div key={s.size} className="h-starter">
          <div className="h-starter-head">
            <span className="h-starter-size">{s.size}</span>
            <div>
              <strong>{s.name}</strong>
              <span>examples/{s.dir}</span>
            </div>
          </div>
          <p>{s.who}</p>
          <div className="h-starter-budget"><Tag>{s.budget}</Tag><Tag>{s.css}</Tag></div>
          <div className="h-code h-code-line h-code-sm">
            <code>{starterCmd(s.dir)}</code>
            <CopyText text={starterCmd(s.dir)} label={`${s.name}样板命令`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Compare() {
  return (
    <div className="h-compare">
      <div className="h-compare-rows">
        {RIVALS.map((r) => (
          <div key={r.name} className="h-compare-row">
            <strong>{r.name}</strong>
            <span className="h-them">{r.them}</span>
            <span className="h-us"><Check aria-hidden="true" />{r.us}</span>
          </div>
        ))}
      </div>
      <div className="h-weak">
        <strong>选之前请看：我们的短板</strong>
        <ul>{WEAK_SPOTS.map((w) => <li key={w}>{w}</li>)}</ul>
        <a href={doc("why")} className="h-more">完整对比（9 家，含「未核实」标注）<ArrowRight aria-hidden="true" /></a>
      </div>
    </div>
  );
}

export function StackStrip() {
  return (
    <div className="h-stacks">
      {STACKS.map((s) => (
        <div key={s.name} className="h-stack">
          <strong>{s.name}</strong>
          <span>{s.note}</span>
          <StatusBadge tone={s.status === "已验证" ? "success" : s.status === "文档支持" ? "info" : "neutral"} variant="dot">{s.status}</StatusBadge>
        </div>
      ))}
    </div>
  );
}

/** Six palettes + light / dark for the whole page (and every live demo on it). */
export function PaletteDock() {
  const { palette, set, mode } = useHome();
  return (
    <div className="h-dock">
      <div className="h-swatches" role="radiogroup" aria-label="色卡">
        {PALETTES.map((p) => (
          // admin-ui-audit-ignore raw-control: 首页的色卡样片（四个色点 + 名字），整页换色的展示件
          <button key={p.id} type="button" role="radio" aria-checked={palette === p.id} className="h-swatch" onClick={() => set({ palette: p.id })}>
            <span className="h-swatch-dots" aria-hidden="true">
              <i style={{ background: p.primary }} />
              <i style={{ background: p.attention }} />
              <i style={{ background: p.danger }} />
              <i style={{ background: p.info }} />
            </span>
            <span className="h-swatch-name">{p.name}</span>
          </button>
        ))}
      </div>
      <SegmentedControl size="sm" label="明暗" value={mode} onValueChange={(m) => set({ mode: m })} options={[{ value: "light", label: "浅色" }, { value: "dark", label: "深色" }]} />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="h-footer">
      <div className="h-footer-grid">
        <div className="h-footer-brand">
          <SiteLogo badge={false} />
          <p>为数据密集型管理后台而生的 React 组件库。</p>
          <code>{INSTALL.npm}</code>
        </div>
        {FOOTER.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <strong>{col.title}</strong>
            {col.links.map(([t, href]) => <a key={t} href={href}>{t}</a>)}
          </nav>
        ))}
      </div>
      <div className="h-footer-base">
        <span>MIT License · © 2026 admin-ui 贡献者</span>
        <span>演示数据「北辰云」及其中的公司、人名均为虚构</span>
        <span>{PKG} v{VERSION}</span>
      </div>
    </footer>
  );
}

export function SectionHead({ kicker, title, sub }: { kicker?: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="h-shead">
      {kicker && <span className="h-kicker">{kicker}</span>}
      <h2>{title}</h2>
      {sub && <p>{sub}</p>}
    </div>
  );
}
