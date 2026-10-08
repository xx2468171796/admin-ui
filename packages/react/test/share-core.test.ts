// bt/share：分享套件的纯逻辑（二维码编码、策略、摘要、复制文本、密码尝试、访问记录筛选、IP 打码）和 QuickDatePresets 的小时档。
import assert from "node:assert/strict";
import test from "node:test";
import { alignmentPositions, dataCodewords, encodeQr, fitVersion, maskPenalty, qrPath, rawDataModules, rsDivisor, rsRemainder } from "../src/qr-core.ts";
import {
  accessFilters,
  allowedCapability,
  applySharePolicy,
  audiencePatch,
  createClipboardClearer,
  sharedByText,
  fromZonedInput,
  toZonedInput,
  attemptState,
  expiresInText,
  expiresSoon,
  expiryPresetBlocked,
  filterAccess,
  formatShareTime,
  maskIp,
  openLimitMax,
  opensLeft,
  passwordForced,
  PIN_ALPHABET,
  randomPin,
  relativeDay,
  remainingText,
  shareCopyText,
  shareSentence,
  expiryPhrase,
  shareChangeLabel,
  shareWatermarkText,
  type ShareAccessEvent,
  type SharePolicy,
  type ShareSettings,
} from "../src/share-core.ts";
import { datePresetKey, datePresetMs, hourPresetValue } from "../src/choice-core.ts";
import { applyGrantChange, grantChangeId, grantChangeText, revertGrantChange, type GrantChange, type GrantEntry } from "../src/grant-list-core.ts";

const NOW = Date.UTC(2026, 9, 5, 10, 0); // 2026-10-05 18:00 Asia/Shanghai
const H = 3_600_000;
const SH = "Asia/Shanghai";
const base: ShareSettings = {
  audience: "anyone",
  capability: "edit",
  allowDownload: true,
  allowCopy: false,
  fields: { name: "view", phone: "view", next: "edit", note: "edit", price: "view" },
  password: "8K3F",
  expiresAt: NOW + 7 * 24 * H,
  expiryPreset: "7d",
  openLimit: { mode: "max", max: 20 },
  watermark: true,
  notifyOnOpen: true,
  remindBeforeHours: 24,
};
const policy: SharePolicy = { owner: "华南子公司", summary: "对外分享必须设密码，最长 30 天", requirePassword: "华南子公司要求对外分享必须设密码", maxExpiryHours: 720 };

// ---------------------------------------------------------------- QR

/** Read the 15 format bits back from around the top-left finder and check the BCH code. */
function formatBits(modules: boolean[][]) {
  let bits = 0;
  const at = (x: number, y: number) => (modules[y]?.[x] ? 1 : 0);
  const order: [number, number][] = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  order.forEach(([x, y], i) => (bits |= at(x, y) << i));
  const raw = bits ^ 0x5412;
  let rem = raw >>> 10;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return { data: raw >>> 10, valid: (rem & 0x3ff) === (raw & 0x3ff) };
}

test("QR: capacity tables and version fit follow ISO/IEC 18004", () => {
  assert.equal(rawDataModules(1), 208);
  assert.equal(rawDataModules(7), 1568);
  assert.equal(dataCodewords(1, "M"), 16);
  assert.equal(dataCodewords(10, "H"), 122);
  assert.equal(dataCodewords(40, "L"), 2956);
  assert.equal(fitVersion(14, "M"), 1, "14 bytes fit 1-M");
  assert.equal(fitVersion(15, "M"), 2);
  assert.equal(fitVersion(3000, "L"), 0, "too long");
  assert.deepEqual(alignmentPositions(1), []);
  assert.deepEqual(alignmentPositions(7), [6, 22, 38]);
  assert.deepEqual(alignmentPositions(32), [6, 34, 60, 86, 112, 138]);
  // Reed–Solomon of the 1-M example in the standard's annex (codewords of "01234567").
  assert.deepEqual(rsRemainder([16, 32, 12, 86, 97, 128, 236, 17, 236, 17, 236, 17, 236, 17, 236, 17], rsDivisor(10)), [165, 36, 212, 193, 237, 54, 199, 135, 44, 85]);
});

test("QR: a share link encodes to a valid symbol (finders, timing, format bits, stable output)", () => {
  const m = encodeQr("https://app.example.com/s/Kp7xQ2");
  assert.equal(m.version, 3);
  assert.equal(m.size, 29);
  assert.equal(m.ecc, "M");
  const row = (y: number) => (m.modules[y] ?? []).map((b) => (b ? 1 : 0)).join("");
  assert.equal(row(0).slice(0, 7), "1111111", "top-left finder");
  assert.equal(row(0).slice(-7), "1111111", "top-right finder");
  assert.equal(row(6).slice(8, 21), "1010101010101", "timing pattern");
  assert.equal(m.modules[m.size - 8]?.[8], true, "dark module");
  const format = formatBits(m.modules);
  assert.ok(format.valid, "format bits carry a valid BCH code");
  assert.equal(format.data, (0 << 3) | m.mask, "format = level M + chosen mask");
  // Verified once with an independent decoder (jsQR) — guards against silent regressions.
  let h = 2166136261;
  for (const c of m.modules.map((r) => r.map((b) => (b ? 1 : 0)).join("")).join("\n")) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  assert.equal(h.toString(16), "c83b667d");
  assert.match(qrPath(m), /^M\d+ \d+h\d+v1h-\d+z/);
  const utf8 = encodeQr("你好，分享链接 https://example.com/s/abcdef?x=1", { ecc: "H" });
  assert.equal(utf8.version, 6, "UTF-8 bytes counted, level H");
  assert.ok(formatBits(utf8.modules).valid);
  assert.ok(encodeQr("x".repeat(400)).version >= 15, "version ≥ 7 draws version info");
  assert.throws(() => encodeQr("y".repeat(3000)), RangeError);
});

test("QR: the chosen mask has the lowest penalty", () => {
  const best = encodeQr("https://app.example.com/s/Kp7xQ2");
  const penalty = maskPenalty(best.modules);
  for (let mask = 0; mask < 8; mask++) assert.ok(maskPenalty(encodeQr("https://app.example.com/s/Kp7xQ2", { mask }).modules) >= penalty, `mask ${mask}`);
});

// ---------------------------------------------------------------- policy, summary, copy text

test("policy: password forced for outside audiences, expiry presets over the maximum blocked", () => {
  assert.equal(passwordForced(policy, "anyone"), policy.requirePassword);
  assert.equal(passwordForced(policy, "org"), undefined, "company-internal links may skip it");
  assert.ok(passwordForced({ ...policy, passwordAlways: true }, "org"));
  assert.equal(expiryPresetBlocked(policy, "30d"), undefined);
  assert.equal(expiryPresetBlocked(policy, "permanent"), "华南子公司要求最长 30 天");
  assert.equal(expiryPresetBlocked(policy, "90d"), "华南子公司要求最长 30 天");
  assert.equal(expiryPresetBlocked(undefined, "permanent"), undefined);
});

test("applySharePolicy pulls settings back inside the policy and the field options", () => {
  const fields = [
    { key: "name", label: "客户名称" },
    { key: "phone", label: "手机", masked: true },
    { key: "next", label: "下次跟进", editable: true },
    { key: "note", label: "备注" },
    { key: "price", label: "成交价", forbidden: "成交价由管理员禁止对外" },
  ];
  const { settings, changes } = applySharePolicy({ ...base, password: null, expiresAt: null, expiryPreset: "permanent", audience: "anyone" }, { ...policy, audiences: { anyone: undefined } }, fields, () => "7K2Q", NOW);
  assert.deepEqual(settings.fields, { name: "view", phone: "view", next: "edit", note: "view" }, "forbidden dropped, non-editable edit → view");
  assert.equal(settings.password, "7K2Q");
  assert.equal(settings.expiresAt, NOW + 720 * H);
  assert.equal(changes.length, 3);
  const blocked = applySharePolicy(base, { ...policy, audiences: { anyone: "公司不允许对外" } }, fields, () => "AAAA", NOW);
  assert.equal(blocked.settings.audience, "org");
  const view = applySharePolicy({ ...base, capability: "view" }, undefined, fields, () => "", NOW);
  assert.equal(view.settings.fields.next, "view", "edit only with the edit capability");
});

test("randomPin draws from the unambiguous alphabet without modulo bias", () => {
  const pin = randomPin(6);
  assert.equal(pin.length, 6);
  assert.ok([...pin].every((c) => PIN_ALPHABET.includes(c)));
  // Bytes ≥ 248 (= 256 − 256 % 31) are rejected.
  let calls = 0;
  const fake = (n: number) => {
    calls++;
    return Uint8Array.from({ length: n }, (_, i) => (calls === 1 ? 250 : i));
  };
  assert.equal(randomPin(4, fake), "2345");
  assert.equal(calls, 2);
});

test("the copy bundle reads like the demo", () => {
  assert.equal(
    shareCopyText({ title: "李承恩（滨江豪宅）", url: "https://app.example.com/s/Kp7xQ2", password: "8K3F", expiresAt: NOW + 7 * 24 * H, openLimit: { mode: "max", max: 20 }, timeZone: SH }),
    "「李承恩（滨江豪宅）」\n链接：https://app.example.com/s/Kp7xQ2\n密码：8K3F\n有效期：2026-10-12 18:00 前\n最多打开 20 次",
  );
  assert.match(shareCopyText({ title: "x", url: "u", password: null, expiresAt: null, openLimit: { mode: "burn" } }), /有效期：永久\n只能打开一次，看完即焚$/);
});

test("expiry and open-count texts", () => {
  assert.equal(formatShareTime(NOW, SH), "2026-10-05 18:00");
  assert.equal(formatShareTime(NOW, "Asia/Shanghai", false), "10-05 18:00");
  assert.equal(remainingText(NOW + 7 * 24 * H, NOW), "还有 7 天");
  assert.equal(remainingText(NOW + 13 * H + 5, NOW), "还有 13 小时");
  assert.equal(remainingText(NOW + 25 * 60_000, NOW), "还有 25 分钟");
  assert.equal(remainingText(NOW - 1, NOW), "已过期");
  assert.equal(remainingText(null, NOW), "永久有效");
  assert.equal(expiresInText(NOW + 6.9 * 24 * H, NOW), "7 天后失效");
  assert.equal(expiresInText(NOW + 3 * H, NOW), "3 小时后失效");
  assert.ok(expiresSoon(NOW + 13 * H, NOW));
  assert.ok(!expiresSoon(NOW + 3 * 24 * H, NOW));
  assert.ok(!expiresSoon(null, NOW));
  assert.equal(opensLeft({ mode: "max", max: 20 }, 3), 17);
  assert.equal(opensLeft({ mode: "burn" }, 1), 0);
  assert.equal(opensLeft({ mode: "unlimited" }, 9), null);
  assert.equal(openLimitMax({ mode: "burn" }), 1);
  assert.equal(relativeDay(NOW + 2 * H, NOW, SH), "今天 20:00");
  assert.equal(relativeDay(NOW + 15 * H, NOW, SH), "明天 09:00");
  assert.equal(relativeDay(NOW - 20 * H, NOW, SH), "昨天 22:00");
  assert.equal(relativeDay(NOW + 5 * 24 * H, NOW, SH), "10-10 18:00");
});

test("password attempts: dots, left, captcha after N, locked at max", () => {
  assert.deepEqual(attemptState(1, 5, 3), { left: 4, dots: ["failed", "left", "left", "left", "left"], captcha: false, locked: false });
  assert.equal(attemptState(3, 5, 3).captcha, true);
  assert.equal(attemptState(9, 5, 3).locked, true);
  assert.equal(attemptState(9, 5, 3).left, 0);
});

test("access log: filter chips with counts (empty kinds left out), filtering, IP masking", () => {
  const ev = (id: string, kind: ShareAccessEvent["kind"]): ShareAccessEvent => ({ id, at: NOW, ip: "203.0.**.18", kind });
  const events = [ev("1", "open"), ev("2", "edit"), ev("3", "open"), ev("4", "security"), ev("5", "download"), ev("6", "open")];
  assert.deepEqual(accessFilters(events).map((f) => `${f.label} ${f.count}`), ["全部 6", "打开 3", "下载 1", "编辑 1", "安全 1"]);
  assert.deepEqual(filterAccess(events, "open").map((e) => e.id), ["1", "3", "6"]);
  assert.equal(filterAccess(events, "all").length, 6);
  assert.equal(maskIp("203.0.113.18"), "203.0.**.18");
  assert.equal(maskIp("2001:db8:85a3:0:0:8a2e:370:7334"), "2001:db8:****:7334");
  assert.equal(maskIp("localhost"), "localhost");
});

test("QuickDatePresets hour presets: exact hours, keys, preset length", () => {
  const now = new Date(2026, 9, 5, 23, 30);
  assert.equal(hourPresetValue(1, "datetime-local", now), "2026-10-06T00:30");
  assert.equal(hourPresetValue(1, "date", now), "2026-10-06");
  assert.equal(datePresetKey(7, "d"), "7d");
  assert.equal(datePresetKey(1, "h"), "1h");
  assert.equal(datePresetMs("1h"), H);
  assert.equal(datePresetMs("30d"), 720 * H);
  assert.equal(datePresetMs("permanent"), null);
});

test("applySharePolicy downgrades a blocked capability, and field edit access with it", () => {
  const fields = [
    { key: "name", label: "客户名称" },
    { key: "next", label: "下次跟进", editable: true },
    { key: "note", label: "备注", editable: true },
  ];
  const noEdit: SharePolicy = { ...policy, capabilities: { edit: "华南子公司不允许访客改" } };
  const { settings, changes } = applySharePolicy({ ...base, fields: { name: "view", next: "edit", note: "edit" } }, noEdit, fields, () => "AAAA", NOW);
  assert.equal(settings.capability, "comment", "edit → the strongest allowed one below it");
  assert.deepEqual(settings.fields, { name: "view", next: "view", note: "view" }, "no edit fields without the edit capability");
  assert.ok(changes.some((c) => c.includes("可编辑") && c.includes("华南子公司不允许访客改")));
  assert.equal(allowedCapability("edit", { ...policy, capabilities: { edit: "x", comment: "y" } }), "view");
  assert.equal(allowedCapability("view", { ...policy, capabilities: { view: "x" } }), "comment", "nothing below: the weakest allowed one");
  assert.equal(allowedCapability("edit", undefined), "edit");
  assert.equal(applySharePolicy(base, policy, fields, () => "", NOW).settings.capability, "edit", "allowed capability untouched");
});

test("switching the audience to one that forces a password brings a password along", () => {
  const people = { ...base, audience: "people" as const, password: null };
  assert.deepEqual(audiencePatch(people, "anyone", policy, () => "7K2Q"), { audience: "anyone", password: "7K2Q" });
  assert.deepEqual(audiencePatch({ ...people, password: "8K3F" }, "anyone", policy, () => "7K2Q"), { audience: "anyone" }, "an existing password is kept");
  assert.deepEqual(audiencePatch(people, "org", policy, () => "7K2Q"), { audience: "org" }, "not forced inside the company");
  assert.deepEqual(audiencePatch(people, "anyone", undefined, () => "7K2Q"), { audience: "anyone" });
});

test("clipboard clearer: one timer, restarted by a new copy, flushed at once on leave", async () => {
  const writes: string[] = [];
  const timers = new Map<number, () => void>();
  let next = 0;
  const clearer = createClipboardClearer((t) => void writes.push(t), { set: (fn) => (timers.set(++next, fn), next), clear: (id) => timers.delete(id as number) });
  const settle = () => new Promise((r) => setTimeout(r, 0));
  clearer.flush();
  await settle();
  assert.deepEqual(writes, [], "nothing pending: flush writes nothing");
  clearer.schedule(60_000);
  clearer.schedule(60_000);
  assert.equal(timers.size, 1, "a new copy restarts the one timer");
  const [firedId, fire] = [...timers][0] ?? [];
  timers.delete(firedId as number);
  fire?.();
  await settle();
  assert.deepEqual(writes, [""]);
  assert.equal(clearer.pending, false);
  clearer.schedule(60_000);
  clearer.flush();
  await settle();
  assert.deepEqual(writes, ["", ""], "leaving with a clear pending clears at once");
  assert.equal(timers.size, 0);
  const failing = createClipboardClearer(() => Promise.reject(new Error("no focus")), { set: (fn) => (fn(), 1), clear: () => undefined });
  failing.schedule(1);
  await settle();
});

test("custom expiry input is read and shown in the dialog's time zone, not the browser's", () => {
  assert.equal(toZonedInput(NOW, "Asia/Shanghai"), "2026-10-05T18:00");
  assert.equal(fromZonedInput("2026-10-05T18:00", "Asia/Shanghai"), NOW);
  assert.equal(fromZonedInput("2026-10-05T03:00", "America/Los_Angeles"), NOW, "PDT is UTC-7");
  assert.equal(formatShareTime(fromZonedInput("2026-10-20T10:00", "Asia/Shanghai"), "Asia/Shanghai"), "2026-10-20 10:00");
  // Daylight saving: 2026-11-01 01:30 happens twice in Los Angeles; either instant reads back the same wall time.
  assert.equal(toZonedInput(fromZonedInput("2026-11-01T01:30", "America/Los_Angeles"), "America/Los_Angeles"), "2026-11-01T01:30");
  assert.equal(toZonedInput(fromZonedInput("2026-03-15T12:00", "America/Los_Angeles"), "America/Los_Angeles"), "2026-03-15T12:00");
  assert.ok(Number.isNaN(fromZonedInput("", "Asia/Shanghai")));
  assert.ok(Number.isNaN(fromZonedInput("tomorrow", "Asia/Shanghai")));
});

test("SecretReveal sharer line never doubles 分享", () => {
  assert.equal(sharedByText("郑主管", "10-07 10:30"), "郑主管 · 10-07 10:30 分享");
  assert.equal(sharedByText("郑主管", "分享 · 10-07 10:30"), "郑主管 · 10-07 10:30 分享", "旧写法（时间前带「分享 ·」）也不重复");
  assert.equal(sharedByText("郑主管"), "郑主管 分享");
  assert.equal(sharedByText("郑主管", "  "), "郑主管 分享");
});

// ---------------------------------------------------------------- 一句话摘要、改了立刻保存、水印、授权名单即改即生效

test("expiryPhrase：今天 / 明天 / N 天后（几月几日 周几）/ 分钟 / 永久 / 已失效，按时区", () => {
  assert.equal(expiryPhrase(null, NOW), "永久有效");
  assert.equal(expiryPhrase(NOW - 1, NOW), "已失效");
  assert.equal(expiryPhrase(NOW + 25 * 60_000, NOW), "25 分钟后失效");
  assert.equal(expiryPhrase(NOW + H, NOW, SH), "今天 19:00 失效");
  assert.equal(expiryPhrase(NOW + 24 * H, NOW, SH), "明天 18:00 失效");
  assert.equal(expiryPhrase(NOW + 7 * 24 * H, NOW, SH), "7 天后（10月12日 周一 18:00）失效");
  assert.equal(expiryPhrase(NOW + 30 * 24 * H, NOW, SH), "30 天后（11月4日 周三 18:00）失效");
  assert.equal(expiryPhrase(NOW + 7 * 24 * H, NOW, "UTC"), "7 天后（10月12日 周一 10:00）失效");
});

test("shareSentence：一句话跟着设置变（谁 · 能做什么 · 有效期 · 次数）", () => {
  const text = (s: ShareSettings, o = {}) => shareSentence(s, { now: NOW, timeZone: SH, opened: 3, ...o }).map((p) => p.text).join(" · ");
  assert.equal(text(base), "互联网上拿到链接和密码的人 · 可编辑 2 个字段 · 7 天后（10月12日 周一 18:00）失效 · 还能打开 17 次");
  assert.equal(shareSentence(base, { now: NOW })[0]?.key, "audience", "第一段是谁能打开（加粗那段）");
  assert.equal(text({ ...base, password: null }), "互联网上拿到链接的人 · 可编辑 2 个字段 · 7 天后（10月12日 周一 18:00）失效 · 还能打开 17 次");
  assert.match(text({ ...base, audience: "people" }, { peopleCount: 9 }), /^指定的 9 个人 · /);
  assert.match(text({ ...base, audience: "people" }), /^指定的人 · /);
  assert.match(text({ ...base, audience: "org", password: null }), /^公司内登录的同事 · /);
  assert.match(text({ ...base, capability: "view" }), / · 只能看 · /);
  assert.match(text({ ...base, fields: {} }), /可编辑（还没选可改的字段）/);
  assert.match(text(base, { fieldCount: 0 }), / · 可编辑 · /, "没有字段的对象（文件）只说可编辑");
  assert.match(text({ ...base, openLimit: { mode: "burn" } }), /打开一次就销毁$/);
  assert.match(text({ ...base, openLimit: { mode: "unlimited" } }), /次数不限$/);
  assert.match(text({ ...base, openLimit: { mode: "max", max: 3 } }), /次数已用完$/);
  assert.match(text({ ...base, expiresAt: null, expiryPreset: "permanent" }), / · 永久有效 · /);
});

test("shareChangeLabel：保存失败时说的是哪一项", () => {
  assert.equal(shareChangeLabel(base, { ...base, expiresAt: NOW + 30 * 24 * H, expiryPreset: "30d" }), "「30 天」");
  assert.equal(shareChangeLabel(base, { ...base, expiresAt: NOW + H, expiryPreset: "1h" }), "「1 小时」");
  assert.equal(shareChangeLabel(base, { ...base, expiresAt: null, expiryPreset: "permanent" }), "「永久」");
  assert.equal(shareChangeLabel(base, { ...base, expiresAt: NOW + 3 * H, expiryPreset: "custom" }), "「有效期」");
  assert.equal(shareChangeLabel(base, { ...base, audience: "org" }), "「公司内」");
  assert.equal(shareChangeLabel(base, { ...base, capability: "view" }), "「只能看」");
  assert.equal(shareChangeLabel(base, { ...base, password: "AB12" }), "「密码」");
  assert.equal(shareChangeLabel(base, { ...base, password: null }), "「关闭密码」");
  assert.equal(shareChangeLabel(base, { ...base, openLimit: { mode: "burn" } }), "「阅后即焚」");
  assert.equal(shareChangeLabel(base, { ...base, openLimit: { mode: "max", max: 21 } }), "「最多 21 次」");
  assert.equal(shareChangeLabel(base, { ...base, fields: {} }), "「访客能看到的字段」");
  assert.equal(shareChangeLabel(base, { ...base, watermark: false }), "「水印」");
  assert.equal(shareChangeLabel(base, { ...base, allowCopy: true }), "「允许复制文字」");
  assert.equal(shareChangeLabel(base, { ...base, remindBeforeHours: null }), "「到期提醒」");
  assert.equal(shareChangeLabel(base, { ...base }), "「设置」");
});

test("shareWatermarkText：访客 IP 打码 + 时间；没 IP 写「仅供查看」", () => {
  const at = Date.UTC(2026, 9, 5, 12, 16);
  assert.equal(shareWatermarkText({ ip: "203.0.113.18", at, timeZone: SH }), "访客 203.0.**.18 · 10-05 20:16");
  assert.equal(shareWatermarkText({ ip: "203.0.**.18", at, timeZone: SH }), "访客 203.0.**.18 · 10-05 20:16", "已打码的不再变");
  assert.equal(shareWatermarkText({ at, timeZone: SH }), "仅供查看 · 10-05 20:16");
  assert.equal(shareWatermarkText({ ip: "203.0.113.18", at, timeZone: "UTC" }), "访客 203.0.**.18 · 10-05 12:16");
});

test("授权名单即改即生效：apply / revert 一个改动（失败只撤这一项，其他改动留着）", () => {
  const value: GrantEntry[] = [{ id: "a", level: "view" }, { id: "b", level: "edit" }, { id: "c", level: "view" }];
  const add: GrantChange = { type: "add", entry: { id: "d", level: "view", name: "阿明" } };
  const level: GrantChange = { type: "level", id: "a", level: "manage", before: "view" };
  const remove: GrantChange = { type: "remove", entry: { id: "b", level: "edit" }, index: 1 };
  assert.deepEqual(applyGrantChange(value, add).map((g) => g.id), ["a", "b", "c", "d"]);
  assert.deepEqual(applyGrantChange(applyGrantChange(value, add), add).map((g) => g.id), ["a", "b", "c", "d"], "重复加不重复");
  assert.equal(applyGrantChange(value, level)[0]?.level, "manage");
  assert.deepEqual(applyGrantChange(value, remove).map((g) => g.id), ["a", "c"]);
  // 先改档再删 b：删 b 失败 → b 回到原位，a 的新档还在
  const both = applyGrantChange(applyGrantChange(value, level), remove);
  const back = revertGrantChange(both, remove);
  assert.deepEqual(back.map((g) => `${g.id}:${g.level}`), ["a:manage", "b:edit", "c:view"]);
  assert.deepEqual(revertGrantChange(back, level).map((g) => g.level), ["view", "edit", "view"]);
  assert.deepEqual(revertGrantChange(applyGrantChange(value, add), add), value);
  assert.deepEqual(revertGrantChange(value, remove), value, "已经在的不再插一次");
  assert.deepEqual(revertGrantChange([], { ...remove, index: 5 }).map((g) => g.id), ["b"], "位置越界就放最后");
  assert.equal(grantChangeId(level), "a");
  assert.equal(grantChangeId(add), "d");
  const levels = [{ value: "view", label: "可查看" }, { value: "manage", label: "可管理" }];
  assert.equal(grantChangeText(level, levels, "阿明"), "「阿明」改成「可管理」");
  assert.equal(grantChangeText(add, levels, "阿明"), "加上「阿明」");
  assert.equal(grantChangeText(remove, levels, "阿明"), "去掉「阿明」");
});
