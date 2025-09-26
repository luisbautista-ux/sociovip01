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
import { useEffect, useMemo, useState } from "react";
import type { PromoterCommissionEntry } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

type PaymentFormValues = { notes?: string };

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promoter: { name: string; uid: string; pendingAmount: number } | null;
  allCommissions: PromoterCommissionEntry[];
  onConfirmPayment: (promoterUid: string, amount: number, notes: string | undefined, settledCommissionIds: string[]) => Promise<void>;
  isSubmitting: boolean;
}

export function PaymentDialog({ open, onOpenChange, promoter, allCommissions, onConfirmPayment, isSubmitting }: PaymentDialogProps) {
  const [selectedCommissionIds, setSelectedCommissionIds] = useState<Set<string>>(new Set());

  const form = useForm<PaymentFormValues>({
    defaultValues: { notes: "" }
  });

  const pendingCommissions = useMemo(() => {
    return allCommissions
      .filter(c => c.promoterId === promoter?.uid && c.commissionPending > 0)
      .sort((a,b) => new Date(a.period).getTime() - new Date(b.period).getTime());
  }, [allCommissions, promoter?.uid]);

  const totalToPay = useMemo(() => {
    return pendingCommissions
      .filter(comm => selectedCommissionIds.has(comm.id))
      .reduce((sum, comm) => sum + comm.commissionPending, 0);
  }, [selectedCommissionIds, pendingCommissions]);

  useEffect(() => {
    if (open && promoter) {
      setSelectedCommissionIds(new Set());
      form.reset({
        notes: `Pago de comisiones a ${promoter.name}.`
      });
    }
  }, [promoter, open, form]);

  const handleToggleCommission = (commissionId: string) => {
    setSelectedCommissionIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commissionId)) {
        newSet.delete(commissionId);
      } else {
        newSet.add(commissionId);
      }
      return newSet;
    });
  };

  const handleSubmit = (values: PaymentFormValues) => {
    if (promoter?.uid && totalToPay > 0) {
      onConfirmPayment(promoter.uid, totalToPay, values.notes, Array.from(selectedCommissionIds));
    }
  };
  
  if (!promoter) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Pago a {promoter.name}</DialogTitle>
          <DialogDescription>
            Total pendiente: S/ {promoter.pendingAmount.toFixed(2)}. Selecciona las comisiones que deseas liquidar.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            
            <div className="space-y-2">
              <Label>Comisiones Pendientes:</Label>
              <ScrollArea className="h-48 w-full rounded-md border p-2 bg-muted/50">
                  {pendingCommissions.length > 0 ? (
                      <div className="space-y-2">
                          {pendingCommissions.map(comm => (
                              <div
                                key={comm.id}
                                className="text-sm p-2 rounded-md bg-background flex items-center gap-3 cursor-pointer hover:bg-muted"
                                onClick={() => handleToggleCommission(comm.id)}
                              >
                                  <Checkbox
                                    checked={selectedCommissionIds.has(comm.id)}
                                    onCheckedChange={() => handleToggleCommission(comm.id)}
                                    aria-label={`Seleccionar comisión para ${comm.entityName}`}
                                  />
                                  <div className="flex-grow flex justify-between items-center">
                                    <div className="flex items-center truncate">
                                        {comm.entityType === 'event' ? <Calendar size={14} className="mr-2 text-muted-foreground"/> : <Ticket size={14} className="mr-2 text-muted-foreground"/>}
                                        <span className="truncate" title={comm.entityName}>{comm.entityName}</span>
                                    </div>
                                    <span className="font-semibold text-primary pl-2">
                                        S/ {comm.commissionPending.toFixed(2)}
                                    </span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                          No hay comisiones pendientes.
                      </div>
                  )}
              </ScrollArea>
            </div>
            
            <div>
              <Label>Monto Total a Pagar (S/)</Label>
              <Input type="number" value={totalToPay.toFixed(2)} readOnly disabled className="font-bold text-lg h-12 bg-muted/70"/>
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
                <Button type="submit" variant="gradient" disabled={isSubmitting || totalToPay <= 0}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CircleDollarSign className="mr-2 h-4 w-4"/>}
                  Confirmar Pago de S/ {totalToPay.toFixed(2)}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
