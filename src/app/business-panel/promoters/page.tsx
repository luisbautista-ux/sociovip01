
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogDescription as UIDialogDescription, DialogFooter } from "@/components/ui/dialog"; 
import { PlusCircle, Edit, Trash2, Search, UserPlus, Percent, ShieldCheck, ShieldX, Loader2, AlertTriangle, Info, MoreVertical, HandCoins, PiggyBank, CircleDollarSign } from "lucide-react";
import type { BusinessPromoterLink, BusinessPromoterFormData, InitialDataForPromoterLink, PlatformUser, QrClient, SocioVipMember, BusinessManagedEntity, GeneratedCode, BusinessPromoterLinkWithCommissions, PromoterPayment } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter as ShadcnAlertDialogFooter, AlertDialogHeader, AlertDialogTitle as UIAlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { cn, sanitizeObjectForFirestore, anyToDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, serverTimestamp, Timestamp, writeBatch, getDoc } from "firebase/firestore";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage as FormMessageHook, FormDescription } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";


const DniEntrySchema = z.object({
  docType: z.enum(['dni', 'ce'], { required_error: "Debes seleccionar un tipo de documento." }),
  docNumber: z.string().min(1, "El número de documento es requerido."),
}).superRefine((data, ctx) => {
    if (data.docType === 'dni') {
        if (!/^\d{8}$/.test(data.docNumber)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "El DNI debe contener exactamente 8 dígitos numéricos.",
                path: ['docNumber'],
            });
        }
    } else if (data.docType === 'ce') {
        if (!/^\d{10,20}$/.test(data.docNumber)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "El Carnet de Extranjería debe tener entre 10 y 20 dígitos numéricos.",
                path: ['docNumber'],
            });
        }
    }
});
type DniEntryValues = z.infer<typeof DniEntrySchema>;


interface CheckDniForPromoterResult {
  dni: string;
  existingLink?: BusinessPromoterLink;
  existingPlatformUserPromoter?: PlatformUser;
  qrClientData?: QrClient;
  socioVipData?: SocioVipMember;
}

const promoterFormSchemaBase = z.object({
  promoterDni: z.string(), 
  promoterName: z.string().min(3, "Nombre del promotor es requerido."),
  promoterEmail: z.string().email("Email del promotor inválido."),
  promoterPhone: z.string()
    .regex(/^9\d{8}$/, "El celular debe empezar con 9 y tener 9 dígitos.")
    .optional()
    .or(z.literal('')),
});

const promoterFormSchemaCreate = promoterFormSchemaBase.extend({
  password: z.string().optional(),
});

type PromoterFormValues = z.infer<typeof promoterFormSchemaCreate>;

interface BusinessPromoterFormProps {
  promoterLinkToEdit?: BusinessPromoterLink; 
  initialData?: InitialDataForPromoterLink;
  onSubmit: (data: BusinessPromoterFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function BusinessPromoterForm({ 
    promoterLinkToEdit, 
    initialData, 
    onSubmit, 
    onCancel, 
    isSubmitting = false 
}: BusinessPromoterFormProps) {
  
  const isEditingLink = !!promoterLinkToEdit;
  const isPrePopulatedFromPlatformUser = !!initialData?.existingPlatformUserPromoter;
  const isPrePopulatedFromOtherSource = !!(initialData && (initialData.qrClientData || initialData.socioVipData) && !isPrePopulatedFromPlatformUser);
  const needsPassword = !isEditingLink && !isPrePopulatedFromPlatformUser;

  const form = useForm<PromoterFormValues>({
    resolver: zodResolver(
      needsPassword
        ? promoterFormSchemaCreate.extend({
            password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
          })
        : promoterFormSchemaCreate
    ),
    defaultValues: {
        promoterDni: initialData?.dni || promoterLinkToEdit?.promoterDni || "",
        promoterName: promoterLinkToEdit?.promoterName || initialData?.existingPlatformUserPromoter?.name || `${initialData?.qrClientData?.name || initialData?.socioVipData?.name || ''} ${initialData?.qrClientData?.surname || initialData?.socioVipData?.surname || ''}`.trim() || "",
        promoterEmail: promoterLinkToEdit?.promoterEmail || initialData?.existingPlatformUserPromoter?.email || initialData?.socioVipData?.email || "",
        promoterPhone: promoterLinkToEdit?.promoterPhone || (initialData?.existingPlatformUserPromoter as any)?.phone || initialData?.qrClientData?.phone?.toString() || initialData?.socioVipData?.phone?.toString() || "",
        password: initialData?.dni || "",
    },
  });
  
  useEffect(() => {
    form.reset({
      promoterDni: initialData?.dni || promoterLinkToEdit?.promoterDni || "",
      promoterName: promoterLinkToEdit?.promoterName || initialData?.existingPlatformUserPromoter?.name || `${initialData?.qrClientData?.name || initialData?.socioVipData?.name || ''} ${initialData?.qrClientData?.surname || initialData?.socioVipData?.surname || ''}`.trim() || "",
      promoterEmail: promoterLinkToEdit?.promoterEmail || initialData?.existingPlatformUserPromoter?.email || initialData?.socioVipData?.email || "",
      promoterPhone: promoterLinkToEdit?.promoterPhone || (initialData?.existingPlatformUserPromoter as any)?.phone || initialData?.qrClientData?.phone?.toString() || initialData?.socioVipData?.phone?.toString() || "",
      password: initialData?.dni || "",
    });
  }, [promoterLinkToEdit, initialData, form]);

  const handleSubmit = (values: PromoterFormValues) => {
    const { password, ...rest } = values;
    const finalData: BusinessPromoterFormData = { ...rest, promoterDni: initialData?.dni || promoterLinkToEdit?.promoterDni || "" };
    if (needsPassword) {
      finalData.password = password;
    }
    onSubmit(finalData);
  };
  
  const disableContactFields = isPrePopulatedFromPlatformUser;
  
  let buttonText = "Crear y Vincular Promotor";
  if (isEditingLink) {
    buttonText = "Guardar Cambios";
  } else if (isPrePopulatedFromPlatformUser) {
    buttonText = "Vincular Promotor";
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {isPrePopulatedFromPlatformUser && !isEditingLink && (
             <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-700 dark:text-blue-300">Vinculando Promotor Existente</AlertTitle>
                <UIDialogDescription>
                    Este promotor ya tiene una cuenta en la plataforma. Sus datos están pre-rellenados.
                </UIDialogDescription>
            </Alert>
        )}
        {isPrePopulatedFromOtherSource && !isEditingLink && (
             <Alert variant="default" className="bg-sky-50 border-sky-200 dark:bg-sky-900/30 dark:border-sky-700">
                <Info className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <AlertTitle className="text-sky-700 dark:text-sky-300">Creando Cuenta de Promotor</AlertTitle>
                <UIDialogDescription>
                    Se creará una nueva cuenta de acceso para este promotor. Por favor, completa o confirma sus datos.
                </UIDialogDescription>
            </Alert>
        )}

        <FormField
          control={form.control}
          name="promoterDni"
          render={({ field }) => (
            <FormItem>
              <FormLabel>DNI / Carnet de Extranjería <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input placeholder="Verificado en paso anterior" {...field} disabled={true} className="disabled:bg-muted/50 disabled:text-muted-foreground/80" /></FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="promoterName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Promotor <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input placeholder="Ej: Juan Pérez" {...field} disabled={isSubmitting || disableContactFields} className={(isSubmitting || disableContactFields) ? "disabled:bg-muted/50 disabled:text-muted-foreground/80" : ""} /></FormControl>
              <FormMessageHook />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="promoterEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email del Promotor <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input type="email" placeholder="Ej: juan.promotor@example.com" {...field} disabled={isSubmitting || disableContactFields} className={(isSubmitting || disableContactFields) ? "disabled:bg-muted/50 disabled:text-muted-foreground/80" : ""} /></FormControl>
              <FormMessageHook />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="promoterPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teléfono del Promotor (Opcional)</FormLabel>
              <FormControl>
                <Input 
                  type="tel" 
                  placeholder="987654321" 
                  {...field} 
                  maxLength={9}
                  onChange={(e) => {
                    const numericValue = e.target.value.replace(/[^0-9]/g, '');
                    field.onChange(numericValue);
                  }}
                  disabled={isSubmitting || disableContactFields} 
                  className={(isSubmitting || disableContactFields) ? "disabled:bg-muted/50 disabled:text-muted-foreground/80" : ""}
                />
              </FormControl>
              <FormMessageHook />
            </FormItem>
          )}
        />

        {needsPassword && (
           <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña Inicial para el Promotor <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="text" placeholder="Mínimo 6 caracteres" {...field} value={field.value || ''} disabled={isSubmitting} /></FormControl>
                  <FormDescription className="text-xs">Por defecto, es el DNI del promotor. Puedes cambiarla.</FormDescription>
                  <FormMessageHook />
                </FormItem>
              )}
            />
        )}
        
        <DialogFooter className="pt-6">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="gradient" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {buttonText}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

const paymentFormSchema = z.object({
  amount: z.coerce.number().positive("El monto debe ser mayor a cero."),
  notes: z.string().optional(),
});
type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promoter: BusinessPromoterLinkWithCommissions | null;
  onConfirmPayment: (promoterUid: string, amount: number, notes?: string) => Promise<void>;
  isSubmitting: boolean;
}

function PaymentDialog({ open, onOpenChange, promoter, onConfirmPayment, isSubmitting }: PaymentDialogProps) {
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
  });

  useEffect(() => {
    if (promoter) {
      form.reset({
        amount: promoter.pendingAmount,
        notes: `Pago de comisiones a ${promoter.promoterName}.`,
      });
    }
  }, [promoter, form]);

  const handleSubmit = (values: PaymentFormValues) => {
    if (promoter?.platformUserUid) {
      onConfirmPayment(promoter.platformUserUid, values.amount, values.notes);
    }
  };
  
  if (!promoter) return null;

  return (
    <UIDialog open={open} onOpenChange={onOpenChange}>
      <UIDialogContent>
        <UIDialogHeader>
          <UIDialogTitle>Registrar Pago a {promoter.promoterName}</UIDialogTitle>
          <UIDialogDescription>
            El monto pendiente actual es de S/ {promoter.pendingAmount.toFixed(2)}. Puedes registrar un pago parcial o total.
          </UIDialogDescription>
        </UIDialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto a Pagar (S/)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} disabled={isSubmitting} /></FormControl>
                  <FormMessageHook />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (Opcional)</FormLabel>
                  <FormControl><Textarea placeholder="Ej: Pago por Yape, transferencia BCP..." {...field} disabled={isSubmitting} /></FormControl>
                  <FormMessageHook />
                </FormItem>
              )}
            />
             <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
                <Button type="submit" variant="gradient" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CircleDollarSign className="mr-2 h-4 w-4"/>}
                  Confirmar Pago
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </UIDialogContent>
    </UIDialog>
  );
}


  export default function BusinessPromotersPage() {
    const { userProfile, currentUser } = useAuth();
    const currentBusinessId = userProfile?.businessId;

    const [searchTerm, setSearchTerm] = useState("");
    const [promoterLinks, setPromoterLinks] = useState<BusinessPromoterLinkWithCommissions[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    
    // State for modal visibility control
    const [modalStep, setModalStep] = useState<'closed' | 'dni_entry' | 'promoter_form' | 'payment_form'>('closed');
    const [showAlreadyLinkedAlert, setShowAlreadyLinkedAlert] = useState(false);
    
    const [editingPromoterLink, setEditingPromoterLink] = useState<BusinessPromoterLink | null>(null);
    const [verifiedPromoterDniResult, setVerifiedPromoterDniResult] = useState<InitialDataForPromoterLink | null>(null);
    const [promoterLinkToEditFromAlert, setPromoterLinkToEditFromAlert] = useState<BusinessPromoterLink | null>(null);
    const [promoterForPayment, setPromoterForPayment] = useState<BusinessPromoterLinkWithCommissions | null>(null);


    const dniEntryForm = useForm<DniEntryValues>({
      resolver: zodResolver(DniEntrySchema),
      defaultValues: { docType: 'dni', docNumber: "" },
    });
    const watchedDocType = dniEntryForm.watch('docType');

    const fetchPromoterData = useCallback(async () => {
        if (!currentBusinessId || !currentUser) {
            setPromoterLinks([]);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const idToken = await currentUser.getIdToken();
            const response = await fetch('/api/business-panel/get-commissions-summary', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al obtener los datos de comisiones.');
            }

            const data: BusinessPromoterLinkWithCommissions[] = await response.json();
            setPromoterLinks(data.sort((a,b) => a.promoterName.localeCompare(b.promoterName)));

        } catch (error: any) {
            console.error("Promoters Page: Failed to fetch promoter data from API:", error);
            toast({ title: "Error al Cargar Promotores", description: `No se pudieron obtener los datos. ${error.message}`, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [currentBusinessId, currentUser, toast]);

    useEffect(() => {
      fetchPromoterData();
    }, [fetchPromoterData]);


    const filteredPromoters = useMemo(() => {
      return promoterLinks.filter(link =>
        (link.promoterName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (link.promoterEmail?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (link.promoterDni?.includes(searchTerm))
      );
    }, [promoterLinks, searchTerm]);

    const checkDniForPromoterAndLink = async (dni: string, businessIdToCheck: string): Promise<InitialDataForPromoterLink> => {
      let result: InitialDataForPromoterLink = { dni };

      const linksQuery = query(collection(db, "businessPromoterLinks"), where("businessId", "==", businessIdToCheck), where("promoterDni", "==", dni));
      const linksSnapshot = await getDocs(linksQuery);
      if (!linksSnapshot.empty) {
        result.existingLink = { id: linksSnapshot.docs[0].id, ...linksSnapshot.docs[0].data() } as BusinessPromoterLink;
      }

      const platformUserQuery = query(collection(db, "platformUsers"), where("dni", "==", dni), where("roles", "array-contains", "promoter"));
      const platformUserSnapshot = await getDocs(platformUserQuery);
      if (!platformUserSnapshot.empty) {
          result.existingPlatformUserPromoter = { id: platformUserSnapshot.docs[0].id, ...platformUserSnapshot.docs[0].data() } as PlatformUser;
      }
      
      if (!result.existingPlatformUserPromoter) {
          const qrClientQuery = query(collection(db, "qrClients"), where("dni", "==", dni));
          const qrClientSnapshot = await getDocs(qrClientQuery);
          if (!qrClientSnapshot.empty) {
              result.qrClientData = { id: qrClientSnapshot.docs[0].id, ...qrClientSnapshot.docs[0].data() } as QrClient;
          }
      }

      if (!result.existingPlatformUserPromoter && !result.qrClientData) {
          const socioVipQuery = query(collection(db, "socioVipMembers"), where("dni", "==", dni));
          const socioVipSnapshot = await getDocs(socioVipQuery);
          if (!socioVipSnapshot.empty) {
              result.socioVipData = { id: socioVipSnapshot.docs[0].id, ...socioVipSnapshot.docs[0].data() } as SocioVipMember;
          }
      }
      return result;
    };
    
    const closeModal = () => {
        setModalStep('closed');
        setEditingPromoterLink(null);
        setVerifiedPromoterDniResult(null);
        setPromoterForPayment(null);
    }

    const handleOpenAddPromoterFlow = () => {
      closeModal();
      dniEntryForm.reset({ docType: 'dni', docNumber: "" });
      setModalStep('dni_entry');
    };

    const handlePromoterDniVerificationSubmit = async (values: DniEntryValues) => {
      if (!currentBusinessId) {
          toast({ title: "Error de Negocio", description: "ID de negocio no disponible.", variant: "destructive" });
          return;
      }
      if (isSubmitting) return;
      
      const docNumberCleaned = values.docNumber.trim();
      setIsSubmitting(true);
      
      const checkResult = await checkDniForPromoterAndLink(docNumberCleaned, currentBusinessId);
      
      setIsSubmitting(false);

      if (checkResult.existingLink) {
          setPromoterLinkToEditFromAlert(checkResult.existingLink);
          setModalStep('closed');
          setShowAlreadyLinkedAlert(true);
      } else {
          setVerifiedPromoterDniResult(checkResult); 
          setModalStep('promoter_form');
      }
    };
    
    const handleEditLinkFromAlert = () => {
      if (promoterLinkToEditFromAlert) {
          setEditingPromoterLink(promoterLinkToEditFromAlert);
          setVerifiedPromoterDniResult(null); 
          setModalStep('promoter_form');
      }
      setShowAlreadyLinkedAlert(false);
      setPromoterLinkToEditFromAlert(null);
    };

    const handleAddOrEditPromoterLink = async (data: BusinessPromoterFormData) => {
      if (!currentBusinessId || !currentUser) {
          toast({ title: "Error de Sesión", description: "No se puede completar la operación.", variant: "destructive" });
          return;
      }
      setIsSubmitting(true);
      try {
        const idToken = await currentUser.getIdToken();
        
        if (editingPromoterLink) { 
          const linkRef = doc(db, "businessPromoterLinks", editingPromoterLink.id);
          const { password, promoterDni, ...updatePayload } = data; // DNI and password are not editable in an existing link
          await updateDoc(linkRef, sanitizeObjectForFirestore(updatePayload as any));
          toast({ title: "Vínculo Actualizado", description: `Se actualizó la información para ${data.promoterName}.` });
        
        } else if (verifiedPromoterDniResult?.existingPlatformUserPromoter) {
          // Link existing platform user via API
           const linkPayload = {
              promoterUid: verifiedPromoterDniResult.existingPlatformUserPromoter.uid,
              promoterData: {
                  promoterDni: verifiedPromoterDniResult.dni,
                  promoterName: data.promoterName,
                  promoterEmail: data.promoterEmail,
                  promoterPhone: data.promoterPhone || "",
              }
            };
            const response = await fetch('/api/business-panel/link-promoter', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }, 
                body: JSON.stringify(linkPayload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error al vincular promotor.');

          toast({ title: "Promotor Vinculado", description: `${data.promoterName} ha sido vinculado a tu negocio.` });

        } else if(verifiedPromoterDniResult) { 
          // Create new platform user via API
          if(!data.password) {
              toast({ title: "Error de Validación", description: `La contraseña es requerida para un nuevo promotor.`, variant: "destructive"});
              setIsSubmitting(false);
              return;
          }
          const creationPayload = {
            email: data.promoterEmail, password: data.password, displayName: data.promoterName,
            firestoreData: {
              dni: verifiedPromoterDniResult.dni, name: data.promoterName, email: data.promoterEmail,
              phone: data.promoterPhone,
            }
          };

          const response = await fetch('/api/business-panel/create-promoter', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }, 
            body: JSON.stringify(creationPayload)
          });

          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Error al crear promotor.');
          toast({ title: "Promotor Creado y Vinculado", description: `Se creó el usuario para ${data.promoterName}.` });
        }
        
        closeModal();
        fetchPromoterData();
      } catch (error: any) {
        console.error("Promoters Page: Failed to add/edit promoter link:", error);
        toast({ title: "Error al Guardar", description: `No se pudo procesar la solicitud. ${error.message}`, variant: "destructive"});
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleConfirmPayment = async (promoterUid: string, amount: number, notes?: string) => {
        if (!currentBusinessId) return;
        setIsSubmitting(true);
        const batch = writeBatch(db);

        try {
            // 1. Find all unpaid codes for this promoter in this business
            const entitiesQuery = query(collection(db, "businessEntities"), where("businessId", "==", currentBusinessId));
            const entitiesSnap = await getDocs(entitiesQuery);
            const codesToUpdate: {entityId: string, codeId: string}[] = [];
            let totalCommissionToSettle = 0;

            for (const entityDoc of entitiesSnap.docs) {
                const entity = { id: entityDoc.id, ...entityDoc.data() } as BusinessManagedEntity;
                const promoterCodes = (entity.generatedCodes || []).filter(
                    c => c.generatedByUid === promoterUid &&
                         c.commissionStatus !== 'paid' &&
                         (c.status === 'redeemed' || c.status === 'used')
                );
                promoterCodes.forEach(code => {
                    codesToUpdate.push({ entityId: entity.id, codeId: code.id });
                    totalCommissionToSettle += code.commissionGenerated || 0;
                });
            }

            // 2. Create a payment record
            const paymentRef = doc(collection(db, "promoterPayments"));
            batch.set(paymentRef, {
                businessId: currentBusinessId,
                promoterUid: promoterUid,
                amountPaid: amount,
                paymentDate: serverTimestamp(),
                notes: notes || "",
                settledCodeIds: codesToUpdate.map(c => c.codeId),
            });

            // 3. Update the status of each settled code inside its entity
            for (const { entityId, codeId } of codesToUpdate) {
                const entityRef = doc(db, "businessEntities", entityId);
                const entitySnap = await getDoc(entityRef); // Re-get inside transaction/batch logic
                if (entitySnap.exists()) {
                    const entityData = entitySnap.data() as BusinessManagedEntity;
                    const updatedCodes = (entityData.generatedCodes || []).map(c => {
                        if (c.id === codeId) {
                            return { ...c, commissionStatus: 'paid', paymentId: paymentRef.id };
                        }
                        return c;
                    });
                    batch.update(entityRef, { generatedCodes: updatedCodes });
                }
            }

            await batch.commit();
            toast({ title: "Pago Registrado", description: `Se registró un pago de S/ ${amount.toFixed(2)}.` });
            fetchPromoterData();
            closeModal();
        } catch (error: any) {
            console.error("Error confirming payment:", error);
            toast({ title: "Error al Registrar Pago", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeletePromoterLink = async (link: BusinessPromoterLink) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            await deleteDoc(doc(db, "businessPromoterLinks", link.id));
            
            toast({
                title: "Promotor Desvinculado",
                description: `${link.promoterName || 'El promotor'} ha sido desvinculado de tu negocio.`,
                variant: "destructive"
            });
            fetchPromoterData();
        } catch (error: any) {
            console.error("Promoters Page: Failed to delete promoter link:", error);
            toast({
                title: "Error al Desvincular",
                description: `No se pudo desvincular el promotor. Error: ${error.message}`,
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTogglePromoterLinkStatus = async (link: BusinessPromoterLink) => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      const newStatus = !link.isActive;
      
      try {
        await updateDoc(doc(db, "businessPromoterLinks", link.id), { isActive: newStatus });
        toast({ title: `Estado Actualizado`, description: `El promotor ${link.promoterName} ahora está ${newStatus ? 'activo' : 'inactivo'}.` });
        fetchPromoterData(); 
      } catch (error: any) {
        console.error("Promoters Page: Failed to toggle promoter link status:", error);
        toast({ title: "Error al Actualizar Estado", description: `No se pudo cambiar el estado del promotor. ${error.message}`, variant: "destructive"});
      } finally {
          setIsSubmitting(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold text-primary flex items-center self-start">
            <UserPlus className="h-8 w-8 mr-2" /> Mis Promotores
          </h1>
          <div className="self-end sm:self-center">
            <Button onClick={handleOpenAddPromoterFlow} variant="gradient" disabled={isLoading || !currentBusinessId}>
              <PlusCircle className="mr-2 h-4 w-4" /> Añadir/Vincular Promotor
            </Button>
          </div>
        </div>
        
        {!currentBusinessId && !isLoading && userProfile && (
          <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-destructive">Error de Configuración del Negocio</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Tu perfil de usuario no está asociado a un negocio.</p></CardContent>
          </Card>
        )}

        {currentBusinessId && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Mis Promotores Vinculados</CardTitle>
              <CardDescription>Gestiona tus promotores y sus comisiones pendientes y pagadas.</CardDescription>
              <div className="relative mt-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar por nombre, email o DNI del promotor..."
                  className="pl-8 w-full sm:w-[300px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-60">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="ml-4 text-lg text-muted-foreground">Cargando promotores...</p>
                </div>
              ) : promoterLinks.length === 0 && !searchTerm ? (
                <p className="text-center text-muted-foreground h-24 flex items-center justify-center">
                  No hay promotores vinculados. Haz clic en "Añadir/Vincular Promotor" para empezar.
                </p>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre Promotor</TableHead>
                      <TableHead>Monto Pendiente</TableHead>
                      <TableHead>Monto Pagado</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPromoters.length > 0 ? (
                      filteredPromoters.map((link) => (
                        <TableRow key={link.id}>
                          <TableCell className="font-medium">{link.promoterName || "N/A"}</TableCell>
                          <TableCell className="font-semibold text-destructive">S/ {link.pendingAmount.toFixed(2)}</TableCell>
                          <TableCell className="text-green-600">S/ {link.paidAmount.toFixed(2)}</TableCell>
                          <TableCell className="text-center">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleTogglePromoterLinkStatus(link)}
                              className={cn("text-xs px-2 py-1 h-auto", link.isActive ? "text-green-600 hover:text-green-700" : "text-red-600 hover:text-red-700")}
                              disabled={isSubmitting}
                            >
                              {link.isActive ? <ShieldCheck className="mr-1 h-4 w-4"/> : <ShieldX className="mr-1 h-4 w-4"/>}
                              {link.isActive ? "Activo" : "Inactivo"}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                             <Button variant="outline" size="xs" className="h-auto py-1 px-2 text-xs" onClick={() => { setPromoterForPayment(link); setModalStep('payment_form'); }} disabled={isSubmitting || link.pendingAmount <= 0}>
                               <HandCoins className="mr-1 h-3 w-3" /> Registrar Pago
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setEditingPromoterLink(link); setModalStep('promoter_form'); }} disabled={isSubmitting}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Editar</span>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={isSubmitting}>
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Desvincular</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <UIAlertDialogTitle>¿Seguro que quieres desvincular?</UIAlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción desvinculará al promotor <span className="font-semibold">{link.promoterName}</span> de tu negocio.
                                    No se eliminará su perfil global (si lo tiene).
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <ShadcnAlertDialogFooter>
                                  <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeletePromoterLink(link)}
                                    className="bg-destructive hover:bg-destructive/90"
                                    disabled={isSubmitting}
                                  >
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Desvincular
                                  </AlertDialogAction>
                                </ShadcnAlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center h-24">No se encontraron promotores con los filtros aplicados.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        <UIDialog open={modalStep !== 'closed'} onOpenChange={(isOpen) => !isOpen && closeModal()}>
            <UIDialogContent className="sm:max-w-lg">
                {modalStep === 'dni_entry' && (
                    <>
                        <UIDialogHeader>
                            <UIDialogTitle>Paso 1: Verificar Documento del Promotor</UIDialogTitle>
                            <UIDialogDescription>
                            Ingresa el documento del promotor para verificar si ya existe o está vinculado.
                            </UIDialogDescription>
                        </UIDialogHeader>
                        <Form {...dniEntryForm}>
                            <form onSubmit={dniEntryForm.handleSubmit(handlePromoterDniVerificationSubmit)} className="space-y-4 py-2">
                                <FormField control={dniEntryForm.control} name="docType" render={({ field }) => (
                                <FormItem className="space-y-2"><FormLabel>Tipo de Documento</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-2">
                                            <FormItem className="flex items-center space-x-3 space-y-0"><Label htmlFor="docType-dni-promoter" className={cn("w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer", field.value === 'dni' && "bg-primary text-primary-foreground border-primary")}><FormControl><RadioGroupItem value="dni" id="docType-dni-promoter" className="sr-only" /></FormControl>DNI</Label></FormItem>
                                            <FormItem className="flex items-center space-x-3 space-y-0"><Label htmlFor="docType-ce-promoter" className={cn("w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer", field.value === 'ce' && "bg-primary text-primary-foreground border-primary")}><FormControl><RadioGroupItem value="ce" id="docType-ce-promoter" className="sr-only" /></FormControl>Carnet de Extranjería</Label></FormItem>
                                </RadioGroup></FormControl><FormMessageHook /></FormItem>
                                )} />
                                <FormField control={dniEntryForm.control} name="docNumber" render={({ field }) => (
                                <FormItem><FormLabel>Número de Documento <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder={watchedDocType === 'dni' ? "8 dígitos numéricos" : "10-20 dígitos numéricos"} {...field} maxLength={watchedDocType === 'dni' ? 8 : 20} onChange={(e) => { const numericValue = e.target.value.replace(/[^0-9]/g, ''); field.onChange(numericValue); }} autoFocus disabled={isSubmitting} /></FormControl><FormMessageHook /></FormItem>
                                )} />
                                <DialogFooter className="pt-2">
                                <Button type="button" variant="outline" onClick={closeModal} disabled={isSubmitting}>Cancelar</Button>
                                <Button type="submit" variant="gradient" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verificar"}</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </>
                )}
                {modalStep === 'promoter_form' && (
                    <>
                        <UIDialogHeader>
                            <UIDialogTitle>{editingPromoterLink ? "Editar Vínculo con Promotor" : "Paso 2: Completar Datos del Promotor/Vínculo"}</UIDialogTitle>
                            <UIDialogDescription>
                                {editingPromoterLink 
                                    ? `Actualiza la información para ${editingPromoterLink.promoterName}.`
                                    : (verifiedPromoterDniResult?.existingPlatformUserPromoter 
                                        ? "Este DNI pertenece a un Promotor de la plataforma. Sus datos se usarán para vincularlo."
                                        : (verifiedPromoterDniResult?.qrClientData || verifiedPromoterDniResult?.socioVipData 
                                            ? "Este DNI fue encontrado como Cliente. Completa los datos para crear su cuenta de promotor y vincularlo."
                                            : "Ingresa los detalles para crear un nuevo usuario promotor y vincularlo a tu negocio."
                                        )
                                    )
                                }
                            </UIDialogDescription>
                        </UIDialogHeader>
                        <BusinessPromoterForm
                            promoterLinkToEdit={editingPromoterLink || undefined}
                            initialData={verifiedPromoterDniResult || undefined}
                            onSubmit={handleAddOrEditPromoterLink}
                            onCancel={closeModal}
                            isSubmitting={isSubmitting}
                        />
                    </>
                )}
                 {modalStep === 'payment_form' && (
                    <PaymentDialog
                        open={modalStep === 'payment_form'}
                        onOpenChange={(isOpen) => !isOpen && closeModal()}
                        promoter={promoterForPayment}
                        onConfirmPayment={handleConfirmPayment}
                        isSubmitting={isSubmitting}
                    />
                 )}
            </UIDialogContent>
        </UIDialog>

        <AlertDialog open={showAlreadyLinkedAlert} onOpenChange={setShowAlreadyLinkedAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <UIAlertDialogTitle className="flex items-center">
                  <AlertTriangle className="text-yellow-500 mr-2 h-6 w-6"/> Promotor ya Vinculado
              </UIAlertDialogTitle>
              <AlertDialogDescription>
                El promotor con DNI/CE <span className="font-semibold">{promoterLinkToEditFromAlert?.promoterDni}</span> ({promoterLinkToEditFromAlert?.promoterName}) ya está vinculado a tu negocio.
                <br/><br/>
                ¿Desea editar la información de este vínculo?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ShadcnAlertDialogFooter>
              <AlertDialogCancel onClick={() => { setShowAlreadyLinkedAlert(false); setPromoterLinkToEditFromAlert(null); }}>No, Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleEditLinkFromAlert} variant="gradient">
                  Sí, Editar Vínculo
              </AlertDialogAction>
            </ShadcnAlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

    