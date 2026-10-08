"use client";
/**
 * ViewManager (bt/views V1, demo D16): the 「视图管理」 panel body — views in three tiers
 * (业务线标准 with a lock · 共享 · 我的), each tier reorderable by drag / keyboard (SortableList), an eye
 * toggle per view (必看 views cannot be hidden), a ⋯ menu (重命名 · 复制一份 / 复制为我的视图 · 从标签栏隐藏 ·
 * 删除视图) filtered by the tier policy (view-core `viewActions`), and 「新建我的视图」 with the six view
 * kinds. All changes go to the host's callbacks; the server enforces who may change what.
 * Put it in ViewTabs `manager` (it becomes a PopoverPanel), a SideSheet, or a page.
 */
import { useContext, useState, type ReactNode } from "react";
import { Copy, Eye, EyeOff, Lock, Pencil, Plus, Trash2, User, Users, X } from "lucide-react";
import { Button, Input } from "../primitives.tsx";
import { InlineAlert } from "../layout.tsx";
import { ConfirmDialog } from "../forms.tsx";
import { MenuButton, type MenuItem, type MenuSection } from "../menu.tsx";
import { SortableList } from "../sortable.tsx";
import { SearchBox } from "../search.tsx";
import { can, searchViews, tierViews, VIEW_KIND_LABELS, VIEW_KINDS, VIEW_TIER_LABELS, VIEW_TIERS, viewActions, type ViewKind, type ViewPolicy, type ViewSummary, type ViewTier } from "./view-core.ts";
import { ViewKindIcon } from "./view-parts.tsx";
import { ViewTabsContext } from "./view-tabs.tsx";
import { IconButton, MoreMenu } from "../buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

export type ViewManagerProps = {
  views: readonly ViewSummary[];
  activeId?: string;
  policy?: ViewPolicy;
  /** Right of each tier heading: 「林经理维护」「一组 · 周组长建」「只有你看得到 · 数量不限」. */
  tierNotes?: Partial<Record<ViewTier, string>>;
  onSelect?: (id: string) => void;
  /** New order of one tier (ids). */
  onReorder?: (tier: ViewTier, ids: string[]) => void;
  onHiddenChange?: (id: string, hidden: boolean) => void;
  onRename?: (id: string, name: string) => void | Promise<void>;
  /** 「复制一份」/「复制为我的视图」: the host creates a 「我的」 copy. */
  onDuplicate?: (id: string) => void;
  /** After the built-in confirmation; reject to keep the dialog with the message. */
  onDelete?: (id: string) => void | Promise<void>;
  onCreate?: (kind: ViewKind) => void;
  /** Kinds offered under 「新建我的视图」 (default all six). */
  kinds?: readonly ViewKind[];
  /** More ⋯ items for a view (「分享视图」「设为默认」). */
  extraItems?: (view: ViewSummary) => readonly MenuItem[];
  /** Search box on top (default: more than 6 views). */
  search?: boolean;
};

const TIER_ICON: Record<ViewTier, ReactNode> = { standard: <Lock size={13} aria-hidden="true" />, shared: <Users size={13} aria-hidden="true" />, mine: <User size={13} aria-hidden="true" /> };
type Row = ViewSummary & { locked?: boolean };

function RenameInput({ name, onDone }: { name: string; onDone: (name: string | null) => void }) {
  const [value, setValue] = useState(name);
  return (
    <Input
      className="aui-vm-rename"
      aria-label="视图名称"
      autoFocus
      value={value}
      maxLength={40}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => onDone(value.trim() && value.trim() !== name ? value.trim() : null)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") onDone(value.trim() && value.trim() !== name ? value.trim() : null);
        if (e.key === "Escape") onDone(null);
      }}
    />
  );
}

/** See the module comment. */
export function ViewManager({ views, activeId, policy = {}, tierNotes, onSelect, onReorder, onHiddenChange, onRename, onDuplicate, onDelete, onCreate, kinds = VIEW_KINDS, extraItems, search }: ViewManagerProps) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const tabs = useContext(ViewTabsContext);
  const searching = query.trim().length > 0;
  const listed = searchViews(views, query);
  const [deleting, setDeleting] = useState<ViewSummary | null>(null);
  const reorderable = policy.canReorder !== false && Boolean(onReorder);
  const menuFor = (view: ViewSummary): MenuSection[] => {
    const set = viewActions(view, policy);
    const own = can(set, "rename");
    const items: MenuItem[] = [];
    if (onRename) items.push({ key: "rename", label: "重命名", icon: <Pencil size={15} />, disabled: !own, disabledReason: set.reasons.rename, onSelect: () => setRenaming(view.id) });
    if (onDuplicate) items.push({ key: "dup", label: view.tier === "mine" ? "复制一份" : "复制为我的视图", icon: <Copy size={15} />, onSelect: () => onDuplicate(view.id) });
    if (onHiddenChange) {
      items.push(view.hidden
        ? { key: "show", label: "在标签栏显示", icon: <Eye size={15} />, onSelect: () => onHiddenChange(view.id, false) }
        : { key: "hide", label: "从标签栏隐藏", icon: <EyeOff size={15} />, disabled: !can(set, "hide"), disabledReason: set.reasons.hide, onSelect: () => onHiddenChange(view.id, true) });
    }
    items.push(...(extraItems?.(view) ?? []));
    const out: MenuSection[] = [{ items }];
    if (onDelete && own) out.push({ items: [{ key: "delete", label: "删除视图", icon: <Trash2 size={15} />, danger: true, onSelect: () => setDeleting(view) }] });
    return out;
  };
  const renderRow = (view: Row) => {
    const set = viewActions(view, policy);
    const eyeDisabled = !view.hidden && !can(set, "hide");
    return (
      <span className="aui-vm-row" data-active={view.id === activeId || undefined} data-hidden={view.hidden || undefined}>
        <ViewKindIcon kind={view.kind} size={15} />
        {renaming === view.id ? (
          <RenameInput
            name={view.name}
            onDone={(name) => {
              setRenaming(null);
              if (name) void onRename?.(view.id, name);
            }}
          />
        ) : (
          <button type="button" className="aui-vm-name" aria-current={view.id === activeId ? "true" : undefined} onClick={() => onSelect?.(view.id)} onDoubleClick={() => can(set, "rename") && onRename && setRenaming(view.id)}>
            <span className="aui-vm-text">{view.name}</span>
            {view.hidden && <span className="aui-sr-only">（已隐藏）</span>}
          </button>
        )}
        {view.mustSee && <span className="aui-vm-must">必看</span>}
        {onHiddenChange && (
          <button
            type="button"
            className="aui-vm-eye"
            aria-pressed={!view.hidden}
            aria-label={view.hidden ? `在标签栏显示「${view.name}」` : `从标签栏隐藏「${view.name}」`}
            aria-disabled={eyeDisabled || undefined}
            data-tip={eyeDisabled ? set.reasons.hide : view.hidden ? "已隐藏，点一下显示" : "显示在标签栏"}
            onClick={() => !eyeDisabled && onHiddenChange(view.id, !view.hidden)}
          >
            {view.hidden ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
          </button>
        )}
        <MoreMenu sections={menuFor(view)} label={`「${view.name}」的操作`} className="aui-vm-more" />
      </span>
    );
  };
  const kindItems = kinds.map((kind) => ({ key: kind, label: VIEW_KIND_LABELS[kind], icon: <ViewKindIcon kind={kind} />, onSelect: () => onCreate?.(kind) }));
  return (
    <div className="aui-vm">
      {(search ?? views.length > 6) && (
        <div className="aui-vm-search">
          <SearchBox size="sm" label="搜索视图" placeholder="搜索视图" value={query} onChange={setQuery} />
        </div>
      )}
      {VIEW_TIERS.map((tier) => {
        // Searching: order changes would only reorder the hits, so dragging is off.
        const list: Row[] = tierViews(listed, tier).map((v) => ({ ...v, locked: !reorderable || searching }));
        if (!list.length && (tier !== "mine" || searching)) return null;
        return (
          <section key={tier} className="aui-vm-tier" aria-label={VIEW_TIER_LABELS[tier]}>
            <header className="aui-vm-tier-head">
              {TIER_ICON[tier]}
              <span>{VIEW_TIER_LABELS[tier]}</span>
              {tierNotes?.[tier] && <small>{tierNotes[tier]}</small>}
            </header>
            {list.length ? (
              <SortableList
                items={list}
                dense
                label={`${VIEW_TIER_LABELS[tier]}的顺序`}
                itemLabel={(v) => v.name}
                lockedHint="没有调整顺序的权限"
                onChange={(next) => onReorder?.(tier, next.map((v) => v.id))}
                renderItem={(v) => renderRow(v)}
              />
            ) : (
              <p className="aui-vm-empty">还没有自己的视图</p>
            )}
          </section>
        );
      })}
      {searching && !listed.length && <p className="aui-vm-empty">没有找到「{query.trim()}」</p>}
      {(onCreate || reorderable) && (
        <footer className="aui-vm-foot">
          {onCreate && (tabs?.openCreate ? (
            <Button variant="outline" size="sm" onClick={tabs.openCreate}>
              <Plus size={14} aria-hidden="true" />
              新建视图
            </Button>
          ) : (
            <MenuButton variant="outline" size="sm" label="新建视图" align="start" sections={[{ title: "新建我的视图", items: kindItems }]}>
              <Plus size={14} aria-hidden="true" />
              新建视图
            </MenuButton>
          ))}
          {reorderable && <span className="aui-note">拖动排序只改你的标签栏</span>}
        </footer>
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="删除视图"
        destructive
        confirmLabel="删除视图"
        impact={deleting ? `删除「${deleting.name}」后，${deleting.tier === "mine" ? "只影响你自己" : "所有能看到它的人都会失去这个视图"}；数据表里的记录不受影响。` : null}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await onDelete?.(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}

export type ViewLockNoticeProps = {
  view: Pick<ViewSummary, "name" | "tier">;
  /** 「复制为我的视图」 */
  onDuplicate?: () => void;
  onDismiss?: () => void;
};
/**
 * Shown when someone tries to change the filter / group / sort of a view they don't maintain (D16):
 * explains why, and offers 「复制为我的视图」. Temporary search stays allowed.
 */
export function ViewLockNotice({ view, onDuplicate, onDismiss }: ViewLockNoticeProps) {
  const what = view.tier === "standard" ? "业务线标准视图" : "共享视图";
  return (
    <div className="aui-vlock">
      <InlineAlert
        tone="warning"
        title={`这是${what}，不能修改筛选、分组、排序。`}
        action={
          <span className="aui-vlock-actions">
            {onDuplicate && (
              <Button size="sm" onClick={onDuplicate}>
                <Copy size={14} aria-hidden="true" />
                复制为我的视图
              </Button>
            )}
            {onDismiss && (
              <IconButton label="关闭提示" onClick={onDismiss} icon={<X size={15} aria-hidden="true" />} />
            )}
          </span>
        }
      >
        可以临时搜索；想换条件，复制一份到「我的视图」再改。
      </InlineAlert>
    </div>
  );
}
