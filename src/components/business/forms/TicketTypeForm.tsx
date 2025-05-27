
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
import type { TicketType, TicketTypeFormData } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

const ticketTypeFormSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  cost: z.coerce.number().min(0, "El costo no puede ser negativo."),
  description: z.string().optional(),
  quantity: z.coerce.number().int().min(0, "La cantidad no puede ser negativa.").optional().or(z.literal(undefined)),
});

type TicketTypeFormValues = z.infer<typeof ticketTypeFormSchema>;

interface TicketTypeFormProps {
  ticketType?: TicketType;
  onSubmit: (data: TicketTypeFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function TicketTypeForm({ ticketType, onSubmit, onCancel, isSubmitting = false }: TicketTypeFormProps) {
  const form = useForm<TicketTypeFormValues>({
    resolver: zodResolver(ticketTypeFormSchema),
    defaultValues: {
      name: ticketType?.name || "",
      cost: ticketType?.cost || 0,
      description: ticketType?.description || "",
      quantity: ticketType?.quantity === undefined || ticketType?.quantity === null ? undefined : ticketType.quantity,
    },
  });

  React.useEffect(() => {
    form.reset({
      name: ticketType?.name || "",
      cost: ticketType?.cost || 0,
      description: ticketType?.description || "",
      quantity: ticketType?.quantity === undefined || ticketType?.quantity === null ? undefined : ticketType.quantity,
    });
  }, [ticketType, form]);

  const handleSubmit = (values: TicketTypeFormValues) => {
    onSubmit(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Tipo de Entrada <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input placeholder="Ej: Entrada General, VIP, Preventa" {...field} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="cost"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Costo (S/) <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input type="number" placeholder="50.00" {...field} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción (Opcional)</FormLabel>
              <FormControl><Textarea placeholder="Detalles de la entrada, ej: Acceso a zona preferencial." {...field} rows={3} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cantidad Disponible (Opcional)</FormLabel>
              <FormControl><Input type="number" placeholder="100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || undefined)} disabled={isSubmitting} /></FormControl>
              <FormDescription>Dejar vacío o 0 para cantidad ilimitada.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter className="pt-6">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {ticketType ? "Guardar Cambios" : "Crear Tipo de Entrada"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
