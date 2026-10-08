// 角色与权限 / 审计日志：AccessManager / AuditLogPage 的样式在 access 块里，按需加载（starter 首屏不带）。
import { AccessManager, AuditLogPage } from "@adminui/react";
import { demoAccessAdapter, demoAuditAdapter } from "./governance-demo";

export function AccessPage({ active }: { active: boolean }) {
  return <AccessManager scope="starter:demo" adapter={demoAccessAdapter} canManage active={active} />;
}
export function AuditPage({ active }: { active: boolean }) {
  return <AuditLogPage scope="starter:demo" adapter={demoAuditAdapter} active={active} />;
}
