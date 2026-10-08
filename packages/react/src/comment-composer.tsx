"use client";
/**
 * The composer of CommentThread (internal): text with @ autocomplete (the host's people search), image /
 * file tools, pending attachments, Ctrl + Enter submits, a failed submit keeps the text and shows why.
 * Two modes: new comment / reply (the thread's bottom box), and inline edit of an existing comment
 * (starts from its text, mentions and attachments; Esc / 「取消」 leaves, 「保存」 only when something changed).
 */
import { useEffect, useId, useRef, useState } from "react";
import { AtSign, ImagePlus, Paperclip, Send, X } from "lucide-react";
import { Button, Textarea } from "./primitives.tsx";
import { type MediaItem } from "./media-parts.tsx";
import { SuggestLayer, suggestOptionId, suggestStep } from "./suggest-layer.tsx";
import { LAYER_ATTR } from "./floating-layer.ts";
import { editChanged, insertMention, keptMentions, mentionQuery, type CommentDraft, type CommentItem, type CommentPerson } from "./comment-core.ts";
import { Avatar } from "./avatar.tsx";
import { Kbd } from "./tooltip.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/comments.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/comments.css";

export const commentInitial = (name: string) => Array.from(name.trim())[0] ?? "?";
const failure = (caught: unknown, fallback: string) => (caught instanceof Error && caught.message ? caught.message : fallback);

export type CommentComposerProps = {
  onSubmit: (draft: CommentDraft) => Promise<void>;
  searchMentions?: (query: string) => Promise<readonly CommentPerson[]> | readonly CommentPerson[];
  onUpload?: (files: File[]) => Promise<MediaItem[]>;
  placeholder: string;
  replyTo?: CommentItem | null;
  onCancelReply?: () => void;
  /** Edit mode: start from this comment. */
  editing?: CommentItem;
  /** Edit mode: Esc / 「取消」. */
  onCancel?: () => void;
};

export function CommentComposer({ onSubmit, searchMentions, onUpload, placeholder, replyTo = null, onCancelReply, editing, onCancel }: CommentComposerProps) {
  const base = useId();
  const listId = `${base}-mentions`;
  const box = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(editing?.body ?? "");
  const [people, setPeople] = useState<CommentPerson[]>(() => [...(editing?.mentions ?? [])]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploaded, setUploaded] = useState<MediaItem[]>(() => [...(editing?.attachments ?? [])]);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [matches, setMatches] = useState<readonly CommentPerson[]>([]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const seq = useRef(0);
  useEffect(() => {
    if (replyTo) area.current?.focus();
  }, [replyTo]);
  useEffect(() => {
    const el = area.current;
    if (!editing || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []); // only on entering edit mode
  const lookup = (next: { start: number; query: string } | null) => {
    setMention(next);
    setActive(0);
    if (!next || !searchMentions) return setMatches([]);
    const n = ++seq.current;
    void Promise.resolve(searchMentions(next.query)).then((found) => n === seq.current && setMatches(found.slice(0, 8)), () => n === seq.current && setMatches([]));
  };
  const onText = (value: string, caret: number) => {
    setText(value);
    lookup(searchMentions ? mentionQuery(value, caret) : null);
  };
  const pick = (person: CommentPerson | undefined) => {
    const el = area.current;
    if (!person || person.unavailable || !mention || !el) return;
    const next = insertMention(text, mention.start, el.selectionStart ?? text.length, person.name);
    setText(next.text);
    setPeople((list) => (list.some((p) => p.id === person.id) ? list : [...list, person]));
    lookup(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };
  const startMention = () => {
    const el = area.current;
    if (!el) return;
    const caret = el.selectionStart ?? text.length;
    const lead = caret > 0 && !/\s/.test(text[caret - 1] ?? "") ? " @" : "@";
    const value = text.slice(0, caret) + lead + text.slice(caret);
    const at = caret + lead.length;
    onText(value, at);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(at, at);
    });
  };
  const addFiles = async (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (!picked.length) return;
    if (!onUpload) return setFiles((old) => [...old, ...picked]);
    setBusy(true);
    setError("");
    try {
      const items = await onUpload(picked);
      setUploaded((old) => [...old, ...items]);
    } catch (caught) {
      setError(failure(caught, "上传失败，请重试"));
    } finally {
      setBusy(false);
    }
  };
  const mentions = keptMentions(text, people);
  const ready = editing ? editChanged(editing, text, mentions, { attachments: uploaded, files }) : Boolean(text.trim() || files.length || uploaded.length);
  const submit = async () => {
    if (busy || !ready) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit({ body: text.trim(), mentions, replyTo: replyTo?.id, attachments: uploaded, files });
      if (editing) return;
      setText("");
      setPeople([]);
      setFiles([]);
      setUploaded([]);
      onCancelReply?.();
    } catch (caught) {
      setError(failure(caught, editing ? "保存失败，请重试" : "发送失败，请重试"));
    } finally {
      setBusy(false);
    }
  };
  const pending = [...uploaded.map((m) => ({ key: m.id, name: m.name, remove: () => setUploaded((l) => l.filter((x) => x.id !== m.id)) })), ...files.map((f, i) => ({ key: `${f.name}#${i}`, name: f.name, remove: () => setFiles((l) => l.filter((x) => x !== f)) }))];
  const open = Boolean(mention && searchMentions);
  // While editing, the box counts as a layer: Esc inside it cancels the edit instead of closing the surrounding dialog.
  const label = editing ? "编辑评论" : replyTo ? `回复 ${replyTo.author.name}` : "写评论";
  return (
    <div ref={box} className="aui-comment-composer" data-editing={editing ? "" : undefined} data-busy={busy || undefined} {...(open || editing ? { [LAYER_ATTR]: "" } : {})}>
      {replyTo && !editing && (
        <div className="aui-comment-replying">
          回复 <b>{replyTo.author.name}</b>
          <button type="button" className="aui-icon-button" aria-label="不回复了" onClick={onCancelReply}><X aria-hidden="true" /></button>
        </div>
      )}
      <Textarea
        ref={area}
        minRows={editing ? 2 : 1}
        maxRows={8}
        value={text}
        placeholder={editing ? "改评论，@ 提到同事" : placeholder}
        aria-label={label}
        aria-describedby={editing ? `${base}-keys` : undefined}
        role={searchMentions ? "combobox" : undefined}
        aria-expanded={searchMentions ? open : undefined}
        aria-controls={searchMentions ? listId : undefined}
        aria-autocomplete={searchMentions ? "list" : undefined}
        aria-activedescendant={open && matches.length ? suggestOptionId(listId, active) : undefined}
        onChange={(event) => onText(event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length)}
        onBlur={() => lookup(null)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && (open || (editing && onCancel && !busy))) {
            event.preventDefault();
            event.stopPropagation();
            return open ? lookup(null) : onCancel?.();
          }
          if (open && matches.length && (event.key === "Enter" || event.key === "Tab") && !event.nativeEvent.isComposing) {
            event.preventDefault();
            return pick(matches[active]);
          }
          const step = open ? suggestStep(active, event.key, matches.length) : null;
          if (step !== null) {
            event.preventDefault();
            return setActive(step);
          }
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void submit();
          }
        }}
      />
      {pending.length > 0 && (
        <ul className="aui-comment-pending" aria-label={editing ? "附件" : "要发送的附件"}>
          {pending.map((p) => (
            <li key={p.key}>
              <span>{p.name}</span>
              <button type="button" className="aui-icon-button" aria-label={`去掉 ${p.name}`} onClick={p.remove}><X aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="aui-error" role="alert">{error}</p>}
      <div className="aui-comment-tools">
        {searchMentions && <button type="button" className="aui-icon-button" aria-label="提到同事（@）" data-tip="提到同事" onClick={startMention}><AtSign aria-hidden="true" /></button>}
        <button type="button" className="aui-icon-button" aria-label="添加图片" data-tip="添加图片" onClick={() => imageInput.current?.click()}><ImagePlus aria-hidden="true" /></button>
        <button type="button" className="aui-icon-button" aria-label="添加文件" data-tip="添加文件" onClick={() => fileInput.current?.click()}><Paperclip aria-hidden="true" /></button>
        <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={(e) => { void addFiles(e.currentTarget.files); e.currentTarget.value = ""; }} />
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => { void addFiles(e.currentTarget.files); e.currentTarget.value = ""; }} />
        {editing ? (
          <>
            {/* The edit box sits in a narrow comment column: the keys go to title / screen readers instead of a visible hint. */}
            <span id={`${base}-keys`} className="aui-sr-only">Ctrl + Enter 保存，Esc 取消</span>
            <Button size="sm" variant="ghost" className="aui-comment-cancel" shortcut="Esc" tooltip="取消" aria-keyshortcuts="Escape" disabled={busy} onClick={onCancel}>取消</Button>
            <Button size="sm" className="aui-comment-send" shortcut="Mod+Enter" tooltip="保存" aria-keyshortcuts="Control+Enter" disabled={busy || !ready} onClick={() => void submit()}>{busy ? "保存中…" : "保存"}</Button>
          </>
        ) : (
          <>
          <span className="aui-comment-kbd aui-note"><Kbd keys="Mod+Enter" size="sm" flat /> 发送</span>
          <Button size="sm" className="aui-comment-send" disabled={busy || !ready} onClick={() => void submit()}><Send aria-hidden="true" />{busy ? "发送中…" : "发送"}</Button>
          </>
        )}
      </div>
      <SuggestLayer open={open} anchor={box.current} side="top" id={listId} label="提到同事" items={matches.map((p) => ({ key: p.id, disabled: Boolean(p.unavailable), content: <><Avatar name={p.name} id={p.id} size={24} kind={p.unavailable ? "gone" : "person"} /><span className="aui-grant-who"><b>{p.name}</b>{(p.unavailable || p.hint) && <small>{p.unavailable ?? p.hint}</small>}</span></> }))}
        active={active} onActive={setActive} onPick={(i) => pick(matches[i])} empty={mention?.query ? "没有这个人，或他看不到这条记录" : "输入名字搜索"} />
    </div>
  );
}
