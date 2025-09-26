
"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Ticket, Loader2, Info, History } from "lucide-react";
import type { PromoterCommissionEntry, PromoterPayment } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CommissionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promoterName: string;
  promoterUid: string;
  commissionEntries: PromoterCommissionEntry[];
}

export function CommissionDetailsDialog({ open, onOpenChange, promoterName, promoterUid, commissionEntries }: CommissionDetailsDialogProps) {
  const { currentUser } = useAuth();
  const [payments, setPayments] = useState<PromoterPayment[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPayments = async () => {
      if (!open || !currentUser || !promoterUid) return;
      setIsLoadingPayments(true);
      try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch(`/api/business-panel/get-payment-details?promoterUid=${promoterUid}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) throw new Error("Failed to fetch payments");
        const data = await response.json();
        setPayments(data);
      } catch (error) {
        console.error("Error fetching payment history:", error);
      } finally {
        setIsLoadingPayments(false);
      }
    };
    fetchPayments();
  }, [open, currentUser, promoterUid]);

  const totalPending = commissionEntries.reduce((sum, c) => sum + c.commissionPending, 0);
  const totalPaid = commissionEntries.reduce((sum, c) => sum + c.commissionPaid, 0);
  
  const selectedPayment = payments.find(p => p.id === selectedPaymentId);
  const settledCodeIdsInSelectedPayment = useMemo(() => new Set(selectedPayment?.settledCodeIds || []), [selectedPayment]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Detalle de Comisiones para: {promoterName}</DialogTitle>
          <DialogDescription>
            Desglose de comisiones generadas y pagos realizados. Haz clic en un pago para ver las comisiones que saldó.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow overflow-hidden">
            <div className="md:col-span-2 flex flex-col overflow-hidden">
                <h3 className="text-lg font-semibold mb-2 px-1">Comisiones Generadas</h3>
                <ScrollArea className="flex-grow border rounded-md">
                    {/* Mobile View for Commissions */}
                    <div className="md:hidden p-2 space-y-2">
                        {commissionEntries.length > 0 ? commissionEntries.map(comm => {
                             const isHighlighted = selectedPaymentId && comm.paymentId === selectedPaymentId;
                             return(
                                <Card key={comm.id} className={cn(isHighlighted && "bg-primary/10 ring-2 ring-primary")}>
                                    <CardHeader className="p-3">
                                        <CardTitle className="text-sm">{comm.entityName}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3 text-xs grid grid-cols-2 gap-1">
                                        <div>QRs Validados:</div><div className="text-right font-semibold">{comm.promoterCodesRedeemed}</div>
                                        <div>Tarifa:</div><div className="text-right font-semibold">{comm.commissionRateApplied}</div>
                                        <div>Pendiente:</div><div className="text-right font-semibold text-destructive">S/ {comm.commissionPending.toFixed(2)}</div>
                                        <div>Pagado:</div><div className="text-right font-semibold text-green-600">S/ {comm.commissionPaid.toFixed(2)}</div>
                                    </CardContent>
                                </Card>
                             )
                        }) : <p className="text-center text-sm text-muted-foreground p-4">No hay comisiones.</p>}
                    </div>
                    {/* Desktop View for Commissions */}
                    <Table className="hidden md:table">
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                                <TableHead>Campaña</TableHead>
                                <TableHead className="text-center">QRs Validados</TableHead>
                                <TableHead className="text-center">Tarifa</TableHead>
                                <TableHead className="text-right">Pendiente</TableHead>
                                <TableHead className="text-right">Pagado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {commissionEntries.length > 0 ? (
                                commissionEntries.map((comm) => {
                                    const isHighlighted = selectedPaymentId && comm.paymentId === selectedPaymentId;
                                    return(
                                    <TableRow 
                                        key={comm.id} 
                                        className={cn(isHighlighted && "bg-primary/10", "transition-colors duration-300")}
                                    >
                                        <TableCell className="font-medium">
                                            <div className="flex items-center">
                                                {comm.entityType === 'event' ? <Calendar size={14} className="mr-2 text-muted-foreground"/> : <Ticket size={14} className="mr-2 text-muted-foreground"/>}
                                                {comm.entityName}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">{comm.promoterCodesRedeemed}</TableCell>
                                        <TableCell className="text-center">{comm.commissionRateApplied}</TableCell>
                                        <TableCell className="text-right font-semibold text-destructive">
                                            S/ {comm.commissionPending.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold text-green-600">
                                            S/ {comm.commissionPaid.toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                )})
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No hay datos de comisión para este promotor.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
            
            <div className="flex flex-col overflow-hidden">
                <h3 className="text-lg font-semibold mb-2 flex items-center"><History className="mr-2 h-5 w-5"/>Historial de Pagos</h3>
                 <ScrollArea className="flex-grow border rounded-md p-2 space-y-2">
                    {isLoadingPayments ? (
                        <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin"/></div>
                    ) : payments.length > 0 ? (
                        payments.map(payment => (
                            <Card 
                                key={payment.id} 
                                className={cn("cursor-pointer hover:bg-muted/50", selectedPaymentId === payment.id && "bg-primary/10 ring-2 ring-primary")}
                                onClick={() => setSelectedPaymentId(prev => prev === payment.id ? null : payment.id)}
                            >
                                <CardContent className="p-3">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-lg text-green-600">S/ {payment.amountPaid.toFixed(2)}</span>
                                        <span className="text-xs text-muted-foreground">{format(new Date(payment.paymentDate as string), "dd MMM yyyy, HH:mm", {locale: es})}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground italic truncate">{payment.notes || "Sin notas"}</p>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
                            <Info className="h-8 w-8 mb-2"/>
                            <p>No se han registrado pagos para este promotor.</p>
                        </div>
                    )}
                 </ScrollArea>
            </div>
        </div>

        <div className="text-lg font-bold text-right pr-4 pt-4 border-t">
            <p>Total Pendiente: <span className="text-destructive">S/ {totalPending.toFixed(2)}</span></p>
            <p>Total Pagado: <span className="text-green-600">S/ {totalPaid.toFixed(2)}</span></p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
