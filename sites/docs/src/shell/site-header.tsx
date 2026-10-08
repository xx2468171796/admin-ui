import type { ReactNode } from "react";
import { Github, Moon, Star, Sun } from "lucide-react";
import { CommandPalette, IconButton, type AdminCommand, type CommandItem, type CommandProvider } from "@adminui/react";
import type { Lang } from "../i18n";
import { GITHUB, HEADER_NAV, SEARCH_PLACEHOLDER, VERSION_BADGE, type HeaderNavId } from "./site-header-data";
import "./site-header.css";

const MODE_LABEL: Record<Lang, { dark: string; light: string }> = {
  zh: { dark: "换成深色", light: "换成浅色" },
  en: { dark: "Switch to dark", light: "Switch to light" },
};

/** The brand mark: logo + wordmark + version badge. Same on the homepage, the docs pages and the footer. */
export function SiteLogo({ badge = true }: { badge?: boolean }) {
  return (
    <a className="sh-logo" href="index.html" aria-label="admin-ui 首页">
      <svg width={28} height={28} viewBox="0 0 32 32" aria-hidden="true">
        <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--aui-primary-fill)" />
        <rect x="7" y="8" width="18" height="3.2" rx="1.6" fill="var(--aui-on-primary)" />
        <rect x="7" y="14.4" width="11" height="3.2" rx="1.6" fill="var(--aui-on-primary)" opacity=".85" />
        <rect x="7" y="20.8" width="15" height="3.2" rx="1.6" fill="var(--aui-on-primary)" opacity=".7" />
        <rect x="20" y="14.4" width="5" height="9.6" rx="1.6" fill="var(--aui-on-primary)" opacity=".55" />
      </svg>
      <span>admin-ui</span>
      {badge && <span className="sh-version">{VERSION_BADGE}</span>}
    </a>
  );
}

export type SiteHeaderProps = {
  lang?: Lang;
  /** Highlighted nav item (docs pages); the homepage passes none. */
  current?: HeaderNavId;
  mode: "light" | "dark";
  onToggleMode: () => void;
  commands: AdminCommand[];
  providers: readonly CommandProvider[];
  onSelect: (item: CommandItem) => void;
  /** In-app navigation for plain clicks (docs SPA); without it the links load the page. */
  navigate?: (slug: string) => void;
  /** Before the brand: the docs sidebar toggle on small screens. */
  leading?: ReactNode;
  /** Extra switches between search and GitHub (docs: palette, language). */
  tools?: ReactNode;
};

/**
 * The one site header (homepage and docs): brand, the shared nav (site-header-data.ts), search palette (Ctrl / ⌘ K),
 * GitHub, dark-mode switch. On small screens the nav moves to a row under the bar (only one of the two is displayed).
 */
export function SiteHeader({ lang = "zh", current, mode, onToggleMode, commands, providers, onSelect, navigate, leading, tools }: SiteHeaderProps) {
  const dark = mode === "dark";
  const label = lang === "en" ? "Main" : "主导航";
  const links = HEADER_NAV.map((item) => (
    <a
      key={item.id}
      href={`${item.slug}.html`}
      aria-current={current === item.id ? "page" : undefined}
      onClick={(e) => {
        if (!navigate || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(item.slug);
      }}
    >
      {item.label[lang]}
    </a>
  ));
  return (
    <>
      <header className="sh">
        <div className="sh-in">
          <div className="sh-brand">
            {leading && <div className="sh-lead">{leading}</div>}
            <SiteLogo />
          </div>
          <nav className="sh-nav" aria-label={label}>
            {links}
          </nav>
          <div className="sh-tools">
            <CommandPalette globalShortcut placeholder={SEARCH_PLACEHOLDER[lang]} commands={commands} providers={providers} onSelect={onSelect} />
            {tools && <div className="sh-extra">{tools}</div>}
            <a className="sh-star" href={GITHUB} aria-label="GitHub">
              <Github aria-hidden="true" />
              <span>GitHub</span>
              <b><Star aria-hidden="true" />Star</b>
            </a>
            <IconButton
              variant="outline"
              label={dark ? MODE_LABEL[lang].light : MODE_LABEL[lang].dark}
              pressed={dark}
              icon={dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              onClick={onToggleMode}
            />
          </div>
        </div>
      </header>
      {/* Narrow screens: the same links as a sideways-scrolling row under the bar, scrolling away with the page. */}
      <nav className="sh-row" aria-label={label}>
        {links}
      </nav>
    </>
  );
}
