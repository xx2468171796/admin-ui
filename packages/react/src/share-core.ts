/**
 * Share kit pure logic (bt/share S1–S5, H3; demos D20–D22, D25). Types the future server package
 * (fenxiang, architecture §5.9) fills in, plus everything the components compute: the summary chips,
 * policy checks, expiry / open-count text, copy bundle, attempt dots, access-log filters, IP masking.
 * No React / DOM, so a server or a test can use the same rules. The server stays the authority: it
 * checks policy, password, expiry and counts on every open; the UI only explains.
 */
import { runtimeTimeZone } from "./admin-defaults.ts";
import { datePresetMs, type DatePresetKey } from "./choice-core.ts";

/** Who can open the link. */
export type ShareAudience = "anyone" | "org" | "people";
/** What a visitor can do (only within the fields the sharer ticked). */
export type ShareCapability = "view" | "comment" | "edit";
/** Open-count rule; burn = 阅后即焚 (one open, then void). */
export type ShareOpenLimit = { mode: "unlimited" } | { mode: "max"; max: number } | { mode: "burn" };
/** What a visitor gets of one field: not shared (absent), view, edit. */
export type ShareFieldAccess = "view" | "edit";

/** One sharing link's settings (what the dialog edits; the host saves every change at once). */
export type ShareSettings = {
  audience: ShareAudience;
  capability: ShareCapability;
  allowDownload: boolean;
  allowCopy: boolean;
  /** Field key → access; keys left out are not shared. */
  fields: Readonly<Record<string, ShareFieldAccess>>;
  /** null = no password. Case-insensitive PIN, shown to the sharer only. */
  password: string | null;
  /** Epoch ms; null = never. */
  expiresAt: number | null;
  /** The preset that set expiresAt (pressed button), "custom", or null. */
  expiryPreset: DatePresetKey | "custom" | null;
  openLimit: ShareOpenLimit;
  watermark: boolean;
  notifyOnOpen: boolean;
  /** Remind the sharer this many hours before expiry; null = off. */
  remindBeforeHours: number | null;
};

/** A field the sharer may offer (already limited to what the sharer can see). */
export type ShareFieldOption = {
  key: string;
  label: string;
  /** Visitors see it masked (「手机（打码）」). */
  masked?: boolean;
  /** Can be made editable (only when the capability is edit). */
  editable?: boolean;
  /** Not allowed out at all, with the reason (「成交价由管理员禁止对外」). */
  forbidden?: string;
};

/** The admin policy that applies to this share (per subsidiary, architecture §5.9). */
export type SharePolicy = {
  /** Who set it (「华南子公司」). */
  owner: string;
  /** One sentence (「对外分享必须设密码，最长 30 天」). */
  summary: string;
  /** Behind 「谁定的？」: who to ask. */
  contact?: string;
  /** Audiences not allowed, with the reason. */
  audiences?: Partial<Record<ShareAudience, string>>;
  /** Password required (reason); applies when the audience is anyone unless `passwordAlways`. */
  requirePassword?: string;
  passwordAlways?: boolean;
  /** Longest expiry in hours (permanent and longer presets are disabled). */
  maxExpiryHours?: number;
  /** Capabilities not allowed, with the reason. */
  capabilities?: Partial<Record<ShareCapability, string>>;
};

export const AUDIENCE_LABELS: Record<ShareAudience, string> = { anyone: "互联网上任何人", org: "公司内", people: "指定的人" };
export const CAPABILITY_LABELS: Record<ShareCapability, string> = { view: "只能看", comment: "可评论", edit: "可编辑" };

/** Is a password forced by the policy for this audience? Returns the reason or undefined. */
export function passwordForced(policy: SharePolicy | undefined, audience: ShareAudience): string | undefined {
  if (!policy?.requirePassword) return undefined;
  return policy.passwordAlways || audience === "anyone" ? policy.requirePassword : undefined;
}

/** Why an expiry preset is not allowed under the policy (undefined = allowed). */
export function expiryPresetBlocked(policy: SharePolicy | undefined, key: DatePresetKey): string | undefined {
  const max = policy?.maxExpiryHours;
  if (max === undefined) return undefined;
  const ms = datePresetMs(key);
  if (ms !== null && ms <= max * 3_600_000) return undefined;
  return `${policy?.owner ?? "公司"}要求最长 ${formatHours(max)}`;
}

/** 24 → 「1 天」, 720 → 「30 天」, 6 → 「6 小时」. */
export function formatHours(hours: number): string {
  return hours >= 24 && hours % 24 === 0 ? `${hours / 24} 天` : `${hours} 小时`;
}

/**
 * Settings brought in line with the policy and the field options: forbidden fields dropped, edit
 * access only for editable fields and only with the edit capability, password generated when forced,
 * expiry capped. Returns the fixed settings and what was changed (for a notice).
 */
export function applySharePolicy(settings: ShareSettings, policy: SharePolicy | undefined, fields: readonly ShareFieldOption[], makePassword: () => string, now = Date.now()): { settings: ShareSettings; changes: string[] } {
  const changes: string[] = [];
  const capability = allowedCapability(settings.capability, policy);
  if (capability !== settings.capability)
    changes.push(`「${CAPABILITY_LABELS[settings.capability]}」不允许：${policy?.capabilities?.[settings.capability]}，改成「${CAPABILITY_LABELS[capability]}」`);
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const nextFields: Record<string, ShareFieldAccess> = {};
  for (const [key, access] of Object.entries(settings.fields)) {
    const option = byKey.get(key);
    if (!option || option.forbidden) {
      changes.push(`去掉了不能对外的字段「${option?.label ?? key}」`);
      continue;
    }
    nextFields[key] = access === "edit" && (!option.editable || capability !== "edit") ? "view" : access;
  }
  let next: ShareSettings = { ...settings, capability, fields: nextFields };
  if (policy?.audiences?.[next.audience]) {
    changes.push(`「${AUDIENCE_LABELS[next.audience]}」不允许：${policy.audiences[next.audience]}`);
    next = { ...next, audience: (["org", "people", "anyone"] as const).find((a) => !policy.audiences?.[a]) ?? "people" };
  }
  if (passwordForced(policy, next.audience) && !next.password) {
    next = { ...next, password: makePassword() };
    changes.push("按公司要求自动设了密码");
  }
  const max = policy?.maxExpiryHours;
  if (max !== undefined) {
    const limit = now + max * 3_600_000;
    if (next.expiresAt === null || next.expiresAt > limit) {
      next = { ...next, expiresAt: limit, expiryPreset: null };
      changes.push(`有效期改成最长 ${formatHours(max)}`);
    }
  }
  return { settings: next, changes };
}

const CAPABILITY_ORDER: readonly ShareCapability[] = ["view", "comment", "edit"];
/**
 * The capability the policy allows: the wanted one, else the strongest allowed one below it (edit →
 * comment → view), else the weakest allowed one; 「只能看」 when the policy blocks everything.
 */
export function allowedCapability(wanted: ShareCapability, policy: SharePolicy | undefined): ShareCapability {
  const ok = (c: ShareCapability) => !policy?.capabilities?.[c];
  if (ok(wanted)) return wanted;
  const below = CAPABILITY_ORDER.slice(0, CAPABILITY_ORDER.indexOf(wanted)).reverse().find(ok);
  return below ?? CAPABILITY_ORDER.find(ok) ?? "view";
}

/**
 * The patch for choosing another audience: when the policy forces a password for it and there is none
 * yet, a password comes with it (the link never sits in a forbidden state between two saves).
 */
export function audiencePatch(settings: ShareSettings, audience: ShareAudience, policy: SharePolicy | undefined, makePassword: () => string): Partial<ShareSettings> {
  return passwordForced(policy, audience) && !settings.password ? { audience, password: makePassword() } : { audience };
}

/**
 * Clearing a copied secret from the clipboard later (SecretReveal). One timer for the whole page, so a
 * row hiding or unmounting does not cancel it; a new copy restarts it; `flush` (page leaving) clears
 * at once if a clear was still pending. Best effort: the browser may refuse to write without focus.
 */
export function createClipboardClearer(write: (text: string) => Promise<void> | void, timers: { set: (fn: () => void, ms: number) => unknown; clear: (id: unknown) => void } = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) }) {
  let pending: unknown = null;
  const run = () => {
    pending = null;
    void Promise.resolve().then(() => write("")).catch(() => undefined);
  };
  return {
    schedule(ms: number) {
      if (pending !== null) timers.clear(pending);
      pending = timers.set(run, ms);
    },
    flush() {
      if (pending === null) return;
      timers.clear(pending);
      run();
    },
    get pending() {
      return pending !== null;
    },
  };
}

/** Unambiguous PIN alphabet (no 0 / O / 1 / I / L). */
export const PIN_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
/** A random PIN from PIN_ALPHABET using crypto.getRandomValues (rejection sampling, no modulo bias). */
export function randomPin(length = 4, random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const limit = 256 - (256 % PIN_ALPHABET.length);
  let out = "";
  while (out.length < length)
    for (const b of random(length * 2)) {
      if (b < limit && out.length < length) out += PIN_ALPHABET[b % PIN_ALPHABET.length];
    }
  return out;
}

/** Parts of an instant in a time zone (Intl), for the short texts below. */
function zoned(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { y: get("year"), m: get("month"), d: get("day"), hh: get("hour"), mm: get("minute") };
}
/** `YYYY-MM-DDTHH:mm` of an instant in a time zone (value of a datetime-local input). */
export function toZonedInput(ms: number, timeZone = runtimeTimeZone()): string {
  const z = zoned(ms, timeZone);
  return `${z.y}-${z.m}-${z.d}T${z.hh}:${z.mm}`;
}
/**
 * The instant a `YYYY-MM-DDTHH:mm` wall time means in a time zone (datetime-local input read in the
 * dialog's `timeZone`, not the browser's); NaN when it does not parse.
 */
export function fromZonedInput(text: string, timeZone = runtimeTimeZone()): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(text);
  if (!m) return Number.NaN;
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  const offsetAt = (ms: number) => {
    const z = zoned(ms, timeZone);
    return Date.UTC(Number(z.y), Number(z.m) - 1, Number(z.d), Number(z.hh), Number(z.mm)) - ms;
  };
  // Two passes settle the offset around daylight-saving changes.
  let at = wall - offsetAt(wall);
  at = wall - offsetAt(at);
  return at;
}
/** 「2026-10-12 18:00」 */
export function formatShareTime(ms: number, timeZone = runtimeTimeZone(), withYear = true): string {
  const z = zoned(ms, timeZone);
  return withYear ? `${z.y}-${z.m}-${z.d} ${z.hh}:${z.mm}` : `${z.m}-${z.d} ${z.hh}:${z.mm}`;
}

/** Time left as a short phrase: 「还有 7 天」「还有 13 小时」「还有 25 分钟」「已过期」. */
export function remainingText(expiresAt: number | null, now = Date.now()): string {
  if (expiresAt === null) return "永久有效";
  const ms = expiresAt - now;
  if (ms <= 0) return "已过期";
  const hours = ms / 3_600_000;
  if (hours >= 48) return `还有 ${Math.floor(hours / 24)} 天`;
  if (hours >= 1) return `还有 ${Math.floor(hours)} 小时`;
  return `还有 ${Math.max(1, Math.ceil(ms / 60_000))} 分钟`;
}
/** 「7 天后失效」 style for the summary chip (rounded up so 6.9 days reads 7). */
export function expiresInText(expiresAt: number | null, now = Date.now()): string {
  if (expiresAt === null) return "永久有效";
  const ms = expiresAt - now;
  if (ms <= 0) return "已失效";
  const hours = ms / 3_600_000;
  if (hours >= 24) return `${Math.round(hours / 24)} 天后失效`;
  if (hours >= 1) return `${Math.round(hours)} 小时后失效`;
  return `${Math.max(1, Math.ceil(ms / 60_000))} 分钟后失效`;
}
/** Expires within `hours` (default 48) — the attention colour in lists. */
export const expiresSoon = (expiresAt: number | null, now = Date.now(), hours = 48) => expiresAt !== null && expiresAt > now && expiresAt - now <= hours * 3_600_000;

/** Opens left under a limit (null = unlimited). */
export function opensLeft(limit: ShareOpenLimit, opened: number): number | null {
  if (limit.mode === "unlimited") return null;
  const max = limit.mode === "burn" ? 1 : limit.max;
  return Math.max(0, max - opened);
}
export const openLimitMax = (limit: ShareOpenLimit): number | null => (limit.mode === "unlimited" ? null : limit.mode === "burn" ? 1 : limit.max);

const WEEKDAYS = "日一二三四五六";
/**
 * When the link stops working, as the dialog's grey hint and summary say it: 「今天 19:00 失效」
 * 「明天 18:00 失效」「7 天后（10月12日 周一 18:00）失效」「25 分钟后失效」「永久有效」「已失效」.
 */
export function expiryPhrase(expiresAt: number | null, now = Date.now(), timeZone = runtimeTimeZone()): string {
  if (expiresAt === null) return "永久有效";
  const ms = expiresAt - now;
  if (ms <= 0) return "已失效";
  if (ms < 3_600_000) return `${Math.max(1, Math.ceil(ms / 60_000))} 分钟后失效`;
  const near = relativeDay(expiresAt, now, timeZone);
  if (ms < 48 * 3_600_000 && /^(今天|明天)/.test(near)) return `${near} 失效`;
  const z = zoned(expiresAt, timeZone);
  const weekday = WEEKDAYS[new Date(Date.UTC(Number(z.y), Number(z.m) - 1, Number(z.d))).getUTCDay()];
  return `${Math.round(ms / 86_400_000)} 天后（${Number(z.m)}月${Number(z.d)}日 周${weekday} ${z.hh}:${z.mm}）失效`;
}

/** One part of the summary sentence; the audience part is the bold one. */
export type ShareSentencePart = { key: "audience" | "capability" | "expiry" | "opens"; text: string };
/**
 * The one sentence under the link, following the settings as they change:
 * 「互联网上拿到链接和密码的人 · 可编辑 2 个字段 · 7 天后（10月12日 周一 18:00）失效 · 还能打开 17 次」.
 * `fieldCount` 0 = an object without fields (「可编辑」 without a count).
 */
export function shareSentence(settings: ShareSettings, options: { now?: number; timeZone?: string; opened?: number; peopleCount?: number; fieldCount?: number } = {}): ShareSentencePart[] {
  const { now = Date.now(), timeZone = runtimeTimeZone(), opened = 0, peopleCount, fieldCount } = options;
  const pw = Boolean(settings.password);
  const audience =
    settings.audience === "anyone" ? (pw ? "互联网上拿到链接和密码的人" : "互联网上拿到链接的人") : settings.audience === "org" ? (pw ? "公司内登录的同事（要密码）" : "公司内登录的同事") : peopleCount !== undefined ? `指定的 ${peopleCount} 个人` : "指定的人";
  const editCount = Object.values(settings.fields).filter((a) => a === "edit").length;
  const capability = settings.capability !== "edit" || fieldCount === 0 ? CAPABILITY_LABELS[settings.capability] : editCount ? `可编辑 ${editCount} 个字段` : "可编辑（还没选可改的字段）";
  const left = opensLeft(settings.openLimit, opened);
  const opens = settings.openLimit.mode === "unlimited" ? "次数不限" : settings.openLimit.mode === "burn" ? "打开一次就销毁" : left ? `还能打开 ${left} 次` : "次数已用完";
  return [
    { key: "audience", text: audience },
    { key: "capability", text: capability },
    { key: "expiry", text: expiryPhrase(settings.expiresAt, now, timeZone) },
    { key: "opens", text: opens },
  ];
}

const presetText = (preset: ShareSettings["expiryPreset"]) =>
  preset === null || preset === "custom" ? "有效期" : preset === "permanent" ? "永久" : preset.endsWith("h") ? `${Number.parseFloat(preset)} 小时` : `${Number.parseFloat(preset)} 天`;
/**
 * What one change was about, quoted, for 「「30 天」没保存：网络中断」 (instant save failed). The first
 * setting that differs names it; unknown / several → 「设置」.
 */
export function shareChangeLabel(before: ShareSettings, next: ShareSettings): string {
  if (before.audience !== next.audience) return `「${AUDIENCE_LABELS[next.audience]}」`;
  if (before.capability !== next.capability) return `「${CAPABILITY_LABELS[next.capability]}」`;
  if (before.expiresAt !== next.expiresAt || before.expiryPreset !== next.expiryPreset) return `「${presetText(next.expiryPreset)}」`;
  if (before.password !== next.password) return next.password === null ? "「关闭密码」" : "「密码」";
  if (JSON.stringify(before.openLimit) !== JSON.stringify(next.openLimit)) return next.openLimit.mode === "burn" ? "「阅后即焚」" : next.openLimit.mode === "max" ? `「最多 ${next.openLimit.max} 次」` : "「次数不限」";
  if (JSON.stringify(before.fields) !== JSON.stringify(next.fields)) return "「访客能看到的字段」";
  if (before.allowDownload !== next.allowDownload) return "「允许下载附件」";
  if (before.allowCopy !== next.allowCopy) return "「允许复制文字」";
  if (before.watermark !== next.watermark) return "「水印」";
  if (before.notifyOnOpen !== next.notifyOnOpen) return "「打开时通知我」";
  if (before.remindBeforeHours !== next.remindBeforeHours) return "「到期提醒」";
  return "「设置」";
}

/**
 * The default watermark line of a public share page: 「访客 203.0.**.18 · 10-05 20:16」 (the IP masked
 * with maskIp, the time in the zone); without an IP 「仅供查看 · 10-05 20:16」.
 */
export function shareWatermarkText(input: { ip?: string | null; at?: number; timeZone?: string } = {}): string {
  const at = shortTime(input.at ?? Date.now(), input.timeZone);
  return input.ip ? `访客 ${maskIp(input.ip)} · ${at}` : `仅供查看 · ${at}`;
}

/** What 「复制链接和密码」 puts on the clipboard: one paragraph that can go straight into LINE. */
export function shareCopyText(input: { title: string; url: string; password: string | null; expiresAt: number | null; openLimit: ShareOpenLimit; timeZone?: string }): string {
  const lines = [`「${input.title}」`, `链接：${input.url}`];
  if (input.password) lines.push(`密码：${input.password}`);
  lines.push(input.expiresAt === null ? "有效期：永久" : `有效期：${formatShareTime(input.expiresAt, input.timeZone)} 前`);
  if (input.openLimit.mode === "burn") lines.push("只能打开一次，看完即焚");
  else if (input.openLimit.mode === "max") lines.push(`最多打开 ${input.openLimit.max} 次`);
  return lines.join("\n");
}

/** Password attempts for PasswordGate: dots, what is left, whether the captcha / lock applies. */
export function attemptState(failed: number, max: number, captchaAfter?: number) {
  const used = Math.max(0, Math.min(failed, max));
  return {
    left: Math.max(0, max - used),
    dots: Array.from({ length: max }, (_, i) => (i < used ? "failed" : "left") as "failed" | "left"),
    captcha: captchaAfter !== undefined && used >= captchaAfter,
    locked: used >= max,
  };
}

/**
 * Mask an IP the way the access log shows it: IPv4 keeps the 1st, 2nd and 4th part (203.0.**.18),
 * IPv6 keeps the first two groups and the last. The server should send masked IPs already; this is for
 * hosts that store them whole and for exports.
 */
export function maskIp(ip: string): string {
  const v4 = ip.split(".");
  if (v4.length === 4) return `${v4[0]}.${v4[1]}.**.${v4[3]}`;
  const v6 = ip.split(":");
  if (v6.length > 2) return [v6[0], v6[1], "****", v6[v6.length - 1]].join(":");
  return ip;
}

/** One line of a share's access log. */
export type ShareAccessKind = "open" | "download" | "edit" | "comment" | "security";
export type ShareAccessEvent = {
  id: string;
  /** Epoch ms. */
  at: number;
  /** Already masked by the server (see maskIp). */
  ip: string;
  area?: string;
  device?: "desktop" | "mobile";
  /** 「Windows」「iPhone」 */
  os?: string;
  /** 「Chrome」「Safari」 */
  browser?: string;
  kind: ShareAccessKind;
  /** The line's text (「第 3 次 · 密码正确 · 正在看」); edits use `change` instead. */
  text?: string;
  /** An edit: field old → new. */
  change?: { field: string; before: string | null; after: string | null };
  /** The sharer was notified of this one. */
  notified?: boolean;
  /** A security event the sharer can act on (block the IP). */
  alarm?: boolean;
};
export const ACCESS_KIND_LABELS: Record<ShareAccessKind, string> = { open: "打开", download: "下载", edit: "编辑", comment: "评论", security: "安全" };
export type AccessFilter = "all" | ShareAccessKind;
/** Filter chips with counts: 全部 6 · 打开 3 · 下载 1 · 编辑 1 · 安全 1 (kinds with 0 are left out). */
export function accessFilters(events: readonly ShareAccessEvent[]): { value: AccessFilter; label: string; count: number }[] {
  const counts = new Map<ShareAccessKind, number>();
  for (const e of events) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  const order: ShareAccessKind[] = ["open", "download", "edit", "comment", "security"];
  return [{ value: "all", label: "全部", count: events.length }, ...order.filter((k) => counts.get(k)).map((k) => ({ value: k, label: ACCESS_KIND_LABELS[k], count: counts.get(k) ?? 0 }))];
}
export const filterAccess = (events: readonly ShareAccessEvent[], filter: AccessFilter) => (filter === "all" ? [...events] : events.filter((e) => e.kind === filter));

/** Where a cell version came from (CellHistoryPopover source chip). */
export type CellVersionSource = "table" | "paste" | "import" | "form" | "api" | "ai" | "automation" | "restore" | "share";
export const SOURCE_LABELS: Record<CellVersionSource, string> = { table: "表格", paste: "粘贴", import: "导入", form: "表单", api: "API", ai: "AI", automation: "自动化", restore: "恢复", share: "分享页" };
/** Machine sources get the info tone; people's edits stay neutral. */
export const machineSource = (source: CellVersionSource) => source === "api" || source === "ai" || source === "automation" || source === "import";

/** `HH:mm` of an epoch in a zone — used by short lists. */
export function clockText(ms: number, timeZone = runtimeTimeZone()): string {
  const z = zoned(ms, timeZone);
  return `${z.hh}:${z.mm}`;
}
/** `MM-DD HH:mm` */
export const shortTime = (ms: number, timeZone = runtimeTimeZone()) => formatShareTime(ms, timeZone, false);

const dayKey = (ms: number, timeZone: string) => formatShareTime(ms, timeZone).slice(0, 10);
/** 「今天 20:16」「明天 09:00」「昨天 22:00」 or 「10-04 22:10」 in the zone. */
export function relativeDay(ms: number, now: number, timeZone = runtimeTimeZone()): string {
  const day = dayKey(ms, timeZone);
  const clock = formatShareTime(ms, timeZone).slice(11);
  if (day === dayKey(now, timeZone)) return `今天 ${clock}`;
  if (day === dayKey(now + 86_400_000, timeZone)) return `明天 ${clock}`;
  if (day === dayKey(now - 86_400_000, timeZone)) return `昨天 ${clock}`;
  return shortTime(ms, timeZone);
}

/**
 * The sharer line of SecretReveal: 「郑主管 · 10-05 20:30 分享」, no time → 「郑主管 分享」. A time given
 * the old way (「分享 · 10-05 20:30」) loses its leading 「分享 ·」 so the word is never doubled.
 */
export function sharedByText(name: string, sharedAt?: string | null): string {
  const at = (sharedAt ?? "").replace(/^\s*分享\s*[·・]?\s*/, "").trim();
  return at ? `${name} · ${at} 分享` : `${name} 分享`;
}
