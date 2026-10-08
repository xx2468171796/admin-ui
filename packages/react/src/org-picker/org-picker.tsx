"use client";
/**
 * OrgPicker (review docs/review/org-picker A–I): the one 「选人 / 部门 / 角色 / 业务线 /
 * 公司」 dialog for sharing, granting, assigning and approvers. Desktop 1000 × 640, three columns: the
 * organisation tree (lazy; ticking a department picks it 「含下级」) | the people of the open node (virtual
 * list) | the draft grouped by kind with paths. A search over everything the viewer may see replaces the
 * two left columns while typing; extra tabs (角色 / 业务线 / 公司 …) are pluggable. `defaultFocus` opens
 * the tree at the viewer's department WITHOUT ticking it. The draft goes to `onChange` only on 「确定 (N)」;
 * departed people in the value stay (struck through) until removed one by one. Phones get a full-screen
 * drill-down with a bottom 「已选」 bar. Data comes only from the host's `OrgDataSource`.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Info, Network } from "lucide-react";
import { Button, Tabs } from "../primitives.tsx";
import { Dialog } from "../forms.tsx";
import { SearchBox } from "../search.tsx";
import { useIsMobile } from "../media-query.ts";
import { DEFAULT_SELECTABLE, mergeResolved, toOutput, type OrgDataSource, type OrgPick, type OrgSearchHit, type PickedSubject, type PickerSource } from "./org-picker-core.ts";
import { usePickerModel, type OrgPickOptions } from "./org-picker-model.ts";
import { orgPickerMessages } from "./org-picker-text.ts";
import { OrgTreePane } from "./org-picker-tree.tsx";
import { MembersPane, type OrgShortcut } from "./org-picker-members.tsx";
import { SelectedPane, pickedSub } from "./org-picker-selected.tsx";
import { SearchPane, SourcePane } from "./org-picker-lists.tsx";
import { MobileBar, MobileOrg, MobileSheet } from "./org-picker-mobile.tsx";
import { useOrgSearch, useOrgTree, useSourceList } from "./use-org-data.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/org-picker.css";

export type OrgPickerProps = OrgPickOptions & {
  open: boolean;
  onClose: () => void;
  source: OrgDataSource;
  /** Tabs after 「组织架构」, in order (角色 / 业务线 / 公司 / 最近 …). */
  extraSources?: readonly PickerSource[];
  /** Controlled value; the draft is handed back only on 「确定」 (second argument: the output shape). */
  value: readonly PickedSubject[];
  onChange: (next: PickedSubject[], picks: OrgPick[]) => void;
  /** Node to open at (the viewer's primary department / company / group — the host decides); never ticked. */
  defaultFocus?: string;
  /** Quick picks above the people: 我 / 我的部门 / 上级 / 整个公司. */
  shortcuts?: readonly OrgShortcut[];
  /** Under an empty department (「去管理后台加人」). */
  emptyAction?: ReactNode;
  /** Who to ask for out-of-scope nodes (「跨公司分享要集团管理员开通」); shown only where availability gives no reason of its own (a reason already says what to do). */
  lockedHint?: string;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
};

const ORG_TAB = "__org";

export function OrgPicker(props: OrgPickerProps) {
  const { open, onClose, source, extraSources = [], value, onChange, defaultFocus, shortcuts = [], emptyAction, lockedHint, title, description, confirmLabel } = props;
  const [draft, setDraft] = useState<PickedSubject[]>([...value]);
  const offline = orgPickerMessages(props.locale, props.messages).networkError;
  const tree = useOrgTree(source, open, offline);
  // Default kinds: people, departments, companies + whatever the extra tabs offer (角色 / 业务线 …).
  const kinds = props.selectable ?? [...DEFAULT_SELECTABLE, ...extraSources.map((s) => s.kind).filter((k) => !DEFAULT_SELECTABLE.includes(k))];
  const model = usePickerModel({ ...props, selectable: kinds }, draft, setDraft, tree.index);
  const { m } = model;
  const mobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState(ORG_TAB);
  const [current, setCurrent] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [deep, setDeep] = useState(false);
  const [scrollKey, setScrollKey] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [focusFailed, setFocusFailed] = useState(false);
  const panelId = useId();
  const opened = useRef(false);
  const searchBox = useRef<HTMLInputElement>(null);
  const search = useOrgSearch(source, open ? query : "", kinds, 60, offline);
  const extra = extraSources.find((s) => s.key === tab) ?? null;
  const tabList = useSourceList(open && !query.trim() ? extra : null, "", offline);

  const openNode = (id: string) => {
    setCurrent(id);
    setFocusId(id);
    const unit = tree.index.get(id);
    setDeep(unit ? unit.kind !== "dept" : false);
  };
  // Open: start from the value, fill in what the host only gave refs of, jump to defaultFocus (never ticked).
  useEffect(() => {
    if (!open) {
      opened.current = false;
      return;
    }
    if (opened.current) return;
    opened.current = true;
    setDraft([...value]);
    setQuery("");
    setTab(ORG_TAB);
    setSheet(false);
    const missing = value.filter((s) => !s.path);
    if (missing.length) {
      source.resolve(missing.map((s) => ({ kind: s.kind, id: s.id }))).then((resolved) => setDraft((d) => mergeResolved(d, resolved)), () => undefined);
    }
    setFocusFailed(false);
    setCurrent(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  // Jump to defaultFocus (never ticked) — also when the host only knows it after the dialog opened (its context
  // request was still on the way): a new value re-focuses instead of leaving the members pane on its skeleton.
  const focusedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      focusedFor.current = null;
      return;
    }
    if (!defaultFocus || focusedFor.current === defaultFocus) return;
    focusedFor.current = defaultFocus;
    setFocusFailed(false);
    let live = true;
    tree.reveal(defaultFocus).then(
      (chain) => {
        if (!live || focusedFor.current !== defaultFocus) return;
        if (!chain.length) return setFocusFailed(true);
        openNode(defaultFocus);
        setScrollKey((k) => k + 1);
      },
      () => live && focusedFor.current === defaultFocus && setFocusFailed(true),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultFocus]);
  // 「/ 聚焦搜索」: on desktop the search box takes the focus when the dialog opens (DialogFrame honours data-autofocus);
  // phones don't pop the keyboard up.
  useLayoutEffect(() => {
    searchBox.current?.toggleAttribute("data-autofocus", !mobile);
  });
  // No defaultFocus (or it can't be found): open the first visible root once the tree is there.
  useEffect(() => {
    if (open && !current && (!defaultFocus || focusFailed) && tree.roots?.[0]) {
      const first = tree.roots.find((r) => model.avail({ kind: r.kind, id: r.id }, r.availability).state !== "hidden") ?? tree.roots[0];
      tree.expand(first.id);
      openNode(first.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, current, tree.roots, focusFailed]);

  const locate = (hit: OrgSearchHit) => {
    setQuery("");
    setTab(ORG_TAB);
    tree.reveal(hit.id).then(() => {
      openNode(hit.id);
      setScrollKey((k) => k + 1);
    }, () => undefined);
  };
  const back = () => {
    if (!defaultFocus) return;
    tree.reveal(defaultFocus).then(() => {
      openNode(defaultFocus);
      setScrollKey((k) => k + 1);
    }, () => undefined);
  };
  const confirm = () => {
    onChange(draft, toOutput(draft));
    onClose();
  };
  const confirmText = confirmLabel ?? (model.single || !draft.length ? m.confirm : model.t(m.confirmCount, { n: draft.length }));
  const tabs = [{ value: ORG_TAB, label: m.tabOrg, icon: <Network aria-hidden="true" /> }, ...extraSources.map((s) => ({ value: s.key, label: s.label }))];
  const showTabs = tabs.length > 1 && !query.trim();
  const searching = Boolean(query.trim());
  const people = kinds.length === 1 && kinds[0] === "person";
  // Shortcuts of kinds this picker can't return (「我的部门」 when only people are picked) are left out.
  const usable = shortcuts.filter((s) => model.canSelect(s.subject.kind));
  const body = searching ? (
    <SearchPane model={model} query={search.query} hits={search.hits} loading={search.loading} error={search.error} onLocate={locate} />
  ) : extra ? (
    <SourcePane model={model} label={extra.label} items={tabList.items} loading={tabList.loading} error={tabList.error} query="" />
  ) : mobile ? (
    <MobileOrg model={model} tree={tree} source={source} current={current} onOpen={openNode} shortcuts={usable} emptyAction={emptyAction} />
  ) : (
    <>
      <OrgTreePane model={model} tree={tree} current={current} focusId={focusId} onFocusId={setFocusId} onOpen={openNode} scrollKey={scrollKey} />
      <MembersPane model={model} tree={tree} source={source} nodeId={current} deep={deep} onDeep={setDeep} shortcuts={usable} onBack={defaultFocus && current !== defaultFocus ? back : undefined} emptyAction={emptyAction} lockedHint={lockedHint} />
    </>
  );
  const single = draft[0];
  const footer = mobile ? undefined : (
    <>
      <span className="aui-note aui-orgp-foot-note">
        {model.single ? (
          single ? model.t(m.pickedSingle, { label: `${single.label}${single.path?.length ? `（${pickedSub(model, single)}）` : ""}` }) : m.noneSelected
        ) : model.canSelect("dept") || model.canSelect("company") ? (
          <>
            <Info aria-hidden="true" />
            {m.includeSubNote}
          </>
        ) : null}
      </span>
      <Button variant="outline" onClick={onClose}>{m.cancel}</Button>
      <Button onClick={confirm}>{confirmText}</Button>
    </>
  );
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} size="xl" className="aui-orgp-dialog" bodyClassName="aui-orgp-body" footer={footer}>
      <div className="aui-orgp" data-single={model.single || undefined} data-mobile={mobile || undefined} data-searching={searching || undefined}>
        <div className="aui-orgp-main">
          <div className="aui-orgp-search">
            <SearchBox ref={searchBox} value={query} onChange={setQuery} placeholder={people ? m.searchPlaceholderPeople : m.searchPlaceholder} label={people ? m.searchPlaceholderPeople : m.searchPlaceholder} shortcut={mobile ? undefined : "/"} variant={mobile ? "subtle" : "default"} />
          </div>
          {showTabs && <div className="aui-orgp-tabs"><Tabs size="sm" label={m.treeLabel} value={tab} onValueChange={setTab} items={tabs} panelId={panelId} /></div>}
          <div className="aui-orgp-panes" id={panelId} role={showTabs ? "tabpanel" : undefined} data-flat={searching || Boolean(extra) || mobile || undefined}>
            {body}
          </div>
          {mobile && <MobileBar model={model} onOpenSheet={() => setSheet(true)} onConfirm={confirm} confirmText={confirmText} />}
        </div>
        {!model.single && !mobile && <SelectedPane model={model} />}
        {mobile && sheet && <MobileSheet model={model} onClose={() => setSheet(false)} onConfirm={confirm} confirmText={confirmText} />}
      </div>
    </Dialog>
  );
}
