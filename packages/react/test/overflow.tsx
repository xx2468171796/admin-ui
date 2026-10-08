import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AdminProvider, Checkbox, Switch, Tabs } from "../src/index.ts";
import "../src/styles.css";
/**
 * Adversarial overflow harness. Radix renders a hidden bubble <input type=checkbox> as a
 * SIBLING of the control whenever there is a form ancestor. Without a positioned wrapper
 * its containing block is <html>, so no inner scroll container can clip it and it widens
 * the whole document — while every scroll container measures perfectly healthy.
 */
function Harness() {
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(false);
  const [section, setSection] = useState("s1");
  return (
    <form>
      {/* 390 宽放不下 10 个分区：标签条不能出系统滚动条，靠渐隐 + 箭头 + 滚轮 */}
      <Tabs
        value={section}
        onValueChange={setSection}
        label="很多分区"
        items={Array.from({ length: 10 }, (_, i) => ({ value: `s${i + 1}`, label: `第${i + 1}个分区` }))}
      >
        <p>分区 {section}</p>
      </Tabs>
      <div className="aui-table-scroll">
        <table className="aui-table" style={{ width: 720 }}>
          <caption className="aui-sr-only">逃逸探针</caption>
          <thead>
            <tr>
              <th style={{ width: 520 }}>说明</th>
              <th>开关</th>
              <th>多选</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>隐藏的 bubble input 不得参与整页滚动区域。</td>
              <td>
                <Switch
                  id="wide-switch"
                  aria-label="宽表里的开关"
                  checked={on}
                  onCheckedChange={setOn}
                />
              </td>
              <td>
                <Checkbox
                  aria-label="宽表里的多选"
                  checked={checked}
                  onCheckedChange={(next) => setChecked(next === true)}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </form>
  );
}
createRoot(document.getElementById("root")!).render(
  <AdminProvider storageKey="test-overflow">
    <Harness />
  </AdminProvider>,
);
