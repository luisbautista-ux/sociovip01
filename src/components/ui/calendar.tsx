
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, DropdownProps, type ButtonProps as RDPButtonProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {

  // Custom NavigationButton component for react-day-picker
  // This component renders a div styled as a button to avoid <button> inside <button>
  const CustomNavigationButton = React.forwardRef<
    HTMLDivElement, // Renders a div
    RDPButtonProps & { name?: 'previous-month' | 'next-month' } // react-day-picker's ButtonProps + name
  >(({ className: rdpBtnClassName, children, ...rdpProps }, ref) => {
    const isPrevious = rdpProps.name === 'previous-month';
    const isNext = rdpProps.name === 'next-month';

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={rdpProps.disabled ? -1 : 0}
        aria-label={rdpProps['aria-label']}
        className={cn(
          // Base styles from shadcn's original nav_button approach
          "h-7 w-7 flex items-center justify-center rounded-md border border-input bg-transparent p-0 text-sm font-medium",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          rdpProps.disabled ? "pointer-events-none opacity-50" : "cursor-pointer",
          // Apply specific shadcn classes for previous/next positioning if available in classNames prop
          isPrevious && classNames?.nav_button_previous,
          isNext && classNames?.nav_button_next,
          rdpBtnClassName // Include any classes passed by react-day-picker itself
        )}
        onClick={(e) => {
          if (!rdpProps.disabled && rdpProps.onClick) {
            // Cast event type if necessary, though often direct pass-through works
            rdpProps.onClick(e as unknown as React.MouseEvent<HTMLButtonElement>);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (!rdpProps.disabled && rdpProps.onClick) {
              e.preventDefault(); // Prevent default spacebar scroll
              rdpProps.onClick(e as unknown as React.MouseEvent<HTMLButtonElement>);
            }
          }
        }}
      >
        {children} {/* This will be the ChevronLeft or ChevronRight icon */}
      </div>
    );
  });
  CustomNavigationButton.displayName = "CustomNavigationButton";


  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        caption_dropdowns: "flex justify-center gap-1",
        nav: "space-x-1 flex items-center",
        nav_button_previous: "absolute left-1", // For positioning of CustomNavigationButton
        nav_button_next: "absolute right-1",   // For positioning of CustomNavigationButton
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          "h-9 w-9 p-0 font-normal rounded-md",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-100",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames, // Allow overriding these default classNames
      }}
      components={{
        NavigationButton: CustomNavigationButton, // Override the navigation button
        Dropdown: ({ value, onChange, children: dropdownChildren, ...dropdownProps }: DropdownProps) => {
          const options = React.Children.toArray(
            dropdownChildren
          ) as React.ReactElement<React.HTMLProps<HTMLOptionElement>>[]
          const selected = options.find((child) => child.props.value === value)
          const handleChange = (newValue: string) => {
            const changeEvent = {
              target: { value: newValue },
            } as React.ChangeEvent<HTMLSelectElement>
            onChange?.(changeEvent)
          }
          return (
            <Select
              value={value?.toString()}
              onValueChange={(newValue) => {
                handleChange(newValue)
              }}
              {...(dropdownProps as Omit<React.ComponentProps<typeof Select>, 'value' | 'onValueChange'>)}
            >
              <SelectTrigger className="h-7 w-auto px-2 py-1 text-xs data-[placeholder]:text-muted-foreground focus:ring-0 focus:ring-offset-0 sm:text-sm">
                <SelectValue>{selected?.props?.children}</SelectValue>
              </SelectTrigger>
              <SelectContent position="popper">
                <div className="max-h-48 overflow-y-auto">
                  {options.map((option, id: number) => (
                    <SelectItem
                      key={`${option.props.value}-${id}`}
                      value={option.props.value?.toString() ?? ""}
                    >
                      {option.props.children}
                    </SelectItem>
                  ))}
                </div>
              </SelectContent>
            </Select>
          )
        },
        // Pass the icons as children to our CustomNavigationButton
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
