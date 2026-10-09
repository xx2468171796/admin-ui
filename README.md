# admin-ui

**A React 19 component library for data-dense admin backends** — page templates, data tables, a multi-view grid, record detail, access management, dashboards, form builders, themes, and machine-readable usage rules that AI coding tools can follow.

[![CI](https://github.com/xx2468171796/admin-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/xx2468171796/admin-ui/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@adminui/react.svg)](https://www.npmjs.com/package/@adminui/react)
[![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Docs and live demos: **https://adminui.zygskins.cn** · [中文说明](README.zh-CN.md)

## Why

- **Templates first.** Page templates (list, KPI list, sections, settings, workspace, board, wizard …) fix the layout so every page in a backend looks and behaves the same.
- **Built for real data.** Tables with server-side paging, sorting, frozen columns and bulk actions; a virtualized multi-view grid (grid / kanban / gallery / calendar / gantt) for 100k-row tables; record detail in three sizes.
- **Small by default.** The root entry and `styles.css` stay small (budgets enforced in CI); heavy features live in optional subpaths and their CSS follows the component that uses it.
- **Backend-agnostic.** Data, permissions and business rules come in through adapters you write; examples include a Go / Rust single-binary service.
- **Guard rails included.** `admin-ui-audit` (shipped as a bin) flags UI drift — hand-rolled buttons, off-palette colors, deep imports — in your own project.

## Install

```sh
npm install @adminui/react react@^19 react-dom@^19
```

**Until the package is available on npm**, install the tarball attached to the GitHub Release (same content as the npm package):

```sh
npm install https://github.com/xx2468171796/admin-ui/releases/download/v8.8.0/adminui-react-8.8.0.tgz react@^19 react-dom@^19
```

Projects that import the package under another name can use an npm alias (`"my-ui": "npm:@adminui/react@^8"`); `admin-ui-audit` recognises such aliases from your `package.json`.

Optional peers are only needed for the subpath that uses them:

| Import | What | Extra install |
|---|---|---|
| `@adminui/react` | core components, hooks, contracts, palettes | — |
| `@adminui/react/styles.css` | core styles (tokens, base, core components) | — |
| `@adminui/react/grid` | multi-view grid `BitableGrid` | `@tanstack/react-table` `@tanstack/react-virtual` |
| `@adminui/react/views` | kanban, gallery, calendar, gantt, view tabs | — |
| `@adminui/react/charts` · `/dashboard-builder` | charts and the dashboard builder | `echarts` |
| `@adminui/react/form-builder` · `/forms-public` | form builder · public fill-in page | — |
| `@adminui/react/access` | permission widgets, access console, governance pages | — |
| `@adminui/react/settings` | dictionary / parameter settings pages (`/peizhi` is a deprecated alias kept in 8.x) | — |
| `@adminui/react/markdown` | Markdown editor | `react-markdown` `remark-gfm` |
| `@adminui/react/excel` | CSV / XLSX parsing | `read-excel-file` |
| `@adminui/react/grid-query` · `/record-detail-spec` | React-free server half (view → query, layout validation) | — |
| `@adminui/react/catalog` | machine-readable capability list (plain data) | — |

## Quick start

```tsx
import "@adminui/react/styles.css"; // first import of your entry file
import { AdminProvider, NotificationProvider } from "@adminui/react";

export function Root({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider storageKey="my-app:admin" palette="forest" mode="system">
      <NotificationProvider>{children}</NotificationProvider>
    </AdminProvider>
  );
}
```

Locale defaults are neutral: dates use the browser's time zone, amounts show no currency symbol and the phone box starts with the country of the browser locale. Set your own once on the provider (component props still win):

```tsx
<AdminProvider storageKey="my-app:admin" defaults={{ timeZone: "Europe/Berlin", currency: "EUR", phoneCountry: "+49" }}>
```

Server-side helpers (`/grid-query`) don't read the provider: pass `timeZone` explicitly.

Import only from public entry points, and lazy-load heavy subpaths (`grid`, `views`, `charts`, `dashboard-builder`, `form-builder`, `access`, `markdown`, `excel`):

```tsx
const CustomersGrid = lazy(() => import("./customers-grid")); // imports "@adminui/react/grid" inside
```

Add the drift check to your CI:

```sh
npx admin-ui-audit src --baseline ui-audit-baseline.json
```

## Examples

| Folder | Starting point for |
|---|---|
| [examples/small](examples/small) | an internal tool with one or two lists (core entry only) |
| [examples/medium](examples/medium) | a full backend: every template, grid, access, dashboards |
| [examples/large](examples/large) | a multi-module backend with lazy-loaded heavy features |
| [examples/single-service](examples/single-service) | Go or Rust + SQLite serving the built frontend from one binary |

## Repository layout

```
packages/react   the library (@adminui/react), its tests, size budgets and audit tool
sites/docs       the docs and demo site (https://adminui.zygskins.cn)
examples/        standalone consumer projects
scripts/         build (dist), dist check, leak guard
```

The compiled `dist/` is **not committed**: CI and the release workflow build it (`npm run build`). Run `npm run build` once after cloning before `npm run check`.

## Contributing

Pull requests are welcome — read [CONTRIBUTING.md](CONTRIBUTING.md) first. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md); report security issues privately through GitHub private vulnerability reporting (see [SECURITY.md](SECURITY.md); there is no security e-mail address).

## License

[MIT](LICENSE) © 2026 admin-ui contributors. Parts of the component patterns derive from shadcn/ui (MIT); see [THIRD-PARTY.md](THIRD-PARTY.md).
