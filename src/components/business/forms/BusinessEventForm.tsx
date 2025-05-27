
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
import { Calendar as CalendarShadcn } from "@/components/ui/calendar"; // Renamed to avoid conflict
import { CalendarIcon, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { BusinessManagedEntity, BusinessEventFormData } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";

const eventFormSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres."),
  termsAndConditions: z.string().optional(),
  startDate: z.date({ required_error: "Fecha de inicio es requerida." }),
  endDate: z.date({ required_error: "Fecha de fin es requerida." }),
  // maxAttendance is no longer a direct form input here, it's calculated
  isActive: z.boolean().default(true),
  imageUrl: z.string().url("Debe ser una URL válida.").optional().or(z.literal("")),
  aiHint: z.string().optional(),
}).refine(data => data.endDate >= data.startDate, {
  message: "La fecha de fin no puede ser anterior a la fecha de inicio.",
  path: ["endDate"],
});

// This type is for what the form itself manages and submits
type EventFormValues = Omit<BusinessEventFormData, 'maxAttendance'>;


interface BusinessEventFormProps {
  event?: BusinessManagedEntity; 
  onSubmit: (data: EventFormValues) => void;
  onCancel?: () => void; 
  isSubmitting?: boolean;
}

export function BusinessEventForm({ 
  event, 
  onSubmit, 
  onCancel, 
  isSubmitting = false,
}: BusinessEventFormProps) {
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: event?.name || "",
      description: event?.description || "",
      termsAndConditions: event?.termsAndConditions || "",
      startDate: event?.startDate ? parseISO(event.startDate) : new Date(),
      endDate: event?.endDate ? parseISO(event.endDate) : new Date(new Date().setDate(new Date().getDate() + 7)),
      isActive: event?.isActive === undefined ? true : event.isActive,
      imageUrl: event?.imageUrl || "",
      aiHint: event?.aiHint || "",
    },
  });

  React.useEffect(() => {
    if (event) {
        form.reset({
        name: event.name || "",
        description: event.description || "",
        termsAndConditions: event.termsAndConditions || "",
        startDate: event.startDate ? parseISO(event.startDate) : new Date(),
        endDate: event.endDate ? parseISO(event.endDate) : new Date(new Date().setDate(new Date().getDate() + 7)),
        isActive: event.isActive === undefined ? true : event.isActive,
        imageUrl: event.imageUrl || "",
        aiHint: event.aiHint || "",
        });
    }
  }, [event, form]);


  const handleSubmit = (values: EventFormValues) => {
    onSubmit(values); 
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
                    <CalendarShadcn mode="single" selected={field.value} onSelect={field.onChange} locale={es} initialFocus />
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
                    <CalendarShadcn mode="single" selected={field.value} onSelect={field.onChange} disabled={{ before: form.getValues("startDate") }} locale={es} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div>
          <FormLabel>Aforo Máximo (Calculado)</FormLabel>
          <p className="text-sm font-medium mt-1">
            {event?.maxAttendance === undefined || event?.maxAttendance === null || event?.maxAttendance < 0 ? '0 (o Ilimitado si no hay entradas con cantidad)' : event.maxAttendance}
          </p>
          <FormDescription className="text-xs">
            Se calcula sumando las cantidades de los tipos de entrada definidos.
          </FormDescription>
        </div>

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
          {/* The main save/cancel buttons are in the parent Dialog managing tabs */}
          <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
             {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
             Actualizar Detalles del Evento
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
