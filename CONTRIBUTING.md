# Contributing to admin-ui

Thanks for helping! Bug reports, docs fixes, new examples and components are all welcome. [中文版](CONTRIBUTING.zh-CN.md)

## Before you start

- For anything bigger than a small fix, open an issue first so we can agree on the API and the look. Components are a contract shared by many backends; a new prop or class name is hard to take back.
- Read `packages/react/AI-RULES.md` and `packages/react/DESIGN.md`: colors come only from the palette, controls are 36px (28px small), styles are scoped under `.adminui`, heavy dependencies only through optional subpaths.

## Setup

Requirements: Node.js 26+, npm 11+.

```sh
npm ci            # or npm install
npm run build     # dist/ is not committed; build it once
npm run check     # typecheck + unit tests + audits + CSS chunks + dist check + size budgets
npm run docs:dev  # docs site with live demos
```

Browser suites (Playwright) are optional locally: `npx playwright install chromium`, then e.g. `npm run test:browser` or a focused suite such as `npm run test:grid -w @adminui/react`. `packages/react/AGENTS.md` lists which suite covers which files.

## Making a change

1. Branch from `main`.
2. Keep the public surface in sync: export in `src/index.ts` (or the subpath entry), the entry in `src/catalog.ts`, the docs page, the medium example, and a line in `CHANGELOG.md` under *Unreleased*.
3. Run `npm run check` and the browser suite for the area you touched. If you changed size-sensitive code, `npm run size` shows the numbers.
4. Run `npm run guard` — CI rejects names and references that do not belong in this repository.
5. Open a pull request using the template. Screenshots (light, dark, 390px mobile) are required for visual changes.

## Commit style

Short imperative subject (`grid: keep frozen columns when resizing`), body explaining *why*. One logical change per PR.

## Releases

Maintainers tag `vX.Y.Z` on `main`; the release workflow builds, checks and publishes to npm with provenance. Version numbers follow semver; breaking changes come with a migration note in `CHANGELOG.md`.

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
