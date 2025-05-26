
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import type { BusinessManagedEntity, GeneratedCode } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PlusCircle, Trash2, AlertTriangle, ClipboardList, ClipboardCopy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";


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
  const [numCodesToGenerate, setNumCodesToGenerate] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    if (entity?.generatedCodes) {
      setCodes([...entity.generatedCodes]);
    } else {
      setCodes([]);
    }
    setNumCodesToGenerate(1); // Reset on entity change
  }, [entity]);

  const handleGenerateMultipleCodes = () => {
    if (numCodesToGenerate < 1 || numCodesToGenerate > 30) {
      toast({
        title: "Cantidad Inválida",
        description: "Por favor, ingresa un número entre 1 y 30.",
        variant: "destructive",
      });
      return;
    }

    const newCodes: GeneratedCode[] = [];
    for (let i = 0; i < numCodesToGenerate; i++) {
      let newCodeValue = generateAlphanumericCode(9);
      // Ensure uniqueness within the current batch and existing codes for this entity
      while (codes.some(c => c.value === newCodeValue) || newCodes.some(nc => nc.value === newCodeValue)) {
        newCodeValue = generateAlphanumericCode(9);
      }
      newCodes.push({
        id: `code-${entity.id}-${Date.now()}-${i}`,
        entityId: entity.id,
        value: newCodeValue,
        status: "available",
        generatedByName: "Admin Negocio (Mock)", // Placeholder
        generatedDate: new Date().toISOString(),
        observation: undefined, // Observation is not set during bulk generation
      });
    }
    
    const updatedCodes = [...codes, ...newCodes];
    setCodes(updatedCodes);
    onCodesUpdated(entity.id, updatedCodes);
    toast({ title: `${newCodes.length} Código(s) Generado(s)`, description: `Se han generado ${newCodes.length} nuevos códigos.` });
    setNumCodesToGenerate(1); // Reset after generation
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

  const handleCopyCodes = async () => {
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
      <DialogContent className="sm:max-w-4xl"> {/* Increased width for more columns */}
        <DialogHeader>
          <DialogTitle>Gestionar Códigos para: {entity.name}</DialogTitle>
          <DialogDescription>
            Visualiza y genera nuevos códigos para esta {entity.type === 'promotion' ? 'promoción' : 'evento'}.
            {entity.type === 'event' && ' Los códigos canjeados/utilizados cuentan para el aforo.'}
            {entity.type === 'promotion' && ' Los códigos canjeados cuentan para el límite de canjes.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="my-4 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-grow sm:flex-grow-0">
            <Label htmlFor="numCodes" className="text-sm font-medium">Cantidad a Generar (1-30)</Label>
            <Input
              id="numCodes"
              type="number"
              min="1"
              max="30"
              value={numCodesToGenerate}
              onChange={(e) => setNumCodesToGenerate(parseInt(e.target.value, 10) || 1)}
              className="mt-1 w-full sm:w-32"
            />
          </div>
          <Button onClick={handleGenerateMultipleCodes} className="sm:self-end">
            <PlusCircle className="mr-2 h-4 w-4" /> Generar Códigos
          </Button>
          <Button onClick={handleCopyCodes} variant="outline" className="sm:self-end" disabled={!codes.some(c => c.status === 'available')}>
            <ClipboardCopy className="mr-2 h-4 w-4" /> Copiar Disponibles
          </Button>
        </div>

        {codes.length > 0 ? (
          <div className="max-h-[50vh] overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Código</TableHead>
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
                    <TableCell className="font-mono">{code.value}</TableCell>
                    <TableCell>{code.generatedByName}</TableCell>
                    <TableCell>
                        <Badge variant={statusColors[code.status]}>{statusTranslations[code.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{code.observation || "N/A"}</TableCell>
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
            <p className="text-sm">Ingresa una cantidad y haz clic en "Generar Códigos" para empezar.</p>
          </div>
        )}
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
