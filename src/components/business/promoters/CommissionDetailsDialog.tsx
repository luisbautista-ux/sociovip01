
"use client";

import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Ticket } from "lucide-react";
import type { PromoterCommissionEntry } from "@/lib/types";

interface CommissionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promoterName: string;
  promoterUid: string;
  commissionEntries: PromoterCommissionEntry[];
}

export function CommissionDetailsDialog({ open, onOpenChange, promoterName, promoterUid, commissionEntries }: CommissionDetailsDialogProps) {

  const { totalPending, totalPaid } = useMemo(() => {
      const pending = commissionEntries.reduce((sum, c) => sum + c.commissionPending, 0);
      const paid = commissionEntries.reduce((sum, c) => sum + c.commissionPaid, 0);
      return { totalPending: pending, totalPaid: paid };
  }, [commissionEntries]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Detalle de comisiones para: {promoterName}</DialogTitle>
          <DialogDescription>
            Desglose de comisiones generadas y estado de pago por cada campaña.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-grow overflow-hidden">
            <ScrollArea className="h-full">
                {/* Mobile View for Commissions */}
                <div className="md:hidden p-2 space-y-2">
                    {commissionEntries.length > 0 ? commissionEntries.map(comm => {
                         return(
                            <Card key={comm.id}>
                                <CardHeader className="p-3">
                                    <CardTitle className="text-sm flex items-center">
                                        {comm.entityType === 'event' ? <Calendar size={14} className="mr-2"/> : <Ticket size={14} className="mr-2"/>}
                                        {comm.entityName}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 text-xs grid grid-cols-2 gap-1">
                                    <div>QRs Validados:</div><div className="text-right font-semibold">{comm.promoterCodesRedeemed}</div>
                                    <div>Tarifa:</div><div className="text-right font-semibold">{comm.commissionRateApplied || 'S/ 0.00'}</div>
                                    <div>Pendiente:</div><div className="text-right font-semibold text-destructive">S/ {comm.commissionPending.toFixed(2)}</div>
                                    <div>Pagado:</div><div className="text-right font-semibold text-green-600">S/ {comm.commissionPaid.toFixed(2)}</div>
                                </CardContent>
                            </Card>
                         )
                    }) : <p className="text-center text-sm text-muted-foreground p-4">No hay comisiones.</p>}
                </div>
                {/* Desktop View for Commissions */}
                <div className="hidden md:block">
                  <Table>
                      <TableHeader>
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
                                  return(
                                  <TableRow key={comm.id}>
                                      <TableCell className="font-medium">
                                          <div className="flex items-center">
                                              {comm.entityType === 'event' ? <Calendar size={14} className="mr-2 text-muted-foreground"/> : <Ticket size={14} className="mr-2 text-muted-foreground"/>}
                                              {comm.entityName}
                                          </div>
                                      </TableCell>
                                      <TableCell className="text-center">{comm.promoterCodesRedeemed}</TableCell>
                                      <TableCell className="text-center">{comm.commissionRateApplied || 'S/ 0.00'}</TableCell>
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
                </div>
            </ScrollArea>
        </div>

        <div className="text-lg font-bold text-right pr-4 pt-4 border-t mt-auto">
            <p>Total Pendiente: <span className="text-destructive">S/ {totalPending.toFixed(2)}</span></p>
            <p>Total Pagado: <span className="text-green-600">S/ {totalPaid.toFixed(2)}</span></p>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
