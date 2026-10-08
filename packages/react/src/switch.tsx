"use client";
// shadcn/ui composition, adapted to scoped CSS tokens. See THIRD-PARTY.md. Re-exported by primitives.tsx.
import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { clsx as cn } from "clsx";

/* @__NO_SIDE_EFFECTS__ */
function named<C extends { displayName?: string }>(component: C, name: string): C {
  component.displayName = name;
  return component;
}

/** Same containing block as the other form controls in primitives.tsx (radix renders a hidden input beside it). */
function ControlShell({ children }: { children: React.ReactNode }) {
  return <span className="aui-control-shell">{children}</span>;
}

/**
 * On/off state for module gates and settings rows (32 × 18, `size="sm"` 26 × 14); takes effect at once.
 * The host still enforces server-side authorization.
 */
export const Switch = /* @__PURE__ */ named(/* @__PURE__ */ React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & { size?: "sm" | "md" }
>(({ className, size, ...props }, ref) => (
  <ControlShell>
    <SwitchPrimitive.Root
      ref={ref}
      className={cn("aui-switch", className)}
      data-size={size === "sm" ? "sm" : undefined}
      {...props}
    >
      <SwitchPrimitive.Thumb className="aui-switch-thumb" />
    </SwitchPrimitive.Root>
  </ControlShell>
)), "Switch");
