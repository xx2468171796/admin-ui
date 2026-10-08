import { useState } from "react";
import { Copy, EyeOff, Trash2 } from "lucide-react";
import { useNotify, type MenuSection } from "@adminui/react";
import { ViewManager, ViewTabs, copyName, newViewName, viewActions, type NewViewDraft, type ViewKind, type ViewSummary } from "@adminui/react/views";

const INITIAL: ViewSummary[] = [
  { id: "all", name: "全部商机", kind: "grid", tier: "standard", mustSee: true },
  { id: "board", name: "阶段看板", kind: "kanban", tier: "standard" },
  { id: "cal", name: "跟进日历", kind: "calendar", tier: "standard" },
  { id: "plan", name: "实施排期", kind: "gantt", tier: "standard" },
  { id: "east", name: "华东组商机", kind: "grid", tier: "shared" },
  { id: "photo", name: "现场照片", kind: "gallery", tier: "shared" },
  { id: "mine", name: "我负责的", kind: "grid", tier: "mine" },
  { id: "late", name: "我的逾期跟进", kind: "calendar", tier: "mine", hidden: true },
];
const TIER_ORDER = ["standard", "shared", "mine"];

/** 一行标签 + 「+」新建 + 右侧「视图」管理。双击「我的」视图改名；当前标签的 ⋯ 和右键是同一个菜单。 */
export function Demo() {
  const notify = useNotify();
  const [views, setViews] = useState<ViewSummary[]>(INITIAL);
  const [active, setActive] = useState("board");
  const patch = (id: string, change: Partial<ViewSummary>) => setViews((list) => list.map((v) => (v.id === id ? { ...v, ...change } : v)));
  const add = (kind: ViewKind, name: string, tier: ViewSummary["tier"]) => {
    const view: ViewSummary = { id: `v${Date.now()}`, name, kind, tier };
    setViews((list) => [...list, view]);
    setActive(view.id);
  };
  const duplicate = (id: string) => {
    const source = views.find((v) => v.id === id);
    if (source) add(source.kind, copyName(source.name, views.map((v) => v.name)), "mine");
  };
  const createView = async (draft: NewViewDraft) => {
    await new Promise((r) => setTimeout(r, 300));
    add(draft.kind, draft.name, draft.audience === "shared" ? "shared" : "mine");
    notify(`已新建视图「${draft.name}」`, "success");
  };

  const tabMenu = (v: ViewSummary): MenuSection[] => {
    const allowed = viewActions(v);
    return [
      {
        items: [
          { key: "dup", label: v.tier === "mine" ? "复制一份" : "复制为我的视图", icon: <Copy size={15} />, onSelect: () => duplicate(v.id) },
          { key: "hide", label: "从标签栏隐藏", icon: <EyeOff size={15} />, disabled: !allowed.allowed.includes("hide"), disabledReason: allowed.reasons.hide, onSelect: () => patch(v.id, { hidden: true }) },
        ],
      },
      ...(allowed.allowed.includes("delete") ? [{ items: [{ key: "del", label: "删除视图", icon: <Trash2 size={15} />, danger: true, onSelect: () => setViews((list) => list.filter((x) => x.id !== v.id)) }] }] : []),
    ];
  };

  const manager = (
    <ViewManager
      views={views}
      activeId={active}
      tierNotes={{ standard: "管理员维护", shared: "华东组 · 组长维护", mine: "只有你看得到" }}
      onSelect={setActive}
      onReorder={(tier, ids) =>
        setViews((list) =>
          [...list.filter((v) => v.tier !== tier), ...ids.map((id) => list.find((v) => v.id === id)).filter((v): v is ViewSummary => Boolean(v))].sort(
            (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
          ),
        )
      }
      onHiddenChange={(id, hidden) => patch(id, { hidden })}
      onRename={(id, name) => patch(id, { name })}
      onDuplicate={duplicate}
      onDelete={async (id) => {
        await new Promise((r) => setTimeout(r, 300));
        setViews((list) => list.filter((v) => v.id !== id));
        if (active === id) setActive("all");
      }}
      onCreate={(kind) => add(kind, newViewName(kind, views.map((v) => v.name)), "mine")}
    />
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <ViewTabs
        views={views}
        activeId={active}
        onSelect={setActive}
        tabMenu={tabMenu}
        onCreateView={createView}
        createAudiences={["mine", "shared"]}
        createNote="建好后带上当前视图的筛选和排序"
        onRename={(id, name) => patch(id, { name })}
        manager={manager}
      />
      <p className="aui-note" style={{ margin: 0 }}>当前视图：{views.find((v) => v.id === active)?.name ?? "—"}</p>
    </div>
  );
}
