/**
 * Build-time UI language of the kit's own text (no React, no DOM, no Node). Used by the Vite plugin in
 * `@adminui/react/vite`; it never runs in the browser.
 *
 * The kit writes its UI text in Simplified Chinese. `zh-Hant` rewrites the kit's own modules to Traditional
 * Chinese with Taiwan wording: first the reviewed UI phrase table below (keys are the Simplified source text),
 * then OpenCC (`cn → twp`) on the remaining Han runs, then the consumer's overrides (keys are the converted
 * text). Only Han characters change; ASCII, code, regexes and escapes are never touched.
 */

/** Language of the kit's built-in UI text. `zh-Hans` = as written (default); `zh-Hant` = Traditional Chinese, Taiwan wording. */
export type AdminUiLocale = "zh-Hans" | "zh-Hant";

/** One phrase rule: Simplified source text (or a pattern without capture groups) → Taiwan wording. */
export type PhraseRule = readonly [from: string | RegExp, to: string];

/** A text → text conversion (OpenCC's converter function has this shape). */
export type TextConverter = (text: string) => string;

const HAN = /\p{Script=Han}/u;
const HAN_RUN = /\p{Script=Han}+/gu;
const LATIN_EDGE = /[A-Za-z0-9]/;

/** True when the text has at least one Han character (the only text the conversion touches). */
export const hasHan = (text: string): boolean => HAN.test(text);

/**
 * UI wording that OpenCC's Taiwan phrase table gets wrong or does not cover, reviewed against every
 * visible string of the kit. Keys are the Simplified source; outputs are final (OpenCC does not run over them).
 * Order does not matter: longer plain keys win at the same position, patterns are tried after them.
 * Replacements that start or end with a Latin letter get a space against an adjacent Han character.
 */
export const HANT_UI_PHRASES: readonly PhraseRule[] = [
  // Forms and keys
  ["带 * 的为必填项", "標 * 為必填"],
  ["提交", "送出"],
  ["回车", "Enter"],
  ["不能有空格", "不能有空白"],
  ["空格", "空白鍵"],
  ["快捷键", "快速鍵"],
  ["双击", "按兩下"],
  ["二维码", "QR Code"],
  ["读屏", "螢幕閱讀器"],
  // Counts of records: 「共 N 筆」「N 筆/頁」「這筆記錄」 (條 stays for conditions, rules, lines)
  ["条记录", "筆記錄"],
  ["这条申请", "這筆申請"],
  ["复制一条", "複製一筆"],
  ["逐条", "逐筆"],
  ["几条", "幾筆"],
  ["条评论", "則評論"],
  ["条回复", "則回覆"],
  ["条数", "筆數"],
  ["上一条（", "上一筆（"],
  ["下一条（", "下一筆（"],
  ["条未读", "則未讀"],
  [/(?<=[\d}—"'`>\/]\s*)条(?![件形规])/u, "筆"],
  // Table columns are 欄 in Taiwan (列 = row there); 列表 / 列出 / 队列 keep 列, rows keep 行 (clear either way)
  [/(?<![队佇陣址系排并序只])列(?![表出举入])/u, "欄"],
  // OpenCC's Taiwan phrases that read wrong in an admin UI
  ["分区", "分區"],
  ["参数", "參數"],
  ["发布", "發布"],
  ["扩展", "擴充"],
  ["全局", "全域"],
  ["类型", "類型"],
  ["对象", "對象"],
  ["权限", "權限"],
  ["账号", "帳號"],
  ["账户", "帳戶"],
  ["后台", "後台"],
  ["前台", "前台"],
  ["平台", "平台"],
  ["工作台", "工作台"],
  ["基本信息", "基本資料"],
  // Mainland words OpenCC keeps
  ["审批", "簽核"],
  ["岗位", "職位"],
  ["套餐", "方案"],
  ["用户组", "使用者群組"],
  ["服务端", "伺服器端"],
  ["客户端", "用戶端"],
  ["运营", "營運"],
  ["仪表盘", "儀表板"],
  ["示例", "範例"],
  ["模板", "範本"],
  ["文本", "文字"],
  ["自定义", "自訂"],
  ["反馈", "回饋"],
  ["拖动", "拖曳"],
  ["拖拽", "拖曳"],
  ["滚动", "捲動"],
  ["邮箱", "電子郵件"],
  ["手机号", "手機號碼"],
  ["标签页", "分頁"],
  ["导航", "導覽"],
  ["重置", "重設"],
  ["滑块", "滑桿"],
  ["单元格", "儲存格"],
  ["弹框", "對話框"],
  ["弹窗", "對話框"],
  ["退出登录", "登出"],
  [/新建(?![构構])/u, "新增"],
  ["只读", "唯讀"],
  ["访问", "存取"],
  ["了解", "了解"],
  ["币种", "幣別"],
  ["日元", "日圓"],
  ["天后", "天後"],
  ["钟", "鐘"],
  ["只", "只"],
  ["复制", "複製"],
  ["十六进制", "十六進位"],
  ["审计", "稽核"],
  ["合同", "合約"],
  ["响应", "回應"],
  ["会话", "工作階段"],
  ["后里", "後裡"],
  ["余数", "餘數"],
  // 周 as a week (週四, 第 3 週, the unit 「週」); a 周 inside a longer word stays to OpenCC
  [/周(?=\$\{|["'`<])|(?<=[\d}]\s*)周/u, "週"],
  ["复核", "複核"],
  // OpenCC's Taiwan phrases also rewrite their own output (文件 → 檔案, 程序 → 程式, 游標 → 遊標, 運算子 →
  // 運運算元) and re-segment it (寫進程式碼 → 寫程序式碼); pinning these words keeps one pass final (idempotent)
  ["文档", "檔案"],
  ["文件", "檔案"],
  ["代码", "程式碼"],
  ["组件", "元件"],
  ["加载", "載入"],
  ["添加", "新增"],
  ["打开", "開啟"],
  ["视图", "檢視"],
  ["接口", "介面"],
  ["运算符", "運算子"],
  ["菜单", "選單"],
  ["声明", "宣告"],
  ["回调", "回呼"],
  ["质量", "品質"],
  ["查看", "查看"],
  ["进程", "處理程序"],
  ["光标", "游標"],
  ["游标", "游標"],
];

type CompiledRule = { readonly to: string };

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function compileRules(rules: readonly PhraseRule[], what: string): { pattern: RegExp | null; rules: CompiledRule[] } {
  // Each output is also a key mapping to itself: OpenCC's Taiwan phrases also rewrite Traditional text
  // (權限 → 許可權, 分區 → 分割槽), so without this a second pass — or Traditional text already in the kit —
  // would undo the table. This is what makes the conversion idempotent.
  const keys = new Set(rules.map(([from]) => from));
  const own = rules.flatMap(([, to]): PhraseRule[] => (hasHan(to) && !keys.has(to) ? [[to, to]] : []));
  const plain = [...rules, ...own].filter((rule) => typeof rule[0] === "string").sort((a, b) => (b[0] as string).length - (a[0] as string).length);
  const patterns = rules.filter((rule) => typeof rule[0] !== "string");
  const ordered = [...plain, ...patterns];
  const sources = ordered.map(([from]) => {
    const source = typeof from === "string" ? escapeRegExp(from) : from.source;
    if (typeof from === "string" ? !hasHan(from) : !hasHan(from.source)) throw new Error(`${what}: 「${String(from)}」 has no Chinese character; only Chinese text is converted`);
    if (new RegExp(`${source}|`, "u").exec("")!.length > 1) throw new Error(`${what}: ${String(from)} must not use capture groups (use (?:…))`);
    return `(${source})`;
  });
  return {
    pattern: sources.length ? new RegExp(sources.join("|"), "gu") : null,
    rules: ordered.map(([, to]) => ({ to })),
  };
}

/** `to` with a space against an adjacent Han character when it starts / ends with a Latin letter or digit. */
function spaced(to: string, before: string, after: string): string {
  const lead = LATIN_EDGE.test(to.charAt(0)) && hasHan(before) ? " " : "";
  const tail = LATIN_EDGE.test(to.charAt(to.length - 1)) && hasHan(after) ? " " : "";
  return `${lead}${to}${tail}`;
}

/** Replace every match of the compiled rules; `rest` converts the text between matches. */
function replaceRules(text: string, compiled: { pattern: RegExp | null; rules: CompiledRule[] }, rest: TextConverter, space: boolean): string {
  if (!compiled.pattern) return rest(text);
  let out = "";
  let last = 0;
  for (const match of text.matchAll(compiled.pattern)) {
    const index = match.index;
    const ruleIndex = match.findIndex((group, i) => i > 0 && group !== undefined) - 1;
    const rule = compiled.rules[ruleIndex];
    if (!rule) continue;
    out += rest(text.slice(last, index));
    out += space ? spaced(rule.to, text.charAt(index - 1), text.charAt(index + match[0].length)) : rule.to;
    last = index + match[0].length;
  }
  return out + rest(text.slice(last));
}

/** Run `convert` over each run of Han characters only; everything else is copied as is. */
export function convertHanRuns(text: string, convert: TextConverter): string {
  return hasHan(text) ? text.replace(HAN_RUN, (run) => convert(run)) : text;
}

export type HantConverterOptions = {
  /** Phrase table applied before OpenCC (Simplified keys). Default: `HANT_UI_PHRASES`. */
  phrases?: readonly PhraseRule[];
  /** Applied last, on the converted text: 「what the screen shows」 → 「what it should show」. Keys must contain a Chinese character. */
  overrides?: Readonly<Record<string, string>>;
};

/**
 * Simplified → Traditional (Taiwan) for the kit's own source / bundle text. `opencc` is a `cn → twp`
 * converter (from `opencc-js`), injected so this stays pure and testable. Deterministic; with the built-in
 * table it is idempotent (running it on its own output changes nothing).
 */
export function createHantConverter(opencc: TextConverter, options: HantConverterOptions = {}): TextConverter {
  const phrases = compileRules(options.phrases ?? HANT_UI_PHRASES, "phrase");
  const overrides = compileRules(Object.entries(options.overrides ?? {}), "override");
  const han = (text: string) => convertHanRuns(text, opencc);
  return (text) => {
    if (!hasHan(text)) return text;
    const converted = replaceRules(text, phrases, han, true);
    return overrides.pattern ? replaceRules(converted, overrides, (rest) => rest, false) : converted;
  };
}

const HEX4 = /^[0-9A-Fa-f]{4}$/;
const ENDS_PIECE = new Set(['"', "'", "`", "\n", "\r"]);

/** Non-ASCII characters as `\uXXXX` (upper-case hex, the way TypeScript writes them). */
const escapeNonAscii = (text: string) =>
  text.replace(/[^\x00-\x7f]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`);

/**
 * Compiled JavaScript keeps some text as `\uXXXX` escapes (TypeScript writes JSX text and attributes that way).
 * Each piece of a literal that has escaped Han is decoded, converted and written back as escapes. Pieces end at
 * quotes, line breaks and every other escape (`\n`, `\\` …), so code around them is copied as is; the characters
 * just before and after a piece (usually its quotes) are passed along as context for the phrase rules.
 */
export function convertEscapedHan(code: string, convert: TextConverter): string {
  if (!/\\u[0-9A-Fa-f]{4}/.test(code)) return code;
  let out = "";
  let last = 0;
  let start = 0;
  let decoded = "";
  let escaped = false;
  const flush = (end: number) => {
    if (escaped && hasHan(decoded)) {
      const before = start > 0 ? code.charAt(start - 1) : "";
      const after = code.charAt(end);
      const both = convert(before + decoded + after);
      const next = both.slice(before.length, both.length - after.length);
      if (next !== decoded) {
        out += code.slice(last, start) + escapeNonAscii(next);
        last = end;
      }
    }
    decoded = "";
    escaped = false;
  };
  let i = 0;
  while (i < code.length) {
    const ch = code.charAt(i);
    if (ch === "\\") {
      if (code.charAt(i + 1) === "u" && HEX4.test(code.slice(i + 2, i + 6))) {
        decoded += String.fromCharCode(Number.parseInt(code.slice(i + 2, i + 6), 16));
        escaped = true;
        i += 6;
        continue;
      }
      flush(i);
      i += 2;
      start = i;
      continue;
    }
    if (ENDS_PIECE.has(ch)) {
      flush(i);
      i += 1;
      start = i;
      continue;
    }
    decoded += ch;
    i += 1;
  }
  flush(code.length);
  return out + code.slice(last);
}

/** True when the text has Han characters, literally or as `\uXXXX` escapes (U+3400–U+9FFF). */
export const hasHanInCode = (code: string): boolean => hasHan(code) || /\\u(?:3[4-9A-Fa-f]|[4-9][0-9A-Fa-f])[0-9A-Fa-f]{2}/.test(code);

/** Convert one module of the kit: escaped Han first (JavaScript only), then literal Han. */
export function convertModuleText(code: string, convert: TextConverter, kind: "js" | "css"): string {
  return convert(kind === "js" ? convertEscapedHan(code, convert) : code);
}
