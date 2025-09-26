
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MoreVertical, HandCoins, Edit, Trash2, Calendar, Ticket } from "lucide-react";
import type { BusinessPromoterLink, PromoterCommissionEntry } from "@/lib/types";

interface PromoterMobileCardsProps {
  commissions: PromoterCommissionEntry[];
  links: BusinessPromoterLink[];
  onToggleStatus: (link: BusinessPromoterLink) => void;
  onRegisterPayment: (promoter: { uid: string, name: string, pendingAmount: number }) => void;
  onEditLink: (link: BusinessPromoterLink) => void;
  onDeleteLink: (link: BusinessPromoterLink) => void;
  isSubmitting: boolean;
}

export function PromoterMobileCards({ commissions, links, onToggleStatus, onRegisterPayment, onEditLink, onDeleteLink, isSubmitting }: PromoterMobileCardsProps) {
  if (commissions.length === 0) {
    return (
      <div className="md:hidden text-center h-24 flex items-center justify-center">
        <p>No se encontraron comisiones.</p>
      </div>
    );
  }

  return (
    <div className="md:hidden space-y-4">
      {commissions.map((comm) => {
        const link = links.find(l => l.platformUserUid === comm.promoterId);
        return (
          <Card key={comm.id} className="overflow-hidden">
            <CardHeader className="p-4">
              <CardTitle className="text-lg">{comm.promoterName}</CardTitle>
              <CardDescription className="flex items-center text-sm">
                {comm.entityType === 'event' ? <Calendar size={14} className="mr-2"/> : <Ticket size={14} className="mr-2"/>}
                {comm.entityName}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="font-semibold text-muted-foreground">QRs Validados</div>
              <div className="text-right">{comm.promoterCodesRedeemed}</div>
              <div className="font-semibold text-muted-foreground">Tarifa</div>
              <div className="text-right">{comm.commissionRateApplied}</div>
              <div className="font-semibold text-muted-foreground">Pendiente</div>
              <div className="text-right font-bold text-destructive">S/ {comm.commissionPending.toFixed(2)}</div>
              <div className="font-semibold text-muted-foreground">Pagado</div>
              <div className="text-right font-semibold text-green-600">S/ {comm.commissionPaid.toFixed(2)}</div>
            </CardContent>
            <CardFooter className="p-2 bg-muted/50">
               <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" className="w-full">Acciones <MoreVertical className="ml-2 h-4 w-4"/></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => onRegisterPayment({ uid: comm.promoterId, name: comm.promoterName, pendingAmount: comm.commissionPending })} disabled={isSubmitting || comm.commissionPending <= 0}><HandCoins className="mr-2 h-4 w-4"/>Registrar Pago</DropdownMenuItem>
                    {link && <DropdownMenuItem onClick={() => onEditLink(link)}><Edit className="mr-2 h-4 w-4"/>Editar Vínculo</DropdownMenuItem>}
                    {link && <DropdownMenuItem onClick={() => onToggleStatus(link)}>{link.isActive ? 'Desactivar Vínculo' : 'Activar Vínculo'}</DropdownMenuItem>}
                    <DropdownMenuSeparator/>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10" disabled={!link}><Trash2 className="mr-2 h-4 w-4"/>Desvincular</DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Confirmar?</AlertDialogTitle><AlertDialogDescription>Se desvinculará a {link?.promoterName} de tu negocio.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => onDeleteLink(link!)} className="bg-destructive hover:bg-destructive/90">Desvincular</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </DropdownMenuContent>
               </DropdownMenu>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  );
}
