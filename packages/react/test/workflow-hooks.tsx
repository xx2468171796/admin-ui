import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AdminProvider,
  Button,
  useAdminResource,
  usePersistentState,
  type StoreAdapter,
  createPageRegistry,
  FeatureGate,
} from "../src/index.ts";
let stored = 0;
const adapter: StoreAdapter<number> = {
  load: async () => stored,
  save: async (_key, value) => {
    await new Promise((resolve) => setTimeout(resolve, value === 1 ? 250 : 1));
    stored = value;
    document.documentElement.dataset.saved = String(value);
  },
  remove: async () => {
    stored = 0;
  },
};
function App() {
  const [scope, setScope] = useState("A");
  const resource = useAdminResource(scope, async () => {
    const captured = scope;
    await new Promise((resolve) =>
      setTimeout(resolve, scope === "A" ? 400 : 10),
    );
    document.documentElement.dataset[`done${captured}`] = "true";
    return captured;
  });
  const preferences = usePersistentState("test", 0, adapter);
  const registry = createPageRegistry([
    { id: "public", title: "Public", render: () => null },
    {
      id: "private",
      title: "Private",
      feature: "private",
      permission: "read",
      render: () => null,
    },
  ]);
  return (
    <AdminProvider storageKey="test-theme">
      <Button onClick={() => setScope("B")}>切换到 B</Button>
      <p data-testid="resource">{resource.data ?? "loading"}</p>
      <Button
        disabled={!preferences.ready}
        onClick={() => {
          preferences.setValue(1);
          preferences.setValue(2);
        }}
      >
        连续保存偏好
      </Button>
      <p data-testid="registry">
        {registry
          .list({ features: { private: true }, permissions: [] })
          .map((p) => p.id)
          .join(",")}
      </p>
      <FeatureGate flags={{}} name="unknown" fallback={<span>默认关闭</span>}>
        不应出现
      </FeatureGate>
    </AdminProvider>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
