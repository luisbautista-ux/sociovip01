
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, CircleDollarSign, Ticket, Calendar } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useMemo } from "react";
import type { PromoterCommissionEntry } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type PaymentFormValues = { amount: number; notes?: string };

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promoter: { name: string; uid: string; pendingAmount: number } | null;
  allCommissions: PromoterCommissionEntry[]; // Recibimos todas las comisiones
  onConfirmPayment: (promoterUid: string, amount: number, notes: string | undefined, settledCommissionIds: string[]) => Promise<void>;
  isSubmitting: boolean;
}

export function PaymentDialog({ open, onOpenChange, promoter, allCommissions, onConfirmPayment, isSubmitting }: PaymentDialogProps) {
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

  const watchedAmount = form.watch('amount');

  useEffect(() => {
    if (promoter && open) {
      form.reset({
        amount: promoter.pendingAmount > 0 ? promoter.pendingAmount : 0,
        notes: `Pago de comisiones a ${promoter.name}.`,
      });
    }
  }, [promoter, open, form]);

  const { commissionsToSettle, totalToSettle, settledIds } = useMemo(() => {
    const pendingCommissions = allCommissions.filter(c => c.promoterId === promoter?.uid && c.commissionPending > 0).sort((a,b) => new Date(a.period).getTime() - new Date(b.period).getTime());
    
    let amountToSettle = watchedAmount || 0;
    const commissionsToSettle: PromoterCommissionEntry[] = [];
    const settledIds: string[] = [];
    let totalToSettle = 0;

    for (const comm of pendingCommissions) {
      if (amountToSettle >= comm.commissionPending) {
        commissionsToSettle.push(comm);
        settledIds.push(comm.id);
        amountToSettle -= comm.commissionPending;
        totalToSettle += comm.commissionPending;
      } else {
        // No se liquidan comisiones parciales por ahora para mantener la simplicidad.
        // Se podría añadir en el futuro si es necesario.
        break;
      }
    }
    return { commissionsToSettle, totalToSettle, settledIds };
  }, [watchedAmount, allCommissions, promoter?.uid]);


  const handleSubmit = (values: PaymentFormValues) => {
    if (promoter?.uid) {
      onConfirmPayment(promoter.uid, values.amount, values.notes, settledIds);
    }
  };
  
  if (!promoter) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Pago a {promoter.name}</DialogTitle>
          <DialogDescription>
            Total pendiente: S/ {promoter.pendingAmount.toFixed(2)}. Ingresa el monto a pagar para ver qué comisiones se liquidarán.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Monto a Pagar (S/)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} disabled={isSubmitting} autoFocus/></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            
            <div className="space-y-2">
              <Label>Comisiones que se liquidarán con este pago:</Label>
              <ScrollArea className="h-40 w-full rounded-md border p-2 bg-muted/50">
                  {commissionsToSettle.length > 0 ? (
                      <ul className="space-y-2">
                          {commissionsToSettle.map(comm => (
                              <li key={comm.id} className="text-sm p-2 rounded-md bg-background flex justify-between items-center">
                                  <div className="flex items-center">
                                      {comm.entityType === 'event' ? <Calendar size={14} className="mr-2"/> : <Ticket size={14} className="mr-2"/>}
                                      <span className="truncate max-w-[200px]" title={comm.entityName}>{comm.entityName}</span>
                                  </div>
                                  <Badge variant="secondary">S/ {comm.commissionPending.toFixed(2)}</Badge>
                              </li>
                          ))}
                      </ul>
                  ) : (
                      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                          {watchedAmount > 0 ? "El monto es insuficiente para cubrir la comisión más antigua." : "Ingresa un monto para ver las comisiones a liquidar."}
                      </div>
                  )}
              </ScrollArea>
              <div className="text-right font-bold">Total a liquidar: S/ {totalToSettle.toFixed(2)}</div>
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notas (Opcional)</FormLabel>
                <FormControl><Textarea placeholder="Ej: Pago por Yape..." {...field} disabled={isSubmitting} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
             <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
                <Button type="submit" variant="gradient" disabled={isSubmitting || totalToSettle <= 0}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CircleDollarSign className="mr-2 h-4 w-4"/>}
                  Confirmar Pago de S/ {Number(form.getValues('amount') || 0).toFixed(2)}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
