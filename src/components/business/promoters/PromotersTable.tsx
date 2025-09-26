
"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { HandCoins, Edit, Trash2, Calendar, Ticket, ShieldCheck, ShieldX } from "lucide-react";
import type { BusinessPromoterLink, PromoterCommissionEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PromotersTableProps {
  commissions: PromoterCommissionEntry[];
  links: BusinessPromoterLink[];
  onToggleStatus: (link: BusinessPromoterLink) => void;
  onRegisterPayment: (promoter: { uid: string, name: string, pendingAmount: number }) => void;
  onEditLink: (link: BusinessPromoterLink) => void;
  onDeleteLink: (link: BusinessPromoterLink) => void;
  isSubmitting: boolean;
}

export function PromotersTable({ commissions, links, onToggleStatus, onRegisterPayment, onEditLink, onDeleteLink, isSubmitting }: PromotersTableProps) {
  if (commissions.length === 0) {
    return (
        <div className="hidden md:block text-center h-24 md:flex md:items-center md:justify-center">
            <p>No se encontraron comisiones para los filtros aplicados.</p>
        </div>
    );
  }
  
  return (
    <div className="hidden md:block overflow-x-auto">
      <Table>
          <TableHeader>
              <TableRow>
                  <TableHead>Promotor</TableHead>
                  <TableHead>Campaña</TableHead>
                  <TableHead className="text-center">QRs Validados</TableHead>
                  <TableHead className="text-center">Tarifa Comisión</TableHead>
                  <TableHead className="text-right">Monto Pendiente</TableHead>
                  <TableHead className="text-right">Monto Pagado</TableHead>
                  <TableHead className="text-center">Estado de Vínculo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
          </TableHeader>
          <TableBody>
              {commissions.map((comm) => {
                  const link = links.find(l => l.platformUserUid === comm.promoterId);
                  return (
                  <TableRow key={comm.id}>
                      <TableCell className="font-medium">{comm.promoterName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground flex items-center">
                          {comm.entityType === 'event' ? <Calendar size={14} className="mr-2"/> : <Ticket size={14} className="mr-2"/>}
                          {comm.entityName}
                      </TableCell>
                      <TableCell className="text-center font-semibold">{comm.promoterCodesRedeemed}</TableCell>
                      <TableCell className="text-center">{comm.commissionRateApplied}</TableCell>
                      <TableCell className="text-right font-semibold text-destructive">
                        S/ {comm.commissionPending.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">S/ {comm.commissionPaid.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                          {link && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => onToggleStatus(link)}
                                className={cn("text-xs px-2 py-1 h-auto", link.isActive ? "text-green-600 hover:text-green-700" : "text-red-600 hover:text-red-700")}
                                disabled={isSubmitting}
                              >
                                {link.isActive ? <ShieldCheck className="mr-1 h-4 w-4"/> : <ShieldX className="mr-1 h-4 w-4"/>}
                                {link.isActive ? "Activo" : "Inactivo"}
                              </Button>
                          )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                          {link && (
                              <>
                              <Button variant="outline" size="xs" className="h-auto py-1 px-2 text-xs" 
                                  onClick={() => onRegisterPayment({ uid: comm.promoterId, name: comm.promoterName, pendingAmount: comm.commissionPending })}
                                  disabled={isSubmitting || comm.commissionPending <= 0}
                              >
                                  <HandCoins className="mr-1 h-3 w-3" /> Pagar
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => onEditLink(link)} disabled={isSubmitting}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>¿Seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción desvinculará al promotor <span className="font-semibold">{link.promoterName}</span>.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDeleteLink(link)} className="bg-destructive hover:bg-destructive/90">Desvincular</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              </>
                          )}
                      </TableCell>
                  </TableRow>
              )})}
          </TableBody>
      </Table>
    </div>
  );
}
