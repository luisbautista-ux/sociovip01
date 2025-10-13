
"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BatchBoxFormData, EventBox } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const batchBoxFormSchema = z.object({
  templateBoxId: z.string().optional(), // Template selection
  prefix: z.string().min(1, "El prefijo es requerido."),
  fromNumber: z.coerce.number().int().min(1, "Debe ser al menos 1."),
  toNumber: z.coerce.number().int().min(1, "Debe ser al menos 1."),
  cost: z.coerce.number().min(0, "El costo no puede ser negativo."),
  capacity: z.coerce.number().int().min(1, "La capacidad debe ser al menos 1.").optional().or(z.literal(undefined)),
  description: z.string().optional(),
}).refine(data => data.toNumber >= data.fromNumber, {
  message: "El número 'hasta' debe ser mayor o igual que 'desde'.",
  path: ["toNumber"],
});

type BatchBoxFormValues = z.infer<typeof batchBoxFormSchema>;

interface BatchBoxFormProps {
  existingBoxes?: EventBox[];
  onSubmit: (data: BatchBoxFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function BatchBoxForm({ existingBoxes = [], onSubmit, onCancel, isSubmitting = false }: BatchBoxFormProps) {
  const form = useForm<BatchBoxFormValues>({
    resolver: zodResolver(batchBoxFormSchema),
    defaultValues: {
      prefix: "Mesa VIP",
      fromNumber: 1,
      toNumber: 10,
      cost: 0,
      capacity: undefined,
      description: "",
    },
  });

  const handleTemplateChange = (boxId: string) => {
    const selectedBox = existingBoxes.find(b => b.id === boxId);
    if (selectedBox) {
      form.setValue("cost", selectedBox.cost);
      form.setValue("capacity", selectedBox.capacity);
      form.setValue("description", selectedBox.description || "");
      
      // Intelligent prefix suggestion
      const nameParts = selectedBox.name.split(' ');
      const lastPart = nameParts[nameParts.length - 1];
      if (isNaN(Number(lastPart))) {
        form.setValue("prefix", selectedBox.name);
      } else {
        form.setValue("prefix", nameParts.slice(0, -1).join(' '));
      }
    }
  };


  const handleSubmit = (values: BatchBoxFormValues) => {
    const { templateBoxId, ...rest } = values;
    onSubmit({ ...rest, status: 'available' });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-3">
        
        {existingBoxes && existingBoxes.length > 0 && (
            <FormField
              control={form.control}
              name="templateBoxId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usar Plantilla (Opcional)</FormLabel>
                  <Select onValueChange={(value) => { field.onChange(value); handleTemplateChange(value);}} disabled={isSubmitting}>
                      <FormControl>
                          <SelectTrigger>
                              <SelectValue placeholder="Selecciona un box existente como plantilla"/>
                          </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          {existingBoxes.map(box => (
                              <SelectItem key={box.id} value={box.id}>{box.name} (S/ {box.cost})</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
        )}
        
        <FormField control={form.control} name="prefix" render={({ field }) => (
          <FormItem>
            <FormLabel>Prefijo del Nombre <span className="text-destructive">*</span></FormLabel>
            <FormControl><Input placeholder="Ej: Mesa VIP, Lounge" {...field} value={field.value || ""} disabled={isSubmitting} /></FormControl>
            <FormMessage />
          </FormItem>
        )}/>
        <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="fromNumber" render={({ field }) => (
            <FormItem>
                <FormLabel>Desde el Nº <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="number" {...field} disabled={isSubmitting} /></FormControl>
                <FormMessage />
            </FormItem>
            )}/>
            <FormField control={form.control} name="toNumber" render={({ field }) => (
            <FormItem>
                <FormLabel>Hasta el Nº <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="number" {...field} disabled={isSubmitting} /></FormControl>
                <FormMessage />
            </FormItem>
            )}/>
        </div>
        <FormField control={form.control} name="cost" render={({ field }) => (
          <FormItem>
            <FormLabel>Costo de cada Box (S/) <span className="text-destructive">*</span></FormLabel>
            <FormControl><Input type="number" placeholder="500.00" {...field} disabled={isSubmitting} /></FormControl>
            <FormMessage />
          </FormItem>
        )}/>
        <FormField control={form.control} name="capacity" render={({ field }) => (
            <FormItem>
                <FormLabel>Capacidad </FormLabel>
                <FormControl><Input type="number" placeholder="8" {...field} value={field.value ?? ""} onChange={e => field.onChange(parseInt(e.target.value, 10) || undefined)} disabled={isSubmitting} /></FormControl>
                <FormMessage />
            </FormItem>
        )}/>
        <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem>
                <FormLabel>Descripción </FormLabel>
                <FormControl><Textarea placeholder="Detalles de los boxes, ej: Incluye 2 botellas y piqueos." {...field} value={field.value || ""} rows={2} disabled={isSubmitting} /></FormControl>
                <FormMessage />
            </FormItem>
        )}/>
        <DialogFooter className="pt-6">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" variant="gradient" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear Boxes
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
