import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMENT_REACTION_KEYS, commentCounts, commentDayLabel, filterComments, foldReplies, groupCommentsByDay, isViewerMention, mentionsViewer, reactionTip, splitMentions, type CommentItem,
} from "../src/comment-core.ts";

const me = { id: "u-wang", name: "小王" };
const chen = { id: "u-chen", name: "陈主管" };
const c = (id: string, over: Partial<CommentItem> = {}): CommentItem => ({ id, author: chen, createdAt: "2026-10-07T07:02:00", body: id, ...over });

test("reactions are the fixed four", () => {
  assert.deepEqual([...COMMENT_REACTION_KEYS], ["like", "ok", "seen", "question"]);
});

test("filters: open by default hides resolved, mine = @ the viewer in the comment or its replies, tombstones drop", () => {
  const items = [
    c("a", { body: "@小王 看下", mentions: [me] }),
    c("b", { resolved: true, resolvedBy: "小B" }),
    c("d", { replies: [c("d1", { mentions: [me], body: "@小王" })] }),
    c("gone", { deleted: true }),
    c("gone-with-replies", { deleted: true, replies: [c("r")] }),
  ];
  assert.deepEqual(filterComments(items, "open").map((x) => x.id), ["a", "d", "gone-with-replies"]);
  assert.deepEqual(filterComments(items, "resolved").map((x) => x.id), ["b"]);
  assert.deepEqual(filterComments(items, "mine", me.id).map((x) => x.id), ["a", "d"]);
  assert.deepEqual(filterComments(items, "mine").map((x) => x.id), [], "no viewer, no @我");
  assert.equal(filterComments(items, "all").length, 5);
  assert.equal(mentionsViewer(c("x", { deleted: true, mentions: [me] }), me.id), false, "a deleted comment no longer mentions anyone");
  assert.deepEqual(commentCounts(items, me.id), { all: 5, open: 2, mine: 2, resolved: 1 });
  assert.deepEqual(commentCounts(items, me.id, { total: 40, open: 9, mine: 4 }), { all: 40, open: 9, mine: 4, resolved: 1 }, "paged: server totals");
});

test("the viewer's own mention is marked (solid highlight)", () => {
  const segs = splitMentions("@小王 和 @陈主管", [me, chen]);
  assert.deepEqual(segs.map((s) => isViewerMention(s, me.id)), [true, false, false]);
  assert.equal(isViewerMention(segs[0]!, undefined), false);
});

test("replies fold after the first unless expanded", () => {
  const replies = [c("r1"), c("r2"), c("r3")];
  assert.deepEqual(foldReplies(replies, false).shown.map((x) => x.id), ["r1"]);
  assert.deepEqual(foldReplies(replies, false).folded.map((x) => x.id), ["r2", "r3"]);
  assert.equal(foldReplies(replies, true).folded.length, 0);
  assert.deepEqual(foldReplies([c("only")], false), { shown: [c("only")], folded: [] });
  assert.deepEqual(foldReplies(undefined, false), { shown: [], folded: [] });
});

test("day separators: 今天 10月7日 / 昨天 / 10月5日 / other years", () => {
  const now = new Date(2026, 9, 7, 16, 0);
  assert.equal(commentDayLabel(new Date(2026, 9, 7, 9, 0).toISOString(), now), "今天 10月7日");
  assert.equal(commentDayLabel(new Date(2026, 9, 6, 23, 30).toISOString(), now), "昨天");
  assert.equal(commentDayLabel(new Date(2026, 9, 5, 8, 0).toISOString(), now), "10月5日");
  assert.equal(commentDayLabel(new Date(2025, 9, 5, 8, 0).toISOString(), now), "2025年10月5日");
  assert.equal(commentDayLabel("nope", now), "");
  const groups = groupCommentsByDay([c("a", { createdAt: new Date(2026, 9, 7, 15).toISOString() }), c("b", { createdAt: new Date(2026, 9, 7, 9).toISOString() }), c("y", { createdAt: new Date(2026, 9, 6, 9).toISOString() })], now);
  assert.deepEqual(groups.map((g) => [g.label, g.items.map((x) => x.id)]), [["今天 10月7日", ["a", "b"]], ["昨天", ["y"]]]);
});

test("reaction tip names who: 「你」 first", () => {
  assert.equal(reactionTip("收到", { key: "ok", count: 2, mine: true, names: ["小王", "小李"] }, "小王"), "收到：你、小李");
  assert.equal(reactionTip("赞", { key: "like", count: 1, names: ["陈主管"] }), "赞：陈主管");
  assert.equal(reactionTip("看过", { key: "seen", count: 3 }), "看过");
});
