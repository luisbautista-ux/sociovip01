
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BatchBoxFormData } from "@/lib/types";

const batchBoxFormSchema = z.object({
  prefix: z.string().min(1, "El prefijo es requerido."),
  fromNumber: z.coerce.number().int().min(1, "Debe ser al menos 1."),
  toNumber: z.coerce.number().int().min(1, "Debe ser al menos 1."),
  cost: z.coerce.number().min(0, "El costo no puede ser negativo."),
  capacity: z.coerce.number().int().min(1, "La capacidad debe ser al menos 1.").optional(),
  description: z.string().optional(),
  status: z.enum(['available', 'unavailable'], { required_error: "Debes seleccionar un estado inicial."}),
}).refine(data => data.toNumber >= data.fromNumber, {
  message: "'Hasta el número' debe ser mayor o igual que 'Desde el número'.",
  path: ["toNumber"],
});

type BatchBoxFormValues = z.infer<typeof batchBoxFormSchema>;

interface CreateBatchBoxesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BatchBoxFormData) => void;
}

export function CreateBatchBoxesDialog({ open, onOpenChange, onSubmit }: CreateBatchBoxesDialogProps) {
  const form = useForm<BatchBoxFormValues>({
    resolver: zodResolver(batchBoxFormSchema),
    defaultValues: {
      prefix: "",
      fromNumber: 1,
      toNumber: 1,
      cost: 0,
      capacity: undefined,
      description: "",
      status: 'available',
    },
  });

  const handleSubmit = (values: BatchBoxFormValues) => {
    onSubmit(values);
    form.reset(); // Reset form after successful submission if dialog stays open or re-opens for another batch
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear Boxes en Lote</DialogTitle>
          <DialogDescription>
            Define un prefijo y un rango numérico para crear múltiples boxes con configuraciones similares.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <FormField
              control={form.control}
              name="prefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prefijo del Nombre del Box</FormLabel>
                  <FormControl><Input placeholder="Ej: Box Elevado, Mesa VIP" {...field} /></FormControl>
                  <FormDescription>Se generarán nombres como "Prefijo 1", "Prefijo 2", etc.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fromNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Desde el número</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="toNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hasta el número</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="cost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Costo por Box (S/)</FormLabel>
                  <FormControl><Input type="number" placeholder="500.00" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacidad por Box (Opcional)</FormLabel>
                  <FormControl><Input type="number" placeholder="8" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || undefined)}/></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción Común para el Lote (Opcional)</FormLabel>
                  <FormControl><Textarea placeholder="Ej: Incluye servicio preferencial..." {...field} rows={2} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado Inicial por Defecto</FormLabel>
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                Crear Lote de Boxes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```