"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

type RootProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>;
type SwitchProps = Omit<
  RootProps,
  "checked" | "defaultChecked" | "onCheckedChange"
> & {
  /** Si lo pasas, el switch queda totalmente controlado */
  checked?: boolean;
  /** Úsalo solo cuando NO pases `checked` (modo no controlado) */
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

const SwitchBase = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ checked, defaultChecked, onCheckedChange, className, ...rest }, ref) => {
  return (
    <SwitchPrimitives.Root
      ref={ref}
      checked={checked}
      // Si está controlado, NO pasamos defaultChecked para no mezclar modos
      defaultChecked={checked === undefined ? defaultChecked : undefined}
      onCheckedChange={onCheckedChange}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        className
      )}
      {...rest}
    >
      <SwitchPrimitives.Thumb className="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitives.Root>
  );
});
SwitchBase.displayName = "Switch";

export const Switch = React.memo(SwitchBase);
