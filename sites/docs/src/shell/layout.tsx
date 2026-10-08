import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BookOpen, Languages, Menu as MenuIcon, Moon, Palette, Sun, X } from "lucide-react";
import { CommandPalette, IconButton, InlineAlert, MoreMenu, PALETTES, type AdminCommand, type CommandProvider } from "@adminui/react";
import nav from "virtual:site-nav";
import { SiteLink, useSite } from "./site-context";
import type { DocSearch } from "./search-blocks";

function Sidebar({ onPick }: { onPick: () => void }) {
  const { slug, t } = useSite();
  const guides = nav.guides.filter((g) => g.slug !== "index");
  return (
    <nav className="site-side" aria-label={t.menu}>
      <div className="site-side-group">
        <h2>{t.guides}</h2>
        <ul>
          {guides.map((g) => (
            <li key={g.slug}>
              <SiteLink to={g.slug} aria-current={slug === g.slug ? "page" : undefined}>{g.title}</SiteLink>
            </li>
          ))}
        </ul>
      </div>
      {nav.groups.map((group) => {
        const docs = group.docs;
        if (!docs.length) return null;
        return (
          <div className="site-side-group" key={group.id}>
            <h2>{group.title}</h2>
            <ul>
              {docs.map((d) => (
                <li key={d.slug} onClick={onPick}>
                  <SiteLink to={d.slug} aria-current={slug === d.slug ? "page" : undefined}>
                    {d.title}
                    {d.status === "preview" && <span className="site-soon">{t.preview}</span>}
                  </SiteLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/**
 * Site frame: top bar (search palette, palette / language / dark switches), sidebar, footer. Navigation comes from
 * the build-time nav data (no doc content), so the light home bundle can use it too; `search` is the full-text search
 * of the docs (in memory in the docs bundle, a lazily loaded index on the home page).
 */
export function Layout({ children, wide, search }: { children: ReactNode; wide?: boolean; search: DocSearch }) {
  const { t, mode, setMode, palette, setPalette, lang, setLang, slug, navigate } = useSite();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [slug]);

  const commands = useMemo<AdminCommand[]>(
    () =>
      nav.routes.map((r) => ({
        id: `nav:${r.slug}`,
        label: r.title,
        group: r.groupTitle ?? t.guides,
        keywords: `${r.slug} ${r.keywords ?? ""} ${r.summary}`,
        run: () => navigate(r.slug),
      })),
    [navigate, t.guides],
  );
  const providers = useMemo<CommandProvider[]>(
    () => [{ id: "content", label: "文档内容", minLength: 2, search: async (q, { limit }) => search(q, limit) }],
    [search],
  );

  return (
    <div className="site" data-drawer={drawer ? "open" : undefined}>
      <header className="site-top">
        <IconButton className="site-menu-btn" label={t.menu} icon={drawer ? <X /> : <MenuIcon />} onClick={() => setDrawer((v) => !v)} />
        <SiteLink to="index" className="site-logo">
          <span className="site-logo-mark" aria-hidden="true">A</span>
          <span className="site-logo-text">admin-ui</span>
          <span className="site-version">8.3</span>
        </SiteLink>
        <nav className="site-top-nav" aria-label="主导航">
          <SiteLink to="install" aria-current={slug === "install" ? "page" : undefined}>{t.navGuide}</SiteLink>
          <SiteLink to="button" aria-current={nav.componentSlugs.includes(slug) ? "page" : undefined}>{t.navComponents}</SiteLink>
          <SiteLink to="why" aria-current={slug === "why" ? "page" : undefined}>{t.navWhy}</SiteLink>
          <SiteLink to="stacks" aria-current={slug === "stacks" ? "page" : undefined}>{t.navStacks}</SiteLink>
        </nav>
        <div className="site-top-tools">
          <CommandPalette
            globalShortcut
            commands={commands}
            providers={providers}
            placeholder={t.search}
            onSelect={(item) => {
              if (item.href) navigate(item.href.replace(/\.html.*$/, ""), item.href.split("#")[1]);
            }}
          />
          <MoreMenu
            icon={<Palette />}
            label={t.palette}
            sections={[{ items: PALETTES.map((p) => ({ key: p.id, label: p.name, checked: palette === p.id, onSelect: () => setPalette(p.id) })) }]}
          />
          <MoreMenu
            icon={<Languages />}
            label={t.langLabel}
            sections={[
              {
                items: [
                  { key: "zh", label: "简体中文", checked: lang === "zh", onSelect: () => setLang("zh") },
                  { key: "en", label: "English", checked: lang === "en", onSelect: () => setLang("en") },
                ],
              },
            ]}
          />
          <IconButton
            label={mode === "dark" ? t.darkOff : t.darkOn}
            icon={mode === "dark" ? <Sun /> : <Moon />}
            onClick={() => setMode(mode === "dark" ? "light" : "dark")}
          />
        </div>
      </header>
      <div className="site-body">
        <aside className="site-aside">
          <Sidebar onPick={() => setDrawer(false)} />
        </aside>
        <div className="site-scrim" aria-hidden="true" onClick={() => setDrawer(false)} />
        <main className="site-main" data-wide={wide ? "true" : undefined}>
          {lang === "en" && (
            <div className="site-en">
              <InlineAlert tone="info" title={t.enNotice} />
            </div>
          )}
          {children}
          <footer className="site-foot">
            <BookOpen aria-hidden="true" />
            <span>{t.footer}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
