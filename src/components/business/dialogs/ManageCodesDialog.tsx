
"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo, useCallback } from "react";
import type { BusinessManagedEntity, GeneratedCode, Business } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { PlusCircle, Trash2, ChevronDown, ChevronUp, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as UIDialogDescription, AlertDialogFooter as UIAlertDialogFooter, AlertDialogHeader, AlertDialogTitle as UIAlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { GENERATED_CODE_STATUS_TRANSLATIONS, GENERATED_CODE_STATUS_COLORS } from "@/lib/constants";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { WhatsAppIcon } from "@/components/icons";


interface ProcessedCodeItem {
  isBatch: boolean;
  id: string; 
  batchId?: string; 
  observation?: string | null;
  generatedDate?: string; 
  generatedByName?: string; 
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
    if (!currentCode || !currentCode.id) { 
        console.warn("ManageCodesDialog: Skipping code with no ID in groupAndSortCodes", currentCode);
        i++;
        continue;
    }
    const currentBatch: GeneratedCode[] = [currentCode];
    let j = i + 1;
    
    const currentObservation = currentCode.observation === undefined ? null : currentCode.observation;
    const currentGeneratedTimeSignature = `${new Date(currentCode.generatedDate || 0).toISOString().substring(0, 19)}-${currentCode.generatedByName || 'unknown'}`;

    while (
      j < sortedCodes.length &&
      sortedCodes[j] && 
      `${new Date(sortedCodes[j].generatedDate || 0).toISOString().substring(0, 19)}-${sortedCodes[j].generatedByName || 'unknown'}` === currentGeneratedTimeSignature &&
      (sortedCodes[j].observation === undefined ? null : sortedCodes[j].observation) === currentObservation
    ) {
      currentBatch.push(sortedCodes[j]);
      j++;
    }

    const batchKeyBase = `${currentGeneratedTimeSignature}-${currentObservation || 'no-obs'}`;
    
    if (currentBatch.length > 1) {
      const batchKey = `${batchKeyBase}-${i}-${currentCode.id}`; 
      processedItems.push({
        isBatch: true,
        id: batchKey,
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
  entity: BusinessManagedEntity | null; 
  onCodesUpdated: (entityId: string, updatedCodes: GeneratedCode[]) => void;
  onRequestCreateNewCodes: () => void;
  isPromoterView?: boolean; 
  currentUserProfileName?: string;
  currentUserProfileUid?: string;
  currentUserProfilePhone?: string;
}

export function ManageCodesDialog({
    open,
    onOpenChange,
    entity,
    onCodesUpdated,
    onRequestCreateNewCodes,
    isPromoterView = false, 
    currentUserProfileName,
    currentUserProfileUid,
    currentUserProfilePhone
}: ManageCodesDialogProps) {
  const [internalCodes, setInternalCodes] = useState<GeneratedCode[]>([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState(false);
  const [businessDetails, setBusinessDetails] = useState<Business | null>(null);
  const { toast } = useToast();
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});

  const fetchLatestData = useCallback(async () => {
    if (!entity?.id) {
      setInternalCodes([]);
      setBusinessDetails(null);
      return;
    }
    setIsLoadingCodes(true);
    try {
      const entityRef = doc(db, "businessEntities", entity.id);
      const entitySnap = await getDoc(entityRef);

      if (entitySnap.exists()) {
        const latestEntityData = entitySnap.data() as BusinessManagedEntity;
        const codesToDisplay = isPromoterView
          ? (latestEntityData.generatedCodes || []).filter(c => c.generatedByUid === currentUserProfileUid)
          : (latestEntityData.generatedCodes || []);
        setInternalCodes([...codesToDisplay]);

        // Fetch business details to get customUrlPath
        if (latestEntityData.businessId) {
            const businessRef = doc(db, "businesses", latestEntityData.businessId);
            const businessSnap = await getDoc(businessRef);
            if(businessSnap.exists()) {
                setBusinessDetails({id: businessSnap.id, ...businessSnap.data()} as Business);
            } else {
                setBusinessDetails(null);
            }
        } else {
            setBusinessDetails(null);
        }

      } else {
        toast({ title: "Error", description: "La promoción o evento ya no existe.", variant: "destructive" });
        setInternalCodes([]);
        setBusinessDetails(null);
      }
    } catch (error) {
      console.error("Error fetching latest codes/business details:", error);
      toast({ title: "Error", description: "No se pudieron cargar los datos actualizados.", variant: "destructive" });
      setInternalCodes(entity.generatedCodes || []); // Fallback to stale data
      setBusinessDetails(null);
    } finally {
      setIsLoadingCodes(false);
    }
  }, [entity, isPromoterView, currentUserProfileUid, toast]);

  useEffect(() => {
    if (open && entity) {
      fetchLatestData();
      setExpandedBatches({}); 
    }
  }, [entity, open, fetchLatestData]);

  const processedAndGroupedCodes = useMemo(() => groupAndSortCodes(internalCodes), [internalCodes]);

  const toggleBatchExpansion = (batchIdToToggle: string) => {
    setExpandedBatches(prev => ({ ...prev, [batchIdToToggle]: !prev[batchIdToToggle] }));
  };

  const handleDeleteCode = (codeIdToDelete: string) => {
    if (!entity || !codeIdToDelete) return;
    const codeToDelete = internalCodes.find(c => c.id === codeIdToDelete);

    if (isPromoterView && codeToDelete?.generatedByUid !== currentUserProfileUid) {
        toast({ title: "Acción no permitida", description: "Solo puedes eliminar códigos generados por ti.", variant: "destructive" });
        return;
    }

    if (codeToDelete && (codeToDelete.status === 'redeemed' || codeToDelete.status === 'used')) {
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
      .filter(c => {
        const canDelete = (c.status !== 'redeemed' && c.status !== 'used') && (!isPromoterView || c.generatedByUid === currentUserProfileUid);
        return canDelete;
      })
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
    if (remainingInBatch.length === 0 && batchItem.batchId) {
      setExpandedBatches(prev => {
        const newState = {...prev};
        delete newState[batchItem.batchId!];
        return newState;
      });
    }
  };
  
    const openWhatsApp = (codes: string[]) => {
        if (!currentUserProfilePhone) {
            toast({ title: "Teléfono no encontrado", description: "No tienes un número de teléfono configurado en tu perfil.", variant: "destructive" });
            return;
        }

        const businessUrl = businessDetails?.customUrlPath
            ? `https://sociovip.app/b/${businessDetails.customUrlPath}`
            : `https://sociovip.app/business/${entity?.businessId}`;

        const codesText = codes.join('\n');
        const message = `Genera tu entrada QR con tu código en:\n${businessUrl}\n\n${codesText}`;
        const whatsappUrl = `https://wa.me/${currentUserProfilePhone}?text=${encodeURIComponent(message)}`;
        
        window.open(whatsappUrl, '_blank');
        toast({ title: "Abriendo WhatsApp", description: "Se está abriendo una pestaña con tu mensaje." });
    };

    const handleShareIndividualCode = (codeValue: string | undefined) => {
        if (!codeValue) return;
        openWhatsApp([codeValue]);
    };

    const handleShareBatchCodes = (batchCodes: GeneratedCode[] | undefined) => {
        if (!batchCodes || batchCodes.length === 0) return;
        const codesToShare = batchCodes.map(c => c.value);
        openWhatsApp(codesToShare);
    };

    const handleShareAllAvailableCodes = () => {
        const availableCodes = internalCodes.filter(c => c.status === 'available').map(c => c.value);
        if (availableCodes.length === 0) {
            toast({ title: "Sin Códigos Disponibles", description: "No hay códigos disponibles para compartir." });
            return;
        }
        openWhatsApp(availableCodes);
    };

  if (!entity) return null; 

  const renderCodeRow = (code: GeneratedCode | undefined, isInsideBatch = false, batchId?: string) => {
    if (!code || !code.id) {
        console.warn("ManageCodesDialog: Attempted to render a code without a valid ID.", code);
        return null; 
    }
    const uniqueKeyForRow = `code-row-${code.id}-${batchId || 'single'}`;

    return (
    <TableRow 
        key={uniqueKeyForRow} 
        className={cn(
            "text-xs", 
            isInsideBatch ? "bg-muted/20 hover:bg-muted/40" : "hover:bg-muted/20",
            isInsideBatch && "border-l-2 border-primary/30" 
        )}
    >
      <TableCell className={cn("font-mono py-1.5 px-2", isInsideBatch && "pl-4")}>
        <div className="flex items-center gap-1">
            <span>{code.value}</span>
             <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-green-600 hover:bg-green-100"
                onClick={(e) => { e.stopPropagation(); handleShareIndividualCode(code.value);}}
                title="Compartir código por WhatsApp"
            >
                <WhatsAppIcon className="h-4 w-4" />
            </Button>
        </div>
      </TableCell>
      <TableCell className="py-1.5 px-2 text-center">
          <Badge variant={GENERATED_CODE_STATUS_COLORS[code.status] || 'outline'} className="text-xs">{GENERATED_CODE_STATUS_TRANSLATIONS[code.status] || code.status}</Badge>
      </TableCell>
      <TableCell className="py-1.5 px-2 text-center">
        {code.redemptionDate ? format(new Date(code.redemptionDate), "dd/MM/yy HH:mm", { locale: es }) : "N/A"}
      </TableCell>
    </TableRow>
  )};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl"> 
        <DialogHeader>
          <DialogTitle>Mis Códigos para: {entity.name}</DialogTitle>
          <DialogDescription>
            Visualiza los códigos que has generado para esta campaña. Se agrupan si se crearon juntos.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <Button onClick={onRequestCreateNewCodes} variant="default" className="bg-primary hover:bg-primary/90">
            <PlusCircle className="mr-2 h-4 w-4" /> Crear Nuevos Códigos
          </Button>
          <Button
            onClick={handleShareAllAvailableCodes}
            variant="outline"
            disabled={!internalCodes.some(c => c.status === 'available')}
          >
            <WhatsAppIcon className="mr-2 h-4 w-4" /> Compartir Disponibles ({internalCodes.filter(c => c.status === 'available').length})
          </Button>
        </div>

        {isLoadingCodes ? (
          <div className="flex justify-center items-center h-[50vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Cargando mis códigos...</p>
          </div>
        ) : processedAndGroupedCodes.length > 0 ? (
          <ScrollArea className="h-[50vh] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow className="text-sm">
                  <TableHead className="w-1/3 px-2 py-2 text-center">Código</TableHead>
                  <TableHead className="w-1/3 px-2 py-2 text-center">Estado</TableHead>
                  <TableHead className="w-1/3 px-2 py-2 text-center">Fecha Canje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedAndGroupedCodes.map((item) => {
                  if (item.isBatch && item.codesInBatch && item.batchId) {
                    const isExpanded = !!expandedBatches[item.batchId];
                    
                    return (
                      <React.Fragment key={item.id}>
                        <TableRow 
                            className="border-b hover:bg-muted/30 cursor-pointer data-[state=open]:bg-muted/30"
                            onClick={() => toggleBatchExpansion(item.batchId!)}
                            data-state={isExpanded ? "open" : "closed"}
                        >
                          <TableCell colSpan={3} className="py-2 px-3 text-xs">
                             <div className="flex items-center justify-between group w-full">
                              <div className="flex items-center">
                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5 mr-2 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 mr-2 shrink-0" />}
                                <span>Lote de {item.codesInBatch.length} códigos</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    className="text-xs h-auto py-1 px-1.5"
                                    onClick={(e) => { e.stopPropagation(); handleShareBatchCodes(item.codesInBatch);}}
                                >
                                    <WhatsAppIcon className="mr-1 h-4 w-4" /> Compartir Lote ({item.codesInBatch!.length})
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && item.codesInBatch.map(code => renderCodeRow(code, true, item.batchId))}
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
            <p>No has generado códigos para esta entidad aún.</p>
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
