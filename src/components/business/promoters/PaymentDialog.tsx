
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, CircleDollarSign, Ticket, Calendar } from "lucide-react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";
import { useEffect, useMemo } from "react";
import type { PromoterCommissionEntry } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

const paymentFormSchema = z.object({
    notes: z.string().optional(),
    commissions: z.array(z.object({
        id: z.string(),
        selected: z.boolean(),
        amount: z.number(),
        name: z.string(),
        type: z.string(),
    })).optional(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;


interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promoter: { name: string; uid: string; pendingAmount: number } | null;
  allCommissions: PromoterCommissionEntry[];
  onConfirmPayment: (promoterUid: string, amount: number, notes: string | undefined, settledCommissionIds: string[]) => Promise<void>;
  isSubmitting: boolean;
}

export function PaymentDialog({ open, onOpenChange, promoter, allCommissions, onConfirmPayment, isSubmitting }: PaymentDialogProps) {
  
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { notes: "", commissions: [] },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "commissions",
  });

  const watchedCommissions = useWatch({
    control: form.control,
    name: "commissions",
  });

  const totalToPay = useMemo(() => {
    return (watchedCommissions ?? [])
      .filter(comm => comm.selected)
      .reduce((sum, comm) => sum + comm.amount, 0);
  }, [watchedCommissions]);


  useEffect(() => {
    if (open && promoter?.uid) {
      const pendingCommissions = allCommissions
        .filter(c => c.promoterId === promoter.uid && c.commissionPending > 0)
        .sort((a,b) => new Date(a.period).getTime() - new Date(b.period).getTime())
        .map(c => ({
          id: c.id,
          selected: false,
          amount: c.commissionPending,
          name: c.entityName,
          type: c.entityType
        }));
      
      replace(pendingCommissions);
      form.reset({ 
          notes: `Pago de comisiones para ${promoter.name}.`,
          commissions: pendingCommissions,
      });

    } else if (!open) {
      replace([]);
      form.reset({ notes: "", commissions: [] });
    }
  }, [open, promoter, allCommissions, form, replace]);


  const handleSubmit = (values: PaymentFormValues) => {
    if (promoter?.uid && totalToPay > 0) {
      const selectedIds = (values.commissions || [])
        .filter(c => c.selected)
        .map(c => c.id);
      onConfirmPayment(promoter.uid, totalToPay, values.notes, selectedIds);
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
                  {fields.length > 0 ? (
                      <div className="space-y-2">
                          {fields.map((field, index) => (
                              <FormField
                                  key={field.id}
                                  control={form.control}
                                  name={`commissions.${index}.selected`}
                                  render={({ field: checkboxField }) => (
                                    <FormItem
                                      className="text-sm p-2 rounded-md bg-background flex items-center gap-3 cursor-pointer hover:bg-muted"
                                      onClick={() => checkboxField.onChange(!checkboxField.value)}
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={checkboxField.value}
                                          onCheckedChange={checkboxField.onChange}
                                          aria-label={`Seleccionar comisión para ${watchedCommissions?.[index]?.name}`}
                                        />
                                      </FormControl>
                                      <div className="flex-grow flex justify-between items-center">
                                        <div className="flex items-center truncate">
                                          {watchedCommissions?.[index]?.type === 'event' ? <Calendar size={14} className="mr-2 text-muted-foreground"/> : <Ticket size={14} className="mr-2 text-muted-foreground"/>}
                                          <span className="truncate" title={watchedCommissions?.[index]?.name}>
                                            {watchedCommissions?.[index]?.name}
                                          </span>
                                        </div>
                                        <span className="font-semibold text-primary pl-2">
                                          S/ {watchedCommissions?.[index]?.amount.toFixed(2)}
                                        </span>
                                      </div>
                                    </FormItem>
                                  )}
                                />
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
