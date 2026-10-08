import "@adminui/react/styles.css";
import { Suspense, lazy, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { AdminProvider, NotificationProvider, StatePanel, isPaletteId } from "@adminui/react";
import { docBySlug, routeBySlug } from "./content/index";
import { ComponentPage } from "./shell/component-page";
import { Layout } from "./shell/layout";
import { SiteLink, SiteProvider, useSite } from "./shell/site-context";
import { searchDocs } from "./shell/search";
import { DEMO_DEFAULTS } from "./shell/site-defaults";
import "./site.css";

const Theming = lazy(() => import("./pages/theming").then((m) => ({ default: m.Theming })));
const ForAi = lazy(() => import("./pages/for-ai").then((m) => ({ default: m.ForAi })));
const TemplatesGallery = lazy(() => import("./pages/templates-gallery").then((m) => ({ default: m.TemplatesGallery })));
const MdPage = lazy(() => import("./pages/md-page").then((m) => ({ default: m.MdPage })));

const MD_PAGES = new Set(["why", "stacks", "install", "migration", "changelog"]);

function Page({ slug }: { slug: string }) {
  const doc = docBySlug(slug);
  if (doc) return <ComponentPage doc={doc} />;
  if (slug === "index") return <StatePanel kind="loading" title="正在打开首页…" />;
  if (slug === "theming") return <Theming />;
  if (slug === "ai") return <ForAi />;
  if (slug === "templates-gallery") return <TemplatesGallery />;
  if (MD_PAGES.has(slug)) return <MdPage slug={slug} />;
  return (
    <StatePanel
      kind="empty"
      title="没有这个页面"
      message="可能是链接写错了，或者页面改了名字。"
      action={<SiteLink to="index">回到首页</SiteLink>}
    />
  );
}

function App() {
  const { slug, mode, palette } = useSite();
  useEffect(() => {
    const route = routeBySlug(slug);
    document.title = slug === "index" || !route ? "admin-ui · 为管理后台而生的 React 组件库" : `${route.title} · admin-ui`;
  }, [slug]);
  return (
    <AdminProvider storageKey="aui-site" defaults={DEMO_DEFAULTS} palette={isPaletteId(palette) ? palette : "forest"} mode={mode} className="site-root">
      <NotificationProvider>
        <Layout search={searchDocs}>
          <Suspense fallback={<StatePanel kind="loading" />}>
            <Page slug={slug} />
          </Suspense>
        </Layout>
      </NotificationProvider>
    </AdminProvider>
  );
}

const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <SiteProvider>
      <App />
    </SiteProvider>,
  );
