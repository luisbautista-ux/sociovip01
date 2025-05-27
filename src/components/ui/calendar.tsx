
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type DropdownProps, type CaptionProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button" // Re-add buttonVariants for default styling
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"; // Re-add for dropdowns
import { es } from "date-fns/locale"; // Import Spanish locale
import { format } from "date-fns";


export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {

  // Custom Caption to use Shadcn Select for month/year
  function CustomCaption(captionProps: CaptionProps) {
    const { goToMonth, currentMonth } = captionProps; // Simplified, useDayPicker/useNavigation not strictly needed here if only for display
    const { fromYear, toYear, fromMonth, toMonth, fromDate, toDate } = props; // Get fromYear/toYear from main props

    const handleYearChange = (value: string) => {
      const newDate = new Date(currentMonth);
      newDate.setFullYear(parseInt(value, 10));
      goToMonth(newDate);
    };

    const handleMonthChange = (value: string) => {
      const newDate = new Date(currentMonth);
      newDate.setMonth(parseInt(value, 10));
      goToMonth(newDate);
    };
    
    const S_fromYear = fromYear || fromDate?.getFullYear() || new Date().getFullYear() - 100;
    const S_toYear = toYear || toDate?.getFullYear() || new Date().getFullYear() + 5; // Allow a few future years

    const years: {label: string, value: string}[] = [];
    for (let i = S_fromYear; i <= S_toYear; i++) {
      years.push({ label: i.toString(), value: i.toString() });
    }

    const months = Array.from({ length: 12 }, (_, i) => ({
        value: i.toString(),
        label: format(new Date(2000, i, 1), "LLLL", { locale: es }),
    }));


    return (
      <div className="flex justify-center items-center pt-1 relative gap-1">
        <button
          name="previous-month"
          aria-label="Go to previous month"
          disabled={!captionProps.previousMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1"
          )}
          onClick={() => captionProps.previousMonth && captionProps.goToMonth(captionProps.previousMonth)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <Select
            value={currentMonth.getMonth().toString()}
            onValueChange={handleMonthChange}
        >
            <SelectTrigger className="h-7 w-[calc(50%-0.5rem)] px-2 py-1 text-xs data-[placeholder]:text-muted-foreground focus:ring-0 focus:ring-offset-0 sm:text-sm">
                <SelectValue>{format(currentMonth, "LLLL", { locale: es })}</SelectValue>
            </SelectTrigger>
            <SelectContent position="popper">
                {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                        {month.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
        <Select
            value={currentMonth.getFullYear().toString()}
            onValueChange={handleYearChange}
        >
            <SelectTrigger className="h-7 w-[calc(50%-0.5rem)] px-2 py-1 text-xs data-[placeholder]:text-muted-foreground focus:ring-0 focus:ring-offset-0 sm:text-sm">
                <SelectValue>{currentMonth.getFullYear()}</SelectValue>
            </SelectTrigger>
            <SelectContent position="popper">
                {years.map((year) => (
                    <SelectItem key={year.value} value={year.value}>
                        {year.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
        <button
          name="next-month"
          aria-label="Go to next month"
          disabled={!captionProps.nextMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1"
          )}
          onClick={() => captionProps.nextMonth && captionProps.goToMonth(captionProps.nextMonth)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption_label: "text-sm font-medium hidden", // Hide default label, CustomCaption handles it
        nav: "space-x-1 flex items-center hidden", // Hide default nav, CustomCaption handles it
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }), // Use ghost variant for day styling
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30", // Make selected outside days more distinct
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Caption: CustomCaption,
        // We are not using IconLeft/IconRight directly as CustomCaption handles navigation buttons
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
