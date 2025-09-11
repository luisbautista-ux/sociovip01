
"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarShadcnUi } from "@/components/ui/calendar"; 
import { CalendarIcon, ImageIcon, Loader2 } from "lucide-react";
import { cn, anyToDate } from "@/lib/utils";
import { format, parseISO, startOfDay, isBefore, isEqual } from "date-fns";
import { es } from "date-fns/locale";
import type { BusinessManagedEntity } from "@/lib/types";

const eventDetailsFormSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres."),
  termsAndConditions: z.string().optional(),
  startDate: z.date({ required_error: "Fecha de inicio es requerida." }),
  endDate: z.date({ required_error: "Fecha de fin es requerida." }),
  maxAttendance: z.coerce.number().int().min(0, "El aforo no puede ser negativo.").optional().or(z.literal(undefined)).or(z.literal(null)),
  isActive: z.boolean().default(true),
  imageUrl: z.string().url("Debe ser una URL válida.").optional().or(z.literal("")),
  aiHint: z.string().optional(),
}).refine(data => {
    if (!data.startDate || !data.endDate) return true; 
    const start = startOfDay(data.startDate);
    const end = startOfDay(data.endDate); 
    return isEqual(end, start) || isBefore(start, end) ;
}, {
  message: "La fecha de fin no puede ser anterior a la fecha de inicio.",
  path: ["endDate"],
});

export type EventDetailsFormValues = z.infer<typeof eventDetailsFormSchema>;

interface BusinessEventFormProps {
  event: BusinessManagedEntity; 
  isSubmitting?: boolean;
  onFormChange: (data: EventDetailsFormValues) => void;
}

export const BusinessEventForm = React.memo(({ event, isSubmitting = false, onFormChange }: BusinessEventFormProps) => {
  const form = useForm<EventDetailsFormValues>({
    resolver: zodResolver(eventDetailsFormSchema),
    defaultValues: {
      name: event?.name || "",
      description: event?.description || "",
      termsAndConditions: event?.termsAndConditions || "",
      startDate: anyToDate(event?.startDate) ?? new Date(),
      endDate: anyToDate(event?.endDate) ?? new Date(new Date().setDate(new Date().getDate() + 7)),
      maxAttendance: event?.maxAttendance === undefined || event?.maxAttendance === null ? undefined : event.maxAttendance,
      isActive: event?.isActive === undefined ? true : event.isActive,
      imageUrl: event?.imageUrl || "",
      aiHint: event?.aiHint || "",
    },
  });
  
  // Use useEffect to subscribe to form changes and call onFormChange
  React.useEffect(() => {
    const subscription = form.watch((value) => {
      // Zod parse to ensure the data is valid before propagating
      const parsed = eventDetailsFormSchema.safeParse(value);
      if (parsed.success) {
        onFormChange(parsed.data);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, onFormChange]);


  return (
    <Form {...form}>
      <form className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Evento <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input placeholder="Ej: Noche de Salsa" {...field} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción <span className="text-destructive">*</span></FormLabel>
              <FormControl><Textarea placeholder="Detalles del evento..." {...field} rows={3} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="termsAndConditions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Términos y Condiciones (Opcional)</FormLabel>
              <FormControl><Textarea placeholder="Condiciones del evento, ej: Dresscode elegante." {...field} value={field.value || ""} rows={3} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Fecha de Inicio <span className="text-destructive">*</span></FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isSubmitting}>
                        {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona fecha</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarShadcnUi mode="single" selected={field.value} onSelect={field.onChange} locale={es} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Fecha de Fin <span className="text-destructive">*</span></FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isSubmitting}>
                        {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona fecha</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarShadcnUi mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => form.getValues("startDate") && isBefore(date, startOfDay(form.getValues("startDate")))} locale={es} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="maxAttendance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Aforo Máximo</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="100"
                  className="no-spinner"
                  {...field}
                  value={field.value === undefined || field.value === null ? '' : String(field.value)}
                   onChange={e => {
                    const val = e.target.value;
                    if (val === "") {
                      field.onChange(undefined);
                    } else {
                      const num = parseInt(val, 10);
                      if (!isNaN(num)) {
                        field.onChange(num);
                      }
                    }
                  }}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormDescription className="text-xs">
                Define el número máximo de asistentes para tu evento.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL de Imagen (Opcional)</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  <Input placeholder="https://ejemplo.com/imagen_evento.png" {...field} value={field.value || ""} disabled={isSubmitting} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="aiHint"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Palabras Clave para Imagen (si URL está vacía)</FormLabel>
              <FormControl><Input placeholder="Ej: concierto musica (máx 2 palabras)" {...field} value={field.value || ""} disabled={isSubmitting} /></FormControl>
               <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Activar Evento <span className="text-destructive">*</span></FormLabel>
                <FormMessage />
              </div>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} /></FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
});

BusinessEventForm.displayName = "BusinessEventForm";
