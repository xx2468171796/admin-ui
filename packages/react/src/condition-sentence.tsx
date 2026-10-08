"use client";
/**
 * ConditionSentence: the one line on top of a filter / condition panel that reads the
 * current tree in plain Chinese — 「阶段 是 报价、谈判 且 负责人 是 我 且（下次跟进 在未来 7 天 或 预计金额
 * ≥ US$ 50,000）」 — field names in bold. Same reading as describeConditionTree (condition-describe.ts):
 * unfinished conditions are left out, an empty tree reads `emptyText`.
 */
import { Fragment, type ReactNode } from "react";
import { Filter } from "lucide-react";
import { conditionTreeParts, conjunctionWord, describeConditionTree, opJoinsValue, type ConditionGroupPart, type ConditionLeafPart, type ConditionPart, type DescribeField, type DescribeOptions } from "./condition-describe.ts";
import type { ConditionGroup } from "./condition-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/conditions.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/conditions.css";

export type ConditionSentenceProps = {
  tree: ConditionGroup<string>;
  fields: readonly DescribeField[];
  /** Text of an empty tree (default 「还没有条件，显示全部记录」). */
  emptyText?: string;
  options?: Omit<DescribeOptions, "emptyText">;
  className?: string;
};

function Leaf({ part, separator }: { part: ConditionLeafPart; separator: string }) {
  const values = part.values.map((v) => v.text).join(separator);
  const joined = opJoinsValue(part.opLabel);
  return (
    <span className="aui-cond-sum-leaf">
      <b>{part.fieldLabel}</b> {joined ? `${part.opLabel}${values}` : [part.opLabel, values].filter(Boolean).join(" ")}
    </span>
  );
}

function Group({ part, nested, separator }: { part: ConditionGroupPart; nested: boolean; separator: string }): ReactNode {
  const items = part.items.filter((item) => (item.kind === "group" ? item.items.some((i) => i.kind === "group" || !i.inactive) : !item.inactive));
  if (!items.length) return null;
  const bracketed = (item: ConditionPart | undefined) => item?.kind === "group" && item.items.filter((i) => i.kind === "group" || !i.inactive).length > 1;
  const body = items.map((item, index) => {
    const word = conjunctionWord(part.conjunction);
    // Full-width brackets take no space: 「我 且（…）」「（…）且 …」.
    const gap = index === 0 ? "" : `${bracketed(items[index - 1]) ? "" : " "}${word}${bracketed(item) ? "" : " "}`;
    return (
      <Fragment key={item.id}>
        {gap}
        {item.kind === "group" ? <Group part={item} nested separator={separator} /> : <Leaf part={item} separator={separator} />}
      </Fragment>
    );
  });
  return nested && items.length > 1 ? <>（{body}）</> : <>{body}</>;
}

/** See the module comment. */
export function ConditionSentence({ tree, fields, emptyText = "还没有条件，显示全部记录", options = {}, className }: ConditionSentenceProps) {
  const text = describeConditionTree(tree, fields, { ...options, emptyText: "" });
  const parts = conditionTreeParts(tree, fields, options);
  return (
    <p className={["aui-cond-sum", className].filter(Boolean).join(" ")} aria-label={`当前条件：${text || emptyText}`} aria-live="polite">
      <Filter aria-hidden="true" />
      <span aria-hidden="true">{text ? <Group part={parts} nested={false} separator={options.valueSeparator ?? "、"} /> : emptyText}</span>
    </p>
  );
}
