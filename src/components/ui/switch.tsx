"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

type RootProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>;

type SwitchProps = Omit<
  RootProps,
  "checked" | "defaultChecked" | "onCheckedChange"
> & {
  checked?: boolean; // Controlado desde afuera
  defaultChecked?: boolean; // Inicial, solo si no usas `checked`
  onCheckedChange?: (checked: boolean) => void;
};

const SwitchBase = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ checked, defaultChecked, onCheckedChange, className, ...rest }, ref) => {
  // Detecta si es controlado o no
  const isControlled = checked !== undefined;

  return (
    <SwitchPrimitives.Root
      ref={ref}
      {...(isControlled
        ? { checked, onCheckedChange } // Controlado → usa `checked`
        : { defaultChecked, onCheckedChange } // No controlado → usa `defaultChecked`
      )}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        className
      )}
      {...rest}
    >
      <SwitchPrimitives.Thumb
        className="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitives.Root>
  );
});

SwitchBase.displayName = "Switch";

// ✅ React.memo para evitar renders innecesarios
export const Switch = React.memo(SwitchBase);
