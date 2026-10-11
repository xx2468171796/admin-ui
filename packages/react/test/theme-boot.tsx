import React from "react";
import { createRoot } from "react-dom/client";
import { AdminProvider, Button, Checkbox, Input, Spinner, Switch } from "../src/index.ts";
import "../src/styles.css";

/** Client-only page (Vite SPA style): the stored 外观 must be on the very first committed frame. */
function Demo() {
  return (
    <AdminProvider storageKey="boot-test" palette="forest" mode="light">
      <div style={{ display: "flex", gap: 12, padding: 24, alignItems: "center" }}>
        <Button>默认按钮</Button>
        <Input aria-label="输入框" placeholder="输入框" />
        <Switch aria-label="开关" defaultChecked />
        <Switch aria-label="关" />
        <Checkbox aria-label="勾选" defaultChecked />
        <Spinner />
      </div>
    </AdminProvider>
  );
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><Demo /></React.StrictMode>);
