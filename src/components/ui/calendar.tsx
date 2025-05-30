
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type CaptionProps } from "react-day-picker" // NO useCaption

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { es } from "date-fns/locale"; 

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props // Props like mode, selected, onSelect, locale, captionLayout, fromYear, toYear etc.
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center", // Default react-day-picker caption style
        caption_label: "text-sm font-medium", // Default react-day-picker caption_label style
        caption_dropdowns: "flex justify-center gap-1", // For react-day-picker dropdowns
        nav: "space-x-1 flex items-center", // Default react-day-picker nav style
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      // Let DayPicker use its default caption or one based on captionLayout prop
      // captionLayout="buttons" is a safe default if no custom caption is needed
      // If dropdowns are desired for month/year, "dropdown" or "dropdown-buttons" can be used
      // Forcing "buttons" for now to ensure basic navigation works.
      // If the instance on the page provides `captionLayout="dropdown"`, DayPicker should handle it.
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
        // No custom Caption component here, DayPicker will use its default or its dropdowns if captionLayout="dropdown"
      }}
      {...props} 
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }

