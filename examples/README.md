# Examples / 示例

Standalone consumer projects that install `@adminui/react` from npm (`^8.3.0`). Copy a folder out of this repository and run:

```sh
npm install
npm run dev     # or: npm run build
```

| Folder | Tier | First-screen budget (gzip) |
|---|---|---|
| `small/` | one or two lists, core entry only | ≤ 72 KB JS excl. React / ≤ 32 KB CSS |
| `medium/` | full backend: every page template, grid, access, dashboards | ≤ 300 KB JS incl. React / ≤ 40 KB CSS |
| `large/` | many modules, heavy features lazy-loaded | ≤ 300 KB JS incl. React / ≤ 40 KB CSS |
| `single-service/` | Go or Rust + SQLite, one binary embeds the built frontend | — |

**Single service:** build the frontend first (`cd web && npm install && npm run build`), copy `web/dist` to `go/web/dist` for Go (Rust embeds `web/dist` directly), then follow `single-service/README.md` for `go run .` / `cargo run`.

**Where to edit:** these folders are generated copies. The source of truth is `packages/react/examples/` (`starter` = medium), where they are type-checked, audited and size-budgeted against the local library in CI — please send pull requests there. To try local library changes in an example, run `npm pack ./packages/react` and install the tarball.

---

可以直接拷走的独立消费方项目，从 npm 安装 `@adminui/react`（`^8.3.0`）。拷出目录后 `npm install`、`npm run dev`。这些目录是生成的副本，正本在 `packages/react/examples/`（`starter` 即 medium），CI 在那里对本地库做类型检查、审计和体积预算——改示例请改那边。
