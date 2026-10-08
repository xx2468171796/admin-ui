"use client";
import { useRef, useState } from "react";
import { Button, Choice, Input } from "./primitives.tsx";
import { parseCsv, type ImportIssue, type ImportRow } from "./workflow-core.ts";
import { buildCsv, downloadCsv } from "./reports.tsx";
export type ImportField = { key: string; label: string; required?: boolean };
export type ImportAdapter = {
  parse?: (
    file: File,
    signal: AbortSignal,
  ) => Promise<{ headers: string[]; rows: ImportRow[] }>;
  validate: (
    rows: readonly ImportRow[],
    signal: AbortSignal,
  ) => Promise<ImportIssue[]>;
  commit: (
    rows: readonly ImportRow[],
    context: {
      signal: AbortSignal;
      duplicatePolicy: string;
      operationId: string;
    },
  ) => Promise<{ message: string }>;
  largeFile?: (file: File) => Promise<{ message: string }>;
};
export function ImportWizard({
  fields,
  adapter,
  duplicatePolicies = [{ value: "reject", label: "拒绝重复记录" }],
}: {
  fields: readonly ImportField[];
  adapter: ImportAdapter;
  duplicatePolicies?: readonly { value: string; label: string }[];
}) {
  const [data, setData] = useState<{ headers: string[]; rows: ImportRow[] }>();
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [validated, setValidated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [policy, setPolicy] = useState(duplicatePolicies[0]?.value ?? "reject");
  const operation = useRef<string>("");
  const lock = useRef(false);
  const [done, setDone] = useState(false);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(String(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const mapped = () =>
    (data?.rows ?? []).map((row) =>
      Object.fromEntries(
        fields.map((f) => [f.key, row[mapping[f.key] ?? ""] ?? ""]),
      ),
    );
  return (
    <section className="aui-workflow-stack">
      <label>
        选择导入文件
        <Input
          type="file"
          accept={adapter.parse ? ".csv,.xlsx" : ".csv,text/csv"}
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setData(undefined);
            setIssues([]);
            setValidated(false);
            setDone(false);
            operation.current = crypto.randomUUID();
            void run(async () => {
              if (file.size > 2 * 1024 * 1024) {
                if (!adapter.largeFile)
                  throw Error("文件超过 2 MB，请使用服务端导入任务");
                setMessage((await adapter.largeFile(file)).message);
                return;
              }
              const parsed = adapter.parse
                ? await adapter.parse(file, new AbortController().signal)
                : parseCsv(await file.text());
              if (parsed.rows.length > 1000)
                throw Error("最多预览 1000 行，请使用服务端导入任务");
              setData(parsed);
              setMapping(
                Object.fromEntries(
                  fields.map((f) => [
                    f.key,
                    parsed.headers.includes(f.key) ? f.key : "",
                  ]),
                ),
              );
            });
            e.target.value = "";
          }}
        />
      </label>
      {data && (
        <>
          <p>已读取 {data.rows.length} 行，请确认字段映射。</p>
          {fields.map((f) => (
            <Choice
              key={f.key}
              label={`映射 ${f.label}`}
              value={mapping[f.key] || "__none"}
              disabled={busy || done}
              options={[
                {
                  value: "__none",
                  label: `${f.label}：未映射${f.required ? "（必填）" : ""}`,
                },
                ...data.headers.map((h) => ({
                  value: h,
                  label: `${f.label} ← ${h}`,
                })),
              ]}
              onChange={(v) => {
                setMapping({ ...mapping, [f.key]: v === "__none" ? "" : v });
                setValidated(false);
                operation.current = crypto.randomUUID();
              }}
            />
          ))}
          <Choice
            label="重复记录策略"
            value={policy}
            options={duplicatePolicies}
            disabled={busy || done}
            onChange={(v) => {
              setPolicy(v);
              setValidated(false);
              operation.current = crypto.randomUUID();
            }}
          />
          <div
            className="aui-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="导入预览"
          >
            <table className="aui-table">
              <thead>
                <tr>
                  {fields.map((f) => (
                    <th key={f.key}>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mapped()
                  .slice(0, 10)
                  .map((r, i) => (
                    <tr key={i}>
                      {fields.map((f) => (
                        <td key={f.key}>{r[f.key]}</td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="aui-note">预览前 10 行；提交前校验全部已读取行。</p>
          {issues.length > 0 && (
            <>
              <ul>
                {issues.slice(0, 20).map((issue, i) => (
                  <li key={i}>
                    第 {issue.row} 行 · {issue.field}：{issue.message}
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                onClick={() =>
                  downloadCsv(
                    "import-errors",
                    buildCsv(
                      issues,
                      (["row", "field", "message"] as const).map((key) => ({
                        title: key,
                        value: (issue) => issue[key],
                      })),
                    ),
                  )
                }
              >
                下载错误报告
              </Button>
            </>
          )}
          <div className="aui-workflow-bar">
            <Button
              variant="outline"
              disabled={busy || done || !data.rows.length}
              onClick={() =>
                void run(async () => {
                  setValidated(false);
                  if (fields.some((f) => f.required && !mapping[f.key]))
                    throw Error("请完成必填字段映射");
                  const errors = await adapter.validate(
                    mapped(),
                    new AbortController().signal,
                  );
                  setIssues(errors);
                  setValidated(!errors.length);
                  setMessage(
                    errors.length
                      ? `发现 ${errors.length} 个错误`
                      : "校验通过，可确认导入",
                  );
                })
              }
            >
              校验全部数据
            </Button>
            <Button
              disabled={busy || done || !validated}
              onClick={() =>
                void run(async () => {
                  const result = await adapter.commit(mapped(), {
                    signal: new AbortController().signal,
                    duplicatePolicy: policy,
                    operationId: operation.current,
                  });
                  setMessage(result.message);
                  setDone(true);
                })
              }
            >
              确认导入 {data.rows.length} 行
            </Button>
          </div>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
