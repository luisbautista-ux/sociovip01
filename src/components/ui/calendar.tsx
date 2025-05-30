
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type CaptionProps, useCaption } from "react-day-picker" // Import useCaption

import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { es } from "date-fns/locale";
import { format } from "date-fns";
import { Button, buttonVariants } from "@/components/ui/button";


export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props // These are the DayPickerProps (like fromYear, toYear) passed to DayPicker
}: CalendarProps) {

  // Custom Caption now uses the useCaption hook
  function CustomCaptionComponent() { // Renamed to avoid confusion
    const { displayMonth, goToMonth, previousMonth: prevMonthNav, nextMonth: nextMonthNav } = useCaption();
    
    // Props for year/month dropdowns still come from the outer Calendar component's props
    const { fromYear, toYear, fromMonth, toMonth, fromDate, toDate } = props;

    const handleYearChange = (value: string) => {
      if (!displayMonth) {
        console.error("Calendar CustomCaption: displayMonth (from useCaption) is not available in handleYearChange.");
        return;
      }
      const newDate = new Date(displayMonth);
      newDate.setFullYear(parseInt(value, 10));
      if (typeof goToMonth === 'function') {
        goToMonth(newDate);
      } else {
        console.error("Calendar CustomCaption: goToMonth (from useCaption) is not available or not a function in handleYearChange.");
      }
    };

    const handleMonthChange = (value: string) => {
      if (!displayMonth) {
        console.error("Calendar CustomCaption: displayMonth (from useCaption) is not available in handleMonthChange.");
        return;
      }
      const newDate = new Date(displayMonth);
      newDate.setMonth(parseInt(value, 10));
      if (typeof goToMonth === 'function') {
        goToMonth(newDate);
      } else {
        console.error("Calendar CustomCaption: goToMonth (from useCaption) is not available or not a function in handleMonthChange.");
      }
    };
    
    const S_fromYear = fromYear || fromDate?.getFullYear() || new Date().getFullYear() - 100;
    const S_toYear = toYear || toDate?.getFullYear() || new Date().getFullYear() + 5;

    const years: {label: string, value: string}[] = [];
    for (let i = S_fromYear; i <= S_toYear; i++) {
      years.push({ label: i.toString(), value: i.toString() });
    }

    const months = Array.from({ length: 12 }, (_, i) => ({
        value: i.toString(),
        label: format(new Date(2000, i, 1), "LLLL", { locale: es }),
    }));

    return (
      <div className="flex justify-between items-center pt-1 relative px-10">
        <Button
          variant="outline"
          size="icon"
          name="previous-month"
          aria-label="Go to previous month"
          disabled={!prevMonthNav}
          className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1"
          onClick={() => prevMonthNav && typeof goToMonth === 'function' && goToMonth(prevMonthNav)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-1 w-full justify-center">
            <Select
                value={displayMonth ? displayMonth.getMonth().toString() : ""}
                onValueChange={handleMonthChange}
                disabled={!displayMonth}
            >
                <SelectTrigger className="h-7 w-[calc(50%-0.25rem)] max-w-[120px] px-2 py-1 text-xs data-[placeholder]:text-muted-foreground focus:ring-0 focus:ring-offset-0 sm:text-sm">
                    <SelectValue>{displayMonth ? format(displayMonth, "LLLL", { locale: es }) : "Mes"}</SelectValue>
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
                value={displayMonth ? displayMonth.getFullYear().toString() : ""}
                onValueChange={handleYearChange}
                disabled={!displayMonth}
            >
                <SelectTrigger className="h-7 w-[calc(50%-0.25rem)] max-w-[80px] px-2 py-1 text-xs data-[placeholder]:text-muted-foreground focus:ring-0 focus:ring-offset-0 sm:text-sm">
                    <SelectValue>{displayMonth ? displayMonth.getFullYear() : "Año"}</SelectValue>
                </SelectTrigger>
                <SelectContent position="popper">
                    {years.map((year) => (
                        <SelectItem key={year.value} value={year.value}>
                            {year.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <Button
          variant="outline"
          size="icon"
          name="next-month"
          aria-label="Go to next month"
          disabled={!nextMonthNav}
          className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1"
          onClick={() => nextMonthNav && typeof goToMonth === 'function' && goToMonth(nextMonthNav)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
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
        caption_label: "text-sm font-medium hidden", // Hide default label
        nav: "space-x-1 flex items-center hidden", // Hide default nav
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
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
      components={{
        Caption: CustomCaptionComponent, // Use the renamed component that uses the hook
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
