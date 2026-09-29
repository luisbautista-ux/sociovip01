
// src/components/business/forms/BusinessEventForm.tsx
"use client";

import React, { useImperativeHandle, useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { CalendarIcon, ImageIcon, Upload, Move, MapPin, Plus, Trash2, Clock } from "lucide-react";
import { cn, anyToDate } from "@/lib/utils";
import { format, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import type { BusinessManagedEntity } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

const scheduleSchema = z.object({
  id: z.string(),
  label: z.string().min(2, "Nombre de la sesión requerido"),
  startDate: z.string().min(1, "Fecha de inicio requerida"),
  endDate: z.string().min(1, "Fecha de fin requerida"),
});

const eventDetailsFormSchema = z.object({
  name: z.string().min(3, "Mínimo 3 caracteres"),
  description: z.string().optional().or(z.literal("")), // Permite vacío o nulo
  locationAddress: z.string().optional(),
  termsAndConditions: z.string().optional(),
  startDate: z.date(),
  endDate: z.date(),
  unlimitedAttendance: z.boolean().default(true),
  maxAttendance: z.coerce.number().optional().nullable(),
  isActive: z.boolean().default(true),
  isPublicAccess: z.boolean().default(false),
  imageUrl: z.string().optional(),
  imageObjectPosition: z.string().optional(),
  aiHint: z.string().optional(),
  imageFile: z.custom<File | null>(() => true).optional(),
  schedules: z.array(scheduleSchema).optional(),
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
  setCurrentEventData: React.Dispatch<React.SetStateAction<BusinessManagedEntity | null>>;
  imagePreviewUrl: string | null;
  onImageFileChange: (file: File | null) => void;
}

export const BusinessEventForm = React.forwardRef<EventDetailsFormRef, BusinessEventFormProps>(({ event, isSubmitting = false, setCurrentEventData, imagePreviewUrl, onImageFileChange }, ref) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [objectPosition, setObjectPosition] = useState('50% 50%');
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  
  const form = useForm<EventDetailsFormValues>({
    resolver: zodResolver(eventDetailsFormSchema),
    defaultValues: {
        name: "", description: "", locationAddress: "", termsAndConditions: "",
        startDate: new Date(), endDate: new Date(new Date().setDate(new Date().getDate() + 7)),
        unlimitedAttendance: true, maxAttendance: null, isActive: true, isPublicAccess: false,
        imageUrl: "", imageObjectPosition: '50% 50%', aiHint: "", schedules: []
    }
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "schedules" });

  useEffect(() => {
    if (event) {
      setObjectPosition(event.imageObjectPosition || '50% 50%');
      form.reset({
        ...event,
        startDate: anyToDate(event.startDate) ?? new Date(),
        endDate: anyToDate(event.endDate) ?? new Date(),
        unlimitedAttendance: !event.maxAttendance || event.maxAttendance === 0,
        maxAttendance: event.maxAttendance || null,
        schedules: event.schedules || [],
      });
    }
  }, [event, form]);
  
  useImperativeHandle(ref, () => ({
    getValues: () => ({ ...form.getValues(), imageObjectPosition: objectPosition }),
    trigger: () => form.trigger(),
    formState: form.formState,
  }));
  
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !imgContainerRef.current) return;
    e.preventDefault();
    
    const deltaX = e.clientX - dragStart.current.x;
    const deltaY = e.clientY - dragStart.current.y;
    dragStart.current = { x: e.clientX, y: e.clientY };
    
    setObjectPosition(prev => {
      const parts = prev.split(' ');
      let x = parseFloat(parts[0]);
      let y = parseFloat(parts[1]);
      if (isNaN(x)) x = 50;
      if (isNaN(y)) y = 50;
      
      const rect = imgContainerRef.current!.getBoundingClientRect();
      // Sensibilidad del arrastre ajustada (2x) para que se sienta más responsivo
      const percentX = (deltaX / rect.width) * 200;
      const percentY = (deltaY / rect.height) * 200;
      
      x = Math.max(0, Math.min(100, x - percentX));
      y = Math.max(0, Math.min(100, y - percentY));
      
      return `${Math.round(x)}% ${Math.round(y)}%`;
    });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || !imgContainerRef.current) return;
    
    const deltaX = e.touches[0].clientX - dragStart.current.x;
    const deltaY = e.touches[0].clientY - dragStart.current.y;
    dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    
    setObjectPosition(prev => {
      const parts = prev.split(' ');
      let x = parseFloat(parts[0]) || 50;
      let y = parseFloat(parts[1]) || 50;
      
      const rect = imgContainerRef.current!.getBoundingClientRect();
      const percentX = (deltaX / rect.width) * 200;
      const percentY = (deltaY / rect.height) * 200;
      
      x = Math.max(0, Math.min(100, x - percentX));
      y = Math.max(0, Math.min(100, y - percentY));
      
      return `${Math.round(x)}% ${Math.round(y)}%`;
    });
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { toast({ title: "Archivo muy grande", variant: "destructive" }); return; }
      onImageFileChange(file);
      form.setValue("imageFile", file);
      setObjectPosition('50% 50%');
    }
  };

  const isUnlimited = form.watch("unlimitedAttendance");

  return (
    <Form {...form}>
      <form className="space-y-6 overflow-y-auto px-1 py-1">
        <div className="space-y-4">
          <div 
            ref={imgContainerRef} 
            className="relative aspect-video rounded-md border bg-muted overflow-hidden cursor-move select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
          >
            {imagePreviewUrl ? (
              <img draggable={false} src={imagePreviewUrl} className="object-cover w-full h-full pointer-events-none" style={{ objectPosition }} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground"><ImageIcon size={40} /><span className="text-xs">Sin imagen</span></div>
            )}
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">Cambiar Imagen</Button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )}/>
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>
          )}/>
          <FormField control={form.control} name="locationAddress" render={({ field }) => (
            <FormItem><FormLabel>Ubicación</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )}/>
        </div>

        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2"><Clock size={16}/>Horarios del Evento (Sesiones)</h3>
            <Button type="button" size="sm" variant="outline" onClick={() => append({ id: Math.random().toString(36).slice(2), label: "", startDate: "", endDate: "" })}>
              <Plus size={14} className="mr-1"/> Agregar Horario
            </Button>
          </div>
          <div className="space-y-3">
            {fields.map((field, index) => (
              <Card key={field.id} className="relative">
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormField control={form.control} name={`schedules.${index}.label`} render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Nombre (Ej: Día 1)</FormLabel><FormControl><Input {...field} size={1} /></FormControl></FormItem>
                  )}/>
                  <FormField control={form.control} name={`schedules.${index}.startDate`} render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Inicio</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
                  )}/>
                  <FormField control={form.control} name={`schedules.${index}.endDate`} render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Fin</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
                  )}/>
                  <Button type="button" variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6 bg-background border rounded-full text-destructive shadow-sm" onClick={() => remove(index)}>
                    <Trash2 size={12}/>
                  </Button>
                </CardContent>
              </Card>
            ))}
            {fields.length === 0 && <p className="text-xs text-muted-foreground text-center py-2 italic">Sin horarios específicos. Se usará el rango general del evento.</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          <FormField control={form.control} name="startDate" render={({ field }) => (
            <FormItem className="flex flex-col"><FormLabel>Fecha Inicio General</FormLabel><FormControl><Input type="date" value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={e => field.onChange(new Date(e.target.value))} /></FormControl></FormItem>
          )}/>
          <FormField control={form.control} name="endDate" render={({ field }) => (
            <FormItem className="flex flex-col"><FormLabel>Fecha Fin General</FormLabel><FormControl><Input type="date" value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={e => field.onChange(new Date(e.target.value))} /></FormControl></FormItem>
          )}/>
        </div>

        <div className="space-y-4 border-t pt-4">
          <FormField control={form.control} name="unlimitedAttendance" render={({ field }) => (
            <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Aforo Ilimitado</FormLabel></FormItem>
          )}/>
          {!isUnlimited && (
            <FormField control={form.control} name="maxAttendance" render={({ field }) => (
              <FormItem><FormLabel>Aforo Máximo</FormLabel><FormControl><Input type="number" {...field} value={field.value || ""} /></FormControl></FormItem>
            )}/>
          )}
        </div>

        <FormField control={form.control} name="isPublicAccess" render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-lg border p-3"><FormLabel>Acceso Público (DNI obligatorio)</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange}/></FormControl></FormItem>
        )}/>
      </form>
    </Form>
  );
});
BusinessEventForm.displayName = "BusinessEventForm";
