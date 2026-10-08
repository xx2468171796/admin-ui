"use client";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "./primitives.tsx";
import { type Draft } from "./workflow-hooks.ts";
export function DraftBanner<T>({
  draft,
  conflict,
  onRestore,
  onDiscard,
}: {
  draft: Draft<T> | null;
  conflict: boolean;
  onRestore: (value: T) => void;
  onDiscard: () => void;
}) {
  if (!draft) return null;
  return (
    <div className="aui-workflow-bar" role="status">
      <span>
        {conflict
          ? "草稿版本与当前记录不一致，请核对后重新编辑"
          : "发现未提交草稿"}
      </span>
      <Button
        variant="outline"
        disabled={conflict}
        onClick={() => onRestore(draft.value)}
      >
        恢复草稿
      </Button>
      <Button variant="ghost" onClick={onDiscard}>
        丢弃草稿
      </Button>
    </div>
  );
}
export type WizardStep = {
  id: string;
  title: string;
  content: ReactNode;
  validate?: () => Promise<void>;
};
export function Stepper({
  steps,
  onFinish,
  summary,
}: {
  steps: readonly WizardStep[];
  onFinish: () => Promise<void>;
  summary: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const lock = useRef(false);
  const next = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (index < steps.length) {
        await steps[index]?.validate?.();
        setIndex((i) => i + 1);
      } else {
        await onFinish();
        setDone(true);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="aui-workflow-stack">
      <ol className="aui-stepper">
        {[...steps.map((s) => s.title), "确认提交"].map((title, i) => (
          <li key={i} aria-current={i === index ? "step" : undefined}>
            {i + 1}. {title}
          </li>
        ))}
      </ol>
      {done ? (
        <p role="status">已提交</p>
      ) : (
        <>
          {steps.map((step, i) => (
            <div key={step.id} hidden={i !== index}>
              {step.content}
            </div>
          ))}
          {index === steps.length && summary}
          {error && (
            <p role="alert" className="aui-error">
              {error}
            </p>
          )}
          <div className="aui-workflow-bar">
            <Button
              variant="outline"
              disabled={!index || busy}
              onClick={() => setIndex((i) => i - 1)}
            >
              上一步
            </Button>
            <Button disabled={busy} onClick={() => void next()}>
              {busy
                ? "处理中…"
                : index === steps.length
                  ? "确认提交"
                  : "下一步"}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
