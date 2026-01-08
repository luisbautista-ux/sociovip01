
"use client";

import * as React from "react";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  activeStep: number;
}

const Stepper = React.forwardRef<HTMLDivElement, StepperProps>(
  ({ orientation = "horizontal", activeStep, children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-start",
          orientation === "vertical" && "flex-col",
          className
        )}
        {...props}
      >
        {React.Children.map(children, (child, index) => {
          return React.isValidElement(child)
            ? React.cloneElement(child, {
                isLast: index === React.Children.count(children) - 1,
                isActive: index === activeStep,
                isCompleted: index < activeStep,
                index,
                orientation,
              })
            : null;
        })}
      </div>
    );
  }
);
Stepper.displayName = "Stepper";

interface StepProps extends React.HTMLAttributes<HTMLDivElement> {
  isLast?: boolean;
  isActive?: boolean;
  isCompleted?: boolean;
  index?: number;
  orientation?: "horizontal" | "vertical";
}

const Step = React.forwardRef<HTMLDivElement, StepProps>(
  ({ orientation = "horizontal", isActive, isCompleted, isLast, children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-start flex-1", orientation === 'vertical' && "flex-col w-full", className)}
        {...props}
      >
        <div className={cn("flex", orientation === 'vertical' && "flex-col items-center")}>
          <div className="flex items-center">
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300",
                isCompleted ? "bg-primary border-primary text-primary-foreground" : "bg-muted border-border",
                isActive && "border-primary"
              )}
            >
              {isCompleted ? <Check className="w-5 h-5" /> : <Circle className={cn("w-3 h-3 transition-colors duration-300", isActive && "text-primary fill-current")} />}
            </div>
            {!isLast && (
              <div
                className={cn(
                  "flex-1 transition-colors duration-300",
                  orientation === 'horizontal' && 'w-12 h-0.5',
                  orientation === 'vertical' && 'h-12 w-0.5',
                  isCompleted ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
          <div className={cn(
            orientation === 'horizontal' && 'mt-2',
            orientation === 'vertical' && 'ml-4 -mt-7'
            )}>
            {children}
          </div>
        </div>
      </div>
    );
  }
);
Step.displayName = "Step";

const StepLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("text-sm font-semibold", className)} {...props}>
        {children}
      </div>
    );
  }
);
StepLabel.displayName = "StepLabel";

const StepContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("mt-2 p-4 border-l-2 ml-4", className)} {...props}>
        {children}
      </div>
    );
  }
);
StepContent.displayName = "StepContent";


export { Stepper, Step, StepLabel, StepContent };
