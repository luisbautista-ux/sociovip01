
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import type { BusinessManagedEntity, GeneratedCode } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PlusCircle, Trash2, AlertTriangle, ClipboardList } from "lucide-react"; // Added ClipboardList
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


function generateAlphanumericCode(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

const statusTranslations: Record<GeneratedCode['status'], string> = {
  available: "Disponible",
  redeemed: "Canjeado/Utilizado",
  expired: "Vencido",
};

const statusColors: Record<GeneratedCode['status'], "default" | "secondary" | "destructive" | "outline"> = {
    available: "default",
    redeemed: "secondary",
    expired: "destructive",
};


interface ManageCodesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: BusinessManagedEntity;
  onCodesUpdated: (entityId: string, updatedCodes: GeneratedCode[]) => void;
}

export function ManageCodesDialog({ open, onOpenChange, entity, onCodesUpdated }: ManageCodesDialogProps) {
  const [codes, setCodes] = useState<GeneratedCode[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (entity?.generatedCodes) {
      setCodes([...entity.generatedCodes]);
    } else {
      setCodes([]);
    }
  }, [entity]);

  const handleGenerateNewCode = () => {
    const newCodeValue = generateAlphanumericCode(9);
    // Check if code already exists for this entity (highly unlikely for random 9-digit, but good practice)
    if (codes.some(c => c.value === newCodeValue)) {
        toast({ title: "Error", description: "Código duplicado generado, intenta de nuevo.", variant: "destructive"});
        return;
    }
    const newCode: GeneratedCode = {
      id: `code-${entity.id}-${Date.now()}`,
      entityId: entity.id,
      value: newCodeValue,
      status: "available",
      generatedByName: "Admin Negocio (Mock)", // Placeholder
      generatedDate: new Date().toISOString(),
    };
    const updatedCodes = [...codes, newCode];
    setCodes(updatedCodes);
    onCodesUpdated(entity.id, updatedCodes); // Inform parent component
    toast({ title: "Código Generado", description: `Nuevo código: ${newCodeValue}` });
  };
  
  const handleDeleteCode = (codeId: string) => {
    const codeToDelete = codes.find(c => c.id === codeId);
    if (codeToDelete && codeToDelete.status === 'redeemed') {
        toast({
            title: "Acción no permitida",
            description: "No se pueden eliminar códigos que ya han sido canjeados/utilizados.",
            variant: "destructive"
        });
        return;
    }
    const updatedCodes = codes.filter(c => c.id !== codeId);
    setCodes(updatedCodes);
    onCodesUpdated(entity.id, updatedCodes);
    toast({ title: "Código Eliminado", description: "El código ha sido eliminado.", variant: "destructive" });
  };


  if (!entity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Gestionar Códigos para: {entity.name}</DialogTitle>
          <DialogDescription>
            Visualiza y genera nuevos códigos para esta {entity.type === 'promotion' ? 'promoción' : 'evento'}.
            {entity.type === 'event' && ' Los códigos canjeados/utilizados cuentan para el aforo.'}
            {entity.type === 'promotion' && ' Los códigos canjeados cuentan para el límite de canjes.'}
          </DialogDescription>
        </DialogHeader>
        <div className="my-4">
          <Button onClick={handleGenerateNewCode}>
            <PlusCircle className="mr-2 h-4 w-4" /> Generar Nuevo Código
          </Button>
        </div>
        {codes.length > 0 ? (
          <div className="max-h-[50vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Creado Por</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead>Fecha Canje</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono">{code.value}</TableCell>
                    <TableCell>{code.generatedByName}</TableCell>
                    <TableCell>
                        <Badge variant={statusColors[code.status]}>{statusTranslations[code.status]}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(code.generatedDate), "Pp", { locale: es })}</TableCell>
                    <TableCell>
                      {code.redemptionDate ? format(new Date(code.redemptionDate), "Pp", { locale: es }) : "N/A"}
                    </TableCell>
                    <TableCell className="text-right">
                        {code.status !== 'redeemed' && (
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Eliminar Código</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    Esta acción no se puede deshacer. Esto eliminará permanentemente el código 
                                    <span className="font-semibold font-mono"> {code.value}</span>.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                    onClick={() => handleDeleteCode(code.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                    >
                                    Eliminar
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border border-dashed rounded-md">
            <ClipboardList className="h-12 w-12 mb-2"/>
            <p>No hay códigos generados para esta entidad aún.</p>
            <p className="text-sm">Haz clic en "Generar Nuevo Código" para empezar.</p>
          </div>
        )}
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
