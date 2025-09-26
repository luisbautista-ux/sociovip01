"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Calendar, Ticket } from "lucide-react";
import type { PromoterCommissionEntry } from "@/lib/types";

interface CommissionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promoterName: string;
  commissionEntries: PromoterCommissionEntry[];
}

export function CommissionDetailsDialog({ open, onOpenChange, promoterName, commissionEntries }: CommissionDetailsDialogProps) {
  const totalPending = commissionEntries.reduce((sum, c) => sum + c.commissionPending, 0);
  const totalPaid = commissionEntries.reduce((sum, c) => sum + c.commissionPaid, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalle de Comisiones para: {promoterName}</DialogTitle>
          <DialogDescription>
            Desglose de comisiones generadas por cada campaña.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Campaña</TableHead>
                        <TableHead className="text-center">QRs Validados</TableHead>
                        <TableHead className="text-center">Tarifa Comisión</TableHead>
                        <TableHead className="text-right">Monto Pendiente</TableHead>
                        <TableHead className="text-right">Monto Pagado</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {commissionEntries.length > 0 ? (
                        commissionEntries.map((comm) => (
                            <TableRow key={comm.id}>
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
                        ))
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
        <div className="text-lg font-bold text-right pr-4 pt-2">
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
