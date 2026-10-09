import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Converter } from "opencc-js/cn2t";
import { convertEscapedHan, convertHanRuns, convertModuleText, createHantConverter, hasHan, hasHanInCode, HANT_UI_PHRASES } from "../src/locale-core.ts";
import { adminUiLocale, libraryFileMatcher } from "../src/vite.ts";
import { ORG_PICKER_MESSAGES } from "../src/org-picker/org-picker-text.ts";

const opencc = Converter({ from: "cn", to: "twp" });
const hant = createHantConverter(opencc);
const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
const decode = (code: string) => code.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
const esc = (text: string) => text.replace(/[^\x00-\x7f]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`);

test("compiled JS: \\uXXXX-escaped text (JSX text / attributes) is converted and stays escaped", () => {
  const code = `_jsxs("p", { children: [_jsx(CircleHelp, {}), "${esc("带 * 的为必填项")}"] }); _jsx(Button, { loadingText: "${esc("提交中…")}" }); ["${esc("已选 ")}", n, "${esc(" 条")}"]; const w = "${esc("周")}"; /${esc("刷新")}|x/.test(m);`;
  const out = convertModuleText(code, hant, "js");
  assert.ok(!/[^\x00-\x7f]/.test(out), "stays ASCII");
  assert.equal(
    decode(out),
    '_jsxs("p", { children: [_jsx(CircleHelp, {}), "標 * 為必填"] }); _jsx(Button, { loadingText: "送出中…" }); ["已選 ", n, " 筆"]; const w = "週"; /重新整理|x/.test(m);',
  );
  const raw = 'const raw = "\\\\u5E26";';
  assert.equal(convertModuleText(raw, hant, "js"), raw, "an escaped backslash is not a \\u escape");
  assert.equal(convertModuleText(out, hant, "js"), out, "idempotent");
  assert.equal(convertEscapedHan('"\\u00e9\\n"', hant), '"\\u00e9\\n"', "non-Han escapes untouched");
  assert.ok(hasHanInCode('"\\u4FDD"') && !hasHanInCode('"\\u00e9"'));
  assert.equal(convertModuleText('.x:not([aria-label^="暂停"]) {}', hant, "css"), '.x:not([aria-label^="暫停"]) {}');
});

test("only Han runs change; ASCII, code, regexes and escapes stay byte for byte", () => {
  const code = 'const re = /^(图片|视频) (.+)$/u; const s = "保存\\n\\u4e2d"; x?.y ?? `${a}设置${b}`; // 注释';
  const out = hant(code);
  assert.equal(out, 'const re = /^(圖片|影片) (.+)$/u; const s = "儲存\\n\\u4e2d"; x?.y ?? `${a}設定${b}`; // 註釋');
  const strip = (s: string) => s.replace(/\p{Script=Han}+/gu, "");
  assert.equal(strip(out), strip(code));
  assert.equal(hant("const a = 1; // no chinese"), "const a = 1; // no chinese");
  assert.equal(convertHanRuns("a 加载 b", (run) => `[${run}]`), "a [加载] b");
  assert.equal(hasHan("abc"), false);
});

test("UI phrase table: Taiwan wording for the kit's common strings", () => {
  const cases: Record<string, string> = {
    "带 * 的为必填项": "標 * 為必填",
    "提交中…": "送出中…",
    "${placeholder}（回车搜索）": "${placeholder}（Enter 搜尋）",
    "按回车选第一个": "按 Enter 選第一個",
    '`共 ${total} 条`': '`共 ${total} 筆`',
    '`${n} 条/页`': '`${n} 筆/頁`',
    '["已选 ", n, " 条"]': '["已選 ", n, " 筆"]',
    "这条记录": "這筆記錄",
    '"条件"': '"條件"',
    "填色 ${n} 条规则": "填色 ${n} 條規則",
    "${count} 条未读": "${count} 則未讀",
    "冻结至此列": "凍結至此欄",
    "列表": "列表",
    "只列你管得着的": "只列你管得著的",
    "上传队列": "上傳佇列",
    '"周"': '"週"',
    "周${WEEK[d]}": "週${WEEK[d]}",
    "搜索客户、记录、文档，或输入命令…": "搜尋客戶、記錄、檔案，或輸入命令…",
    "默认": "預設",
    "加载更多": "載入更多",
    "用户": "使用者",
    "视频": "影片",
    "屏幕": "螢幕",
    "鼠标": "滑鼠",
    "字段权限": "欄位權限",
    "分区": "分區",
    "全部类型": "全部類型",
    "后台管理": "後台管理",
    "参数": "參數",
    "已发布": "已發布",
    "二维码": "QR Code",
    "分享二维码": "分享 QR Code",
    "${n} 天后": "${n} 天後",
    "数据没取回来，只影响这一张卡": "資料沒取回來，只影響這一張卡",
  };
  for (const [from, to] of Object.entries(cases)) assert.equal(hant(from), to, from);
});

test("idempotent, and Traditional text already in the kit stays as is", () => {
  const samples = [
    "部门、岗位、角色、人员授权、权限解释和授权审计；每一次改动都有审计。",
    "隐藏分区「${title}」",
    "Word 文档",
    "保存后各进程下一次读取即生效",
    "GridView.filter 是条件树，groupBy 是分组层级数组",
    "共 ${n} 条，${m} 条未解决",
    "新构造器：barOption",
  ];
  for (const s of samples) assert.equal(hant(hant(s)), hant(s), s);
  for (const traditional of ["搜尋人員、部門、角色、業務線，支援拼音首字母", "只列出你管得到的 · Enter 選第一個", "權限", "分區", "類型", "後台"]) {
    assert.equal(hant(traditional), traditional, traditional);
  }
  // The kit's own Traditional table (OrgPicker locale zh-TW) passes through unchanged.
  for (const [key, text] of Object.entries(ORG_PICKER_MESSAGES["zh-TW"])) if (typeof text === "string" && text !== (ORG_PICKER_MESSAGES["zh-CN"] as Record<string, unknown>)[key]) assert.equal(hant(text), text, key);
});

test("every output of the phrase table is stable under the converter", () => {
  for (const [, to] of HANT_UI_PHRASES) if (hasHan(to)) assert.equal(hant(to), to, to);
});

test("overrides apply last on the converted text, exactly as written; keys must contain Chinese", () => {
  const custom = createHantConverter(opencc, { overrides: { 簽核: "審批", "Enter 搜尋": "按 Enter 搜尋" } });
  assert.equal(custom("待你审批"), "待你審批");
  assert.equal(custom("（回车搜索）"), "（按 Enter 搜尋）");
  assert.equal(custom(custom("待你审批")), "待你審批");
  assert.throws(() => createHantConverter(opencc, { overrides: { id: "x" } }), /no Chinese character/);
  assert.throws(() => createHantConverter(opencc, { phrases: [[/(条)/u, "筆"]] }), /capture groups/);
});

test("library file matcher: only the kit's own files, in every install layout", () => {
  const match = libraryFileMatcher({ roots: ["/app/packages/admin-ui"], names: ["@scope/kit"], windows: false });
  assert.ok(match("/app/node_modules/@scope/kit/dist/src/forms.js"));
  assert.ok(match("/app/node_modules/.pnpm/@scope+kit@8.5.0_react@19.1.0/node_modules/@scope/kit/dist/src/forms.js?v=1a2b"));
  assert.ok(match("/app/node_modules/@scope/kit/src/styles/media.css"));
  assert.ok(match("/app/packages/admin-ui/dist/src/forms.js"));
  assert.ok(match("/app/packages/admin-ui/src/forms.tsx"));
  assert.ok(!match("/app/node_modules/@scope/kit/node_modules/lucide-react/dist/esm/icons/x.js"), "nested dependency");
  assert.ok(!match("/app/node_modules/.pnpm/node_modules/lucide-react/dist/esm/lucide-react.js"), "other package");
  assert.ok(!match("/app/node_modules/@scope/kit-extra/dist/index.js"), "package with a longer name");
  assert.ok(!match("/app/src/App.tsx"), "consumer code");
  assert.ok(!match("/app/node_modules/@scope/kit/dist/src/forms.d.ts.map"), "not code");
  assert.ok(!match("\0aui-size-probe"), "virtual module");
  const win = libraryFileMatcher({ roots: ["D:\\code\\app\\node_modules\\@scope\\kit"], names: ["@scope/kit"], windows: true });
  assert.ok(win("d:/code/app/node_modules/@scope/kit/dist/src/forms.js"));
  assert.ok(win("D:\\code\\app\\node_modules\\.pnpm\\@scope+kit@8.5.0\\node_modules\\@scope\\kit\\dist\\src\\forms.js"));
  assert.ok(!win("D:\\code\\app\\src\\main.tsx"));
});

test("plugin: zh-Hans is inert, bad options fail early, zh-Hant converts only the kit's files", async () => {
  const inert = adminUiLocale();
  assert.deepEqual(Object.keys(inert), ["name"]);
  assert.deepEqual(Object.keys(adminUiLocale({ locale: "zh-Hans" })), ["name"]);
  assert.throws(() => adminUiLocale({ locale: "en" as never }), /unknown locale/);
  assert.throws(() => adminUiLocale({ locale: "zh-Hant", overrides: { ok: "x" } }), /no Chinese character/);

  const plugin = adminUiLocale({ locale: "zh-Hant" });
  const transform = plugin.transform as (code: string, id: string) => Promise<{ code: string } | null>;
  const formsFile = `${pkgRoot}dist/src/forms.js`;
  const forms = readFileSync(formsFile, "utf8");
  assert.ok(decode(forms).includes("带 * 的为必填项"));
  const converted = await transform(forms, formsFile);
  assert.ok(converted && decode(converted.code).includes("標 * 為必填") && !decode(converted.code).includes("带 * 的为必填项"));
  assert.equal(await transform('export const t = "保存";', "/app/src/App.tsx"), null, "consumer code untouched");

  const config = (plugin.config as () => { optimizeDeps: { esbuildOptions: { plugins: { name: string; setup: (build: unknown) => void }[] } } })();
  const [esbuildPlugin] = config.optimizeDeps.esbuildOptions.plugins;
  assert.match(esbuildPlugin!.name, /^admin-ui-locale:zh-Hant:[0-9a-f]{12}$/);
  assert.notEqual(esbuildPlugin!.name, (adminUiLocale({ locale: "zh-Hant", overrides: { 簽核: "審批" } }).config as typeof plugin.config & (() => typeof config))().optimizeDeps.esbuildOptions.plugins[0]!.name, "overrides change the dependency-cache key");
  let onLoad: ((args: { path: string }) => Promise<{ contents: string; resolveDir: string } | undefined>) | undefined;
  esbuildPlugin!.setup({ onLoad: (_options: unknown, callback: typeof onLoad) => (onLoad = callback) });
  const loaded = await onLoad!({ path: formsFile });
  assert.ok(loaded && decode(loaded.contents).includes("送出中…"));
  assert.equal(await onLoad!({ path: `${pkgRoot}node_modules/lucide-react/dist/esm/lucide-react.js` }), undefined);
});
