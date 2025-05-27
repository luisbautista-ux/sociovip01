
"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { BusinessManagedEntity, BusinessEventFormData } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";

const eventFormSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres."),
  termsAndConditions: z.string().optional(),
  startDate: z.date({ required_error: "Fecha de inicio es requerida." }),
  endDate: z.date({ required_error: "Fecha de fin es requerida." }),
  maxAttendance: z.coerce.number().int().min(0).optional().or(z.literal(undefined)), // Allow 0 for unlimited
  isActive: z.boolean().default(true),
  imageUrl: z.string().url("Debe ser una URL válida.").optional().or(z.literal("")),
  aiHint: z.string().optional(),
}).refine(data => data.endDate >= data.startDate, {
  message: "La fecha de fin no puede ser anterior a la fecha de inicio.",
  path: ["endDate"],
});

type EventFormValues = z.infer<typeof eventFormSchema>;

interface BusinessEventFormProps {
  event?: BusinessManagedEntity; 
  onSubmit: (data: BusinessEventFormData) => void;
  onCancel?: () => void; 
  isSubmitting?: boolean;
  submitButtonText?: string;
}

export function BusinessEventForm({ 
  event, 
  onSubmit, 
  onCancel, 
  isSubmitting = false,
  submitButtonText 
}: BusinessEventFormProps) {
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: event?.name || "",
      description: event?.description || "",
      termsAndConditions: event?.termsAndConditions || "",
      startDate: event?.startDate ? new Date(event.startDate) : new Date(),
      endDate: event?.endDate ? new Date(event.endDate) : new Date(new Date().setDate(new Date().getDate() + 7)),
      maxAttendance: event?.maxAttendance === undefined || event?.maxAttendance === null ? undefined : event.maxAttendance,
      isActive: event?.isActive === undefined ? true : event.isActive,
      imageUrl: event?.imageUrl || "",
      aiHint: event?.aiHint || "",
    },
  });

  React.useEffect(() => {
    form.reset({
      name: event?.name || "",
      description: event?.description || "",
      termsAndConditions: event?.termsAndConditions || "",
      startDate: event?.startDate ? new Date(event.startDate) : new Date(),
      endDate: event?.endDate ? new Date(event.endDate) : new Date(new Date().setDate(new Date().getDate() + 7)),
      maxAttendance: event?.maxAttendance === undefined || event?.maxAttendance === null ? undefined : event.maxAttendance,
      isActive: event?.isActive === undefined ? true : event.isActive,
      imageUrl: event?.imageUrl || "",
      aiHint: event?.aiHint || "",
    });
  }, [event, form]);


  const handleSubmit = (values: EventFormValues) => {
    const dataToSubmit: BusinessEventFormData = {
        ...values,
        maxAttendance: values.maxAttendance === undefined || values.maxAttendance === null || values.maxAttendance < 0 ? 0 : values.maxAttendance,
    };
    onSubmit(dataToSubmit); 
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
              <FormControl><Textarea placeholder="Condiciones del evento, ej: Dresscode elegante." {...field} rows={3} disabled={isSubmitting} /></FormControl>
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
                      <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isSubmitting}>
                        {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona fecha</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={es} initialFocus />
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
                      <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isSubmitting}>
                        {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona fecha</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={{ before: form.getValues("startDate") }} locale={es} initialFocus />
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
              <FormLabel>Aforo Máximo (Opcional)</FormLabel>
              <FormControl><Input type="number" placeholder="Ej: 150 (0 para ilimitado)" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || undefined)} disabled={isSubmitting} /></FormControl>
               <FormDescription>Dejar en 0 o vacío para aforo ilimitado.</FormDescription>
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
                  <Input placeholder="https://ejemplo.com/imagen_evento.png" {...field} disabled={isSubmitting} />
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
              <FormControl><Input placeholder="Ej: concierto musica (máx 2 palabras)" {...field} disabled={isSubmitting} /></FormControl>
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
        <DialogFooter className="pt-6">
          {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button> }
          <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
             {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitButtonText || (event ? "Guardar Cambios en Detalles" : "Crear Evento")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
