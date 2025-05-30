
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type CaptionProps } from "react-day-picker" 

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
  components, // Captura los componentes pasados externamente
  ...props // Estas son las DayPickerProps (como fromYear, toYear) pasadas a DayPicker
}: CalendarProps) {

  // CustomCaptionComponent ahora está definido dentro de Calendar para cerrar sobre `props` (CalendarProps)
  // para fromYear, toYear etc.
  function CustomCaptionComponent(captionProps: CaptionProps) {
    // Log detallado para depuración
    // console.log("Calendar CustomCaptionComponent received captionProps:", JSON.stringify(captionProps, (key, value) =>
    //   typeof value === 'function' ? `Function ${value.name || 'anonymous'}` : value, 2));

    const { displayMonth, goToMonth, previousMonth: prevMonthNav, nextMonth: nextMonthNav } = captionProps;

    // Estas props (fromYear, toYear etc.) vienen del componente Calendar (el wrapper)
    const { fromYear, toYear, fromDate, toDate } = props;

    const handleYearChange = (value: string) => {
      if (!displayMonth) {
        console.error("Calendar CustomCaption: displayMonth is not available in handleYearChange.", captionProps);
        return;
      }
      if (typeof goToMonth !== 'function') {
        console.error("Calendar CustomCaption: goToMonth is not available or not a function in handleYearChange.", captionProps);
        return;
      }
      const newDate = new Date(displayMonth);
      newDate.setFullYear(parseInt(value, 10));
      goToMonth(newDate);
    };

    const handleMonthChange = (value: string) => {
      if (!displayMonth) {
        console.error("Calendar CustomCaption: displayMonth is not available in handleMonthChange.", captionProps);
        return;
      }
      if (typeof goToMonth !== 'function') {
        console.error("Calendar CustomCaption: goToMonth is not available or not a function in handleMonthChange.", captionProps);
        return;
      }
      const newDate = new Date(displayMonth);
      newDate.setMonth(parseInt(value, 10));
      goToMonth(newDate);
    };
    
    // Determinar los años para el dropdown
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

    // Si displayMonth o goToMonth no están listos, podríamos renderizar un fallback o simplemente deshabilitar.
    const navigationReady = !!displayMonth && typeof goToMonth === 'function';

    return (
      <div className="flex justify-between items-center pt-1 relative px-10">
        <Button
          variant="outline"
          size="icon"
          name="previous-month"
          aria-label="Go to previous month"
          disabled={!navigationReady || !prevMonthNav}
          className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1"
          onClick={() => navigationReady && prevMonthNav && goToMonth(prevMonthNav)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-1 w-full justify-center">
            <Select
                value={navigationReady ? displayMonth.getMonth().toString() : ""}
                onValueChange={handleMonthChange}
                disabled={!navigationReady}
            >
                <SelectTrigger className="h-7 w-[calc(50%-0.25rem)] max-w-[120px] px-2 py-1 text-xs data-[placeholder]:text-muted-foreground focus:ring-0 focus:ring-offset-0 sm:text-sm" disabled={!navigationReady}>
                    <SelectValue placeholder="Mes">{navigationReady ? format(displayMonth, "LLLL", { locale: es }) : "Mes"}</SelectValue>
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
                value={navigationReady ? displayMonth.getFullYear().toString() : ""}
                onValueChange={handleYearChange}
                disabled={!navigationReady}
            >
                <SelectTrigger className="h-7 w-[calc(50%-0.25rem)] max-w-[80px] px-2 py-1 text-xs data-[placeholder]:text-muted-foreground focus:ring-0 focus:ring-offset-0 sm:text-sm" disabled={!navigationReady}>
                    <SelectValue placeholder="Año">{navigationReady ? displayMonth.getFullYear() : "Año"}</SelectValue>
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
          disabled={!navigationReady || !nextMonthNav}
          className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1"
          onClick={() => navigationReady && nextMonthNav && goToMonth(nextMonthNav)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }
  
  // Prepara los props para DayPicker, excluyendo captionLayout si usamos CustomCaptionComponent
  const { captionLayout, ...dayPickerProps } = props;

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption_label: "text-sm font-medium hidden", 
        nav: "space-x-1 flex items-center hidden", 
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
        Caption: CustomCaptionComponent,
        ...components // Permite que otros componentes sean pasados si es necesario
      }}
      // No pasamos explícitamente captionLayout aquí, ya que nuestro CustomCaptionComponent maneja todo el layout del caption.
      // DayPicker debería manejar la ausencia de captionLayout cuando components.Caption está definido.
      {...dayPickerProps} 
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
