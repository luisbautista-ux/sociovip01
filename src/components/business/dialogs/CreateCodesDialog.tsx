
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import type { GeneratedCode } from "@/lib/types";
import { CheckCircle, Copy, PlusCircle, AlertTriangle } from "lucide-react";
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
  onCodesCreated: (entityId: string, newCodes: GeneratedCode[], observation?: string) => void;
  existingCodesValues: string[]; // Pass only values of existing codes for uniqueness check
}

export function CreateCodesDialog({ 
    open, 
    onOpenChange, 
    entityName, 
    entityId, 
    onCodesCreated,
    existingCodesValues 
}: CreateCodesDialogProps) {
  const [numCodes, setNumCodes] = useState(1);
  const [observation, setObservation] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [justCreatedCodes, setJustCreatedCodes] = useState<GeneratedCode[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setNumCodes(1);
      setObservation("");
      setShowSuccess(false);
      setJustCreatedCodes([]);
    }
  }, [open]);

  const handleCreateCodes = () => {
    if (numCodes < 1 || numCodes > 50) { // Increased max to 50
      toast({
        title: "Cantidad Inválida",
        description: "Por favor, ingresa un número entre 1 y 50.",
        variant: "destructive",
      });
      return;
    }

    const newCodesBatch: GeneratedCode[] = [];
    const currentAndNewCodes = new Set(existingCodesValues);

    for (let i = 0; i < numCodes; i++) {
      let newCodeValue = generateAlphanumericCode(9);
      while (currentAndNewCodes.has(newCodeValue)) {
        newCodeValue = generateAlphanumericCode(9); // Regenerate if not unique
      }
      currentAndNewCodes.add(newCodeValue);
      newCodesBatch.push({
        id: `code-${entityId}-${Date.now()}-${i}`,
        entityId: entityId,
        value: newCodeValue,
        status: "available",
        generatedByName: "Negocio (Mock)", // Placeholder
        generatedDate: new Date().toISOString(),
        observation: observation || undefined,
      });
    }
    
    onCodesCreated(entityId, newCodesBatch, observation || undefined);
    setJustCreatedCodes(newCodesBatch);
    setShowSuccess(true);
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
    // Reset is handled by useEffect on 'open'
  };

  return (
    <Dialog open={open} onOpenChange={handleCloseAndReset}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {showSuccess ? "Códigos Creados Exitosamente" : `Crear Códigos para: ${entityName}`}
          </DialogTitle>
          {!showSuccess && (
            <DialogDescription>
              Define la cantidad de códigos y una observación opcional.
            </DialogDescription>
          )}
        </DialogHeader>
        
        {!showSuccess ? (
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="numCodesToGenerate" className="text-sm font-medium">Cantidad de Códigos (1-50)</Label>
              <Input
                id="numCodesToGenerate"
                type="number"
                min="1"
                max="50"
                value={numCodes}
                onChange={(e) => setNumCodes(parseInt(e.target.value, 10) || 1)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="observation" className="text-sm font-medium">Observación (Opcional)</Label>
              <Textarea
                id="observation"
                placeholder="Ej: Para invitados de cumpleaños, promoción especial..."
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                className="mt-1"
                rows={3}
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
              Estos códigos se han añadido a '{entityName}'. Puedes verlos y gestionarlos en la sección "Ver Códigos".
            </p>
          </div>
        )}

        <DialogFooter className="mt-2">
          {showSuccess ? (
            <Button onClick={handleCloseAndReset} className="w-full" variant="outline">Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleCloseAndReset}>Cancelar</Button>
              <Button onClick={handleCreateCodes} className="bg-primary hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Crear Códigos
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
