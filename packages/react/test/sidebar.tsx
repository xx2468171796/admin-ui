import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Box, FileText } from "lucide-react";
import {
  AdminProvider,
  AdminShell,
  Button,
  Choice,
  Input,
  StatusBadge,
  Panel,
  Switch,
  type NavItem,
} from "../src/index.ts";
import "../src/styles.css";
// Adversarial shell: a real console menu (7 groups / 33 entries) is taller than the
// viewport, which is exactly the case the starter is too small to cover.
const groups = [
  "运营",
  "用户与权限",
  "商业化",
  "玩法",
  "内容",
  "风控与安全",
  "系统",
];
const navigation: NavItem[] = Array.from({ length: 33 }, (_, i) => ({
  id: `page-${i + 1}`,
  title: `菜单项 ${i + 1}`,
  icon: FileText,
  group: i < 2 ? undefined : groups[(i - 2) % groups.length],
}));
function Shell() {
  const [active, setActive] = useState("page-1");
  const [clicked, setClicked] = useState("none");
  return (
    <>
      <AdminShell
        brand={
          <>
            <Box />
            菜单压力测试
          </>
        }
        navigation={navigation}
        tabs={[
          {
            id: active,
            title: active,
            icon: FileText,
            closable: false,
            content: (
              <>
                <output id="clicked">{clicked}</output>
                {/* Crowded header: a real console packs a segmented control, a select,
                    a switch and a primary action next to the title. */}
                <Panel
                  title="充值档位"
                  description="窄屏下标题与操作不得互相挤压。"
                  actions={
                    <>
                      <Button variant="outline" size="sm">
                        全部
                      </Button>
                      <Button variant="outline" size="sm">
                        启用中
                      </Button>
                      <Choice
                        label="排序方式"
                        value="price"
                        options={[
                          { value: "price", label: "按售价" },
                          { value: "time", label: "按时间" },
                        ]}
                        onChange={() => {}}
                      />
                      <Switch id="tier-switch" aria-label="仅看启用" />
                      <Button>新增档位</Button>
                    </>
                  }
                >
                  <p className="aui-note">演示内容。</p>
                </Panel>
              </>
            ),
          },
        ]}
        activeId={active}
        onNavigate={(id) => {
          setActive(id);
          setClicked(id);
        }}
        onCloseTab={() => {}}
        account={{ name: "陈组长", detail: "lead01", role: "值班" }}
        accountMenu={[{ id: "me", label: "我的资料", onSelect: () => {} }]}
        onSignOut={() => {}}
      />
      {/* Host controls on the dark brand rail: every variant must stay readable — contrast check in browser.mjs.
          A rail-coloured panel parked off screen (only computed colours are read), so the menu stays a pure stress test. */}
      <div className="aui-sidebar" style={{ position: "fixed", left: -1000, top: 0, width: 232, height: "auto", padding: 12, pointerEvents: "none" }}>
        <div id="profile-controls" style={{ display: "grid", gap: 6 }}>
          <span id="profile-marker">共享组件 · 侧栏底部入口</span>
          <span className="aui-note">备注文字</span>
          <a href="#profile">个人设置</a>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <Button size="sm">主按钮</Button>
            <Button size="sm" variant="outline">描边</Button>
            <Button size="sm" variant="secondary">次要</Button>
            <Button size="sm" variant="ghost">幽灵</Button>
            <Button size="sm" variant="text">文字</Button>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <StatusBadge>中性</StatusBadge>
            <StatusBadge tone="brand">品牌</StatusBadge>
          </div>
          <Input aria-label="侧栏输入" defaultValue="输入内容" />
        </div>
      </div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <AdminProvider storageKey="test-sidebar">
    <Shell />
  </AdminProvider>,
);
