
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
import { useEffect, useMemo } from "react";
import type { PromoterCommissionEntry } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promoter: { name: string; uid: string; pendingAmount: number } | null;
  allCommissions: PromoterCommissionEntry[];
  onConfirmPayment: (promoterUid: string, entityId: string, amount: number, notes: string | undefined) => Promise<void>;
  isSubmitting: boolean;
}

export function PaymentDialog({ open, onOpenChange, promoter, allCommissions, onConfirmPayment, isSubmitting }: PaymentDialogProps) {
  
  const pendingCommissionsByEntity = useMemo(() => {
    if (!promoter) return [];
    const entityMap = new Map<string, { name: string; totalPending: number, minCommission: number }>();
    
    allCommissions.forEach(comm => {
      if (comm.promoterId === promoter.uid && comm.commissionPending > 0) {
        const current = entityMap.get(comm.entityId) || { name: comm.entityName, totalPending: 0, minCommission: Infinity };
        current.totalPending += comm.commissionPending;
        
        // Asumimos que commissionRateApplied es 'S/ 3.00' o similar
        const rateMatch = comm.commissionRateApplied.match(/S\/\s*([\d.]+)/);
        if (rateMatch && rateMatch[1]) {
            const rateValue = parseFloat(rateMatch[1]);
            if (rateValue > 0 && rateValue < current.minCommission) {
                current.minCommission = rateValue;
            }
        }

        entityMap.set(comm.entityId, current);
      }
    });

    return Array.from(entityMap.entries()).map(([id, data]) => ({ id, ...data }));
  }, [allCommissions, promoter]);

  const selectedEntityId = useForm<any>().watch("entityId");

  const paymentFormSchema = z.object({
      entityId: z.string().min(1, "Debes seleccionar una campaña."),
      amount: z.coerce.number()
        .positive("El monto debe ser mayor a cero.")
        .max(pendingCommissionsByEntity.find(e => e.id === selectedEntityId)?.totalPending || 0, "El monto no puede ser mayor a la deuda pendiente de esta campaña.")
        .min(pendingCommissionsByEntity.find(e => e.id === selectedEntityId)?.minCommission || 0.01, "El monto debe ser suficiente para cubrir al menos una comisión."),
      notes: z.string().optional(),
  });

  type PaymentFormValues = z.infer<typeof paymentFormSchema>;
  
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { entityId: "", notes: "", amount: 0 },
    mode: "onChange"
  });

  useEffect(() => {
    if (open && promoter) {
      form.reset({
        entityId: "",
        notes: `Pago de comisiones para ${promoter.name}.`,
        amount: 0,
      });
    }
  }, [open, promoter, form]);


  const handleSubmit = (values: PaymentFormValues) => {
    if (!promoter?.uid || !values.entityId || values.amount <= 0) return;
    onConfirmPayment(promoter.uid, values.entityId, values.amount, values.notes);
  };
  
  if (!promoter) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Pago a {promoter.name}</DialogTitle>
          <DialogDescription>
            Total pendiente de todas las campañas: S/ {promoter.pendingAmount.toFixed(2)}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            
            <FormField
              control={form.control}
              name="entityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pagar Comisión de <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={(value) => {
                      field.onChange(value);
                      const pending = pendingCommissionsByEntity.find(e => e.id === value)?.totalPending || 0;
                      form.setValue('amount', pending);
                      form.trigger('amount'); // Re-trigger validation for amount
                  }} value={field.value}>
                    <FormControl>
                      <SelectTrigger disabled={isSubmitting}>
                        <SelectValue placeholder="Selecciona una campaña/evento" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {pendingCommissionsByEntity.map(entity => (
                        <SelectItem key={entity.id} value={entity.id}>
                          {entity.name} (Pendiente: S/ {entity.totalPending.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto a Pagar (S/) <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      disabled={isSubmitting || !form.watch('entityId')}
                      className="font-semibold"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notas (Opcional)</FormLabel>
                <FormControl><Textarea placeholder="Ej: Pago por Yape, adelanto..." {...field} disabled={isSubmitting} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>

             <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
                <Button type="submit" variant="gradient" disabled={isSubmitting || !form.formState.isValid}>
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
