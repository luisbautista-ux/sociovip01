
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import type { GeneratedCode } from "@/lib/types";
import { CheckCircle, Copy, PlusCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  onCodesCreated: (entityId: string, newCodes: GeneratedCode[], observation?: string) => void; // observation es string o undefined
  existingCodesValues: string[]; 
  isSubmittingMain?: boolean; 
  currentUserProfileName?: string;
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
}: CreateCodesDialogProps) {
  const [numCodes, setNumCodes] = useState(1);
  const [observation, setObservation] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [justCreatedCodes, setJustCreatedCodes] = useState<GeneratedCode[]>([]);
  const [isCreating, setIsCreating] = useState(false); 
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setNumCodes(1);
      setObservation("");
      setShowSuccess(false);
      setJustCreatedCodes([]);
      setIsCreating(false);
    }
  }, [open]);

  const handleCreateCodes = () => {
    if (numCodes < 1 || numCodes > 50) { 
      toast({
        title: "Cantidad Inválida",
        description: "Por favor, ingresa un número entre 1 y 50.",
        variant: "destructive",
      });
      return;
    }
    setIsCreating(true);

    const newCodesBatch: GeneratedCode[] = [];
    const currentAndNewCodes = new Set(existingCodesValues);

    for (let i = 0; i < numCodes; i++) {
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
      const codeObservation = observation.trim() === "" ? undefined : observation.trim(); // Use undefined if empty
      newCodesBatch.push({
        id: `code-${entityId}-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        entityId: entityId,
        value: newCodeValue,
        status: "available",
        generatedByName: currentUserProfileName || "Sistema",
        generatedDate: new Date().toISOString(),
        observation: codeObservation,
        redemptionDate: null,
        redeemedByInfo: null,
        isVipCandidate: false,
      });
    }
    
    onCodesCreated(entityId, newCodesBatch, observation.trim() === "" ? undefined : observation.trim());
    setJustCreatedCodes(newCodesBatch);
    setShowSuccess(true);
    setIsCreating(false);
  };

  const handleCopyCreatedCodes = async () => {
    if (justCreatedCodes.length === 0) return;
    const codesToCopy = justCreatedCodes.map(c => c.value).join('\n');
    try {
      await navigator.clipboard.writeText(codesToCopy);
      toast({ title: "Códigos Copiados", description: `${justCreatedCodes.length} códigos recién creados han sido copiados.` });
    } catch (err) {
      toast({ title: "Error al Copiar", description: "No se pudieron copiar los códigos.", variant: "destructive" });
    }
  };

  const handleCloseAndReset = () => {
    onOpenChange(false); 
  };

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
            <div>
              <Label htmlFor="numCodesToGenerate" className="text-sm font-medium">Cantidad de Códigos (1-50) <span className="text-destructive">*</span></Label>
              <Input
                id="numCodesToGenerate"
                type="number"
                min="1"
                max="50"
                value={numCodes}
                onChange={(e) => setNumCodes(parseInt(e.target.value, 10) || 1)}
                className="mt-1"
                disabled={isCreating || isSubmittingMain}
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
                disabled={isCreating || isSubmittingMain}
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
              {currentUserProfileName?.toLowerCase().includes("promotor") 
                ? "" // No mostrar mensaje de simulación si el promotor ahora guarda en Firestore
                : " Puedes verlos y gestionarlos en la sección 'Ver Códigos'."
              }
            </p>
          </div>
        )}

        <DialogFooter className="mt-2">
          {showSuccess ? (
            <Button onClick={handleCloseAndReset} className="w-full" variant="outline">Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleCloseAndReset} disabled={isCreating || isSubmittingMain}>Cancelar</Button>
              <Button onClick={handleCreateCodes} className="bg-primary hover:bg-primary/90" disabled={isCreating || isSubmittingMain}>
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
