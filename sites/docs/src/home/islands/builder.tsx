import { Hand, MousePointer2, Undo2 } from "lucide-react";
import { useIsMobile } from "@adminui/react";
import { DashboardView } from "@adminui/react/dashboard-builder";
import { Demo as BuilderDemo } from "../../demos/charts/builder-playground";
import { BUILDER_METRICS, DEFAULT_FILTERS, DIMENSIONS, INITIAL_DASHBOARD, loadWidgetData } from "../../data/charts-data";
import { defineIsland } from "./runtime";
import "./builder.css";

/** The DashboardBuilder playground; phones get the read-only DashboardView (dragging needs a pointer and room). */
function Playground() {
  const mobile = useIsMobile();
  if (mobile)
    return (
      <div className="h-play h-play-mobile">
        <p className="h-play-note"><Hand aria-hidden="true" />手机上是只读看板（按阅读顺序排）；在电脑上打开可以拖。</p>
        <DashboardView widgets={INITIAL_DASHBOARD.widgets} context={DEFAULT_FILTERS} load={loadWidgetData} decor={{ metrics: BUILDER_METRICS, dimensions: DIMENSIONS }} stacked label={INITIAL_DASHBOARD.title} />
      </div>
    );
  return (
    <div className="h-play">
      <span className="h-sticker h-s1"><MousePointer2 aria-hidden="true" />① 从左边拖一个组件进来</span>
      <span className="h-sticker h-s2"><Hand aria-hidden="true" />② 拖右下角改大小，点卡片改设置</span>
      <span className="h-sticker h-s3"><Undo2 aria-hidden="true" />③ Ctrl Z 撤销 · 保存 = 一份 JSON</span>
      <div className="h-play-frame"><div><BuilderDemo /></div></div>
    </div>
  );
}

defineIsland("builder", { main: { view: Playground } });
