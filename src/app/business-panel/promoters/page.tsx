
  "use client";

  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
  import { Button } from "@/components/ui/button";
  import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogDescription as UIDialogDescription, DialogFooter as UIDialogFooter } from "@/components/ui/dialog"; 
  import { PlusCircle, Edit, Trash2, Search, UserPlus, Percent, ShieldCheck, ShieldX, Loader2, AlertTriangle, Info } from "lucide-react";
  import type { BusinessPromoterLink, PromoterProfile, BusinessPromoterFormData, InitialDataForPromoterLink, PlatformUser, QrClient, SocioVipMember } from "@/lib/types";
  import { format, parseISO } from "date-fns";
  import { es } from "date-fns/locale";
  import React, { useState, useEffect, useCallback } from "react";
  import { Input } from "@/components/ui/input";
  import { useToast } from "@/hooks/use-toast";
  import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as UIAlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
 
  import { cn, sanitizeObjectForFirestore } from "@/lib/utils";
  import { useAuth } from "@/context/AuthContext";
  import { db } from "@/lib/firebase";
  import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, serverTimestamp, Timestamp, writeBatch, getDoc } from "firebase/firestore";
  import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage as FormMessageHook } from "@/components/ui/form";
  import { zodResolver } from "@hookform/resolvers/zod";
  import { useForm } from "react-hook-form";
  import { z } from "zod";
  import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
  import { Label } from "@/components/ui/label";

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
  commissionRate: z.string().optional(),
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
        commissionRate: promoterLinkToEdit?.commissionRate || "",
        password: initialData?.dni || "",
    },
  });

  const handleSubmit = (values: PromoterFormValues) => {
    onSubmit(values);
  };
  
  const disableContactFields = isPrePopulatedFromPlatformUser;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {isPrePopulatedFromPlatformUser && !isEditingLink && (
             <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-700 dark:text-blue-300">Vinculando Promotor Existente</AlertTitle>
                <AlertDescription className="text-blue-600 dark:text-blue-400">
                    Este promotor ya tiene una cuenta en la plataforma. Sus datos están pre-rellenados. Solo define la comisión para este vínculo.
                </AlertDescription>
            </Alert>
        )}
        {isPrePopulatedFromOtherSource && !isEditingLink && (
             <Alert variant="default" className="bg-sky-50 border-sky-200 dark:bg-sky-900/30 dark:border-sky-700">
                <Info className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <AlertTitle className="text-sky-700 dark:text-sky-300">Creando Cuenta de Promotor</AlertTitle>
                <AlertDescription className="text-sky-600 dark:text-sky-400">
                    Se creará una nueva cuenta de acceso para este promotor. Por favor, completa o confirma sus datos.
                </AlertDescription>
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
              <FormMessage />
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
              <FormMessage />
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
              <FormMessage />
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
                  <FormMessage />
                </FormItem>
              )}
            />
        )}

        <FormField
          control={form.control}
          name="commissionRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tasa de Comisión para este Negocio (Ej: 10% o S/5 por código)</FormLabel>
              <FormControl><Input placeholder="Definir comisión para este negocio" {...field} value={field.value || ""} disabled={isSubmitting} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter className="pt-6">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditingLink ? "Guardar Cambios" : "Crear y Vincular Promotor"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}


  export default function BusinessPromotersPage() {
    const { userProfile, currentUser } = useAuth();
    const currentBusinessId = userProfile?.businessId;

    const [searchTerm, setSearchTerm] = useState("");
    const [promoterLinks, setPromoterLinks] = useState<BusinessPromoterLink[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const [showDniEntryModal, setShowDniEntryModal] = useState(false);
    const [dniForPromoterVerification, setDniForPromoterVerification] = useState("");
    const [verifiedPromoterDniResult, setVerifiedPromoterDniResult] = useState<InitialDataForPromoterLink | null>(null);
    
    const [showAddEditModal, setShowAddEditModal] = useState(false);
    const [editingPromoterLink, setEditingPromoterLink] = useState<BusinessPromoterLink | null>(null);

    const [showAlreadyLinkedAlert, setShowAlreadyLinkedAlert] = useState(false);
    const [promoterLinkToEditFromAlert, setPromoterLinkToEditFromAlert] = useState<BusinessPromoterLink | null>(null);


    const dniEntryForm = useForm<DniEntryValues>({
      resolver: zodResolver(DniEntrySchema),
      defaultValues: { docType: 'dni', docNumber: "" },
    });
    const watchedDocType = dniEntryForm.watch('docType');

    const fetchPromoterLinks = useCallback(async () => {
      if (!currentBusinessId) {
        setPromoterLinks([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const q = query(collection(db, "businessPromoterLinks"), where("businessId", "==", currentBusinessId));
        const querySnapshot = await getDocs(q);
        const fetchedLinks: BusinessPromoterLink[] = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            businessId: data.businessId,
            promoterDni: data.promoterDni,
            promoterName: data.promoterName,
            promoterEmail: data.promoterEmail,
            promoterPhone: data.promoterPhone,
            commissionRate: data.commissionRate,
            isActive: data.isActive === undefined ? true : data.isActive,
            isPlatformUser: data.isPlatformUser || false,
            platformUserUid: data.platformUserUid,
            joinDate: data.joinDate instanceof Timestamp ? data.joinDate.toDate().toISOString() : (data.joinDate || new Date().toISOString()),
          };
        });
        setPromoterLinks(fetchedLinks.sort((a,b) => (a.promoterName || "").localeCompare(b.promoterName || "")));
      } catch (error: any) {
        console.error("Promoters Page: Failed to fetch promoter links:", error);
        toast({
          title: "Error al Cargar Promotores",
          description: `No se pudieron obtener los promotores. ${error.message}`,
          variant: "destructive",
        });
        setPromoterLinks([]);
      } finally {
        setIsLoading(false);
      }
    }, [currentBusinessId, toast]);

    useEffect(() => {
  if (!currentBusinessId) {
    setIsLoading(false);
    setPromoterLinks([]);
    return;
  }
  fetchPromoterLinks();
}, [currentBusinessId, fetchPromoterLinks]);


    const filteredPromoters = promoterLinks.filter(link =>
      (link.promoterName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (link.promoterEmail?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (link.promoterDni?.includes(searchTerm))
    );

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

    const handleOpenAddPromoterFlow = () => {
      setEditingPromoterLink(null);
      setVerifiedPromoterDniResult(null);
      dniEntryForm.reset({ docType: 'dni', docNumber: "" });
      setPromoterLinkToEditFromAlert(null); 
      setShowAlreadyLinkedAlert(false); 
      setShowDniEntryModal(true);
    };

    const handlePromoterDniVerificationSubmit = async (values: DniEntryValues) => {
      if (!currentBusinessId) {
          toast({ title: "Error de Negocio", description: "ID de negocio no disponible.", variant: "destructive" });
          return;
      }
      if (isSubmitting) return;
      
      const docNumberCleaned = values.docNumber.trim();
      if (!docNumberCleaned) {
          toast({ title: "Número de Documento Requerido", description: "Por favor, ingresa un número válido.", variant: "destructive"});
          return;
      }
      
      setIsSubmitting(true);
      setDniForPromoterVerification(docNumberCleaned);

      let fetchedNameFromApi: string | undefined = undefined;

      if (values.docType === 'dni') {
        try {
          const response = await fetch('/api/admin/consult-dni', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dni: docNumberCleaned }),
          });
          const data = await response.json();
          if (response.ok && data.nombreCompleto) {
            fetchedNameFromApi = data.nombreCompleto;
            toast({ title: "DNI Encontrado", description: `Nombre: ${fetchedNameFromApi}` });
          } else if (!response.ok) {
            toast({ title: "Consulta DNI", description: data.error || "No se pudo obtener el nombre para este DNI.", variant: "default" });
          }
        } catch (error) {
          console.error("Error calling DNI consultation API route:", error);
          toast({ title: "Error de Red", description: "No se pudo comunicar con el servicio de consulta de DNI.", variant: "destructive" });
        }
      }
      
      const checkResult = await checkDniForPromoterAndLink(docNumberCleaned, currentBusinessId);
      
      if (fetchedNameFromApi) {
          const nameParts = fetchedNameFromApi.split(' ');
          const surname = nameParts.slice(0, 2).join(' ');
          const name = nameParts.slice(2).join(' ');
          if(checkResult.qrClientData) {
              checkResult.qrClientData.name = name;
              checkResult.qrClientData.surname = surname;
          } else if (checkResult.socioVipData) {
              checkResult.socioVipData.name = name;
              checkResult.socioVipData.surname = surname;
          }
      }
      
      setIsSubmitting(false);
      setShowDniEntryModal(false);

      if (checkResult.existingLink) {
          setPromoterLinkToEditFromAlert(checkResult.existingLink);
          setShowAlreadyLinkedAlert(true);
      } else {
          setVerifiedPromoterDniResult(checkResult); 
          setShowAddEditModal(true);
      }
    };
    
    const handleEditLinkFromAlert = () => {
      if (promoterLinkToEditFromAlert) {
          setEditingPromoterLink(promoterLinkToEditFromAlert);
          setVerifiedPromoterDniResult(null); 
          setShowAddEditModal(true);
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
        if (editingPromoterLink) { 
          const linkRef = doc(db, "businessPromoterLinks", editingPromoterLink.id);
          const updatePayload: Partial<BusinessPromoterLink> = {
              commissionRate: data.commissionRate,
          };
          await updateDoc(linkRef, sanitizeObjectForFirestore(updatePayload));
          toast({ title: "Vínculo Actualizado", description: `Se actualizó la información para ${data.promoterName}.` });
        } else if (verifiedPromoterDniResult?.existingPlatformUserPromoter) {
          // Link existing platform user
          const batch = writeBatch(db);
          const userRef = doc(db, "platformUsers", verifiedPromoterDniResult.existingPlatformUserPromoter.uid);
          const newBusinessIds = [...(verifiedPromoterDniResult.existingPlatformUserPromoter.businessIds || []), currentBusinessId];
          batch.update(userRef, { businessIds: newBusinessIds });
          
          const linkPayload = {
              businessId: currentBusinessId,
              promoterDni: verifiedPromoterDniResult.dni,
              promoterName: verifiedPromoterDniResult.existingPlatformUserPromoter.name,
              promoterEmail: verifiedPromoterDniResult.existingPlatformUserPromoter.email,
              promoterPhone: verifiedPromoterDniResult.existingPlatformUserPromoter.phone || "",
              commissionRate: data.commissionRate,
              isActive: true,
              isPlatformUser: true,
              platformUserUid: verifiedPromoterDniResult.existingPlatformUserPromoter.uid,
              joinDate: serverTimestamp(),
          };
          const linkDocRef = doc(collection(db, "businessPromoterLinks"));
          batch.set(linkDocRef, sanitizeObjectForFirestore(linkPayload));
          await batch.commit();
          toast({ title: "Promotor Vinculado", description: `${data.promoterName} ha sido vinculado a tu negocio.` });

        } else if(verifiedPromoterDniResult) { 
          // Create new platform user
          if(!data.password) {
              toast({ title: "Error de Validación", description: `La contraseña es requerida para un nuevo promotor.`, variant: "destructive"});
              setIsSubmitting(false);
              return;
          }
          const idToken = await currentUser.getIdToken();
          const creationPayload = {
            email: data.promoterEmail, password: data.password, displayName: data.promoterName,
            firestoreData: {
              dni: verifiedPromoterDniResult.dni, name: data.promoterName, email: data.promoterEmail,
              phone: data.promoterPhone, commissionRate: data.commissionRate
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
        
        setShowAddEditModal(false);
        setEditingPromoterLink(null);
        setVerifiedPromoterDniResult(null);
        fetchPromoterLinks();
      } catch (error: any) {
        console.error("Promoters Page: Failed to add/edit promoter link:", error);
        toast({ title: "Error al Guardar", description: `No se pudo procesar la solicitud. ${error.message}`, variant: "destructive"});
      } finally {
        setIsSubmitting(false);
      }
    };
    
    const handleDeletePromoterLink = async (link: BusinessPromoterLink) => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      try {
        const batch = writeBatch(db);
        // Remove link
        const linkRef = doc(db, "businessPromoterLinks", link.id);
        batch.delete(linkRef);

        // If user is a platform user, remove this businessId from their profile
        if (link.isPlatformUser && link.platformUserUid && currentBusinessId) {
          const userRef = doc(db, "platformUsers", link.platformUserUid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data() as PlatformUser;
            const updatedBusinessIds = (userData.businessIds || []).filter(id => id !== currentBusinessId);
            batch.update(userRef, { businessIds: updatedBusinessIds });
          }
        }
        await batch.commit();
        
        toast({ title: "Promotor Desvinculado", description: `${link.promoterName || 'El promotor'} ha sido desvinculado.`, variant: "destructive" });
        fetchPromoterLinks();
      } catch (error: any) {
        console.error("Promoters Page: Failed to delete promoter link:", error);
        toast({ title: "Error al Desvincular", description: `No se pudo desvincular el promotor. ${error.message}`, variant: "destructive"});
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
        fetchPromoterLinks(); 
      } catch (error: any) {
        console.error("Promoters Page: Failed to toggle promoter link status:", error);
        toast({ title: "Error al Actualizar Estado", description: `No se pudo cambiar el estado del promotor. ${error.message}`, variant: "destructive"});
      } finally {
          setIsSubmitting(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
          <h1 className="text-3xl font-bold text-primary flex items-center">
            <UserPlus className="h-8 w-8 mr-2" /> Gestión de Promotores
          </h1>
          <Button onClick={handleOpenAddPromoterFlow} className="bg-primary hover:bg-primary/90" disabled={isLoading || !currentBusinessId}>
            <PlusCircle className="mr-2 h-4 w-4" /> Añadir/Vincular Promotor
          </Button>
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
              <CardDescription>Personas que ayudan a promocionar tu negocio. El DNI es el identificador único.</CardDescription>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre Promotor</TableHead>
                      <TableHead>DNI/CE <span className="text-destructive">*</span></TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead><Percent className="inline-block h-4 w-4 mr-1 text-muted-foreground"/>Comisión</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="hidden lg:table-cell">Vinculado Desde</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPromoters.length > 0 ? (
                      filteredPromoters.map((link) => (
                        <TableRow key={link.id}>
                          <TableCell className="font-medium">{link.promoterName || "N/A"}</TableCell>
                          <TableCell>{link.promoterDni}</TableCell>
                          <TableCell className="hidden md:table-cell">{link.promoterEmail || "N/A"}</TableCell>
                          <TableCell>{link.commissionRate || "No definida"}</TableCell>
                          <TableCell>
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
                          <TableCell className="hidden lg:table-cell">{link.joinDate ? format(parseISO(link.joinDate), "P", { locale: es }) : "N/A"}</TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingPromoterLink(link); setShowAddEditModal(true); }} disabled={isSubmitting}>
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
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeletePromoterLink(link)}
                                    className="bg-destructive hover:bg-destructive/90"
                                    disabled={isSubmitting}
                                  >
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Desvincular
                                  </AlertDialogAction>
                                </AlertDialogFooter>
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
              )}
            </CardContent>
          </Card>
        )}
        
        <UIDialog open={showDniEntryModal} onOpenChange={setShowDniEntryModal}>
          <UIDialogContent className="sm:max-w-md">
            <UIDialogHeader>
              <UIDialogTitle>Paso 1: Verificar Documento del Promotor</UIDialogTitle>
              <UIDialogDescription>
                Ingresa el documento del promotor para verificar si ya existe o está vinculado.
              </UIDialogDescription>
            </UIDialogHeader>
            <Form {...dniEntryForm}>
              <form onSubmit={dniEntryForm.handleSubmit(handlePromoterDniVerificationSubmit)} className="space-y-4 py-2">
                <FormField
                  control={dniEntryForm.control}
                  name="docType"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Tipo de Documento</FormLabel>
                      <FormControl>
                          <RadioGroup
                              onValueChange={(value) => {
                                  field.onChange(value);
                                  dniEntryForm.setValue('docNumber', '');
                                  dniEntryForm.clearErrors('docNumber');
                              }}
                              defaultValue={field.value}
                              className="grid grid-cols-2 gap-2"
                          >
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                  <Label
                                      htmlFor="docType-dni-promoter"
                                      className={cn(
                                          "w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer",
                                          field.value === 'dni' && "bg-primary text-primary-foreground border-primary"
                                      )}
                                  >
                                      <FormControl>
                                          <RadioGroupItem value="dni" id="docType-dni-promoter" className="sr-only" />
                                      </FormControl>
                                      DNI
                                  </Label>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                  <Label
                                      htmlFor="docType-ce-promoter"
                                      className={cn(
                                          "w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer",
                                          field.value === 'ce' && "bg-primary text-primary-foreground border-primary"
                                      )}
                                  >
                                      <FormControl>
                                          <RadioGroupItem value="ce" id="docType-ce-promoter" className="sr-only" />
                                      </FormControl>
                                      Carnet de Extranjería
                                  </Label>
                              </FormItem>
                          </RadioGroup>
                      </FormControl>
                      <FormMessageHook />
                    </FormItem>
                  )}
                />
                <FormField
                  control={dniEntryForm.control}
                  name="docNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Documento <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={watchedDocType === 'dni' ? "8 dígitos numéricos" : "10-20 dígitos numéricos"} 
                          {...field} 
                          maxLength={watchedDocType === 'dni' ? 8 : 20}
                          onChange={(e) => {
                              const numericValue = e.target.value.replace(/[^0-9]/g, '');
                              field.onChange(numericValue);
                          }}
                          autoFocus 
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessageHook />
                    </FormItem>
                  )}
                />
                <UIDialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowDniEntryModal(false)} disabled={isSubmitting}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verificar"}
                  </Button>
                </UIDialogFooter>
              </form>
            </Form>
          </UIDialogContent>
        </UIDialog>

        <UIDialog open={showAddEditModal} onOpenChange={(open) => {
            if (!open) {
                setEditingPromoterLink(null);
                setVerifiedPromoterDniResult(null);
            }
            setShowAddEditModal(open);
        }}>
          <UIDialogContent className="sm:max-w-lg">
            <UIDialogHeader>
              <UIDialogTitle>{editingPromoterLink ? "Editar Vínculo con Promotor" : "Paso 2: Completar Datos del Promotor/Vínculo"}</UIDialogTitle>
              <UIDialogDescription>
                  {editingPromoterLink 
                    ? `Actualiza la tasa de comisión para ${editingPromoterLink.promoterName}.`
                    : (verifiedPromoterDniResult?.existingPlatformUserPromoter 
                        ? "Este DNI pertenece a un Promotor de la plataforma. Sus datos se usarán. Define la comisión y vincúlalo."
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
                onCancel={() => {
                  setShowAddEditModal(false);
                  setEditingPromoterLink(null);
                  setVerifiedPromoterDniResult(null);
                }}
                isSubmitting={isSubmitting}
              />
          </UIDialogContent>
        </UIDialog>

        <AlertDialog open={showAlreadyLinkedAlert} onOpenChange={setShowAlreadyLinkedAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <UIAlertDialogTitle className="flex items-center">
                  <AlertTriangle className="text-yellow-500 mr-2 h-6 w-6"/> Promotor ya Vinculado
              </UIAlertDialogTitle>
              <AlertDialogDescription>
                El promotor con DNI/CE <span className="font-semibold">{dniForPromoterVerification}</span> ({promoterLinkToEditFromAlert?.promoterName}) ya está vinculado a tu negocio.
                <br/><br/>
                ¿Desea editar la información de este vínculo (ej. tasa de comisión)?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setShowAlreadyLinkedAlert(false); setPromoterLinkToEditFromAlert(null); }}>No, Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleEditLinkFromAlert} className="bg-primary hover:bg-primary/90">
                  Sí, Editar Vínculo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

