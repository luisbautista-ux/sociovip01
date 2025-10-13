
"use client";

import React, { useImperativeHandle, useEffect, useRef, useState } from "react";
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
import { CalendarIcon, ImageIcon, Upload } from "lucide-react";
import { cn, anyToDate } from "@/lib/utils";
import { format, isBefore, startOfDay, isEqual } from "date-fns";
import { es } from "date-fns/locale";
import type { BusinessManagedEntity } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import NextImage from "next/image";
import { useToast } from "@/hooks/use-toast";

const eventDetailsFormSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres."),
  termsAndConditions: z.string().optional(),
  startDate: z.date({ required_error: "Fecha de inicio es requerida." }),
  endDate: z.date({ required_error: "Fecha de fin es requerida." }),
  unlimitedAttendance: z.boolean().default(true),
  maxAttendance: z.coerce.number().int().min(0, "El aforo no puede ser negativo.").optional().or(z.literal(undefined)).or(z.literal(null)),
  isActive: z.boolean().default(true),
  imageFile: z.custom<File | null>(() => true).optional(),
  aiHint: z.string().optional(),
}).refine(data => {
    if (!data.startDate || !data.endDate) return true; 
    const start = startOfDay(data.startDate);
    const end = startOfDay(data.endDate); 
    return isEqual(end, start) || isBefore(start, end) ;
}, {
  message: "La fecha de fin no puede ser anterior a la fecha de inicio.",
  path: ["endDate"],
}).refine(data => {
    if (!data.unlimitedAttendance && (!data.maxAttendance || data.maxAttendance <= 0)) {
        return false;
    }
    return true;
}, {
  message: "Si el aforo no es ilimitado, debes especificar un número mayor a 0.",
  path: ["maxAttendance"],
});

export type EventDetailsFormValues = z.infer<typeof eventDetailsFormSchema>;

export interface EventDetailsFormRef {
  getValues: () => EventDetailsFormValues;
  trigger: () => Promise<boolean>;
  formState: UseFormReturn<EventDetailsFormValues>['formState'];
}

interface BusinessEventFormProps {
  event: BusinessManagedEntity | null; 
  isSubmitting?: boolean;
  onDetailsChange: (newDetails: Partial<EventDetailsFormValues>) => void;
  imagePreviewUrl: string | null;
}

export const BusinessEventForm = React.forwardRef<EventDetailsFormRef, BusinessEventFormProps>(({ event, isSubmitting = false, onDetailsChange, imagePreviewUrl }, ref) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<EventDetailsFormValues>({
    resolver: zodResolver(eventDetailsFormSchema),
    mode: "onBlur",
  });
  
  useEffect(() => {
    if (event) {
        const unlimited = event.maxAttendance === undefined || event.maxAttendance === null || event.maxAttendance === 0;
        form.reset({
            name: event.name || "",
            description: event.description || "",
            termsAndConditions: event.termsAndConditions || "",
            startDate: anyToDate(event.startDate) ?? new Date(),
            endDate: anyToDate(event.endDate) ?? new Date(new Date().setDate(new Date().getDate() + 7)),
            unlimitedAttendance: unlimited,
            maxAttendance: unlimited ? undefined : event.maxAttendance,
            isActive: event.isActive === undefined ? true : event.isActive,
            imageFile: null,
            aiHint: event.aiHint || "",
        });
    }
  }, [event, form]);

  useImperativeHandle(ref, () => ({
    getValues: () => form.getValues(),
    trigger: () => form.trigger(),
    formState: form.formState,
  }));
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "Archivo muy grande", description: "La imagen no debe superar los 5MB.", variant: "destructive" });
        return;
      }
      onDetailsChange({ imageFile: file });
    }
  };
  
  const isUnlimited = form.watch("unlimitedAttendance");

  useEffect(() => {
    if (isUnlimited) {
      if (form.getValues("maxAttendance") !== 0) {
        form.setValue("maxAttendance", 0);
        onDetailsChange({ maxAttendance: 0 });
      }
    }
  }, [isUnlimited, form, onDetailsChange]);


  return (
    <Form {...form}>
      <form className="space-y-4 overflow-y-auto">
        
        <div className="flex flex-col items-center justify-center mb-4 space-y-3">
          <div className="w-full aspect-video relative rounded-md border bg-muted flex items-center justify-center">
            {imagePreviewUrl ? (
              <NextImage src={imagePreviewUrl} alt="Vista previa de la imagen" layout="fill" objectFit="cover" className="rounded-md" />
            ) : (
              <div className="text-muted-foreground flex flex-col items-center">
                <ImageIcon className="h-10 w-10" />
                <span className="text-sm mt-1">Vista Previa</span>
              </div>
            )}
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/png, image/jpeg, image/webp"
          />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
             Cambiar Imagen
          </Button>
          <FormMessage>{form.formState.errors.imageFile?.message}</FormMessage>
        </div>
        
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel><span className="font-bold">Nombre del Evento</span> <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input placeholder="Ej: Noche de Salsa" {...field} value={field.value || ''} onBlur={() => onDetailsChange({ name: field.value })} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel><strong>Descripción</strong> <span className="text-destructive">*</span></FormLabel>
              <FormControl><Textarea placeholder="Detalles del evento..." {...field} value={field.value || ''} onBlur={() => onDetailsChange({ description: field.value })} rows={3} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="termsAndConditions"
          render={({ field }) => (
            <FormItem>
              <FormLabel><strong>Términos y Condiciones (Opcional)</strong></FormLabel>
              <FormControl><Textarea placeholder="Condiciones del evento, ej: Dresscode elegante." {...field} value={field.value || ''} onBlur={() => onDetailsChange({ termsAndConditions: field.value })} rows={3} disabled={isSubmitting} /></FormControl>
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
                <FormLabel><strong>Fecha de Inicio</strong> <span className="text-destructive">*</span></FormLabel>
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
                    <CalendarShadcnUi mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); onDetailsChange({ startDate: date }); }} locale={es} initialFocus />
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
                <FormLabel><strong>Fecha de Fin</strong> <span className="text-destructive">*</span></FormLabel>
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
                    <CalendarShadcnUi mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); onDetailsChange({ endDate: date }); }} disabled={(date) => form.getValues("startDate") && isBefore(date, startOfDay(form.getValues("startDate")))} locale={es} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="space-y-2">
            <FormField
              control={form.control}
              name="unlimitedAttendance"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => {
                          const isChecked = Boolean(checked);
                          field.onChange(isChecked);
                          onDetailsChange({ unlimitedAttendance: isChecked });
                      }}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormLabel className="font-normal"><strong>Aforo Ilimitado</strong></FormLabel>
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="maxAttendance"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className={cn(isUnlimited && "text-muted-foreground/50")}>Aforo Máximo</FormLabel>
                    <FormControl>
                        <Input
                        type="number"
                        placeholder="100"
                        className="no-spinner"
                        {...field}
                        value={field.value ?? ''} 
                        onBlur={() => onDetailsChange({ maxAttendance: form.getValues("maxAttendance") })}
                        onChange={e => {
                            const val = e.target.value;
                            field.onChange(val === "" ? undefined : Number(val));
                        }}
                        disabled={isSubmitting || isUnlimited}
                        />
                    </FormControl>
                    <FormDescription className="text-xs">
                        {isUnlimited ? "El aforo es ilimitado. Desmarca la casilla para definir un límite." : "Define el número máximo de asistentes."}
                    </FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
                />
        </div>

        <FormField
          control={form.control}
          name="aiHint"
          render={({ field }) => (
            <FormItem>
              <FormLabel><strong>Palabras Clave para Imagen (Opcional)</strong></FormLabel>
              <FormControl><Input placeholder="Ej: concierto musica (máx 2 palabras)" {...field} value={field.value || ""} onBlur={() => onDetailsChange({ aiHint: field.value })} disabled={isSubmitting} /></FormControl>
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
                <FormLabel><strong>Activar Evento</strong> <span className="text-destructive">*</span></FormLabel>
                <FormMessage />
              </div>
              <FormControl><Switch checked={field.value} onCheckedChange={(checked) => { field.onChange(checked); onDetailsChange({ isActive: checked }); }} disabled={isSubmitting} /></FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
});

BusinessEventForm.displayName = "BusinessEventForm";
