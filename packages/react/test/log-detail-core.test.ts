// 审阅 05：审计展开不给最终用户看原始 key / id / JSON
import test from "node:test";
import assert from "node:assert/strict";
import { detailValueText, readableDetail } from "../src/log-detail-core.ts";

test("readableDetail: labelled keys read as words, the rest folds into technical", () => {
  const detail = { ids: ["01a1144b-e19a-751a-b3b9-e8fd73d53388"], lineId: "tw_home", count: 1200, reason: "请假" };
  const { shown, technical } = readableDetail(detail, {
    labels: { reason: "原因", lineId: "业务线", count: "数量" },
    format: (key, value) => (key === "lineId" && value === "tw_home" ? "智能家居" : undefined),
  });
  assert.deepEqual(shown.map((e) => `${e.label}：${e.value}`), ["原因：请假", "业务线：智能家居", "数量：1,200"], "按 labels 的顺序");
  assert.deepEqual(technical.map((e) => e.key), ["ids"]);
  assert.equal(technical[0]?.value, '["01a1144b-e19a-751a-b3b9-e8fd73d53388"]');
});

test("detailValueText: 是 / 否、短列表、长列表写「N 项」、空写「—」", () => {
  assert.equal(detailValueText(true), "是");
  assert.equal(detailValueText(["a", "b"]), "a、b");
  assert.equal(detailValueText([1, 2, 3, 4, 5, 6]), "6 项");
  assert.equal(detailValueText(null), "—");
  assert.equal(detailValueText([]), "—");
  assert.equal(detailValueText({ a: 1 }), '{"a":1}');
  const long = readableDetail({ ids: [1, 2, 3, 4, 5, 6] }, { labels: { ids: "记录" } });
  assert.equal(long.shown[0]?.value, "6 项");
  assert.equal(long.technical[0]?.value, "[1,2,3,4,5,6]", "完整列表留在技术细节里");
});
