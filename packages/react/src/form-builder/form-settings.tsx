"use client";
/**
 * Collection settings of the FormBuilder (bt/builders-a V9, D08 right pane): 提交次数限制 (每人一次 /
 * 每天 / 每周 / 每月 / 不限 — a parameter, plan §2 item 13), 需要登录, 允许修改自己的提交, 新提交通知
 * (chips + host picker), 谁能填写, the link with 复制, QR code with 下载, 链接预填 generator, 催填 and
 * 停止收集. Knock-on rules (per-person limits need login …) live in form-core patchFormSettings.
 */
import { useRef, useState, type ReactNode } from "react";
import { Check, Copy, Download, Link2, Plus, Send, X } from "lucide-react";
import { Button, Checkbox, Choice, Input, Switch } from "../primitives.tsx";
import { SegmentedControl } from "../choices.tsx";
import { HelpTip } from "../help-tip.tsx";
import { PopoverPanel } from "../popover-panel.tsx";
import { QrCode, downloadQrPng } from "../qr-code.tsx";
import { avatarTone } from "../avatar-core.ts";
import {
  FORM_AUDIENCES,
  FORM_SUBMIT_LIMITS,
  buildPrefillLink,
  formSettingLocks,
  isConditionField,
  patchFormSettings,
  questionTitle,
  type FormDefinition,
  type FormField,
  type FormPrefill,
  type FormSettings,
  type FormSubmitLimit,
} from "./form-core.ts";
import { IconButton } from "../buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/form-builder.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/form-builder.css";

export type FormSettingsPaneProps = {
  form: FormDefinition;
  fields: readonly FormField[];
  settings: FormSettings;
  onChange: (next: FormSettings) => void;
  shareUrl: string;
  submitLimits: readonly FormSubmitLimit[];
  onAddNotify?: () => void;
  onRemind?: () => void;
  copy: (text: string) => Promise<void>;
  /** Extra block at the bottom (brand / cover settings of the host). */
  extra?: ReactNode;
  readOnly?: boolean;
};

function useCopied(copy: (text: string) => Promise<void>) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = async (key: string, text: string) => {
    try {
      await copy(text);
      setCopied(key);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(`${key}:fail`);
    }
  };
  return { copied, run };
}

export function FormSettingsPane({ form, fields, settings, onChange, shareUrl, submitLimits, onAddNotify, onRemind, copy, extra, readOnly }: FormSettingsPaneProps) {
  const set = (patch: Partial<FormSettings>) => onChange(patchFormSettings(settings, patch));
  const locks = formSettingLocks(settings);
  const qrBox = useRef<HTMLDivElement>(null);
  const prefillButton = useRef<HTMLButtonElement>(null);
  const [prefillOpen, setPrefillOpen] = useState(false);
  const { copied, run } = useCopied(copy);
  const limits = FORM_SUBMIT_LIMITS.filter((l) => submitLimits.includes(l.value));
  const hidden = !settings.collecting;
  return (
    <aside className="aui-fb-pane aui-fb-settings" aria-label="表单设置">
      <div className="aui-fb-pane-head"><h3>表单设置</h3></div>
      <div className="aui-fb-pane-body">
        <section className="aui-fb-sec" aria-label="收集规则">
          <h4>收集规则</h4>
          <div className="aui-fb-row">
            <span>提交次数限制</span>
            <HelpTip label="提交次数限制说明">按人限制需要先登录（选了会自动打开「需要登录」）。{submitLimits.length < FORM_SUBMIT_LIMITS.length ? "还可以按每周一次、每月一次限制，由系统设置打开。" : ""}</HelpTip>
          </div>
          {limits.length <= 3 ? (
            <SegmentedControl size="sm" className="aui-fb-seg" label="提交次数限制" value={settings.submitLimit} disabled={readOnly} options={limits} onValueChange={(v) => set({ submitLimit: v })} />
          ) : (
            <Choice label="提交次数限制" value={settings.submitLimit} disabled={readOnly} options={limits} onChange={(v) => set({ submitLimit: v as FormSubmitLimit })} />
          )}
          <label className="aui-fb-row aui-fb-switch-row">
            <span>需要登录<small>（填写人要先登录）</small></span>
            <Switch aria-label="需要登录" checked={settings.loginRequired} disabled={readOnly || Boolean(locks.loginRequired && settings.loginRequired)} title={locks.loginRequired} onCheckedChange={(v) => set({ loginRequired: v })} />
          </label>
          {locks.loginRequired && <small className="aui-fb-note">{locks.loginRequired}</small>}
          <label className="aui-fb-row aui-fb-switch-row">
            <span>允许修改自己的提交</span>
            <Switch aria-label="允许修改自己的提交" checked={settings.allowEditOwn} disabled={readOnly} onCheckedChange={(v) => set({ allowEditOwn: v })} />
          </label>
        </section>
        <section className="aui-fb-sec" aria-label="新提交通知">
          <h4>新提交通知</h4>
          <ul className="aui-fb-people" aria-label="收到通知的人">
            {settings.notify.map((p) => (
              <li key={p.id} className="aui-fb-person">
                <span className="aui-avatar" data-size="20" data-kind={p.kind === "group" ? "group" : undefined} data-tone={p.kind === "group" ? undefined : avatarTone(p.id)} aria-hidden="true">{p.kind === "group" ? "#" : Array.from(p.name)[0]}</span>
                {p.name}
                {!readOnly && <button type="button" className="aui-fb-person-x" aria-label={`不再通知 ${p.name}`} onClick={() => set({ notify: settings.notify.filter((x) => x.id !== p.id) })}><X aria-hidden="true" /></button>}
              </li>
            ))}
            {!settings.notify.length && <li className="aui-fb-note">没人收到通知</li>}
            {onAddNotify && !readOnly && <li><IconButton label="添加要通知的人或群" tooltip="添加人或群" variant="outline" className="aui-fb-person-add" onClick={onAddNotify} icon={<Plus />} /></li>}
          </ul>
        </section>
        <section className="aui-fb-sec" aria-label="分享">
          <h4>分享</h4>
          <div className="aui-fb-row"><span>谁能填写</span></div>
          <SegmentedControl size="sm" className="aui-fb-seg" label="谁能填写" value={settings.audience} disabled={readOnly} options={FORM_AUDIENCES} onValueChange={(v) => set({ audience: v })} />
          <div className="aui-fb-link">
            <Input aria-label="表单链接" readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
            <Button variant="outline" size="sm" onClick={() => void run("link", shareUrl)}>{copied === "link" ? <Check /> : <Copy />}{copied === "link" ? "已复制" : "复制"}</Button>
          </div>
          {copied === "link:fail" && <small className="aui-fb-note">复制没成功，请手动选中链接复制</small>}
          <div className="aui-fb-qr" ref={qrBox}>
            <QrCode value={shareUrl} size={52} label={`「${form.title}」的二维码`} />
            <span className="aui-fb-qr-text"><b>二维码</b><small>贴到展会海报、门店</small></span>
            <Button variant="outline" size="sm" onClick={() => void downloadQrPng(shareUrl, `${form.title}-二维码`, qrBox.current?.querySelector("svg") ?? null)}><Download />下载</Button>
          </div>
          <div className="aui-fb-row">
            <span>链接预填</span>
            <HelpTip label="链接预填说明">在链接后面加 ?prefill_来源=展会&amp;hide_来源=1，打开时自动填好「来源」并隐藏这一题；不同渠道各发一条链接就能分清来源。</HelpTip>
            <Button ref={prefillButton} variant="text" size="sm" className="aui-fb-row-end" onClick={() => setPrefillOpen(true)}><Link2 />生成预填链接</Button>
          </div>
          <div className="aui-fb-row">
            <span>催填<small>（发给还没填的人）</small></span>
            {settings.audience === "picked" && onRemind ? (
              <Button variant="outline" size="sm" className="aui-fb-row-end" onClick={onRemind}><Send />催填</Button>
            ) : <small className="aui-fb-row-end aui-fb-note">指定人时可用</small>}
          </div>
        </section>
        <section className="aui-fb-sec aui-fb-stop" aria-label="停止收集">
          <label className="aui-fb-row aui-fb-switch-row" data-on={hidden || undefined}>
            <span>停止收集<small>关闭后链接打不开</small></span>
            <Switch aria-label="停止收集" checked={hidden} disabled={readOnly} onCheckedChange={(v) => set({ collecting: !v })} />
          </label>
        </section>
        {extra}
      </div>
      <PrefillPanel open={prefillOpen} anchor={prefillButton.current} onClose={(focus) => { setPrefillOpen(false); if (focus) prefillButton.current?.focus(); }} form={form} fields={fields} shareUrl={shareUrl} onCopy={(link) => run("prefill", link)} copied={copied === "prefill"} />
    </aside>
  );
}

type PrefillRow = { key: string; value: string; hide: boolean };
function PrefillPanel({ open, anchor, onClose, form, fields, shareUrl, onCopy, copied }: { open: boolean; anchor: HTMLElement | null; onClose: (focus: boolean) => void; form: FormDefinition; fields: readonly FormField[]; shareUrl: string; onCopy: (link: string) => void; copied: boolean }) {
  const options = form.questions.flatMap((q) => {
    const field = fields.find((f) => f.key === q.field);
    return field && isConditionField(field) && field.type !== "rating" && field.type !== "checkbox" ? [{ field, label: questionTitle(q, field) }] : [];
  });
  const [rows, setRows] = useState<PrefillRow[]>([]);
  const list = rows.length ? rows : options[0] ? [{ key: options[0].field.key, value: "", hide: true }] : [];
  const setRow = (index: number, patch: Partial<PrefillRow>) => setRows(list.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const items: FormPrefill[] = list.flatMap((r) => {
    const field = options.find((o) => o.field.key === r.key)?.field;
    return field ? [{ field, value: r.value, hide: r.hide }] : [];
  });
  const link = buildPrefillLink(shareUrl, items);
  return (
    <PopoverPanel open={open} anchor={anchor} onClose={onClose} title="生成预填链接" width={420} align="end" help="选一题、填好答案：打开这条链接时这一题已经填好；勾上「隐藏这一题」，填表的人就看不到它。"
      footer={<Button size="sm" disabled={link === shareUrl} onClick={() => onCopy(link)}>{copied ? <Check /> : <Copy />}{copied ? "已复制" : "复制链接"}</Button>}>
      <div className="aui-fb-prefill">
        {list.map((row, index) => {
          const field = options.find((o) => o.field.key === row.key)?.field;
          return (
            <div key={index} className="aui-fb-prefill-row" role="group" aria-label={`预填 ${index + 1}`}>
              <Choice label={`预填 ${index + 1} 的题目`} value={row.key} options={options.map((o) => ({ value: o.field.key, label: o.label }))} onChange={(key) => setRow(index, { key, value: "" })} />
              {field?.options ? (
                <Choice label={`预填 ${index + 1} 的答案`} value={row.value} placeholder="选一个答案" options={field.options.map((o) => ({ value: o.value, label: o.label }))} onChange={(value) => setRow(index, { value })} />
              ) : (
                <Input aria-label={`预填 ${index + 1} 的答案`} placeholder="答案，例如：展会" value={row.value} onChange={(e) => setRow(index, { value: e.target.value })} />
              )}
              <label className="aui-fb-prefill-hide"><Checkbox checked={row.hide} onCheckedChange={(v) => setRow(index, { hide: v === true })} aria-label={`预填 ${index + 1}：隐藏这一题`} />隐藏这一题</label>
            </div>
          );
        })}
        {options.length > list.length && list.length < 3 && <Button variant="ghost" size="sm" onClick={() => setRows([...list, { key: options.find((o) => !list.some((r) => r.key === o.field.key))!.field.key, value: "", hide: false }])}><Plus />再预填一题</Button>}
        <div className="aui-fb-prefill-link"><Link2 aria-hidden="true" /><code>{link}</code></div>
      </div>
    </PopoverPanel>
  );
}
