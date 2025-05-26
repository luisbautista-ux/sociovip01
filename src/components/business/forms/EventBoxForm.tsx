
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EventBox, EventBoxFormData } from "@/lib/types";
import { DialogFooter } from "@/components/ui/dialog";

const eventBoxFormSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres."),
  cost: z.coerce.number().min(0, "El costo no puede ser negativo."),
  description: z.string().optional(),
  status: z.enum(['available', 'unavailable'], { required_error: "Debes seleccionar un estado."}),
  capacity: z.coerce.number().int().min(1, "La capacidad debe ser al menos 1.").optional(),
});

type EventBoxFormValues = z.infer<typeof eventBoxFormSchema>;

interface EventBoxFormProps {
  eventBox?: EventBox;
  onSubmit: (data: EventBoxFormData) => void;
  onCancel: () => void;
}

export function EventBoxForm({ eventBox, onSubmit, onCancel }: EventBoxFormProps) {
  const form = useForm<EventBoxFormValues>({
    resolver: zodResolver(eventBoxFormSchema),
    defaultValues: {
      name: eventBox?.name || "",
      cost: eventBox?.cost || 0,
      description: eventBox?.description || "",
      status: eventBox?.status || 'available',
      capacity: eventBox?.capacity || undefined,
    },
  });

  const handleSubmit = (values: EventBoxFormValues) => {
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
              <FormLabel>Nombre del Box</FormLabel>
              <FormControl><Input placeholder="Ej: Box A1 (Escenario)" {...field} /></FormControl>
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
              <FormControl><Input type="number" placeholder="500.00" {...field} /></FormControl>
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
              <FormControl><Textarea placeholder="Detalles del box..." {...field} rows={3} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="capacity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Capacidad (Personas - Opcional)</FormLabel>
              <FormControl><Input type="number" placeholder="8" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || undefined)}/></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estado</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un estado" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="available">Disponible</SelectItem>
                  <SelectItem value="unavailable">No Disponible</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter className="pt-6">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90">
            {eventBox ? "Guardar Cambios" : "Crear Box"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
