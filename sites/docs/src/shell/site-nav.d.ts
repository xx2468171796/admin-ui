/** Light navigation data generated at build time from src/content (vite.config.ts `site-nav` plugin). */
declare module "virtual:site-nav" {
  export type NavDoc = { slug: string; title: string; status?: string };
  export type NavGroup = { id: string; title: string; docs: readonly NavDoc[] };
  export type NavRoute = { slug: string; title: string; summary: string; groupTitle?: string; keywords?: string };
  const nav: {
    guides: readonly { slug: string; title: string }[];
    groups: readonly NavGroup[];
    routes: readonly NavRoute[];
    componentSlugs: readonly string[];
    exportsCount: number;
  };
  export default nav;
}
