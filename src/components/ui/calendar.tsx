
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, DropdownProps, type ButtonProps as RDPButtonProps, type CaptionProps, useDayPicker, useNavigation } from "react-day-picker"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./select"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const CustomNavigationButton = React.forwardRef<
    HTMLDivElement, // Renders a div
    RDPButtonProps & { name: 'previous-month' | 'next-month' } // name is always provided by DayPicker for its nav buttons
  >(({ name, disabled, onClick, ...restButtonProps }, ref) => {
    const Icon = name === 'previous-month' ? ChevronLeft : ChevronRight;
    const dayPickerClassNames = props.classNames || {};

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={restButtonProps['aria-label']}
        className={cn(
          "h-7 w-7 flex items-center justify-center rounded-md border border-input bg-transparent p-0 text-sm font-medium",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          disabled ? "pointer-events-none opacity-50" : "cursor-pointer",
          name === 'previous-month' && dayPickerClassNames.nav_button_previous,
          name === 'next-month' && dayPickerClassNames.nav_button_next
        )}
        onClick={(e: React.MouseEvent<HTMLDivElement>) => {
          if (!disabled && onClick) {
            onClick(e);
          }
        }}
        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (!disabled && onClick) {
              e.preventDefault();
              (onClick as any)(e); // onClick expects MouseEvent but KeyboardEvent works
            }
          }
        }}
      >
        <Icon className="h-4 w-4" />
      </div>
    );
  });
  CustomNavigationButton.displayName = "CustomNavigationButton";

  // Custom Caption component to use Shadcn Select for month/year
  function CustomCaption(captionProps: CaptionProps) {
    const { goToMonth, nextMonth, previousMonth, currentMonth } = useNavigation();
    const { fromYear, fromMonth, fromDate, toYear, toMonth, toDate } = useDayPicker();

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
    
    const years: {label: string, value: string}[] = [];
    const S_fromYear = fromYear || fromDate?.getFullYear() || new Date().getFullYear() - 100;
    const S_toYear = toYear || toDate?.getFullYear() || new Date().getFullYear() + 0;

    for (let i = S_fromYear; i <= S_toYear; i++) {
      years.push({ label: i.toString(), value: i.toString() });
    }

    const months = Array.from({ length: 12 }, (_, i) => ({
        value: i.toString(),
        label: format(new Date(2000, i, 1), "LLLL", { locale: es }),
    }));


    return (
      <div className="flex justify-between items-center px-2 py-1.5">
         <CustomNavigationButton name="previous-month" onClick={() => previousMonth && goToMonth(previousMonth)} disabled={!previousMonth} aria-label="Mes anterior" />
        <div className="flex gap-1">
            <Select
                value={currentMonth.getMonth().toString()}
                onValueChange={handleMonthChange}
            >
                <SelectTrigger className="h-7 w-auto px-2 py-1 text-xs data-[placeholder]:text-muted-foreground focus:ring-0 focus:ring-offset-0 sm:text-sm">
                    <SelectValue>{format(currentMonth, "LLLL", { locale: es })}</SelectValue>
                </SelectTrigger>
                <SelectContent position="popper">
                    <SelectGroup>
                        {months.map((month) => (
                            <SelectItem key={month.value} value={month.value}>
                                {month.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
            <Select
                value={currentMonth.getFullYear().toString()}
                onValueChange={handleYearChange}
            >
                <SelectTrigger className="h-7 w-auto px-2 py-1 text-xs data-[placeholder]:text-muted-foreground focus:ring-0 focus:ring-offset-0 sm:text-sm">
                    <SelectValue>{currentMonth.getFullYear()}</SelectValue>
                </SelectTrigger>
                <SelectContent position="popper">
                     <SelectGroup>
                        {years.map((year) => (
                            <SelectItem key={year.value} value={year.value}>
                                {year.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
        </div>
        <CustomNavigationButton name="next-month" onClick={() => nextMonth && goToMonth(nextMonth)} disabled={!nextMonth} aria-label="Mes siguiente" />
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
        // caption: "flex justify-center pt-1 relative items-center", // Default caption style, we use CustomCaption
        // caption_label: "text-sm font-medium", // Handled by CustomCaption
        // caption_dropdowns: "flex justify-center gap-1", // Handled by CustomCaption
        // nav: "space-x-1 flex items-center", // Handled by CustomCaption
        nav_button_previous: "absolute left-1", // Used by CustomNavigationButton for positioning
        nav_button_next: "absolute right-1",   // Used by CustomNavigationButton for positioning
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
        ...classNames, 
      }}
      components={{
        // NavigationButton: CustomNavigationButton, // Navigation buttons are now part of CustomCaption
        Caption: CustomCaption, // This replaces the default caption and navigation
        // IconLeft and IconRight are no longer directly used by DayPicker if Caption is fully custom
        // But our CustomNavigationButton uses them if needed.
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }

    