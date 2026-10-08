import { useState } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { Button, DateTimePicker, FormDialog, FormField, Panel, QuickDatePresets, Textarea, useNotify } from "@adminui/react";
import {
  AccessProfileHeader,
  EMPTY_TARGET_DRAFT,
  EffectiveAccessTable,
  OverrideTargetFields,
  accessProfileStats,
  draftToTarget,
  targetKinds,
  targetLabel,
  type EffectiveAccessRow,
  type MatrixResource,
  type OverrideTargetDraft,
} from "@adminui/react/access";

// 有效权限扩展示例（样稿 D15「按人员」）：人员权限构成条 + 带类别 / 到期 / 行操作的有效权限表 + 「加什么」四种目标的单独加。
// 真实项目里行来自 quanxian 的有效权限接口，单独加走 AccessApi.setTargetOverride（服务端检查你不能超过自己的权限并写审计）。
export const NOW = new Date("2026-10-05T07:40:00Z");
const RESOURCES: MatrixResource[] = [
  { id: "customer", label: "客户", actions: ["read", "update", "export"], fields: [{ id: "expected", label: "预计金额" }, { id: "price", label: "成交价", sensitive: true }, { id: "phone", label: "手机", sensitive: true }, { id: "quality", label: "客户质量" }] },
  { id: "followup", label: "跟进记录", actions: ["read", "create"] },
];
const CODES = [
  { value: "customer:read", label: "客户 · 看" },
  { value: "customer:update", label: "客户 · 改" },
  { value: "customer:export", label: "客户 · 导出" },
];
const RECORDS = [
  { id: "c1", label: "张家豪（徐汇区别墅）", hint: "阿杰负责" },
  { id: "c2", label: "李承恩（滨江豪宅）", hint: "美华负责" },
  { id: "c3", label: "黄淑芬", hint: "小王负责" },
];

export const ROWS: EffectiveAccessRow[] = [
  { code: "customer:rw", category: "action", label: "看、加、改 客户", allowed: true, sources: [{ kind: "role", id: "sales", label: "销售" }], blocks: [] },
  { code: "customer:export", category: "action", label: "导出", allowed: false, sources: [{ kind: "role", id: "sales", label: "销售" }], blocks: [{ kind: "denied", label: "林经理减的", detail: "原因：月底客户资料外流排查；10-31 到期" }] },
  { code: "customer:read@own", category: "scope", label: "负责人是我 的客户 · 38 条", allowed: true, scope: { tier: "own" }, sources: [{ kind: "role", id: "sales", label: "销售", scope: { tier: "own" } }], blocks: [] },
  { code: "customer:read@b2", category: "scope", label: "二组 美华 的客户 · 可读写 · 14 条", allowed: true, scope: { tier: "custom", deptIds: ["b2"], label: "二组 美华" }, sources: [{ kind: "personal", id: "p1", label: "周组长加的", detail: "原因：代班", expiresAt: "2026-10-12T15:59:00Z" }], blocks: [] },
  { code: "customer.fields", category: "field", label: "预计金额 可读写 · 成交价 可读", allowed: true, sources: [{ kind: "role", id: "sales", label: "销售" }], blocks: [] },
  { code: "customer.phone", category: "field", label: "手机 可读（打码）", allowed: true, sources: [{ kind: "role", id: "sales", label: "销售" }], blocks: [] },
  { code: "customer.ops", category: "field", label: "客户质量、运营备注 看不到", allowed: false, sources: [{ kind: "field_default", label: "字段默认不可见", detail: "运营 小B 加的，没给销售" }], blocks: [{ kind: "not_granted", label: "没有角色给这两个字段" }] },
  { code: "customer#c1", category: "record", label: "张家豪（徐汇区别墅） · 可读写", allowed: true, sources: [{ kind: "shared_record", id: "s1", label: "阿杰共享的", detail: "10-02", expiresAt: "2026-10-20T00:00:00Z" }], blocks: [] },
  { code: "followup:*", category: "subtable", label: "跟进记录：能看的客户都能看、能加", allowed: true, sources: [{ kind: "parent", label: "跟随父记录「客户」" }], blocks: [] },
];

const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));

export function PersonAccessDemo() {
  const notify = useNotify();
  const [personal, setPersonal] = useState(false);
  const [adding, setAdding] = useState<null | "allow" | "deny">(null);
  const [draft, setDraft] = useState<OverrideTargetDraft>({ ...EMPTY_TARGET_DRAFT, kind: "field", resource: "customer", field: "price", ability: "write" });
  const [expires, setExpires] = useState("");
  const [reason, setReason] = useState("代班美华一周，要帮她改张家豪的成交价");
  return (
    <Panel
      title="小王 在「客户」表上的有效权限"
      count="每一项都写了从哪来"
      description="角色给基础权限，个人可以单独加或单独减；单独减优先。每次加减都写审计；你只能给你管得着的人加，不能超过你自己的权限。"
      actions={
        <>
          <Button size="sm" onClick={() => setAdding("allow")}><UserPlus aria-hidden="true" />单独加权限</Button>
          <Button size="sm" variant="outline" onClick={() => setAdding("deny")}><UserMinus aria-hidden="true" />单独减</Button>
        </>
      }
    >
      <div className="aui-stack">
        <AccessProfileHeader
          name="小王"
          tags={["销售", "智能家居 · 一组"]}
          meta="组长 周组长 · 主管 陈主管 · 经理 林经理"
          stats={accessProfileStats(ROWS)}
          activeStat={personal ? ["personalAdd", "personalDeny"] : null}
          onStatSelect={(s) => setPersonal(s.key === "personalAdd" || s.key === "personalDeny" ? !personal : false)}
        />
        <EffectiveAccessTable
          subject="小王"
          caption="小王在客户表上的有效权限"
          rows={ROWS}
          now={NOW}
          personalOnly={personal}
          onPersonalOnlyChange={setPersonal}
          rowActions={(r) =>
            r.blocks.some((b) => b.kind === "denied")
              ? [{ key: "undo", label: "撤销", onSelect: () => notify(`已撤销「单独减 ${r.label}」（演示）`, "success") }]
              : r.sources.some((s) => s.kind === "personal")
                ? [{ key: "revoke", label: "收回", onSelect: () => notify(`已收回「${r.label}」（演示）`, "success") }]
                : []
          }
        />
      </div>
      <FormDialog
        open={adding !== null}
        title={adding === "deny" ? "给 小王 单独减权限" : "给 小王 单独加权限"}
        description="到期自动收回，写进变更记录。你只能给你管得着的人加、不能超过你自己的权限（你：成交价 可读写）。"
        submitLabel={adding === "deny" ? "减掉" : "加上"}
        dirty
        onClose={() => setAdding(null)}
        onSubmit={async () => {
          const picked = draftToTarget(draft);
          if ("error" in picked) throw new Error(picked.error);
          if (!reason.trim()) throw new Error("请写原因");
          await wait();
          notify(`已${adding === "deny" ? "减" : "加"}：${targetLabel(picked.target, RESOURCES, (c) => CODES.find((o) => o.value === c)?.label ?? c)}（演示）`, "success");
          setAdding(null);
        }}
      >
        <OverrideTargetFields
          draft={draft}
          onChange={setDraft}
          kinds={targetKinds({ targeted: true, scoped: true, fields: true, records: true })}
          codes={CODES}
          scopedCodes={CODES.slice(0, 2)}
          resources={RESOURCES}
          findRecords={async (_res, q) => {
            await wait(200);
            return RECORDS.filter((r) => r.label.includes(q));
          }}
        />
        <FormField label="到期时间" htmlFor="pa-exp" hint="留空 = 不过期；到期自动收回">
          <DateTimePicker id="pa-exp" clearable value={expires} onChange={setExpires} />
        </FormField>
        <QuickDatePresets permanent="不过期" onPick={setExpires} now={() => NOW} />
        <FormField label="原因" htmlFor="pa-why" required>
          <Textarea id="pa-why" value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </FormDialog>
    </Panel>
  );
}
