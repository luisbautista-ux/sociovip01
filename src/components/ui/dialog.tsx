"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// ✅ IMPLEMENTACIÓN PERSONALIZADA SIN RADIX UI
const Dialog = ({ children, open, onOpenChange }: {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  return (
    <div>
      {open && (
        <div 
          className="fixed inset-0 z-50 bg-black/80"
          onClick={() => onOpenChange(false)}
        />
      )}
      {children}
    </div>
  )
}

const DialogTrigger = ({ children, onClick }: {
  children: React.ReactNode;
  onClick?: () => void;
}) => {
  return (
    <div onClick={(e) => {
      e.stopPropagation();
      onClick?.();
    }}>
      {children}
    </div>
  )
}

const DialogPortal = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

const DialogClose = ({ children, onClick }: {
  children: React.ReactNode;
  onClick?: () => void;
}) => {
  return (
    <div onClick={(e) => {
      e.stopPropagation();
      onClick?.();
    }}>
      {children}
    </div>
  )
}

const DialogOverlay = ({ children, className }: {
  children?: React.ReactNode;
  className?: string;
}) => {
  // ✅ IMPLEMENTACIÓN MUY SIMPLE SIN RADIX UI
  return (
    <div className={cn("fixed inset-0 z-50 bg-black/80", className)}>
      {children}
    </div>
  )
}

const DialogContent = ({ children, className }: {
  children: React.ReactNode;
  className?: string;
}) => {
  // ✅ IMPLEMENTACIÓN MUY SIMPLE SIN RADIX UI
  return (
    <div className={cn(
      "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200",
      className
    )}>
      {children}
      <Button
        variant="ghost"
        className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        onClick={(e) => {
          e.stopPropagation();
          const parent = e.currentTarget.closest('[role="dialog"]');
          if (parent) {
            const backdrop = parent.parentElement?.previousElementSibling;
            if (backdrop) {
              backdrop.click();
            }
          }
        }}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </Button>
    </div>
  )
}

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
)
DialogTitle.displayName = "DialogTitle"

const DialogDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
)
DialogDescription.displayName = "DialogDescription"

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}