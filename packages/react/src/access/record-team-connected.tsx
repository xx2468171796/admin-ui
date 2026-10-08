"use client";
/**
 * RecordTeam — RecordTeamPanel wired to the quanxian record-grant routes, for any detail page:
 *
 * ```tsx
 * <RecordTeam api={qxApi} resourceType="customer" resourceId={c.id} recordLabel={`客户：${c.name}`}
 *   owner={c.owner ? { id: c.owner, name: names(c.owner) } : null} users={people} orgTree={depts}
 *   canManage={c.allowedActions.includes("share")} canTransfer={c.allowedActions.includes("transfer")} onChanged={reload} />
 * ```
 * The owner usually lives in the business table (owner column) rather than as a grant, so pass it and
 * it is shown as the「负责人」row. Add members sends `{ type, id? }` only (teamAddPayload); change =
 * grant again (one grant per subject); remove asks for a reason; transfer is one server transaction.
 * The server decides again: a record you cannot reach is a 404, a level you may not give a 403.
 */
import { useMemo, useState } from "react";
import { useAdminResource } from "../workflow-hooks.ts";
import { RecordTeamPanel } from "./record-team.tsx";
import { teamAddPayload, type AccessUser, type GrantSubject, type OrgNode, type RecordTeamMember } from "./contracts.ts";
import type { AccessApi } from "./console-api.ts";
import { addEach, addEachText, asDialogError } from "./console-core.ts";

export type RecordTeamProps = {
  api: Pick<AccessApi, "listRecordGrants" | "grantRecord" | "revokeRecordGrant" | "transferOwner">;
  resourceType: string;
  resourceId: string;
  recordLabel?: string;
  title?: string;
  /** The record's owner (business column); null = no owner (public pool). */
  owner?: { id: string; name: string; hint?: string } | null;
  /** People that can be added / receive ownership. */
  users?: readonly AccessUser[];
  orgTree?: readonly OrgNode[];
  groups?: readonly { id: string; name: string; hint?: string }[];
  subjectTypes?: readonly GrantSubject["type"][];
  /** UI hints from the record's allowed actions (the server checks again). */
  canManage?: boolean;
  canTransfer?: boolean;
  /** Called after any change (transfer changes the record's owner: reload it). */
  onChanged?: () => void;
  now?: Date;
};

export function RecordTeam({ api, resourceType, resourceId, recordLabel, title, owner, users = [], orgTree, groups, subjectTypes, canManage = false, canTransfer = false, onChanged, now }: RecordTeamProps) {
  const [rev, setRev] = useState(0);
  const list = useAdminResource(`team:${resourceType}:${resourceId}:${rev}`, (signal) => api.listRecordGrants(resourceType, resourceId, signal));
  const members = useMemo<RecordTeamMember[]>(() => {
    const name = new Map(users.map((u) => [u.id, u.name]));
    // grantedBy is an account id: show the person's name when we know it.
    const grants = (list.data ?? []).map((g) => (g.grantedBy && name.has(g.grantedBy) ? { ...g, grantedBy: name.get(g.grantedBy)! } : g));
    if (!owner || grants.some((g) => g.level === "owner")) return grants;
    return [{ id: `owner:${owner.id}`, subject: { type: "user", id: owner.id, name: owner.name, ...(owner.hint ? { hint: owner.hint } : {}) }, level: "owner" }, ...grants];
  }, [list.data, owner, users]);
  const changed = () => {
    setRev((r) => r + 1);
    onChanged?.();
  };
  const guard = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      throw asDialogError(e);
    }
    changed();
  };
  const candidates = owner ? users.filter((u) => u.id !== owner.id) : users;
  // Offer departments / groups only when the host could load them (people without org rights get none).
  const tree = orgTree?.length ? orgTree : undefined;
  const kinds = (subjectTypes ?? ["user"]).filter((k) => (k === "dept" ? !!tree : k === "group" ? !!groups?.length : true));
  return (
    <RecordTeamPanel
      members={members}
      {...(title ? { title } : {})}
      {...(recordLabel ? { recordLabel } : {})}
      canManage={canManage}
      canTransfer={canTransfer}
      candidates={candidates}
      {...(tree ? { orgTree: tree } : {})}
      {...(groups ? { groups } : {})}
      subjectTypes={kinds}
      loading={list.loading && !list.data}
      {...(list.error && !list.data ? { error: list.error } : {})}
      onRetry={list.refresh}
      {...(now ? { now } : {})}
      onAdd={async (inputs) => {
        // 一个一个加：有的没加上也继续，最后不管成败都刷新，并说清哪些加上了、哪些没加上（原因）
        let result: Awaited<ReturnType<typeof addEach>>;
        try {
          result = await addEach(inputs, (input) => api.grantRecord(resourceType, resourceId, teamAddPayload(input)), (input) => input.subject.name);
        } finally {
          if (inputs.length) changed();
        }
        const text = addEachText(result);
        if (text) throw new Error(text);
      }}
      onUpdate={(member, patch) =>
        guard(() => api.grantRecord(resourceType, resourceId, teamAddPayload({ subject: member.subject, level: patch.level, expiresAt: patch.expiresAt, reason: member.reason || "修改协作权限" })))
      }
      onRemove={(member, reason) => guard(() => api.revokeRecordGrant(resourceType, resourceId, member.id, reason))}
      onTransferOwner={(input) => guard(() => api.transferOwner(resourceType, resourceId, input))}
    />
  );
}

