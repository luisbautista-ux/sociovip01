

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MoreVertical, HandCoins, Edit, Trash2, ShieldCheck, ShieldX, ListChecks } from "lucide-react";
import type { BusinessPromoterLinkWithCommissions } from "@/lib/types";

interface PromoterMobileCardsProps {
  promoters: BusinessPromoterLinkWithCommissions[];
  onToggleStatus: (link: BusinessPromoterLinkWithCommissions) => void;
  onViewDetails: (promoter: BusinessPromoterLinkWithCommissions) => void;
  onEditLink: (link: BusinessPromoterLinkWithCommissions) => void;
  onDeleteLink: (link: BusinessPromoterLinkWithCommissions) => void;
  onOpenPaymentDialog: (promoter: { uid: string, name: string, pendingAmount: number }) => void; // New prop
  isSubmitting: boolean;
}

export function PromoterMobileCards({ promoters, onToggleStatus, onViewDetails, onEditLink, onDeleteLink, onOpenPaymentDialog, isSubmitting }: PromoterMobileCardsProps) {
  if (promoters.length === 0) {
    return (
      <div className="md:hidden text-center h-24 flex items-center justify-center">
        <p>No se encontraron promotores.</p>
      </div>
    );
  }

  return (
    <div className="md:hidden space-y-4">
      {promoters.map((promoter) => {
        return (
          <Card key={promoter.id} className="overflow-hidden">
            <CardHeader className="p-4">
              <CardTitle className="text-lg">{promoter.promoterName}</CardTitle>
              <CardDescription className="text-xs">{promoter.promoterEmail}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="font-semibold text-muted-foreground">Estado Vínculo</div>
              <div className="text-right">
                <Badge variant={promoter.isActive ? "default" : "destructive"} className={promoter.isActive ? "bg-green-500" : ""}>
                    {promoter.isActive ? "Activo" : "Inactivo"}
                </Badge>
              </div>
              <div className="font-semibold text-muted-foreground">Comisión Pendiente</div>
              <div className="text-right font-bold text-destructive">S/ {promoter.pendingAmount.toFixed(2)}</div>
              <div className="font-semibold text-muted-foreground">Comisión Pagada</div>
              <div className="text-right font-semibold text-green-600">S/ {promoter.paidAmount.toFixed(2)}</div>
            </CardContent>
            <CardFooter className="p-2 bg-muted/50 justify-center">
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white px-3 h-8">
                        Acciones
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem 
                      onClick={() => onOpenPaymentDialog({ uid: promoter.platformUserUid!, name: promoter.promoterName, pendingAmount: promoter.pendingAmount })}
                      disabled={promoter.pendingAmount <= 0 || isSubmitting}
                    >
                        <HandCoins className="mr-2 h-4 w-4"/> Registrar Pago
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onViewDetails(promoter)} disabled={isSubmitting}><ListChecks className="mr-2 h-4 w-4"/>Ver Detalles de Comisión</DropdownMenuItem>
                    <DropdownMenuSeparator/>
                    <DropdownMenuItem onClick={() => onEditLink(promoter)}><Edit className="mr-2 h-4 w-4"/>Editar Vínculo</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggleStatus(promoter)}>{promoter.isActive ? <ShieldX className="mr-2 h-4 w-4 text-destructive" /> : <ShieldCheck className="mr-2 h-4 w-4 text-green-600" />} {promoter.isActive ? 'Desactivar Vínculo' : 'Activar Vínculo'}</DropdownMenuItem>
                    <DropdownMenuSeparator/>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4"/>Desvincular</DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Confirmar?</AlertDialogTitle><AlertDialogDescription>Se desvinculará a {promoter.promoterName} de tu negocio.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => onDeleteLink(promoter)} className="bg-destructive hover:bg-destructive/90">Desvincular</AlertDialogAction></AlertDialogFooter>
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
