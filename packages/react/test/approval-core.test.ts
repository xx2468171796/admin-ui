import test from "node:test";
import assert from "node:assert/strict";
import {
  approvalCounts, approvalStatusMeta, canDecide, canWithdraw, currentLine, currentStepIndex, waitDays, decisionError, filterApprovals, modeText,
  pendingApprovers, stepPassed, stepStates, stepTally, waitingSince, type ApprovalRequest, type ApprovalStep,
} from "../src/approval-core.ts";

const zhou = { id: "u-zhou", name: "周敏", hint: "销售二组" };
const zheng = { id: "u-zheng", name: "郑凯" };
const chen = { id: "u-chen", name: "陈晓" };
const lin = { id: "u-lin", name: "林宁" };
const step = (key: string, approvers: ApprovalStep["approvers"], mode: ApprovalStep["mode"], decisions: ApprovalStep["decisions"] = []): ApprovalStep => ({ key, label: key, approvers, mode, decisions });
const req = (over: Partial<ApprovalRequest> = {}): ApprovalRequest => ({
  id: "a1", title: "申请权限「导出客户」", requester: zhou, createdAt: "2026-10-05T01:12:00Z", status: "pending",
  steps: [step("上级", [zheng], "any"), step("财务", [chen, lin], "all")], ...over,
});

test("a step passes by its mode: any = one approval, all = every approver", () => {
  assert.equal(stepPassed(step("s", [zheng, chen], "any", [{ approver: chen, decision: "approved", at: "2026-10-05T02:00:00Z" }])), true);
  assert.equal(stepPassed(step("s", [zheng, chen], "all", [{ approver: chen, decision: "approved", at: "2026-10-05T02:00:00Z" }])), false);
  assert.equal(stepPassed(step("s", [zheng, chen], "all", [{ approver: chen, decision: "approved", at: "x" }, { approver: zheng, decision: "approved", at: "y" }])), true);
  assert.equal(stepPassed(step("s", [], "all")), false, "all with nobody never passes");
  assert.equal(stepPassed(step("s", [zheng], "any", [{ approver: zheng, decision: "rejected", reason: "不行", at: "x" }])), false, "a rejection is not an approval");
  assert.deepEqual(stepTally(step("s", [zheng, chen, lin], "all", [{ approver: lin, decision: "approved", at: "x" }])), { approved: 1, needed: 3 });
  assert.deepEqual(stepTally(step("s", [zheng, chen], "any", [{ approver: chen, decision: "approved", at: "x" }, { approver: zheng, decision: "approved", at: "y" }])), { approved: 1, needed: 1 });
});

test("step states follow the request status", () => {
  assert.deepEqual(stepStates(req()), ["current", "waiting"], "nothing decided: the first step waits");
  const first = req({ steps: [step("上级", [zheng], "any", [{ approver: zheng, decision: "approved", at: "2026-10-06T00:00:00Z" }]), step("财务", [chen, lin], "all", [{ approver: chen, decision: "approved", at: "2026-10-06T03:00:00Z" }])] });
  assert.deepEqual(stepStates(first), ["done", "current"], "all-step half done stays current");
  assert.equal(currentStepIndex(first), 1);
  assert.deepEqual(pendingApprovers(first.steps[1]!).map((p) => p.name), ["林宁"]);
  assert.deepEqual(stepStates(req({ currentStep: 1 })), ["done", "current"], "the server's currentStep wins");
  assert.deepEqual(stepStates(req({ status: "approved" })), ["done", "done"]);
  const rejected = req({ status: "rejected", steps: [step("上级", [zheng], "any", [{ approver: zheng, decision: "rejected", reason: "地址由派工单带出", at: "x" }]), step("财务", [chen], "any")] });
  assert.deepEqual(stepStates(rejected), ["rejected", "skipped"]);
  const later = req({ status: "rejected", steps: [step("上级", [zheng], "any", [{ approver: zheng, decision: "approved", at: "x" }]), step("财务", [chen], "any", [{ approver: chen, decision: "rejected", reason: "超预算", at: "y" }])] });
  assert.deepEqual(stepStates(later), ["done", "rejected"]);
  assert.deepEqual(stepStates(req({ status: "withdrawn" })), ["skipped", "skipped"]);
  assert.equal(currentStepIndex(req({ status: "approved" })), -1);
});

test("who may act: current approvers decide once, the requester withdraws while pending", () => {
  assert.equal(canDecide(req(), "u-zheng"), true);
  assert.equal(canDecide(req(), "u-chen"), false, "not their step yet");
  assert.equal(canDecide(req(), undefined), false);
  assert.equal(canDecide(req({ status: "approved" }), "u-zheng"), false);
  const half = req({ currentStep: 1, steps: [step("上级", [zheng], "any", [{ approver: zheng, decision: "approved", at: "x" }]), step("财务", [chen, lin], "all", [{ approver: chen, decision: "approved", at: "y" }])] });
  assert.equal(canDecide(half, "u-chen"), false, "already approved this step");
  assert.equal(canDecide(half, "u-lin"), true);
  assert.equal(canWithdraw(req(), "u-zhou"), true);
  assert.equal(canWithdraw(req(), "u-zheng"), false);
  assert.equal(canWithdraw(req({ status: "rejected" }), "u-zhou"), false);
});

test("a rejection needs a reason; an approval doesn't", () => {
  assert.equal(decisionError("rejected", "  "), "驳回要写原因，申请人会看到");
  assert.equal(decisionError("rejected", "超预算"), null);
  assert.equal(decisionError("approved", ""), null);
});

test("status chip, scopes and counts", () => {
  assert.deepEqual(approvalStatusMeta(req(), "u-zheng"), { label: "待你审批", tone: "warning" });
  assert.deepEqual(approvalStatusMeta(req(), "u-zhou"), { label: "审批中", tone: "warning" });
  assert.deepEqual(approvalStatusMeta(req({ status: "approved" })), { label: "已通过", tone: "success" });
  assert.deepEqual(approvalStatusMeta(req({ status: "rejected" })), { label: "已驳回", tone: "danger" });
  assert.deepEqual(approvalStatusMeta(req({ status: "withdrawn" })), { label: "已撤回", tone: "neutral" });
  const items = [req({ id: "a" }), req({ id: "b", requester: zheng, steps: [step("上级", [chen], "any")] }), req({ id: "c", status: "approved" })];
  assert.deepEqual(filterApprovals(items, "mine", "u-zhou").map((r) => r.id), ["a", "c"]);
  assert.deepEqual(filterApprovals(items, "todo", "u-zheng").map((r) => r.id), ["a"]);
  assert.equal(filterApprovals(items, "all", "u-zheng").length, 3);
  assert.deepEqual(approvalCounts(items, "u-zheng"), { mine: 1, todo: 1, all: 3 });
  assert.deepEqual(approvalCounts(items, "u-zheng", { todo: 12 }), { mine: 1, todo: 12, all: 3 }, "server totals win");
});

test("mode text, waiting time and the one-line state", () => {
  assert.equal(modeText(step("s", [zheng], "any")), "", "one approver: nothing to explain");
  assert.equal(modeText(step("s", [zheng, chen], "any")), "任一人批准即可");
  assert.equal(modeText(step("s", [zheng, chen, lin], "all", [{ approver: lin, decision: "approved", at: "x" }])), "需 3 人都批准 · 已批 1");
  const now = Date.parse("2026-10-07T09:00:00Z");
  assert.equal(waitDays("2026-10-05T01:12:00Z", now), 2);
  assert.equal(waitDays("not a date", now), 0);
  assert.equal(currentLine(req(), now), "等 郑凯 审批 · 已等 2 天");
  const second = req({ steps: [step("上级", [zheng], "any", [{ approver: zheng, decision: "approved", at: "2026-10-07T01:00:00Z" }]), step("财务", [chen, lin], "all")] });
  assert.equal(waitingSince(second), "2026-10-07T01:00:00Z", "the current step waits since the previous decision");
  assert.equal(currentLine(second, now), "等 陈晓、林宁 审批");
  assert.equal(currentLine(req({ status: "rejected", steps: [step("上级", [zheng], "any", [{ approver: zheng, decision: "rejected", reason: "no", at: "x" }])] }), now), "郑凯 驳回了");
  assert.equal(currentLine(req({ status: "withdrawn" }), now), "周敏 撤回了申请");
  assert.equal(currentLine(req({ status: "approved" }), now), "已通过");
});
