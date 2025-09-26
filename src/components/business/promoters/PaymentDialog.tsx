
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CircleDollarSign } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";

type PaymentFormValues = { amount: number; notes?: string };

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promoter: { name: string; uid: string; pendingAmount: number } | null;
  onConfirmPayment: (promoterUid: string, amount: number, notes?: string) => Promise<void>;
  isSubmitting: boolean;
}

export function PaymentDialog({ open, onOpenChange, promoter, onConfirmPayment, isSubmitting }: PaymentDialogProps) {
  const paymentFormSchema = z.object({
    amount: z.coerce.number()
        .positive("El monto debe ser mayor a cero.")
        .max(promoter?.pendingAmount || 0, `El monto no puede exceder el pendiente de S/ ${(promoter?.pendingAmount || 0).toFixed(2)}.`),
    notes: z.string().optional(),
  });

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { amount: 0, notes: "" }
  });

  useEffect(() => {
    if (promoter && open) {
      form.reset({
        amount: promoter.pendingAmount,
        notes: `Pago de comisiones a ${promoter.name}.`,
      });
    }
  }, [promoter, open, form]);

  const handleSubmit = (values: PaymentFormValues) => {
    if (promoter?.uid) {
      onConfirmPayment(promoter.uid, values.amount, values.notes);
    }
  };
  
  if (!promoter) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Pago a {promoter.name}</DialogTitle>
          <DialogDescription>
            El monto pendiente es de S/ {promoter.pendingAmount.toFixed(2)}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Monto a Pagar (S/)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} disabled={isSubmitting} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notas (Opcional)</FormLabel>
                <FormControl><Textarea placeholder="Ej: Pago por Yape..." {...field} disabled={isSubmitting} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
             <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
                <Button type="submit" variant="gradient" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CircleDollarSign className="mr-2 h-4 w-4"/>}
                  Confirmar Pago
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
