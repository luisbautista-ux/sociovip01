
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo } from "react";
import type { BusinessManagedEntity, GeneratedCode } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PlusCircle, Trash2, ClipboardList, ClipboardCopy, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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

interface ProcessedCodeItem {
  isBatch: boolean;
  id: string; // Unique ID for React key: could be batchId or code.id
  batchId?: string; // For AccordionItem value if it's a batch
  observation?: string; // For batch display
  generatedDate?: string; // For batch display
  codesInBatch?: GeneratedCode[]; // If isBatch is true
  singleCode?: GeneratedCode; // If isBatch is false
}

function groupAndSortCodes(codesToSort: GeneratedCode[]): ProcessedCodeItem[] {
  if (!codesToSort || codesToSort.length === 0) return [];

  const sortedCodes = [...codesToSort].sort(
    (a, b) => new Date(b.generatedDate).getTime() - new Date(a.generatedDate).getTime()
  );

  const processedItems: ProcessedCodeItem[] = [];
  let i = 0;
  while (i < sortedCodes.length) {
    const currentCode = sortedCodes[i];
    const currentBatch: GeneratedCode[] = [currentCode];
    let j = i + 1;
    while (
      j < sortedCodes.length &&
      sortedCodes[j].generatedDate === currentCode.generatedDate &&
      (sortedCodes[j].observation || undefined) === (currentCode.observation || undefined)
    ) {
      currentBatch.push(sortedCodes[j]);
      j++;
    }

    if (currentBatch.length > 1) {
      const batchKey = `${currentCode.generatedDate}-${currentCode.observation || 'no-obs'}-${i}`; // Add index to ensure unique accordion value
      processedItems.push({
        isBatch: true,
        id: batchKey,
        batchId: batchKey,
        observation: currentCode.observation,
        generatedDate: currentCode.generatedDate,
        codesInBatch: currentBatch,
      });
      i = j; 
    } else {
      processedItems.push({
        isBatch: false,
        id: currentCode.id,
        singleCode: currentCode,
      });
      i++; 
    }
  }
  return processedItems;
}


interface ManageCodesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: BusinessManagedEntity;
  onCodesUpdated: (entityId: string, updatedCodes: GeneratedCode[]) => void;
  onRequestCreateNewCodes: () => void; 
}

export function ManageCodesDialog({ 
    open, 
    onOpenChange, 
    entity, 
    onCodesUpdated,
    onRequestCreateNewCodes 
}: ManageCodesDialogProps) {
  const [internalCodes, setInternalCodes] = useState<GeneratedCode[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open && entity?.generatedCodes) {
      setInternalCodes([...entity.generatedCodes]);
    } else if (open && !entity?.generatedCodes) {
      setInternalCodes([]);
    }
    // When dialog closes, internalCodes will be reset if entity changes or becomes null via parent.
  }, [entity, open]);

  const processedAndGroupedCodes = useMemo(() => groupAndSortCodes(internalCodes), [internalCodes]);

  const handleDeleteCode = (codeId: string) => {
    const codeToDelete = internalCodes.find(c => c.id === codeId);
    if (codeToDelete && codeToDelete.status === 'redeemed') {
        toast({
            title: "Acción no permitida",
            description: "No se pueden eliminar códigos que ya han sido canjeados/utilizados.",
            variant: "destructive"
        });
        return;
    }
    const updatedRawCodes = internalCodes.filter(c => c.id !== codeId);
    setInternalCodes(updatedRawCodes);
    onCodesUpdated(entity.id, updatedRawCodes); 
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
    const availableCodes = internalCodes.filter(c => c.status === 'available').map(c => c.value).join('\n');
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

  const renderCodeRow = (code: GeneratedCode, isInsideBatch = false) => (
    <TableRow key={code.id} className={isInsideBatch ? "bg-muted/20 hover:bg-muted/40" : ""}>
      <TableCell className="font-mono">
        <div className="flex items-center gap-1">
            <span>{code.value}</span>
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => handleCopyIndividualCode(code.value)}
                title="Copiar código"
            >
                <ClipboardCopy className="h-3.5 w-3.5" />
            </Button>
        </div>
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
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-7 w-7">
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
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl"> {/* Increased width for more columns */}
        <DialogHeader>
          <DialogTitle>Códigos para: {entity.name}</DialogTitle>
          <DialogDescription>
            Visualiza y gestiona los códigos existentes. Los códigos se muestran ordenados por fecha de creación (más recientes primero) y agrupados si se crearon juntos.
          </DialogDescription>
        </DialogHeader>
        
        <div className="my-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <Button onClick={onRequestCreateNewCodes} variant="default" className="bg-primary hover:bg-primary/90">
            <PlusCircle className="mr-2 h-4 w-4" /> Crear Nuevos Códigos
          </Button>
          <Button 
            onClick={handleCopyAllAvailableCodes} 
            variant="outline" 
            disabled={!internalCodes.some(c => c.status === 'available')}
          >
            <ClipboardCopy className="mr-2 h-4 w-4" /> Copiar Disponibles ({internalCodes.filter(c => c.status === 'available').length})
          </Button>
        </div>

        {processedAndGroupedCodes.length > 0 ? (
          <ScrollArea className="h-[50vh] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Código</TableHead>
                  <TableHead>Creado Por</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Observación</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead>Fecha Canje</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Accordion type="multiple" className="w-full">
                  {processedAndGroupedCodes.map((item) => {
                    if (item.isBatch && item.codesInBatch) {
                      return (
                        <AccordionItem value={item.batchId!} key={item.id} className="border-b-0">
                           <TableRow className="border-b hover:bg-transparent data-[state=open]:bg-muted/30">
                             <TableCell colSpan={7} className="p-0">
                                <AccordionTrigger className="py-3 px-4 text-sm hover:no-underline justify-start group">
                                  <ChevronDown className="h-4 w-4 mr-2 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                  Lote de {item.codesInBatch.length} códigos 
                                  ({format(new Date(item.generatedDate!), "P p", { locale: es })})
                                  {item.observation ? <span className="ml-2 text-muted-foreground text-xs truncate" title={item.observation}> - Obs: {item.observation}</span> : ""}
                                </AccordionTrigger>
                             </TableCell>
                           </TableRow>
                          <AccordionContent asChild>
                             <tr className="w-full">
                                <td colSpan={7} className="p-0">
                                  <div className="pl-6 pr-2 pb-2 border-l-2 border-primary ml-5 mr-1"> 
                                      {/* No Table or TableBody here, just render rows */}
                                      {item.codesInBatch.map(code => renderCodeRow(code, true))}
                                  </div>
                                </td>
                            </tr>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    } else if (item.singleCode) {
                      // Render single code as a regular TableRow, not within an AccordionItem
                      return renderCodeRow(item.singleCode);
                    }
                    return null;
                  })}
                </Accordion>
              </TableBody>
            </Table>
          </ScrollArea>
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
