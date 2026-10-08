import { Plus } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "@adminui/react";

type Props = { variant?: string; size?: string; label?: string; withIcon?: boolean; loading?: boolean; disabledReason?: string };

export function Demo({ variant = "default", size = "default", label = "新建客户", withIcon = true, loading = false, disabledReason = "" }: Props) {
  return (
    <Button
      variant={variant as ButtonVariant}
      size={size as ButtonSize}
      loading={loading}
      loadingText="保存中…"
      disabledReason={disabledReason || undefined}
      disabled={disabledReason ? true : undefined}
    >
      {withIcon && <Plus aria-hidden="true" />}
      {label}
    </Button>
  );
}
