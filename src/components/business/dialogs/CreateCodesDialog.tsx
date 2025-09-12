
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo } from "react";
import type { GeneratedCode } from "@/lib/types";
import { CheckCircle, Copy, PlusCircle, Loader2, AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle } from "@/components/ui/alert";

function generateAlphanumericCode(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

interface CreateCodesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName: string;
  entityId: string;
  onCodesCreated: (entityId: string, newCodes: GeneratedCode[], observation?: string, creatorUid?: string) => Promise<void>; 
  existingCodesValues: string[]; 
  isSubmittingMain?: boolean; 
  currentUserProfileName?: string;
  currentUserProfileUid?: string;
  maxAttendance?: number;
  currentCodeCount?: number;
}

export function CreateCodesDialog({ 
    open, 
    onOpenChange, 
    entityName, 
    entityId, 
    onCodesCreated,
    existingCodesValues,
    isSubmittingMain = false, 
    currentUserProfileName,
    currentUserProfileUid,
    maxAttendance,
    currentCodeCount = 0,
}: CreateCodesDialogProps) {
  const [numCodes, setNumCodes] = useState<number | string>(1);
  const [observation, setObservation] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [justCreatedCodes, setJustCreatedCodes] = useState<GeneratedCode[]>([]);
  const [isCreating, setIsCreating] = useState(false); 
  const { toast } = useToast();

  const maxCodesCanCreate = useMemo(() => {
    if (maxAttendance && maxAttendance > 0) {
      return Math.max(0, maxAttendance - currentCodeCount);
    }
    return 50; // Default max per batch if no attendance limit
  }, [maxAttendance, currentCodeCount]);

  useEffect(() => {
    if (open) {
      setNumCodes(1);
      setObservation("");
      setShowSuccess(false);
      setJustCreatedCodes([]);
      setIsCreating(false);
    }
  }, [open]);

  const handleCreateCodes = async () => {
    const numToCreate = Number(numCodes);
    if (isNaN(numToCreate) || numToCreate < 1 || numToCreate > Math.min(50, maxCodesCanCreate === 0 && maxAttendance && maxAttendance > 0 ? 0 : 50)) { 
      toast({
        title: "Cantidad Inválida",
        description: `Por favor, ingresa un número entre 1 y ${Math.min(50, maxCodesCanCreate || 50)}.`,
        variant: "destructive",
      });
      return;
    }

    if (maxAttendance && maxAttendance > 0 && (currentCodeCount + numToCreate > maxAttendance)) {
       toast({
        title: "Límite de Aforo Excedido",
        description: `Solo puedes crear ${maxCodesCanCreate} código(s) más para no superar el aforo de ${maxAttendance}.`,
        variant: "destructive",
      });
      return;
    }
    
    setIsCreating(true);

    const newCodesBatch: GeneratedCode[] = [];
    const currentAndNewCodes = new Set(existingCodesValues);

    for (let i = 0; i < numToCreate; i++) {
      let newCodeValue = generateAlphanumericCode(9);
      let attemptCount = 0;
      const maxAttempts = 100; 

      while (currentAndNewCodes.has(newCodeValue) && attemptCount < maxAttempts) {
        newCodeValue = generateAlphanumericCode(9); 
        attemptCount++;
      }
      if (attemptCount >= maxAttempts) {
        toast({
            title: "Error al generar código único",
            description: "No se pudo generar un código único después de varios intentos. Intente con menos códigos o más tarde.",
            variant: "destructive"
        });
        setIsCreating(false);
        return; 
      }

      currentAndNewCodes.add(newCodeValue);
      const codeObservation = observation.trim() === "" ? undefined : observation.trim();
      newCodesBatch.push({
        id: `code-${entityId}-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        entityId: entityId,
        value: newCodeValue,
        status: "available",
        generatedByName: currentUserProfileName || "Sistema",
        generatedByUid: currentUserProfileUid || undefined,
        generatedDate: new Date().toISOString(),
        observation: codeObservation || null, // Ensure null if empty
        redemptionDate: null, 
        redeemedByInfo: null, 
        isVipCandidate: false,
      });
    }
    
    // First, show the success message UI
    setJustCreatedCodes(newCodesBatch);
    setShowSuccess(true);
    setIsCreating(false);

    // Then, call the async database operation without waiting for it to complete in this function
    // This prevents the UI from being blocked or re-rendered unexpectedly
    onCodesCreated(entityId, newCodesBatch, observation.trim() === "" ? undefined : observation.trim(), currentUserProfileUid);
  };

  const handleCopyCreatedCodes = async () => {
    if (justCreatedCodes.length === 0) return;
    const codesToCopy = justCreatedCodes.map(c => c.value).join('\n');
    try {
      await navigator.clipboard.writeText(codesToCopy);
      toast({ title: "Códigos Copiados", description: `${justCreatedCodes.length} códigos recién creados han sido copiados.` });
    } catch (err) {
      toast({ title: "Error al Copiar", description: "No se pudo copiar los códigos.", variant: "destructive" });
    }
  };

  const handleCloseAndReset = () => {
    onOpenChange(false); 
  };

  const canCreateAnyCodes = !maxAttendance || maxAttendance === 0 || maxCodesCanCreate > 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) { 
            setNumCodes(1);
            setObservation("");
            setShowSuccess(false);
            setJustCreatedCodes([]);
            setIsCreating(false);
        }
        onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {showSuccess ? "Códigos Creados Exitosamente" : `Crear Códigos para: ${entityName}`}
          </DialogTitle>
          {!showSuccess && (
            <DialogDescription>
              Define la cantidad de códigos y una observación opcional que se aplicará a todos los códigos de este lote.
            </DialogDescription>
          )}
        </DialogHeader>
        
        {!showSuccess ? (
          <div className="space-y-4 py-4">
             {maxAttendance && maxAttendance > 0 && (
                <Alert variant={canCreateAnyCodes ? "default" : "destructive"}>
                    {canCreateAnyCodes ? <Info className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    <AlertTitle>{canCreateAnyCodes ? "Información de Aforo" : "Aforo Completo"}</AlertTitle>
                    <DialogDescription>
                    {canCreateAnyCodes ? `Este evento tiene un aforo de ${maxAttendance}. Actualmente hay ${currentCodeCount} códigos. Puedes crear hasta ${maxCodesCanCreate} más.` : `Ya se ha alcanzado el aforo máximo de ${maxAttendance} códigos para este evento.`}
                    </DialogDescription>
                </Alert>
             )}
            <div>
              <Label htmlFor="numCodesToGenerate" className="text-sm font-medium">Cantidad de Códigos (1-{Math.min(50, canCreateAnyCodes ? maxCodesCanCreate || 50 : 0)}) <span className="text-destructive">*</span></Label>
              <Input
                id="numCodesToGenerate"
                type="number"
                min="1"
                max={Math.min(50, canCreateAnyCodes ? maxCodesCanCreate || 50 : 0)}
                value={numCodes}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty string to clear the input, otherwise parse it.
                  if (value === "") {
                    setNumCodes("");
                  } else {
                    const numberValue = parseInt(value, 10);
                    // Check for NaN and negative values, default to a sensible state if needed
                    setNumCodes(isNaN(numberValue) || numberValue < 0 ? "" : numberValue);
                  }
                }}
                className="mt-1 no-spinner"
                disabled={isCreating || isSubmittingMain || !canCreateAnyCodes}
              />
            </div>
            <div>
              <Label htmlFor="observation" className="text-sm font-medium">Observación (Opcional)</Label>
              <Textarea
                id="observation"
                placeholder="Ej: Para invitados VIP, promoción especial fin de semana..."
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                className="mt-1"
                rows={3}
                disabled={isCreating || isSubmittingMain || !canCreateAnyCodes}
              />
            </div>
          </div>
        ) : (
          <div className="py-6 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <p className="text-lg font-medium">¡Has creado {justCreatedCodes.length} código(s)!</p>
            {justCreatedCodes.length > 0 && (
              <Button onClick={handleCopyCreatedCodes} variant="outline" size="lg" className="w-full">
                <Copy className="mr-2 h-5 w-5" /> Copiar Códigos Creados ({justCreatedCodes.length})
              </Button>
            )}
             <p className="text-sm text-muted-foreground">
              Estos códigos se han añadido a '{entityName}'.
            </p>
          </div>
        )}

        <DialogFooter className="mt-2">
          {showSuccess ? (
            <Button onClick={handleCloseAndReset} className="w-full" variant="outline">Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleCloseAndReset} disabled={isCreating || isSubmittingMain}>Cancelar</Button>
              <Button onClick={handleCreateCodes} className="bg-primary hover:bg-primary/90" disabled={isCreating || isSubmittingMain || !canCreateAnyCodes}>
                {(isCreating || isSubmittingMain) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <PlusCircle className="mr-2 h-4 w-4" /> Crear Códigos
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
