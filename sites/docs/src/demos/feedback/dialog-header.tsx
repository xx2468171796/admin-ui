import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button, Dialog, DescriptionList, IconButton, StatusBadge } from "@adminui/react";
import { CUSTOMERS, formatAmount, personName, stageLabel } from "../../data/demo-data";

/** 只读详情：标题旁放状态（titleAdornment），× 左边放上一条 / 下一条（headerActions），焦点落在弹框本身。 */
export function Demo() {
  const [index, setIndex] = useState<number | null>(null);
  const customer = index === null ? undefined : CUSTOMERS[index];
  return (
    <>
      <Button variant="outline" onClick={() => setIndex(0)}>查看客户</Button>
      <Dialog
        open={customer !== undefined}
        size="md"
        title={customer?.name ?? ""}
        description={customer ? `${customer.industry} · ${customer.city}` : undefined}
        titleAdornment={customer && <StatusBadge tone={customer.active ? "success" : "neutral"}>{customer.active ? "合作中" : "已停用"}</StatusBadge>}
        initialFocus="dialog"
        onClose={() => setIndex(null)}
        headerActions={
          <>
            <IconButton label="上一条" icon={<ChevronUp />} disabled={!index} onClick={() => setIndex((i) => Math.max(0, (i ?? 0) - 1))} />
            <IconButton label="下一条" icon={<ChevronDown />} disabled={index === CUSTOMERS.length - 1} onClick={() => setIndex((i) => Math.min(CUSTOMERS.length - 1, (i ?? 0) + 1))} />
          </>
        }
      >
        {customer && (
          <DescriptionList
            items={[
              { label: "编号", value: customer.id },
              { label: "阶段", value: stageLabel(customer.stage) },
              { label: "负责人", value: personName(customer.owner) },
              { label: "年费", value: formatAmount(customer.amount) },
              { label: "席位", value: `${customer.seats} 个` },
              { label: "下次跟进", value: customer.nextFollowUp },
            ]}
          />
        )}
      </Dialog>
    </>
  );
}
