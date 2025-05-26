
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TicketType, TicketTypeFormData } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";

const ticketTypeFormSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  cost: z.coerce.number().min(0, "El costo no puede ser negativo."),
  description: z.string().optional(),
  quantity: z.coerce.number().int().min(0, "La cantidad no puede ser negativa.").optional(),
});

type TicketTypeFormValues = z.infer<typeof ticketTypeFormSchema>;

interface TicketTypeFormProps {
  ticketType?: TicketType;
  onSubmit: (data: TicketTypeFormData) => void;
  onCancel: () => void;
}

export function TicketTypeForm({ ticketType, onSubmit, onCancel }: TicketTypeFormProps) {
  const form = useForm<TicketTypeFormValues>({
    resolver: zodResolver(ticketTypeFormSchema),
    defaultValues: {
      name: ticketType?.name || "",
      cost: ticketType?.cost || 0,
      description: ticketType?.description || "",
      quantity: ticketType?.quantity || undefined,
    },
  });

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
              <FormLabel>Nombre del Tipo de Entrada</FormLabel>
              <FormControl><Input placeholder="Ej: Entrada General" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="cost"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Costo (S/)</FormLabel>
              <FormControl><Input type="number" placeholder="50.00" {...field} /></FormControl>
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
              <FormControl><Textarea placeholder="Detalles de la entrada..." {...field} rows={3} /></FormControl>
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
              <FormControl><Input type="number" placeholder="100 (dejar vacío para ilimitado)" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || undefined)} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter className="pt-6">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90">
            {ticketType ? "Guardar Cambios" : "Crear Tipo de Entrada"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
