import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AdminProvider,
  Button,
  FormDialog,
  Input,
  AppearanceButton,
  UploadField,
  useAdminTheme,
  useDataSource,
  type ListAdapter,
} from "../src/index.ts";
import "../src/styles.css";
const adapter: ListAdapter<string> = async (query) => {
  await new Promise((r) => setTimeout(r, query.search === "slow" ? 450 : 20));
  if (query.search === "error") throw Error("服务失败");
  return { rows: [query.search], total: 1 };
};
function Fixture() {
  const [q, setQ] = useState("initial");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [calls, setCalls] = useState(0);
  const [received, setReceived] = useState(0);
  const data = useDataSource(adapter, {
    page: 1,
    pageSize: 10,
    search: q,
    filters: {},
  });
  const { palette } = useAdminTheme();
  return (
    <>
      <AppearanceButton label="色卡设置" icon="palette" />
      <Button onClick={() => setQ("slow")}>慢查询</Button>
      <Button onClick={() => setQ("fast")}>快查询</Button>
      <Button onClick={() => setQ("error")}>失败查询</Button>
      <output id="result">
        {data.error || data.data?.rows[0] || "loading"}
      </output>
      <Button onClick={() => setOpen(true)}>打开表单</Button>
      <output id="calls">{calls}</output>
      <span id="primary">{palette.primary}</span>
      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="异步表单"
        description="测试保存与退出"
        dirty={!!value}
        onSubmit={async () => {
          setCalls((v) => v + 1);
          await new Promise((r) => setTimeout(r, 200));
          if (value !== "success") throw Error("服务端拒绝");
        }}
      >
        <label htmlFor="value">内容</label>
        <Input
          id="value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </FormDialog>
      <UploadField
        accept={["image/png"]}
        maxBytes={1000}
        upload={async (file, { onProgress }) => {
          onProgress(50);
          await new Promise((r) => setTimeout(r, 250));
          if (file.name === "fail.png") throw Error("上传器失败");
          return { id: "1", url: "/asset", name: file.name };
        }}
        onUploaded={() => setReceived((v) => v + 1)}
      />
      <output id="received">{received}</output>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <>
    <AdminProvider storageKey="test-a">
      <Fixture />
    </AdminProvider>
    <AdminProvider storageKey="test-b" palette="celadon">
      <Button>第二主题</Button>
    </AdminProvider>
  </>,
);
