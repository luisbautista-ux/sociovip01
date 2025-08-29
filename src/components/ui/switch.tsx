"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

type RootProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>;

type SwitchProps = Omit<
  RootProps,
  "checked" | "defaultChecked" | "onCheckedChange"
> & {
  /** Controlado desde afuera */
  checked?: boolean;
  /** No controlado (estado interno) */
  defaultChecked?: boolean;
  /** Notifica cambio */
  onCheckedChange?: (checked: boolean) => void;
};

/**
 * Implementación robusta:
 * - Soporta controlado y no controlado sin mezclar.
 * - No hace setState durante render.
 * - Callback estable (no depende del valor actual).
 */
const SwitchImpl = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(function Switch(
  { checked, defaultChecked, onCheckedChange, className, ...rest },
  ref
) {
  // ¿Está controlado?
  const isControlled = checked !== undefined;

  // Estado interno SOLO si NO está controlado
  const [internal, setInternal] = React.useState<boolean>(
    defaultChecked ?? false
  );

  // Si cambia defaultChecked y es no-controlado, sincronizamos
  React.useEffect(() => {
    if (!isControlled && defaultChecked !== undefined) {
      setInternal(defaultChecked);
    }
  }, [defaultChecked, isControlled]);

  // Valor real mostrado
  const current = isControlled ? !!checked : internal;

  const handleChange = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternal(next);
      onCheckedChange?.(next);
    },
    [isControlled, onCheckedChange]
  );

  return (
    <SwitchPrimitives.Root
      ref={ref}
      checked={current}
      onCheckedChange={handleChange}
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

export const Switch = React.memo(SwitchImpl);
