
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo, useRef } from "react";
import type { Business, GeneratedCode, PlatformUserRole, BusinessManagedEntity, TicketType } from "@/lib/types";
import { CheckCircle, Copy, PlusCircle, Loader2, AlertTriangle, Info, Download, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormMessage, FormItem } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { generateCodesPDF } from "@/lib/utils";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

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
  entity: BusinessManagedEntity | null;
  onCodesCreated: (entityId: string, newCodes: GeneratedCode[], observation?: string, creatorUid?: string) => Promise<void>; 
  existingCodesValues: string[]; 
  isSubmittingMain?: boolean; 
  currentUserProfileName?: string;
  currentUserProfileUid?: string;
  currentUserRoles?: PlatformUserRole[];
}

export function CreateCodesDialog({ 
    open, 
    onOpenChange, 
    entity,
    onCodesCreated,
    existingCodesValues,
    isSubmittingMain = false, 
    currentUserProfileName,
    currentUserProfileUid,
    currentUserRoles = [],
}: CreateCodesDialogProps) {
  const [numCodes, setNumCodes] = useState<number | string>(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [justCreatedCodes, setJustCreatedCodes] = useState<GeneratedCode[]>([]);
  const [isCreating, setIsCreating] = useState(false); 
  const { toast } = useToast();
  const form = useForm();
  const [businessDetails, setBusinessDetails] = useState<Business | null>(null);
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<string | undefined>(undefined);

  const canDownloadPdf = currentUserRoles.includes('business_admin') || currentUserRoles.includes('staff');
  const isEventWithTickets = entity?.type === 'event' && entity.ticketTypes && entity.ticketTypes.length > 0;

  useEffect(() => {
    const fetchBusinessDetails = async () => {
      if(open && entity?.businessId) {
        const businessRef = doc(db, "businesses", entity.businessId);
        const businessSnap = await getDoc(businessRef);
        if(businessSnap.exists()) {
          setBusinessDetails({id: businessSnap.id, ...businessSnap.data()} as Business);
        }
      }
    };
    fetchBusinessDetails();
  }, [open, entity]);

  const maxCodesCanCreate = useMemo(() => {
    if (entity?.maxAttendance && entity.maxAttendance > 0) {
      return Math.max(0, entity.maxAttendance - (entity.generatedCodes?.length || 0));
    }
    return 50; 
  }, [entity]);

  useEffect(() => {
    if (open) {
      setNumCodes(1);
      setShowSuccess(false);
      setJustCreatedCodes([]);
      setIsCreating(false);
      setSelectedTicketTypeId(isEventWithTickets ? entity.ticketTypes?.[0]?.id : undefined);
    }
  }, [open, isEventWithTickets, entity]);

  const handleCreateCodes = async () => {
    if (!entity) return;

    if (isEventWithTickets && !selectedTicketTypeId) {
      toast({
        title: "Selección requerida",
        description: "Por favor, selecciona un tipo de entrada para los códigos.",
        variant: "destructive",
      });
      return;
    }

    const numToCreate = Number(numCodes);
    if (isNaN(numToCreate) || numToCreate < 1 || numToCreate > 50) { 
      toast({
        title: "Cantidad inválida",
        description: "Solo se permite crear hasta 50 códigos a la vez.",
        variant: "destructive",
      });
      return;
    }

    if (entity.maxAttendance && entity.maxAttendance > 0 && ((entity.generatedCodes?.length || 0) + numToCreate > entity.maxAttendance)) {
       toast({
        title: "Límite de Aforo Excedido",
        description: `Solo puedes crear ${maxCodesCanCreate} código(s) más para no superar el aforo de ${entity.maxAttendance}.`,
        variant: "destructive",
      });
      return;
    }
    
    setIsCreating(true);

    const newCodesBatch: GeneratedCode[] = [];
    const currentAndNewCodes = new Set(existingCodesValues);
    const selectedTicketType = entity.ticketTypes?.find(t => t.id === selectedTicketTypeId);

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
      newCodesBatch.push({
        id: `code-${entity.id}-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        entityId: entity.id,
        value: newCodeValue,
        status: "available",
        generatedByName: currentUserProfileName || "Sistema",
        generatedByUid: currentUserProfileUid || undefined,
        generatedDate: new Date().toISOString(),
        observation: null,
        redemptionDate: null, 
        redeemedByInfo: null, 
        isVipCandidate: false,
        ticketTypeId: selectedTicketType?.id,
        ticketTypeName: selectedTicketType?.name,
      });
    }

    try {
        await onCodesCreated(entity.id, newCodesBatch, undefined, currentUserProfileUid);
        setJustCreatedCodes(newCodesBatch);
        setShowSuccess(true);
    } catch (e) {
        console.error("Error passed up from onCodesCreated:", e);
    } finally {
        setIsCreating(false);
    }
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

  const handleDownloadPDF = () => {
    if (justCreatedCodes.length === 0 || !businessDetails || !entity) return;
    
    const businessUrl = businessDetails.customUrlPath
      ? `https://sociovip.app/${businessDetails.customUrlPath}`
      : `https://sociovip.app/business/${entity?.businessId}`;

    generateCodesPDF(justCreatedCodes, businessDetails, entity);
  };

  const handleCloseAndReset = () => {
    onOpenChange(false); 
  };

  const canCreateAnyCodes = !entity?.maxAttendance || entity.maxAttendance === 0 || maxCodesCanCreate > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {showSuccess ? "Códigos Creados Exitosamente" : `Crear códigos para: ${entity?.name}`}
          </DialogTitle>
          {!showSuccess && (
            <DialogDescription>
              Define la cantidad de códigos.
            </DialogDescription>
          )}
        </DialogHeader>
        
        {!showSuccess ? (
        <Form {...form}>
          <form className="space-y-4 py-4" onSubmit={(e) => { e.preventDefault(); handleCreateCodes(); }}>
             {(entity?.maxAttendance ?? 0) > 0 && (
                <Alert variant={canCreateAnyCodes ? "default" : "destructive"}>
                    {canCreateAnyCodes ? <Info className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    <AlertTitle>{canCreateAnyCodes ? "Información de Aforo" : "Aforo Completo"}</AlertTitle>
                    <DialogDescription>
                    {canCreateAnyCodes ? `Este evento tiene un aforo de ${entity?.maxAttendance}. Actualmente hay ${entity?.generatedCodes?.length || 0} códigos. Puedes crear hasta ${maxCodesCanCreate} más.` : `Ya se ha alcanzado el aforo máximo de ${entity?.maxAttendance} códigos para este evento.`}
                    </DialogDescription>
                </Alert>
             )}
            
            {isEventWithTickets && (
              <FormItem>
                <Label htmlFor="ticketTypeSelect">
                  Tipo de Entrada <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedTicketTypeId} onValueChange={setSelectedTicketTypeId} disabled={isCreating || isSubmittingMain}>
                  <SelectTrigger id="ticketTypeSelect">
                    <SelectValue placeholder="Selecciona un tipo de entrada" />
                  </SelectTrigger>
                  <SelectContent>
                    {entity.ticketTypes?.map((ticket) => (
                      <SelectItem key={ticket.id} value={ticket.id}>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: ticket.color }}></div>
                          {ticket.name} (S/ {ticket.cost.toFixed(2)})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}

            <FormField
              control={form.control}
              name="numCodes"
              render={() => (
                <FormItem>
                  <Label htmlFor="numCodesToGenerate">
                    Cantidad de códigos (Máx. 50 x vez) <span className="text-destructive">*</span>
                  </Label>
                  <FormControl>
                    <Input
                      id="numCodesToGenerate"
                      type="number"
                      min="1"
                      max={Math.min(50, canCreateAnyCodes ? maxCodesCanCreate || 50 : 0)}
                      value={numCodes || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNumCodes(value === '' ? '' : parseInt(value, 10));
                      }}
                      className="mt-1 no-spinner"
                      disabled={isCreating || isSubmittingMain || !canCreateAnyCodes}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
          </form>
          </Form>
        ) : (
          <div className="py-6 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <p className="text-lg font-medium">¡Has creado {justCreatedCodes.length} código(s)!</p>
            {isEventWithTickets && (
              <p className="text-sm text-muted-foreground">
                Para el tipo de entrada: <span className="font-semibold">{entity?.ticketTypes?.find(t => t.id === selectedTicketTypeId)?.name}</span>
              </p>
            )}
            <div className="flex flex-col sm:flex-row sm:justify-center items-center gap-2">
              <Button onClick={handleCopyCreatedCodes} variant="outline" size="lg" className="w-full">
                <Copy className="mr-2 h-4 w-4" /> Copiar códigos ({justCreatedCodes.length})
              </Button>
              {canDownloadPdf && (
                <Button onClick={handleDownloadPDF} variant="outline" size="lg" className="w-full">
                    <Download className="mr-2 h-4 w-4" /> Descargar PDF
                </Button>
              )}
            </div>
             <p className="text-sm text-muted-foreground">
              Estos códigos se han añadido a '{entity?.name}'.
            </p>
          </div>
        )}

        <DialogFooter className="mt-2">
          {showSuccess ? (
            <Button onClick={handleCloseAndReset} className="w-full" variant="outline">Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleCloseAndReset} disabled={isCreating || isSubmittingMain}>Cancelar</Button>
              <Button onClick={handleCreateCodes} variant="gradient" disabled={isCreating || isSubmittingMain || !canCreateAnyCodes}>
                {(isCreating || isSubmittingMain) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <PlusCircle className="mr-2 h-4 w-4" /> Crear códigos
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
