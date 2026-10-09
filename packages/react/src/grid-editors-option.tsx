"use client";
/**
 * Option editor of BitableGrid / RecordField.edit for singleSelect / multiSelect / user fields, in the
 * one select look: the cell (or the record's value cell) becomes a box with the chosen
 * values — removable tags for multi, the tag + a hover × for single (clearing is never a fake
 * 「（清空）」 option) — and the search text; the option list hangs under the box (OptionList: tick on the
 * right for single, checkbox on the left for multi, people with avatars, 「已选 N 项 · 清空」).
 * Keys: ↑ ↓ / Home / End move, Enter picks (single commits ↓; multi toggles, Ctrl + Enter commits),
 * Tab / Shift + Tab commit and move, Backspace on an empty search removes the last value, Esc cancels;
 * clicking outside commits (multi needs no 「完成」 button).
 */
import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { X } from "lucide-react";
import { PopoverLayer } from "./popover-panel.tsx";
import { OptionList, RemovableChip, SelectFooter, type SelectItem } from "./option-list.tsx";
import { useOptionNav } from "./use-option-nav.ts";
import { toggleValue } from "./option-list-core.ts";
import { readField, toPeople, type GridSelectOption } from "./grid-core.ts";
import { useOptionalNotify } from "./notifications.tsx";
import type { GridCommitMove, GridEditorProps } from "./grid-editors.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/grid.css";

export function OptionEditor<T>({ field, row, startText, people, onCommit, onCancel, error, variant = "cell" }: GridEditorProps<T>) {
  const multi = field.type !== "singleSelect";
  const isUser = field.type === "user";
  // Options created in this editor (field.onCreateOption) until the host's field carries them.
  const [made, setMade] = useState<readonly GridSelectOption[]>([]);
  const options: readonly SelectItem[] = useMemo(() => {
    if (!isUser) {
      const own = field.options ?? [];
      return [...own, ...made.filter((m) => !own.some((o) => o.value === m.value))].map((o) => ({ value: o.value, label: o.label, tone: o.tone, color: o.color }));
    }
    const current = toPeople(readField(field, row));
    const list = people?.length ? people : current;
    return list.map((p) => ({ value: p.key ?? p.name, label: p.name, hint: p.hint, avatar: "" }));
  }, [field, row, people, isUser, made]);
  const initial = useMemo((): string[] => {
    const value = readField(field, row);
    if (isUser) return toPeople(value).map((p) => p.key ?? p.name);
    return (Array.isArray(value) ? value : value === null || value === undefined || value === "" ? [] : [value]).map(String);
  }, [field, row, isUser]);
  const [chosen, setChosen] = useState<string[]>(initial);
  const chosenRef = useRef(chosen);
  chosenRef.current = chosen;
  const freeText = isUser && !people?.length;
  const done = useRef(false);
  const toValue = (values: string[]): unknown => {
    if (field.type === "singleSelect") return values[0] ?? null;
    if (field.type === "multiSelect") return values;
    return values.map((v) => people?.find((p) => (p.key ?? p.name) === v) ?? { name: v });
  };
  const finish = (values: string[], move: GridCommitMove) => {
    if (done.current) return;
    done.current = true;
    if (freeText && nav.query.trim()) {
      // No people list: typed names (comma separated) are added.
      onCommit({ text: [...values, nav.query.trim()].join("、") }, move);
      return;
    }
    onCommit({ value: toValue(values) }, move);
  };
  const pick = (value: string) => {
    if (!multi) return finish([value], "none");
    setChosen((list) => toggleValue(list, value, options.map((o) => o.value)) ?? list);
  };
  const notify = useOptionalNotify();
  const [creating, setCreating] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const createOption = !isUser ? field.onCreateOption : undefined;
  // 「+ 新建选项」: wait for the host, then pick what it made (multi: add); null = cancelled; a rejection keeps the editor open.
  const create = createOption ? (label: string) => {
    if (creating) return;
    setCreating(label);
    setCreateError(null);
    createOption(label).then(
      (option) => {
        setCreating(null);
        if (!option) return nav.setQuery(label);
        setMade((list) => [...list, option]);
        if (!multi) return finish([option.value], "none");
        setChosen((list) => (list.includes(option.value) ? list : [...list, option.value]));
        nav.setQuery("");
      },
      (caught: unknown) => {
        setCreating(null);
        nav.setQuery(label);
        const message = caught instanceof Error && caught.message ? caught.message : "请稍后重试";
        if (notify) notify.show({ title: `没能新建选项「${label}」`, description: message, tone: "error" });
        else setCreateError(`没能新建选项「${label}」：${message}`);
      },
    );
  } : undefined;
  const nav = useOptionNav({ options, selected: chosen, onPick: pick, onCreate: create, createExact: true, initialQuery: startText ?? "", onEnterEmpty: () => (multi || freeText ? finish(chosenRef.current, "down") : undefined) });
  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.nativeEvent.isComposing) return;
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      done.current = true;
      onCancel();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      finish(chosenRef.current, event.shiftKey ? "left" : "right");
      return;
    }
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      finish(chosenRef.current, "down");
      return;
    }
    if ((event.key === "Backspace" || event.key === "Delete") && !nav.query && chosenRef.current.length) {
      event.preventDefault();
      if (multi) setChosen((list) => list.slice(0, -1));
      else finish([], "none");
      return;
    }
    nav.onKeyDown(event, { search: true });
  };
  const close = (returnFocus: boolean) => {
    if (!returnFocus) return finish(chosenRef.current, "none");
    done.current = true;
    onCancel();
  };
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const width = box?.getBoundingClientRect().width;
  const known = (value: string): SelectItem => options.find((o) => o.value === value) ?? { value, label: value, ...(isUser ? { avatar: "" } : {}) };
  const size = variant === "cell" ? "sm" : "md";
  return (
    <div ref={setBox} className="aui-grid-editor aui-grid-option-field" data-variant={variant} data-error={error ? true : undefined} onKeyDown={onKeyDown}>
      {chosen.map((value) => (
        <RemovableChip key={value} option={known(value)} size={size} onRemove={multi ? () => setChosen((list) => list.filter((v) => v !== value)) : undefined} />
      ))}
      <input
        className="aui-grid-option-search"
        aria-label={`搜索「${field.title}」选项`}
        placeholder={chosen.length ? "" : freeText ? "输入姓名，多个用逗号分隔" : createOption ? "搜索或新建选项" : "搜索选项"}
        value={nav.query}
        autoFocus
        autoComplete="off"
        role="combobox"
        aria-expanded="true"
        aria-controls={nav.listId}
        aria-activedescendant={nav.activeId}
        onChange={(event) => nav.setQuery(event.target.value)}
      />
      {!multi && chosen.length > 0 && (
        <button type="button" className="aui-grid-option-clear" tabIndex={-1} aria-label={`清空「${field.title}」`} onPointerDown={(event) => { event.preventDefault(); finish([], "none"); }}>
          <X aria-hidden="true" />
        </button>
      )}
      <PopoverLayer open={Boolean(box)} anchor={box} label={`选择「${field.title}」`} initialFocus={false} className="aui-popover aui-select-pop aui-grid-option-pop"
        style={width ? { width: Math.max(240, Math.round(width)) } : undefined} onClose={close}
        sheet={{ title: field.title, end: <button type="button" className="aui-sheet-action" onPointerDown={(event) => { event.preventDefault(); finish(chosenRef.current, "none"); }}>完成</button> }}>
        <div className="aui-grid-option-editor" onKeyDown={onKeyDown}>
          <OptionList
            id={nav.listId}
            label={field.title}
            options={nav.shown}
            selected={chosen}
            multiple={multi}
            active={nav.active}
            onActive={nav.setActive}
            onPick={pick}
            create={creating ? null : nav.create}
            onCreate={create}
            creating={creating}
            emptyText={freeText ? "回车添加输入的姓名" : nav.query.trim() ? `没有匹配「${nav.query.trim()}」的选项` : "没有可选的选项"}
            pickOnPointerDown
          />
          {(error ?? createError) && <div className="aui-grid-editor-error" role="alert">{error ?? createError}</div>}
          {multi && <SelectFooter count={chosen.length} onClear={() => setChosen([])} />}
        </div>
      </PopoverLayer>
    </div>
  );
}
