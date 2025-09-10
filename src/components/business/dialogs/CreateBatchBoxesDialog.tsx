
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
import { Loader2 } from "lucide-react"; // Assuming Loader2 is used for submitting state

const batchBoxFormSchema = z.object({
  prefix: z.string().min(1, "El prefijo es requerido."),
  fromNumber: z.coerce.number().int().min(1, "Debe ser al menos 1."),
  toNumber: z.coerce.number().int().min(1, "Debe ser al menos 1."),
  cost: z.coerce.number().min(0, "El costo no puede ser negativo."),
  capacity: z.coerce.number().int().min(1, "La capacidad debe ser al menos 1.").optional().or(z.literal(undefined)),
  description: z.string().optional(),
  status: z.enum(['available', 'unavailable'], { required_error: "Debes seleccionar un estado inicial."}),
}).refine(data => data.toNumber >= data.fromNumber, {
  message: "'Hasta el número' debe ser mayor o igual que 'Desde el número'.",
  path: ["toNumber"],
});

type BatchBoxFormValues = z.infer<typeof batchBoxFormSchema>;

interface CreateBatchBoxesDialogProps {
  onSubmit: (data: BatchBoxFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function CreateBatchBoxesDialog({ onSubmit, onCancel, isSubmitting = false }: CreateBatchBoxesDialogProps) {
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
  };

  return (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <FormField
              control={form.control}
              name="prefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prefijo del Nombre del Box <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Ej: Box Elevado, Mesa VIP" {...field} disabled={isSubmitting} /></FormControl>
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
                    <FormLabel>Desde el número <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="number" {...field} disabled={isSubmitting} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="toNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hasta el número <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="number" {...field} disabled={isSubmitting} /></FormControl>
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
                  <FormLabel>Costo por Box (S/) <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="number" placeholder="500.00" {...field} disabled={isSubmitting} /></FormControl>
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
                  <FormControl><Input type="number" placeholder="8" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || undefined)} disabled={isSubmitting} /></FormControl>
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
                  <FormControl><Textarea placeholder="Ej: Incluye servicio preferencial y vista al escenario." {...field} rows={2} disabled={isSubmitting} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado Inicial por Defecto <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
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
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Lote de Boxes
              </Button>
            </DialogFooter>
          </form>
        </Form>
  );
}
