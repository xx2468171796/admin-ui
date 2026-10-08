import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MESSAGES, type Lang, type Messages } from "../i18n";
import type { PreviewMode } from "./preview-protocol";

type Site = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Messages;
  mode: PreviewMode;
  setMode: (mode: PreviewMode) => void;
  palette: string;
  setPalette: (id: string) => void;
  slug: string;
  navigate: (slug: string, hash?: string) => void;
};

const SiteContext = createContext<Site | null>(null);

export function useSite(): Site {
  const site = useContext(SiteContext);
  if (!site) throw new Error("useSite outside SiteProvider");
  return site;
}

const KEY = "aui-site:prefs";
type Prefs = { lang: Lang; mode: PreviewMode; palette: string };

function readPrefs(): Prefs {
  const fallback: Prefs = { lang: "zh", mode: "light", palette: "forest" };
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (typeof raw !== "object" || raw === null) return fallback;
    const r = raw as Record<string, unknown>;
    return {
      lang: r.lang === "en" ? "en" : "zh",
      mode: r.mode === "dark" ? "dark" : "light",
      palette: typeof r.palette === "string" ? r.palette : "forest",
    };
  } catch {
    return fallback;
  }
}

/** Route = file name: `/x/y/button.html` or the clean `/button` (static hosts try `$uri.html`) → "button"; `/` or index.html → "index". */
export function slugFromPath(pathname: string): string {
  const last = pathname.split("/").pop() ?? "";
  const m = /^([a-z0-9-]+)(?:\.html)?$/.exec(last);
  return m?.[1] ?? "index";
}

export function hrefFor(slug: string): string {
  return `${slug}.html`;
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState(readPrefs);
  const [slug, setSlug] = useState(() => slugFromPath(window.location.pathname));

  useEffect(() => {
    // Sandboxed previews (opaque origin) have no storage: keep the prefs in memory then.
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* no storage */
    }
  }, [prefs]);

  useEffect(() => {
    const onPop = () => {
      const next = slugFromPath(window.location.pathname);
      if (next === "index") window.location.reload();
      else setSlug(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((next: string, hash?: string) => {
    const url = hrefFor(next) + (hash ? `#${hash}` : "");
    // The homepage is its own small bundle (src/home): load it as a page, not inside the docs app.
    if (next === "index") {
      window.location.href = url;
      return;
    }
    try {
      window.history.pushState(null, "", url);
    } catch {
      // Some sandboxed frames refuse pushState: every route is a real file, so just load it.
      window.location.href = url;
      return;
    }
    setSlug(next);
    if (hash) requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView());
    else window.scrollTo({ top: 0 });
  }, []);

  const value = useMemo<Site>(
    () => ({
      lang: prefs.lang,
      setLang: (lang) => setPrefs((p) => ({ ...p, lang })),
      t: MESSAGES[prefs.lang],
      mode: prefs.mode,
      setMode: (mode) => setPrefs((p) => ({ ...p, mode })),
      palette: prefs.palette,
      setPalette: (palette) => setPrefs((p) => ({ ...p, palette })),
      slug,
      navigate,
    }),
    [prefs, slug, navigate],
  );
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

/** An in-site link: real href (works without JS, middle-click, copy link), SPA navigation on plain click. */
export function SiteLink({ to, hash, children, className, ...rest }: { to: string; hash?: string; children: ReactNode; className?: string; "aria-current"?: "page" | undefined }) {
  const { navigate } = useSite();
  return (
    <a
      href={hrefFor(to) + (hash ? `#${hash}` : "")}
      className={className}
      {...rest}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to, hash);
      }}
    >
      {children}
    </a>
  );
}
