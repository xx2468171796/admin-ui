import test from "node:test";
import assert from "node:assert/strict";
import { answerSegments, countChars, diffLines, estimateTokens, insertVariable, lineMarks, missingCitations, promptSegments, safeCitationHref, unknownVariables, usedVariables, winnerTally } from "../src/ai-core.ts";

test("variables: segments, used list, unknown, insert at caret", () => {
  assert.deepEqual(promptSegments("客户资料：{{客户资料}}，文字稿 {{ 本次跟进文字稿 }}"), [
    { kind: "text", text: "客户资料：" },
    { kind: "var", text: "{{客户资料}}", name: "客户资料" },
    { kind: "text", text: "，文字稿 " },
    { kind: "var", text: "{{ 本次跟进文字稿 }}", name: "本次跟进文字稿" },
  ]);
  assert.deepEqual(promptSegments("没有变量 {单括号} {{}}"), [{ kind: "text", text: "没有变量 {单括号} {{}}" }]);
  assert.deepEqual(usedVariables("{{a}} {{b}} {{a}}"), ["a", "b"]);
  assert.deepEqual(unknownVariables("{{客户名称}} {{客户名}}", ["客户名称"]), ["客户名"]);
  assert.deepEqual(insertVariable("你好，", 3, 3, "客户名称"), { text: "你好，{{客户名称}}", caret: 11 });
  assert.deepEqual(insertVariable("abcdef", 1, 3, "x"), { text: "a{{x}}def", caret: 6 }, "替换选中的文字");
  assert.deepEqual(insertVariable("ab", 9, 1, "x"), { text: "ab{{x}}", caret: 7 }, "越界收回到末尾");
});

test("counts: characters without spaces, rough tokens", () => {
  assert.equal(countChars("你好 世界\nab"), 6);
  assert.equal(estimateTokens("你好世界"), 4, "中文一个字约一个 token");
  assert.equal(estimateTokens("abcdefgh"), 2, "英文约 4 个字符一个 token");
  assert.equal(estimateTokens(""), 0);
});

test("line diff: same / add / del with line numbers", () => {
  const ops = diffLines("a\nb\nc", "a\nB\nc\nd");
  assert.deepEqual(ops.map((o) => `${o.kind}:${o.text}`), ["same:a", "add:B", "del:b", "same:c", "add:d"]);
  assert.deepEqual(ops.filter((o) => o.kind === "add").map((o) => o.newLine), [2, 4]);
  assert.deepEqual(diffLines("x", "x").map((o) => o.kind), ["same"]);
  assert.deepEqual(diffLines("a\r\nb", "a\nb").map((o) => o.kind), ["same", "same"], "CRLF 不算改动");
});

test("line marks: added lines, removed-before markers, places", () => {
  const base = ["1", "2", "3", "4", "5"].join("\n");
  const draft = ["1", "2", "3x", "4", "5", "6"].join("\n");
  const m = lineMarks(base, draft);
  assert.deepEqual([...m.added], [3, 6]);
  assert.equal(m.places, 2, "两处：第 3 行改了、末尾加了一行");
  const del = lineMarks("a\nb\nc", "a\nc");
  assert.deepEqual([...del.added], []);
  assert.deepEqual([...del.removedBefore], [[2, 1]], "第 2 行前面删了 1 行");
  assert.equal(del.places, 1);
  assert.equal(lineMarks("same", "same").places, 0);
  const changed = lineMarks("a\nb\nc\nd", "a\nB\nC\nd");
  assert.deepEqual([...changed.added], [2, 3]);
  assert.deepEqual([...changed.removedBefore], [], "改过的行不再标删除");
  assert.equal(changed.places, 2, "改了两行 = 两处");
  const shrink = lineMarks("a\nb\nc\nd", "a\nX\nd");
  assert.deepEqual([...shrink.removedBefore], [[3, 1]], "两行改成一行：多删的一行标在后面");
  assert.equal(shrink.places, 2);
});

test("citations: markers, lists, invented numbers", () => {
  assert.deepEqual(answerSegments("断网也能用[1]，见案例[2,3]。"), [
    { kind: "text", text: "断网也能用" },
    { kind: "cite", ids: [1] },
    { kind: "text", text: "，见案例" },
    { kind: "cite", ids: [2, 3] },
    { kind: "text", text: "。" },
  ]);
  assert.deepEqual(answerSegments("[1、2]"), [{ kind: "cite", ids: [1, 2] }]);
  assert.deepEqual(answerSegments("没有出处"), [{ kind: "text", text: "没有出处" }]);
  assert.deepEqual(missingCitations("a[1] b[4] c[0]", 2), [0, 4]);
});

test("winner tally over samples", () => {
  const t = winnerTally({ s1: "v3", s2: "v3", s3: "tie", s4: "v2", s5: null }, ["s1", "s2", "s3", "s4", "s5", "s6"], ["v2", "v3"]);
  assert.deepEqual([...t.wins], [["v2", 1], ["v3", 2]]);
  assert.equal(t.tie, 1);
  assert.equal(t.open, 2);
});

test("citation hrefs: only http(s), mailto and relative may open", () => {
  assert.equal(safeCitationHref("https://kb.example.com/a"), "https://kb.example.com/a");
  assert.equal(safeCitationHref("http://x.test"), "http://x.test");
  assert.equal(safeCitationHref("/kb/12"), "/kb/12");
  assert.equal(safeCitationHref("mailto:a@b.c"), "mailto:a@b.c");
  assert.equal(safeCitationHref("javascript:alert(1)"), undefined);
  assert.equal(safeCitationHref(" JavaScript:alert(1)"), undefined);
  assert.equal(safeCitationHref("data:text/html,<b>x</b>"), undefined);
  assert.equal(safeCitationHref(undefined), undefined);
  assert.equal(safeCitationHref(""), undefined);
});
