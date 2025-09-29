
"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BatchBoxFormData } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

const batchBoxFormSchema = z.object({
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
  onSubmit: (data: BatchBoxFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function BatchBoxForm({ onSubmit, onCancel, isSubmitting = false }: BatchBoxFormProps) {
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

  const handleSubmit = (values: BatchBoxFormValues) => {
    onSubmit({ ...values, status: 'available' });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
        <FormField control={form.control} name="prefix" render={({ field }) => (
          <FormItem>
            <FormLabel>Prefijo del Nombre <span className="text-destructive">*</span></FormLabel>
            <FormControl><Input placeholder="Ej: Mesa VIP, Lounge" {...field} disabled={isSubmitting} /></FormControl>
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
                <FormLabel>Capacidad (Opcional)</FormLabel>
                <FormControl><Input type="number" placeholder="8" {...field} value={field.value ?? ""} onChange={e => field.onChange(parseInt(e.target.value, 10) || undefined)} disabled={isSubmitting} /></FormControl>
                <FormMessage />
            </FormItem>
        )}/>
        <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem>
                <FormLabel>Descripción (Opcional)</FormLabel>
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
