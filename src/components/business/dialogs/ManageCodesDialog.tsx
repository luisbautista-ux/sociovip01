
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import type { BusinessManagedEntity, GeneratedCode } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PlusCircle, Trash2, ClipboardList, ClipboardCopy, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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
  onRequestCreateNewCodes: () => void; // Callback to signal parent to open CreateCodesDialog
}

export function ManageCodesDialog({ 
    open, 
    onOpenChange, 
    entity, 
    onCodesUpdated,
    onRequestCreateNewCodes 
}: ManageCodesDialogProps) {
  const [codes, setCodes] = useState<GeneratedCode[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (entity?.generatedCodes) {
      setCodes([...entity.generatedCodes]);
    } else {
      setCodes([]);
    }
  }, [entity, open]); // Re-sync codes when entity changes or dialog re-opens

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
    onCodesUpdated(entity.id, updatedCodes); // Propagate change to parent
    toast({ title: "Código Eliminado", description: "El código ha sido eliminado.", variant: "destructive" });
  };

  const handleCopyIndividualCode = async (codeValue: string) => {
    try {
      await navigator.clipboard.writeText(codeValue);
      toast({ title: "Código Copiado", description: `El código ${codeValue} ha sido copiado.` });
    } catch (err) {
      toast({ title: "Error al Copiar", description: "No se pudo copiar el código.", variant: "destructive" });
    }
  };

  const handleCopyAllAvailableCodes = async () => {
    const availableCodes = codes.filter(c => c.status === 'available').map(c => c.value).join('\n');
    if (!availableCodes) {
      toast({ title: "Sin Códigos Disponibles", description: "No hay códigos disponibles para copiar.", variant: "default" });
      return;
    }
    try {
      await navigator.clipboard.writeText(availableCodes);
      toast({ title: "Códigos Copiados", description: "Los códigos disponibles han sido copiados al portapapeles." });
    } catch (err) {
      toast({ title: "Error al Copiar", description: "No se pudieron copiar los códigos.", variant: "destructive" });
      console.error("Failed to copy codes: ", err);
    }
  };


  if (!entity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Códigos para: {entity.name}</DialogTitle>
          <DialogDescription>
            Visualiza y gestiona los códigos existentes. Para generar nuevos códigos, usa el botón "Crear Nuevos Códigos".
          </DialogDescription>
        </DialogHeader>
        
        <div className="my-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
          <Button onClick={onRequestCreateNewCodes} variant="default" className="bg-primary hover:bg-primary/90">
            <PlusCircle className="mr-2 h-4 w-4" /> Crear Nuevos Códigos
          </Button>
          <Button 
            onClick={handleCopyAllAvailableCodes} 
            variant="outline" 
            disabled={!codes.some(c => c.status === 'available')}
          >
            <ClipboardCopy className="mr-2 h-4 w-4" /> Copiar Disponibles ({codes.filter(c => c.status === 'available').length})
          </Button>
        </div>

        {codes.length > 0 ? (
          <div className="max-h-[50vh] overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Código</TableHead>
                  <TableHead>Creado Por</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Observación</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead>Fecha Canje</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono flex items-center">
                      {code.value}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="ml-2 h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => handleCopyIndividualCode(code.value)}
                        title="Copiar código"
                      >
                        <ClipboardCopy className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                    <TableCell>{code.generatedByName}</TableCell>
                    <TableCell>
                        <Badge variant={statusColors[code.status]}>{statusTranslations[code.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate" title={code.observation}>{code.observation || "N/A"}</TableCell>
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
            <p className="text-sm">Usa el botón "Crear Nuevos Códigos" para empezar.</p>
          </div>
        )}
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
