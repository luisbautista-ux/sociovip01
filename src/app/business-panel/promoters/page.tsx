
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogDescription as UIDialogDescription, DialogFooter as UIDialogFooter } from "@/components/ui/dialog"; 
import { PlusCircle, Edit, Trash2, Search, UserPlus, Percent, ShieldCheck, ShieldX, Loader2, AlertTriangle } from "lucide-react";
import type { BusinessPromoterLink, PromoterProfile, BusinessPromoterFormData, InitialDataForPromoterLink, PlatformUser, QrClient, SocioVipMember } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as UIAlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BusinessPromoterForm } from "@/components/business/forms/BusinessPromoterForm";
import { cn, sanitizeObjectForFirestore } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, serverTimestamp, Timestamp } from "firebase/firestore";
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


export default function BusinessPromotersPage() {
  const { userProfile } = useAuth();
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
      console.warn("Promoters Page: No currentBusinessId or userProfile available. Skipping fetch.");
      setPromoterLinks([]);
      setIsLoading(false);
      if (userProfile === null) {
        toast({ title: "Error de Negocio", description: "ID de negocio no disponible en tu perfil.", variant: "destructive", duration: 7000 });
      }
      return;
    }
    console.log('Promoters Page: UserProfile for query:', userProfile);
    console.log('Promoters Page: Querying promoter links with businessId:', currentBusinessId);
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
      console.log("Promoters Page: Fetched links successfully:", fetchedLinks.length);
    } catch (error: any) {
       console.error("Promoters Page: Failed to fetch promoter links:", error.code, error.message, error);
      toast({
        title: "Error al Cargar Promotores Vinculados",
        description: `No se pudieron obtener los promotores. ${error.message}`,
        variant: "destructive",
      });
      setPromoterLinks([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentBusinessId, userProfile, toast]);

  useEffect(() => {
    if (currentBusinessId) {
      fetchPromoterLinks();
    } else if (userProfile === null) { 
        setIsLoading(false);
        setPromoterLinks([]);
    }
  }, [currentBusinessId, userProfile, fetchPromoterLinks]);


  const filteredPromoters = promoterLinks.filter(link =>
    (link.promoterName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (link.promoterEmail?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (link.promoterDni?.includes(searchTerm))
  );

  const checkDniForPromoterAndLink = async (dni: string, businessIdToCheck: string): Promise<InitialDataForPromoterLink> => {
    let result: InitialDataForPromoterLink = { dni };

    // 1. Check if DNI is already linked to this specific business
    const linksQuery = query(collection(db, "businessPromoterLinks"), where("businessId", "==", businessIdToCheck), where("promoterDni", "==", dni));
    const linksSnapshot = await getDocs(linksQuery);
    if (!linksSnapshot.empty) {
      result.existingLink = { id: linksSnapshot.docs[0].id, ...linksSnapshot.docs[0].data() } as BusinessPromoterLink;
    }

    // 2. Check if DNI exists as a PlatformUser with role 'promoter'
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
        checkResult.qrClientData = { ...checkResult.qrClientData, name: fetchedNameFromApi } as QrClient;
    }
    
    setIsSubmitting(false);
    setShowDniEntryModal(false);

    if (checkResult.existingLink) {
        setPromoterLinkToEditFromAlert(checkResult.existingLink);
        setShowAlreadyLinkedAlert(true);
    } else {
        setVerifiedPromoterDniResult(checkResult); 
        setEditingPromoterLink(null); 
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
    if (!currentBusinessId) {
        toast({ title: "Error de Negocio", description: "ID de negocio no disponible.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    try {
      if (editingPromoterLink) { 
        const linkRef = doc(db, "businessPromoterLinks", editingPromoterLink.id);
        const updatePayload: Partial<BusinessPromoterLink> = {
            commissionRate: data.commissionRate,
            promoterName: editingPromoterLink.isPlatformUser ? editingPromoterLink.promoterName : data.promoterName,
            promoterEmail: editingPromoterLink.isPlatformUser ? editingPromoterLink.promoterEmail : data.promoterEmail,
            promoterPhone: editingPromoterLink.isPlatformUser ? editingPromoterLink.promoterPhone : data.promoterPhone,
        };
        await updateDoc(linkRef, sanitizeObjectForFirestore(updatePayload));
        toast({ title: "Vínculo de Promotor Actualizado", description: `Se actualizó la información para ${data.promoterName}.` });
      } else if (verifiedPromoterDniResult) { 
        const newLinkPayloadRaw: Omit<BusinessPromoterLink, 'id' | 'joinDate'> & { joinDate: any } = {
            businessId: currentBusinessId,
            promoterDni: verifiedPromoterDniResult.dni,
            promoterName: data.promoterName, 
            promoterEmail: data.promoterEmail,
            promoterPhone: data.promoterPhone,
            commissionRate: data.commissionRate,
            isActive: true,
            isPlatformUser: !!verifiedPromoterDniResult.existingPlatformUserPromoter,
            platformUserUid: verifiedPromoterDniResult.existingPlatformUserPromoter?.uid,
            joinDate: serverTimestamp(),
        };
        await addDoc(collection(db, "businessPromoterLinks"), sanitizeObjectForFirestore(newLinkPayloadRaw));
        toast({ title: "Promotor Vinculado", description: `${data.promoterName} ha sido vinculado a tu negocio.` });
      }
      
      setShowAddEditModal(false);
      setEditingPromoterLink(null);
      setVerifiedPromoterDniResult(null);
      fetchPromoterLinks();
    } catch (error: any) {
      console.error("Promoters Page: Failed to add/edit promoter link:", error.code, error.message, error);
      toast({ title: "Error al Guardar", description: `No se pudo procesar la solicitud del promotor. ${error.message}`, variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeletePromoterLink = async (link: BusinessPromoterLink) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "businessPromoterLinks", link.id));
      toast({ title: "Promotor Desvinculado", description: `${link.promoterName || 'El promotor'} ha sido desvinculado.`, variant: "destructive" });
      fetchPromoterLinks();
    } catch (error: any) {
       console.error("Promoters Page: Failed to delete promoter link:", error.code, error.message, error);
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
      console.error("Promoters Page: Failed to toggle promoter link status:", error.code, error.message, error);
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
                          <Button variant="ghost" size="icon" onClick={() => { setEditingPromoterLink(link); setVerifiedPromoterDniResult(null); setShowAddEditModal(true); }} disabled={isSubmitting}>
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
      
      <UIDialog open={showDniEntryModal} onOpenChange={(isOpen) => {
          if (!isOpen) {
            dniEntryForm.reset({ docType: 'dni', docNumber: "" });
            setDniForPromoterVerification("");
          }
          setShowDniEntryModal(isOpen);
      }}>
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

      <UIDialog open={showAddEditModal} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setEditingPromoterLink(null); 
          setVerifiedPromoterDniResult(null);
        }
        setShowAddEditModal(isOpen);
      }}>
        <UIDialogContent className="sm:max-w-lg">
          <UIDialogHeader>
            <UIDialogTitle>{editingPromoterLink ? "Editar Vínculo con Promotor" : "Paso 2: Completar Datos del Promotor/Vínculo"}</UIDialogTitle>
             <UIDialogDescription>
                {editingPromoterLink 
                  ? `Actualiza la tasa de comisión para ${editingPromoterLink.promoterName}. Los datos del promotor (si es Usuario de Plataforma) no se cambian aquí.`
                  : (verifiedPromoterDniResult?.existingPlatformUserPromoter 
                      ? "Este DNI pertenece a un Promotor de la plataforma. Sus datos de contacto se usarán. Define la comisión."
                      : (verifiedPromoterDniResult?.qrClientData || verifiedPromoterDniResult?.socioVipData 
                          ? "Este DNI fue encontrado como Cliente. Algunos datos han sido pre-rellenados. Completa la información para este vínculo de promotor."
                          : "Ingresa los detalles para este nuevo promotor y su comisión para tu negocio."
                        )
                    )
                }
            </UIDialogDescription>
          </UIDialogHeader>
          <BusinessPromoterForm
            promoterLinkToEdit={editingPromoterLink || undefined}
            initialData={!editingPromoterLink && verifiedPromoterDniResult ? verifiedPromoterDniResult : undefined}
            onSubmit={handleAddOrEditPromoterLink} 
            onCancel={() => { setShowAddEditModal(false); setEditingPromoterLink(null); setVerifiedPromoterDniResult(null); }}
            isSubmitting={isSubmitting}
          />
        </UIDialogContent>
      </UIDialog>

       <AlertDialog open={showAlreadyLinkedAlert} onOpenChange={(isOpen) => {
           if(!isOpen) setPromoterLinkToEditFromAlert(null);
           setShowAlreadyLinkedAlert(isOpen);
        }}>
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

