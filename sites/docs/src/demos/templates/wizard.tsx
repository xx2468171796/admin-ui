import { useState } from "react";
import { ArrowRightLeft, FileSpreadsheet, PlugZap, RefreshCw, Upload } from "lucide-react";
import {
  ActionList, Button, ChoiceTiles, Choice, FormField, InfoList, InlineAlert, PageHeader, Panel, StatusBadge, WizardLayout, useNotify,
} from "@adminui/react";

const STEPS = [{ key: "source", label: "选来源" }, { key: "file", label: "上传文件" }, { key: "map", label: "对应字段" }, { key: "done", label: "完成" }];
const COLUMNS = [
  { key: "a", label: "公司名称", guess: "name" },
  { key: "b", label: "所在城市", guess: "city" },
  { key: "c", label: "联系人手机", guess: "phone" },
  { key: "d", label: "备注 2", guess: "skip" },
];
const FIELDS = [{ value: "name", label: "客户名称" }, { value: "city", label: "城市" }, { value: "phone", label: "手机" }, { value: "note", label: "备注" }, { value: "skip", label: "不导入这一列" }];

/** T12 向导页：居中向导卡（步骤条 → 每步一块内容 → 上一步 / 下一步，不能下一步时写原因）+ 右侧 260 小卡。 */
export function Demo() {
  const notify = useNotify();
  // 从第 2 步开始：还没上传文件，「下一步」旁边写着原因。
  const [step, setStep] = useState(1);
  const [source, setSource] = useState("excel");
  const [file, setFile] = useState<"none" | "uploading" | "ready">("none");
  const [mapping, setMapping] = useState<Record<string, string>>(() => Object.fromEntries(COLUMNS.map((c) => [c.key, c.guess])));
  const current = STEPS[step]?.key ?? "source";

  const upload = () => {
    setFile("uploading");
    setTimeout(() => setFile("ready"), 900);
  };
  const blocked = current === "file" && file !== "ready" ? "先上传文件，才能对应字段" : current === "map" && !Object.values(mapping).includes("name") ? "要有一列对应到「客户名称」" : undefined;

  return (
    <div style={{ height: 680, overflow: "auto", padding: 16, background: "var(--aui-canvas)" }}>
      <PageHeader title="导入客户" />
      <WizardLayout
        title="导入客户"
        description="从表格或其他系统把客户搬进来；重复的客户按名称合并，不会建两份。"
        note="关掉也没关系，上传过的文件保留 24 小时"
        onClose={() => notify("关闭向导")}
        steps={STEPS}
        current={current}
        onBack={step > 0 && current !== "done" ? () => setStep((s) => s - 1) : undefined}
        onNext={current === "done" ? () => { setStep(0); setFile("none"); } : () => setStep((s) => s + 1)}
        nextLabel={current === "map" ? "开始导入" : current === "done" ? "再导入一批" : "下一步"}
        nextDisabledReason={blocked}
        aside={
          <>
            <Panel title="常见问题" flush>
              <ActionList wrap label="常见问题" items={[
                { key: "1", title: "支持哪些文件？", detail: "Excel（.xlsx）和 CSV，第一行是列名，最多 5 万行。" },
                { key: "2", title: "重复的客户怎么办？", detail: "名称相同的合并到已有客户，空的格子不会覆盖已有内容。" },
                { key: "3", title: "导错了能撤回吗？", detail: "导入后 3 天内可以在操作日志里整批撤销。" },
              ]} />
            </Panel>
            <Panel title="最近导入">
              <InfoList label="最近导入" items={[
                { key: "1", label: <><StatusBadge tone="success">完成</StatusBadge> 展会名单.xlsx</>, value: "昨天" },
                { key: "2", label: <><StatusBadge tone="warning">12 行跳过</StatusBadge> 老系统导出.csv</>, value: "9-30" },
              ]} />
            </Panel>
          </>
        }
      >
        {current === "source" && (
          <FormField label="客户数据从哪里来" htmlFor="tpl-source" hint="选错了可以回来换">
            <ChoiceTiles id="tpl-source" label="客户数据从哪里来" value={source} onValueChange={setSource} options={[
              { value: "excel", label: "Excel / CSV", hint: "从表格文件导入", icon: <FileSpreadsheet /> },
              { value: "crm", label: "其他 CRM", hint: "按对方的导出格式", icon: <ArrowRightLeft /> },
              { value: "api", label: "开放接口", hint: "让技术同事用 API 推送", icon: <PlugZap /> },
            ]} />
          </FormField>
        )}
        {current === "file" && (
          file === "ready"
            ? <InlineAlert tone="success" title="客户名单-2026Q4.xlsx 已上传" action={<Button size="sm" variant="outline" onClick={upload}><RefreshCw />换一个</Button>}>识别到 4 列、386 行，其中 9 行和已有客户同名，会合并。</InlineAlert>
            : <InlineAlert tone="info" title={file === "uploading" ? "正在上传并读取…" : "还没有选择文件"} action={<Button size="sm" onClick={upload} loading={file === "uploading"}><Upload />选择文件</Button>}>第一行要是列名；单个文件不超过 20 MB。</InlineAlert>
        )}
        {current === "map" && COLUMNS.map((c) => (
          <FormField key={c.key} label={`文件里的「${c.label}」`} htmlFor={`tpl-map-${c.key}`}>
            <Choice label={`「${c.label}」导入到`} value={mapping[c.key] ?? "skip"} onChange={(v) => setMapping((m) => ({ ...m, [c.key]: v }))} options={FIELDS} />
          </FormField>
        ))}
        {current === "done" && (
          <InlineAlert tone="success" title="导入完成：新增 377 个客户，合并 9 个">新客户的负责人是你；可以在客户列表里按「最近导入」筛出来。</InlineAlert>
        )}
      </WizardLayout>
    </div>
  );
}
