"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo } from "react";
import type { BusinessManagedEntity, GeneratedCode } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PlusCircle, Trash2, ClipboardCopy, ChevronDown, ChevronUp, Copy, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as UIDialogDescription, AlertDialogFooter as UIAlertDialogFooter, AlertDialogHeader, AlertDialogTitle as UIAlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { GENERATED_CODE_STATUS_TRANSLATIONS, GENERATED_CODE_STATUS_COLORS } from "@/lib/constants";

interface ProcessedCodeItem {
  isBatch: boolean;
  id: string; // Unique key for React list (can be batchId or single code id)
  batchId?: string; // Identifier for the batch itself
  observation?: string | null;
  generatedDate?: string; // Common generatedDate for the batch
  generatedByName?: string; // Common generator for the batch
  codesInBatch?: GeneratedCode[];
  singleCode?: GeneratedCode;
}

function groupAndSortCodes(codesToSort: GeneratedCode[] | undefined): ProcessedCodeItem[] {
  if (!codesToSort || codesToSort.length === 0) return [];

  const sortedCodes = [...codesToSort].sort(
    (a, b) => new Date(b.generatedDate || 0).getTime() - new Date(a.generatedDate || 0).getTime()
  );

  const processedItems: ProcessedCodeItem[] = [];
  let i = 0;
  while (i < sortedCodes.length) {
    const currentCode = sortedCodes[i];
    if (!currentCode) { // Defensive check
        i++;
        continue;
    }
    const currentBatch: GeneratedCode[] = [currentCode];
    let j = i + 1;
    
    const currentObservation = currentCode.observation === undefined ? null : currentCode.observation;
    const currentGeneratedTimeSignature = `${new Date(currentCode.generatedDate || 0).toISOString().substring(0, 19)}-${currentCode.generatedByName || 'unknown'}`;

    while (
      j < sortedCodes.length &&
      sortedCodes[j] && // Defensive check
      `${new Date(sortedCodes[j].generatedDate || 0).toISOString().substring(0, 19)}-${sortedCodes[j].generatedByName || 'unknown'}` === currentGeneratedTimeSignature &&
      (sortedCodes[j].observation === undefined ? null : sortedCodes[j].observation) === currentObservation
    ) {
      currentBatch.push(sortedCodes[j]);
      j++;
    }

    const batchKeyBase = `${currentGeneratedTimeSignature}-${currentObservation || 'no-obs'}`;
    
    if (currentBatch.length > 1) {
      const batchKey = `${batchKeyBase}-${i}`;
      processedItems.push({
        isBatch: true,
        id: batchKey, // Use batchKey as the React key for the group
        batchId: batchKey,
        observation: currentObservation,
        generatedDate: currentCode.generatedDate,
        generatedByName: currentCode.generatedByName,
        codesInBatch: currentBatch,
      });
      i = j; 
    } else {
      processedItems.push({
        isBatch: false,
        id: currentCode.id || `${batchKeyBase}-single-${i}-${Math.random().toString(36).slice(2)}`,
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
  entity: BusinessManagedEntity | null; 
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
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open && entity?.generatedCodes) {
      setInternalCodes([...entity.generatedCodes]);
      setExpandedBatches({}); 
    } else if (open && (!entity || !entity.generatedCodes)) {
      setInternalCodes([]);
      setExpandedBatches({});
    }
  }, [entity, open]);

  const processedAndGroupedCodes = useMemo(() => groupAndSortCodes(internalCodes), [internalCodes]);

  const toggleBatchExpansion = (batchIdToToggle: string) => {
    setExpandedBatches(prev => ({ ...prev, [batchIdToToggle]: !prev[batchIdToToggle] }));
  };

  const handleDeleteCode = (codeIdToDelete: string) => {
    if (!entity || !codeIdToDelete) return;
    const codeToDelete = internalCodes.find(c => c.id === codeIdToDelete);
    if (codeToDelete && codeToDelete.status === 'redeemed') {
        toast({
            title: "Acción no permitida",
            description: "No se pueden eliminar códigos que ya han sido canjeados/utilizados.",
            variant: "destructive"
        });
        return;
    }
    const updatedRawCodes = internalCodes.filter(c => c.id !== codeIdToDelete);
    setInternalCodes(updatedRawCodes);
    onCodesUpdated(entity.id, updatedRawCodes); 
    toast({ title: "Código Eliminado", description: `El código "${codeToDelete?.value}" ha sido eliminado.`, variant: "destructive" });
  };

  const handleDeleteBatchCodes = (batchItem: ProcessedCodeItem) => {
    if (!entity || !batchItem.isBatch || !batchItem.codesInBatch || !batchItem.batchId) return;

    const codesToDeleteFromBatchIds = batchItem.codesInBatch
      .filter(c => c.status !== 'redeemed')
      .map(c => c.id);
    
    if (codesToDeleteFromBatchIds.length === 0) {
        toast({ title: "Nada que Eliminar", description: "Todos los códigos en este lote ya han sido canjeados o no hay códigos elegibles para eliminar.", variant: "default"});
        return;
    }

    const updatedRawCodes = internalCodes.filter(c => !codesToDeleteFromBatchIds.includes(c.id));
    
    setInternalCodes(updatedRawCodes);
    onCodesUpdated(entity.id, updatedRawCodes);
    toast({ title: "Códigos del Lote Eliminados", description: `${codesToDeleteFromBatchIds.length} código(s) no canjeado(s) del lote han sido eliminados.`, variant: "destructive" });
    
    const remainingInBatch = updatedRawCodes.filter(c => batchItem.codesInBatch?.some(orig => orig.id === c.id));
    if (remainingInBatch.length === 0) {
      setExpandedBatches(prev => {
        const newState = {...prev};
        if(batchItem.batchId) delete newState[batchItem.batchId];
        return newState;
      });
    }
  };

  const handleCopyIndividualCode = async (codeValue: string | undefined) => {
    if (!codeValue) return;
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
      toast({ title: "Sin Códigos Disponibles", description: "No hay códigos disponibles para copiar." });
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

  const handleCopyBatchCodes = async (batchCodes: GeneratedCode[] | undefined) => {
    if (!batchCodes || batchCodes.length === 0) return;
    const codesToCopy = batchCodes.map(c => c.value).join('\n');
    try {
      await navigator.clipboard.writeText(codesToCopy);
      toast({ title: "Códigos del Lote Copiados", description: `${batchCodes.length} códigos del lote han sido copiados.` });
    } catch (err) {
      toast({ title: "Error al Copiar Lote", description: "No se pudieron copiar los códigos del lote.", variant: "destructive" });
    }
  };

  if (!entity) return null; 

  const renderCodeRow = (code: GeneratedCode | undefined, isInsideBatch = false) => {
    if (!code || !code.id) {
        console.warn("ManageCodesDialog: Attempted to render a code without a valid ID.", code);
        return null; // Do not render if code or code.id is missing
    }
    return (
    <TableRow 
        key={code.id} // Ensure key is always valid
        className={cn(
            "text-xs", 
            isInsideBatch ? "bg-muted/20 hover:bg-muted/40" : "hover:bg-muted/20",
        )}
    >
      <TableCell className={cn("font-mono py-1.5 px-2", isInsideBatch && "pl-6")}>
        <div className="flex items-center gap-1">
            <span>{code.value}</span>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => handleCopyIndividualCode(code.value)}
                title="Copiar código"
            >
                <ClipboardCopy className="h-3 w-3" />
            </Button>
        </div>
      </TableCell>
      <TableCell className="py-1.5 px-2">{code.generatedByName}</TableCell>
      <TableCell className="py-1.5 px-2">
          <Badge variant={GENERATED_CODE_STATUS_COLORS[code.status] || 'outline'} className="text-xs">{GENERATED_CODE_STATUS_TRANSLATIONS[code.status] || code.status}</Badge>
      </TableCell>
      <TableCell className="py-1.5 px-2 max-w-[150px] truncate" title={code.observation || undefined}>{code.observation || "N/A"}</TableCell>
      <TableCell className="py-1.5 px-2">{code.generatedDate ? format(new Date(code.generatedDate), "dd/MM/yy HH:mm", { locale: es }) : "N/A"}</TableCell>
      <TableCell className="py-1.5 px-2">
        {code.redemptionDate ? format(new Date(code.redemptionDate), "dd/MM/yy HH:mm", { locale: es }) : "N/A"}
      </TableCell>
      <TableCell className="text-right py-1.5 px-2">
          {code.status !== 'redeemed' && (
               <AlertDialog>
                  <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-6 w-6">
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Eliminar Código</span>
                      </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                  <AlertDialogHeader>
                      <UIAlertDialogTitle>¿Estás seguro?</UIAlertDialogTitle>
                      <UIDialogDescription>
                      Esta acción no se puede deshacer. Esto eliminará permanentemente el código:
                      <span className="font-semibold font-mono"> {code.value}</span>.
                      </UIDialogDescription>
                  </AlertDialogHeader>
                  <UIAlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                      onClick={() => handleDeleteCode(code.id!)}
                      className="bg-destructive hover:bg-destructive/90"
                      >
                      Eliminar
                      </AlertDialogAction>
                  </UIAlertDialogFooter>
                  </AlertDialogContent>
              </AlertDialog>
          )}
      </TableCell>
    </TableRow>
  )};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl"> 
        <DialogHeader>
          <DialogTitle>Códigos para: {entity.name}</DialogTitle>
          <DialogDescription>
            Visualiza y gestiona los códigos existentes. Se ordenan por fecha de creación (más recientes primero) y se agrupan si se crearon juntos con la misma observación y por el mismo usuario.
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
                <TableRow className="text-sm">
                  <TableHead className="w-[150px] px-2 py-2">Código</TableHead>
                  <TableHead className="px-2 py-2">Creado Por</TableHead>
                  <TableHead className="px-2 py-2">Estado</TableHead>
                  <TableHead className="px-2 py-2">Observación</TableHead>
                  <TableHead className="px-2 py-2">Fecha Creación</TableHead>
                  <TableHead className="px-2 py-2">Fecha Canje</TableHead>
                  <TableHead className="text-right px-2 py-2">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedAndGroupedCodes.map((item) => {
                  if (item.isBatch && item.codesInBatch && item.batchId) {
                    const isExpanded = !!expandedBatches[item.batchId];
                    const nonRedeemedInBatchCount = item.codesInBatch.filter(c => c.status !== 'redeemed').length;
                    return (
                      <React.Fragment key={item.id}>
                        <TableRow 
                            className="border-b hover:bg-muted/30 cursor-pointer data-[state=open]:bg-muted/20"
                            onClick={() => toggleBatchExpansion(item.batchId!)}
                            data-state={isExpanded ? "open" : "closed"}
                        >
                          <TableCell colSpan={7} className="py-2 px-3 text-xs">
                            <div className="flex items-center justify-between group w-full hover:bg-transparent">
                              <div className="flex items-center">
                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5 mr-2 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 mr-2 shrink-0" />}
                                <span>Lote de {item.codesInBatch.length} códigos (Por: {item.generatedByName || 'N/A'})</span>
                                {item.generatedDate && <span className="text-muted-foreground ml-1 text-xs"> - {format(new Date(item.generatedDate), "dd/MM/yy HH:mm", { locale: es })}</span>}
                                {item.observation && <span className="ml-2 text-muted-foreground text-xs truncate" title={item.observation}> - Obs: {item.observation}</span>}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <>
                            <TableRow className="bg-muted/10 hover:bg-muted/10">
                                <TableCell colSpan={7} className="pt-1 pb-1.5 px-6">
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="xs"
                                            className="text-xs h-auto py-1 px-1.5"
                                            onClick={(e) => { e.stopPropagation(); handleCopyBatchCodes(item.codesInBatch);}}
                                        >
                                            <Copy className="mr-1 h-3 w-3" /> Copiar Lote ({item.codesInBatch!.length})
                                        </Button>
                                        {nonRedeemedInBatchCount > 0 && (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="destructive"
                                                        size="xs"
                                                        className="text-xs h-auto py-1 px-1.5"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <Trash2 className="mr-1 h-3 w-3" /> Eliminar No Canjeados ({nonRedeemedInBatchCount})
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <UIAlertDialogTitle className="flex items-center"><AlertTriangle className="text-destructive mr-2"/>¿Eliminar Códigos del Lote?</UIAlertDialogTitle>
                                                        <UIDialogDescription>
                                                            Se eliminarán {nonRedeemedInBatchCount} código(s) no canjeado(s) de este lote (Observación: {item.observation || "N/A"}). 
                                                            Los códigos ya canjeados no se verán afectados. Esta acción no se puede deshacer.
                                                        </UIDialogDescription>
                                                    </AlertDialogHeader>
                                                    <UIAlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteBatchCodes(item)} className="bg-destructive hover:bg-destructive/90">
                                                            Sí, Eliminar No Canjeados
                                                        </AlertDialogAction>
                                                    </UIAlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                            {item.codesInBatch.map(code => renderCodeRow(code, true))}
                          </>
                        )}
                      </React.Fragment>
                    );
                  } else if (item.singleCode) {
                    return renderCodeRow(item.singleCode, false);
                  }
                  return null;
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border border-dashed rounded-md p-4 text-center">
            <ClipboardCopy className="h-12 w-12 mb-2"/>
            <p>No hay códigos generados para esta entidad aún.</p>
            <p className="text-sm">Haz clic en "Crear Nuevos Códigos" para empezar.</p>
          </div>
        )}
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
