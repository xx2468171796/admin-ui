import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { auditText, auditPaths, compareBaseline, makeBaseline, main, RULES, TEMPLATE_BLOCKS } from "../scripts/ui-audit.mjs";
import { TOOLS, PAGE_TEMPLATES } from "../src/catalog.ts";

const rules = (text: string, file = "page.tsx") => auditText(text, file).map((f) => `${f.rule}@${f.line}`);

test("raw-control: native controls in JSX, hidden / file inputs allowed", () => {
  const src = [
    "export function A() {",
    "  return <div>",
    '    <button onClick={go}>保存</button>',
    "    <table><tbody /></table>",
    '    <input type="hidden" name="t" />',
    '    <input type="file" accept=".csv" hidden />',
    '    <input value={v} />',
    "    <select />",
    "    <dialog open />",
    "  </div>;",
    "}",
    "const ref = useRef<HTMLButtonElement>(null); // <button> in a comment is fine",
    'const msg = "<button> in a string is fine";',
  ].join("\n");
  assert.deepEqual(rules(src), ["raw-control@3", "raw-control@4", "raw-control@7", "raw-control@8", "raw-control@9"]);
});

test("native-date: kit Input as a native date / time picker is a warning; text inputs and the pickers are fine", () => {
  const src = [
    "export function A() {",
    "  return <div>",
    '    <Input type="date" value={d} />',
    '    <Input id="x" type={"datetime-local"} value={t} />',
    '    <Input type="time" />',
    '    <Input type="text" value={v} />',
    "    <DatePicker value={d} onChange={setD} />",
    "  </div>;",
    "}",
  ].join("\n");
  assert.deepEqual(rules(src), ["native-date@3", "native-date@4", "native-date@5"]);
  assert.equal(auditText(src, "page.tsx")[0]?.level, "warn");
});

test("hard-colour: CSS values, inline styles and paint attributes; tokens and keywords allowed", () => {
  const css = [
    ".box { color: #333; }",
    ".ok { color: var(--aui-text); background: transparent; border-color: currentColor; }",
    ".mix { background: color-mix(in srgb, var(--aui-primary) 10%, white); }",
    ".shadow { box-shadow: 0 1px 2px rgba(0, 0, 0, .2); }",
    ".named { background: white; }",
    ".font { font-family: Red Hat, sans-serif; mask-image: linear-gradient(black, transparent); }",
    ".icon { background: url(#abc) no-repeat; }",
    ":root { --brand: hsl(140 30% 40%); }",
  ].join("\n");
  assert.deepEqual(rules(css, "page.css"), ["hard-colour@1", "hard-colour@4", "hard-colour@5", "hard-colour@8"]);
  const tsx = [
    'const a = <div style={{ color: "#c00", padding: 8 }} />;',
    'const b = <div style={{ background: "var(--aui-soft)", color: ok ? "red" : "rgb(1,2,3)" }} />;',
    'const c = <path fill="#fff" stroke="currentColor" d="M0 0" />;',
    'const d = <circle fill="none" stroke="var(--aui-primary)" />;',
    'const e = <a href="#add">跳到新增</a>;',
  ].join("\n");
  assert.deepEqual(rules(tsx), ["hard-colour@1", "hard-colour@2", "hard-colour@3"]);
});

test("colour-bar: coloured left / top borders and inset shadows ≥ 2px", () => {
  const css = [
    ".a { border-left: 3px solid var(--aui-primary); }",
    ".b { border-top: 2px solid var(--aui-warning); }",
    ".c { border-left: 1px solid var(--aui-primary); }",
    ".d { border-top: 2px solid var(--aui-border); }",
    ".e { box-shadow: inset 4px 0 0 var(--aui-danger); }",
    ".f { box-shadow: inset 0 0 0 1px var(--aui-line); }",
    ".g { border: 2px solid var(--aui-primary); }",
  ].join("\n");
  assert.deepEqual(rules(css, "x.css"), ["colour-bar@1", "colour-bar@2", "colour-bar@5"]);
  assert.deepEqual(rules('const x = <div style={{ borderLeft: "4px solid var(--aui-info)" }} />;'), ["colour-bar@1"]);
});

test("sdk-override: consumer selectors that patch .aui-* classes", () => {
  const css = [".page .aui-panel { padding: 0; }", "@media (max-width: 600px) {", "  .mine { gap: 8px; }", "  :global(.aui-button) { height: 30px; }", "}", ".aurora { gap: 4px; }"].join("\n");
  assert.deepEqual(rules(css, "x.css"), ["sdk-override@1", "sdk-override@4"]);
  // Own classes inside SDK markup are fine; anonymous / element children of SDK elements are not.
  const nested = [".aui-table .row-actions { flex-wrap: nowrap; }", ".side .aui-panel > * + * { margin-top: 8px; }", ".x .aui-card svg { width: 12px; }"].join("\n");
  assert.deepEqual(rules(nested, "y.css"), ["sdk-override@2", "sdk-override@3"]);
});

test("row-actions: actions column render with Button / RowActions instead of RowActionBar", () => {
  const src = [
    "const columns = [",
    '  { key: "name", title: "名称", render: (r) => <Button>不是操作列</Button> },',
    '  { key: "actions", title: "操作", kind: "actions", render: (r) => <>',
    '    <Button size="sm">编辑</Button>',
    "    <RowActions actions={[]} />",
    "  </> },",
    '  { key: "ops", kind: "actions", render: (r) => <RowActionBar actions={[{ key: "e", label: "编辑", onSelect: edit }]} /> },',
    "];",
  ].join("\n");
  assert.deepEqual(rules(src), ["row-actions@4"]);
});

test("intro-paragraph and page-title around PageHeader", () => {
  const src = [
    "export function Page() {",
    "  return <PageBody>",
    '    <PageHeader title="机器" showTitle actions={<Button>新增</Button>} />',
    '    <p className="aui-note">这里列出所有机器，可以新增、编辑。</p>',
    '    <ResourcePanel title="机器"><p>面板里的段落不算</p></ResourcePanel>',
    "  </PageBody>;",
    "}",
  ].join("\n");
  assert.deepEqual(rules(src), ["page-title@3", "intro-paragraph@4"]);
  assert.deepEqual(rules('const x = <><PageHeader title="登录" showTitle={false} /><Panel title="a" /></>;'), []);
  assert.deepEqual(rules('const x = <><PageHeader title="a" description={<p>写在「?」里</p>} /><Panel title="a" /></>;'), []);
});

test("no-template: PageHeader without any page-template block is a warning", () => {
  const found = auditText('export const P = () => <PageBody><PageHeader title="x" /><div>自己拼的</div></PageBody>;', "p.tsx");
  assert.deepEqual(found.map((f) => [f.rule, f.level]), [["no-template", "warn"]]);
  assert.deepEqual(rules('export const P = () => <><PageHeader title="x" /><SplitLayout main={1} side={2} /></>;'), []);
  for (const t of PAGE_TEMPLATES.filter((t) => t.id !== "T14")) assert.ok(t.components.some((c) => TEMPLATE_BLOCKS.includes(c)), `${t.id} has a block the audit recognises`);
});

test("suppression needs a known rule and a reason; works on the same line or the line above", () => {
  const src = [
    '{/* admin-ui-audit-ignore raw-control: 第三方富文本工具栏要原生按钮 */}',
    "<button />",
    "<table /> // admin-ui-audit-ignore raw-control: 打印页",
    "// admin-ui-audit-ignore raw-control",
    "<select />",
    "// admin-ui-audit-ignore hard-colour: 原因写了但规则不对",
    "<dialog />",
    "// admin-ui-audit-ignore no-such-rule: 打错规则名",
    "<input />",
  ].join("\n");
  assert.deepEqual(rules(src), ["bad-ignore@4", "raw-control@5", "raw-control@7", "bad-ignore@8", "raw-control@9"]);
  assert.deepEqual(rules("/* admin-ui-audit-ignore sdk-override: 打印样式只在打印时生效 */\n.print .aui-shell { display: none; }", "p.css"), []);
  const webview = ["// admin-ui-audit-ignore-file raw-control: VS Code 工作台的 Shadow DOM，不在 AdminProvider 里", "<button />", "<select />", '<div style={{ color: "#fff" }} />'].join("\n");
  assert.deepEqual(rules(webview), ["hard-colour@4"]);
  assert.deepEqual(rules("// admin-ui-audit-ignore-file raw-control\n<button />"), ["bad-ignore@1", "raw-control@2"]);
  // Reasons may contain `*`; a comment that doesn't parse (no colon) is reported, never silently ignored.
  assert.deepEqual(rules("/* admin-ui-audit-ignore-file hard-colour: 没有 --aui-* 色卡的环境 */\n.x { color: #123; }", "w.css"), []);
  assert.deepEqual(rules("// admin-ui-audit-ignore raw-control 忘了冒号\n<button />"), ["bad-ignore@1", "raw-control@2"]);
});

test("baseline: known errors pass, new ones fail, line moves don't matter, fixed ones are counted as stale", () => {
  const dir = mkdtempSync(join(tmpdir(), "ui-audit-"));
  mkdirSync(join(dir, "src/a"), { recursive: true });
  mkdirSync(join(dir, "src/node_modules/x"), { recursive: true });
  writeFileSync(join(dir, "src/a/page.tsx"), "const a = <button>旧</button>;\nconst b = <table />;\n");
  writeFileSync(join(dir, "src/a/page.test.tsx"), "const a = <button />;\n");
  writeFileSync(join(dir, "src/node_modules/x/i.tsx"), "const a = <button />;\n");
  writeFileSync(join(dir, "src/a/s.css"), ".x { color: #123456; }\n");
  const findings = auditPaths([join(dir, "src")], dir);
  assert.deepEqual(findings.map((f) => `${f.file}:${f.line}:${f.rule}`), ["src/a/page.tsx:1:raw-control", "src/a/page.tsx:2:raw-control", "src/a/s.css:1:hard-colour"]);
  const baseline = makeBaseline(findings);
  assert.equal(baseline.findings.length, 3);
  assert.equal(compareBaseline(findings, baseline).fresh.length, 0);
  // Lines shift, one error fixed, one new error added.
  writeFileSync(join(dir, "src/a/page.tsx"), "// header\nconst a = <button>旧</button>;\nconst c = <select />;\n");
  const next = compareBaseline(auditPaths([join(dir, "src")], dir), baseline);
  assert.deepEqual(next.fresh.map((f) => `${f.line}:${f.text}`), ["3:const c = <select />;"]);
  assert.equal(next.known.length, 2);
  assert.equal(next.stale, 1);

  // CLI: --write-baseline then --baseline; exit 1 only for new errors; paths are relative to the baseline file.
  const file = join(dir, "ui-audit-baseline.json");
  const out: string[] = [];
  const log = (s: string) => out.push(s);
  assert.equal(main([join(dir, "src"), "--baseline", file, "--write-baseline"], log), 0);
  assert.ok(existsSync(file) && JSON.parse(readFileSync(file, "utf8")).findings.every((f: { file: string }) => f.file.startsWith("src/")));
  assert.equal(main([join(dir, "src"), "--baseline", file], log), 0);
  writeFileSync(join(dir, "src/a/new.tsx"), "const n = <dialog />;\n");
  assert.equal(main([join(dir, "src"), "--baseline", file], log), 1);
  assert.equal(main([join(dir, "src"), "--json", "--baseline", file], log), 1);
  const report = JSON.parse(out.at(-1)!);
  assert.equal(report.errors, 1);
  assert.equal(report.findings[0].rule, "raw-control");
  assert.equal(main([join(dir, "src"), "--baseline", join(dir, "missing.json")], log), 2);
  assert.equal(main([], log), 2);
});

test("catalog lists the audit tool and the package ships it as a bin", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const tool = TOOLS.find((t) => t.id === "ui-audit");
  assert.ok(tool);
  assert.equal(pkg.bin[tool.bin], tool.script);
  assert.ok(pkg.files.includes(tool.script));
  assert.deepEqual([...tool.rules].sort(), Object.keys(RULES).filter((r) => r !== "bad-ignore").sort());
  assert.match(readFileSync(new URL(`../${tool.script}`, import.meta.url), "utf8"), /^#!\/usr\/bin\/env node/);
});

// ---------------------------------------------------------------- 8.0 migration rules
import { MIGRATION_8 } from "../scripts/ui-audit.mjs";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/audit-8/src/${name}`, import.meta.url), "utf8");
const found = (text: string, file: string) => auditText(text, file).filter((f) => ["removed-api", "removed-prop", "removed-class", "removed-css-var", "legacy-tone", "deep-import"].includes(f.rule));

test("8.0 audit: a 7.x page reports every removed API / prop / class / tone / deep import with file:line and the replacement", () => {
  const out = found(fixture("old-page.tsx"), "old-page.tsx").map((f) => `${f.rule}@${f.line}:${f.detail.split(" → ")[0]}`).sort();
  assert.deepEqual(out, [
    "removed-api@2:BatchBar", "removed-api@2:ThemePicker", "removed-api@2:LegacyOptionTone",
    "removed-api@3:resolveBrandColors",
    "deep-import@4:@adminui/react/src/grid-core.ts",
    "legacy-tone@7:tone: \"neutral\"", "legacy-tone@8:tone: \"solid\"",
    "removed-prop@10:display: \"tiles\"",
    "removed-prop@14:<AdminShell profile>",
    "removed-prop@15:<Button size=\"icon\">", "removed-prop@16:<Button variant=\"link\">", "removed-prop@17:<Button title>",
    "removed-prop@18:<IconButton title>", "removed-prop@19:<MenuButton size=\"icon\">",
    "removed-prop@20:<CommentThread unresolvedOnly>", "removed-prop@20:<CommentThread onUnresolvedOnlyChange>",
    "removed-prop@21:<DataTable batchMode>", "removed-prop@21:<DataTable batchActions>",
    "removed-prop@22:<RecordHeader variant>",
    "removed-class@23:aui-button-icon", "removed-class@23:aui-menu-item",
  ].sort());
  for (const f of found(fixture("old-page.tsx"), "old-page.tsx")) assert.match(f.detail, / → \S/, `${f.rule} names the replacement`);
});

test("8.0 audit: the same page on 8.0 is clean (StatusBadge / alert tones are not option tones; legacyTone reads old data)", () => {
  assert.deepEqual(found(fixture("new-page.tsx"), "new-page.tsx"), []);
});

test("8.0 audit: CSS — removed classes and deep @import", () => {
  assert.deepEqual(found(fixture("old.css"), "old.css").map((f) => `${f.rule}@${f.line}`), ["removed-class@2", "deep-import@3"]);
  assert.deepEqual(found(".x .aui-icon-btn { color: var(--aui-text); }\n@import \"@adminui/react/styles.css\";", "ok.css"), []);
});

test("8.0 audit: the CLI takes `audit` as a subcommand (npx @adminui/react audit <dir>)", () => {
  const lines: string[] = [];
  const code = main(["audit", fileURLToPath(new URL("./fixtures/audit-8/src", import.meta.url))], (l) => lines.push(l));
  assert.equal(code, 1);
  assert.match(lines.join("\n"), /removed-api/);
});

test("8.0 audit: every removed export is really gone and MIGRATION-8.md lists every entry of the table", () => {
  const doc = readFileSync(new URL("../MIGRATION-8.md", import.meta.url), "utf8");
  for (const name of Object.keys(MIGRATION_8.exports)) assert.ok(doc.includes(`\`${name}\``), `MIGRATION-8.md: ${name}`);
  for (const p of MIGRATION_8.props) assert.ok(doc.includes(p.prop), `MIGRATION-8.md: ${p.component} ${p.prop}`);
  for (const cls of Object.keys(MIGRATION_8.classes)) assert.ok(doc.includes(cls), `MIGRATION-8.md: .${cls}`);
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.bin["admin-ui"], "scripts/ui-audit.mjs", "npx @adminui/react audit");
});

test("package aliases: npm aliases and release tarballs of the SDK are audited under their own name", async () => {
  const { packageAliases, DEFAULT_PACKAGES } = await import("../scripts/ui-audit.mjs");
  assert.ok(DEFAULT_PACKAGES.length > 0);
  assert.deepEqual(packageAliases({ dependencies: { "@corp/ui": "npm:@adminui/react@^8", x: "https://github.com/o/r/releases/download/v8.2.0/adminui-react-8.2.0.tgz", react: "^19" } }), ["@corp/ui", "x"]);
  const deep = 'import x from "@corp/ui/src/grid.tsx";';
  assert.deepEqual(auditText(deep, "a.tsx", { packages: ["@corp/ui"] }).map((f) => f.rule), ["deep-import"]);
  assert.deepEqual(auditText(deep, "a.tsx").map((f) => f.rule), [], "an unknown package name is not the SDK");
  assert.deepEqual(auditText('import { SettingsPage } from "@corp/ui/settings";', "a.tsx", { packages: ["@corp/ui"] }), [], "/settings is a public entry");
});
