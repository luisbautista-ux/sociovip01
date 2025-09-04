"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, defaultChecked, onCheckedChange, ...props }, ref) => {
    const id = React.useId();
    const [internalChecked, setInternalChecked] = React.useState(
      defaultChecked || false
    );
    
    // Determina si es controlado
    const isControlled = checked !== undefined;
    const currentChecked = isControlled ? checked : internalChecked;
    
    const handleCheckedChange = (newChecked: boolean) => {
      if (!isControlled) {
        setInternalChecked(newChecked);
      }
      
      // Usar setTimeout para evitar bucles en Firebase Studio
      setTimeout(() => {
        onCheckedChange?.(newChecked);
      }, 10);
    };
    
    return (
      <div className="flex items-center">
        <input
          type="checkbox"
          id={id}
          className={cn("sr-only")}
          checked={currentChecked}
          onChange={(e) => handleCheckedChange(e.target.checked)}
          ref={ref as any}
          {...props}
        />
        <label
          htmlFor={id}
          className={cn(
            "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
            currentChecked ? "bg-primary" : "bg-input",
            className
          )}
        >
          <span
            className={cn(
              "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
              currentChecked ? "translate-x-5" : "translate-x-0"
            )}
          />
        </label>
      </div>
    );
  }
);

Switch.displayName = "Switch";
export { Switch };