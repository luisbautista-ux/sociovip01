
"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { HandCoins, Edit, Trash2, ShieldCheck, ShieldX, ListChecks } from "lucide-react";
import type { BusinessPromoterLinkWithCommissions } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PromotersTableProps {
  promoters: BusinessPromoterLinkWithCommissions[];
  onToggleStatus: (link: BusinessPromoterLinkWithCommissions) => void;
  onRegisterPayment: (promoter: { uid: string, name: string, pendingAmount: number }) => void;
  onViewDetails: (promoter: BusinessPromoterLinkWithCommissions) => void;
  onEditLink: (link: BusinessPromoterLinkWithCommissions) => void;
  onDeleteLink: (link: BusinessPromoterLinkWithCommissions) => void;
  isSubmitting: boolean;
}

export function PromotersTable({ promoters, onToggleStatus, onRegisterPayment, onViewDetails, onEditLink, onDeleteLink, isSubmitting }: PromotersTableProps) {
  if (promoters.length === 0) {
    return (
        <div className="hidden md:block text-center h-24 md:flex md:items-center md:justify-center">
            <p>No se encontraron promotores con los filtros aplicados.</p>
        </div>
    );
  }
  
  return (
    <div className="hidden md:block overflow-x-auto">
      <Table>
          <TableHeader>
              <TableRow>
                  <TableHead>Promotor</TableHead>
                  <TableHead className="text-right">Comisión Pendiente</TableHead>
                  <TableHead className="text-right">Comisión Pagada</TableHead>
                  <TableHead className="text-center">Estado de Vínculo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
          </TableHeader>
          <TableBody>
              {promoters.map((promoter) => {
                  return (
                  <TableRow key={promoter.id}>
                      <TableCell className="font-medium">
                        <div>{promoter.promoterName}</div>
                        <div className="text-xs text-muted-foreground">{promoter.promoterDni}</div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-destructive">
                        S/ {promoter.pendingAmount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        S/ {promoter.paidAmount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => onToggleStatus(promoter)}
                            className={cn("text-xs px-2 py-1 h-auto", promoter.isActive ? "text-green-600 hover:text-green-700" : "text-red-600 hover:text-red-700")}
                            disabled={isSubmitting}
                          >
                            {promoter.isActive ? <ShieldCheck className="mr-1 h-4 w-4"/> : <ShieldX className="mr-1 h-4 w-4"/>}
                            {promoter.isActive ? "Activo" : "Inactivo"}
                          </Button>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                          <>
                          <Button variant="outline" size="xs" className="h-auto py-1 px-2 text-xs" onClick={() => onViewDetails(promoter)} disabled={isSubmitting}>
                              <ListChecks className="mr-1 h-3 w-3" /> Detalles
                          </Button>
                          <Button variant="outline" size="xs" className="h-auto py-1 px-2 text-xs" 
                              onClick={() => onRegisterPayment({ uid: promoter.platformUserUid!, name: promoter.promoterName, pendingAmount: promoter.pendingAmount })}
                              disabled={isSubmitting || promoter.pendingAmount <= 0}
                          >
                              <HandCoins className="mr-1 h-3 w-3" /> Pagar
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onEditLink(promoter)} disabled={isSubmitting}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>¿Seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción desvinculará al promotor <span className="font-semibold">{promoter.promoterName}</span>.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDeleteLink(promoter)} className="bg-destructive hover:bg-destructive/90">Desvincular</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          </>
                      </TableCell>
                  </TableRow>
              )})}
          </TableBody>
      </Table>
    </div>
  );
}
