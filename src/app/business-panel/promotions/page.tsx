
"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription as UIDialogDescription,
    DialogFooter as ShadcnDialogFooter 
} from "@/components/ui/dialog";
import { Ticket as TicketIconLucide, PlusCircle, Edit, Trash2, Search, BarChart3, Copy, ListChecks, QrCode as QrCodeIcon, Loader2 } from "lucide-react";
import type { BusinessManagedEntity, BusinessPromotionFormData, GeneratedCode } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter as UIAlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle as UIAlertDialogTitle, 
    AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { BusinessPromotionForm } from "@/components/business/forms/BusinessPromotionForm";
import { ManageCodesDialog } from "@/components/business/dialogs/ManageCodesDialog";
import { CreateCodesDialog } from "@/components/business/dialogs/CreateCodesDialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { isEntityCurrentlyActivatable, sanitizeObjectForFirestore } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { 
    collection, 
    addDoc, 
    doc, 
    getDoc,
    getDocs, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    serverTimestamp, 
    Timestamp 
} from "firebase/firestore";
import { cn } from "@/lib/utils";


export default function BusinessPromotionsPage() {
  const { userProfile, loadingAuth, loadingProfile } = useAuth();
  const { toast } = useToast();
  
  const [promotions, setPromotions] = useState<BusinessManagedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);
  
  const [showCreateEditPromotionModal, setShowCreateEditPromotionModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<BusinessManagedEntity | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  
  const [showManageCodesModal, setShowManageCodesModal] = useState(false);
  const [selectedEntityForViewingCodes, setSelectedEntityForViewingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const [showCreateCodesModal, setShowCreateCodesModal] = useState(false);
  const [selectedEntityForCreatingCodes, setSelectedEntityForCreatingCodes] = useState<BusinessManagedEntity | null>(null);

  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedPromotionForStats, setSelectedPromotionForStats] = useState<BusinessManagedEntity | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

 useEffect(() => {
    if (!loadingAuth && !loadingProfile) {
      if (userProfile) {
        if (userProfile.businessId && typeof userProfile.businessId === 'string' && userProfile.businessId.trim() !== '') {
          setCurrentBusinessId(userProfile.businessId);
        } else {
          setCurrentBusinessId(null);
          setPromotions([]);
          setIsLoading(false); 
          if (userProfile.roles.includes('business_admin') || userProfile.roles.includes('staff')) {
            toast({
              title: "Error de Negocio",
              description: "Tu perfil de usuario no está asociado a un negocio. No se pueden cargar promociones.",
              variant: "destructive",
              duration: 7000,
            });
          }
        }
      } else { 
        setCurrentBusinessId(null);
        setPromotions([]);
        setIsLoading(false);
      }
    }
  }, [userProfile, loadingAuth, loadingProfile, toast]);

  const fetchBusinessPromotions = useCallback(async (businessIdToFetch: string) => {
    console.log("Promotions Page: Attempting to fetch for businessId:", businessIdToFetch);
    if (!businessIdToFetch) {
      console.log("Promotions Page: No valid businessId, skipping fetch.");
      setPromotions([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    console.log("Promotions Page: Querying promotions with businessId:", businessIdToFetch);
    try {
      const q = query(
        collection(db, "businessEntities"),
        where("businessId", "==", businessIdToFetch),
        where("type", "==", "promotion")
      );
      const querySnapshot = await getDocs(q);
      console.log("Promotions Page: Firestore query executed. Snapshot size:", querySnapshot.size);

      const fetchedPromotions: BusinessManagedEntity[] = querySnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const nowISO = new Date().toISOString();
        
        return {
          id: docSnap.id,
          businessId: data.businessId || businessIdToFetch,
          type: "promotion" as "promotion",
          name: data.name || "Promoción sin nombre",
          description: data.description || "",
          termsAndConditions: data.termsAndConditions || "",
          startDate: data.startDate instanceof Timestamp ? data.startDate.toDate().toISOString() : (typeof data.startDate === 'string' ? data.startDate : nowISO),
          endDate: data.endDate instanceof Timestamp ? data.endDate.toDate().toISOString() : (typeof data.endDate === 'string' ? data.endDate : nowISO),
          usageLimit: data.usageLimit === undefined || data.usageLimit === null ? 0 : Number(data.usageLimit),
          isActive: data.isActive === undefined ? true : data.isActive,
          imageUrl: data.imageUrl || "",
          aiHint: data.aiHint || "",
          generatedCodes: Array.isArray(data.generatedCodes) ? data.generatedCodes.map(gc => sanitizeObjectForFirestore({...gc})) : [],
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : undefined),
          ticketTypes: [], 
          eventBoxes: [], 
          assignedPromoters: [], 
          maxAttendance: 0, 
        };
      });
      
      const sortedPromotions = fetchedPromotions.sort((a,b) => {
         if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
         if (a.createdAt) return -1;
         if (b.createdAt) return 1;
         if (a.startDate && b.startDate) return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
         return 0;
      });
      setPromotions(sortedPromotions);
      console.log("Promotions Page: Fetched promotions data:", sortedPromotions);
    } catch (error: any) {
      console.error("Promotions Page: Error fetching promotions:", error.code, error.message, error);
      toast({
        title: "Error al Cargar Promociones",
        description: `No se pudieron obtener las promociones. ${error.message}`,
        variant: "destructive",
      });
      setPromotions([]); 
    } finally {
        console.log("Promotions Page: fetchBusinessPromotions finished, setting isLoading to false.");
        setIsLoading(false);
    }
  }, [toast]); 

 useEffect(() => {
    if (currentBusinessId && !loadingAuth && !loadingProfile) {
        fetchBusinessPromotions(currentBusinessId);
    } else if (!currentBusinessId && !loadingAuth && !loadingProfile) {
        setPromotions([]);
        setIsLoading(false);
    }
  }, [currentBusinessId, fetchBusinessPromotions, loadingAuth, loadingProfile]);


  const filteredPromotions = useMemo(() => {
    return promotions.filter(promo =>
        (promo.name && typeof promo.name === 'string' ? promo.name.toLowerCase().includes(searchTerm.toLowerCase()) : false) ||
        (promo.description && typeof promo.description === 'string' ? promo.description.toLowerCase().includes(searchTerm.toLowerCase()) : false)
    ).sort((a, b) => { 
        const aActiveCurrent = isEntityCurrentlyActivatable(a);
        const bActiveCurrent = isEntityCurrentlyActivatable(b);
        if (aActiveCurrent && !bActiveCurrent) return -1;
        if (!aActiveCurrent && bActiveCurrent) return 1;
        if (a.isActive && !b.isActive) return -1; 
        if (!a.isActive && b.isActive) return 1;
        if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (a.startDate && b.startDate) return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
        return 0;
    });
  }, [promotions, searchTerm]);

  const handleOpenCreateEditModal = (promotion: BusinessManagedEntity | null, duplicate = false) => {
    setIsSubmitting(false); 
    setIsDuplicating(duplicate);
    if (duplicate && promotion) {
      const { id, generatedCodes, createdAt, ...promoToDuplicate } = sanitizeObjectForFirestore(promotion) as BusinessManagedEntity; 
      setEditingPromotion({
        ...promoToDuplicate,
        id: '', 
        name: `${promotion.name || 'Promoción'} (Copia)`,
        generatedCodes: [], 
        isActive: true, 
        createdAt: undefined, 
        businessId: promoToDuplicate.businessId || currentBusinessId || "",
        type: "promotion",
        startDate: promoToDuplicate.startDate || new Date().toISOString(),
        endDate: promoToDuplicate.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        usageLimit: promoToDuplicate.usageLimit === undefined ? 0 : promoToDuplicate.usageLimit,
        imageUrl: promoToDuplicate.imageUrl || "",
        aiHint: promoToDuplicate.aiHint || "",
        termsAndConditions: promoToDuplicate.termsAndConditions || "",
        ticketTypes: [],
        eventBoxes: [],
        assignedPromoters: [],
        maxAttendance: 0,
      });
    } else {
      setEditingPromotion(promotion ? sanitizeObjectForFirestore(promotion) as BusinessManagedEntity : null);
    }
    setShowCreateEditPromotionModal(true);
  };

  const handleFormSubmit = async (data: BusinessPromotionFormData) => {
    if (!currentBusinessId) {
      toast({ title: "Error de Negocio", description: "ID de negocio no disponible para guardar la promoción.", variant: "destructive", duration: 7000 });
      setIsSubmitting(false);
      return;
    }
    console.log("Promotions Page: handleFormSubmit called. Current Business ID:", currentBusinessId, "EditingPromo:", editingPromotion, "IsDuplicating:", isDuplicating);
    setIsSubmitting(true);

    const promotionPayloadBase = {
      name: data.name,
      description: data.description,
      termsAndConditions: data.termsAndConditions || "",
      startDate: data.startDate, 
      endDate: data.endDate,     
      usageLimit: data.usageLimit === undefined || data.usageLimit === null || isNaN(Number(data.usageLimit)) ? 0 : Number(data.usageLimit),
      isActive: data.isActive,
      imageUrl: data.imageUrl || (data.aiHint ? `https://placehold.co/600x400.png?text=${encodeURIComponent(data.aiHint.split(' ').slice(0,2).join('+'))}` : editingPromotion?.imageUrl || `https://placehold.co/600x400.png?text=${encodeURIComponent(data.name.substring(0,10))}`),
      aiHint: data.aiHint || data.name.split(' ').slice(0,2).join(' '),
    };
    
    const fullPayloadForFirestore: Omit<BusinessManagedEntity, 'id' | 'createdAt'> & { startDate: Timestamp, endDate: Timestamp, createdAt?: any, generatedCodes: GeneratedCode[] } = {
        ...promotionPayloadBase,
        businessId: currentBusinessId,
        type: "promotion" as "promotion",
        startDate: Timestamp.fromDate(new Date(promotionPayloadBase.startDate)),
        endDate: Timestamp.fromDate(new Date(promotionPayloadBase.endDate)),
        generatedCodes: (editingPromotion && !isDuplicating ? editingPromotion.generatedCodes : []) || [],
        ticketTypes: [],
        eventBoxes: [],
        assignedPromoters: [],
        maxAttendance: 0, 
    };
    
    const sanitizedPayload = sanitizeObjectForFirestore(fullPayloadForFirestore);
    console.log('Promotions Page: Saving promotion with payload:', sanitizedPayload);
    
    try {
      if (editingPromotion && !isDuplicating && editingPromotion.id) { 
        const { createdAt, ...updateData } = sanitizedPayload; 
        await updateDoc(doc(db, "businessEntities", editingPromotion.id), updateData);
        toast({ title: "Promoción Actualizada", description: `La promoción "${data.name}" ha sido actualizada.` });
      } else { 
        const createData = { ...sanitizedPayload, createdAt: serverTimestamp() };
        console.log("Promotions Page: Creating promotion with payload:", createData);
        const docRef = await addDoc(collection(db, "businessEntities"), createData);
        toast({ title: isDuplicating ? "Promoción Duplicada" : "Promoción Creada", description: `La promoción "${data.name}" ha sido creada con ID: ${docRef.id}.` });
      }
      setShowCreateEditPromotionModal(false);
      setEditingPromotion(null);
      setIsDuplicating(false);
      if (currentBusinessId) {
        fetchBusinessPromotions(currentBusinessId); 
      }
    } catch (error: any) {
      console.error("Promotions Page: Error saving promotion:", error.code, error.message, error);
      let errorDesc = `No se pudo guardar la promoción. ${error.message}`;
      if (error.code === 'permission-denied') {
        errorDesc = `Error de permisos al guardar promoción. (Negocio ID: ${currentBusinessId}, Usuario: ${userProfile?.email})`;
      } else if (error.code === 'invalid-argument' && error.message.includes("Unsupported field value: undefined")) {
        errorDesc = `Error al guardar: Uno de los campos tiene un valor indefinido no soportado. Revisa los datos del formulario, especialmente opcionales. Detalle: ${error.message}`;
      }
      toast({ title: "Error al Guardar Promoción", description: errorDesc, variant: "destructive", duration: 10000});
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeletePromotion = async (promotionId: string, promotionName?: string) => {
    if (isSubmitting) return;
     if (!currentBusinessId) {
        toast({ title: "Error", description: "ID de negocio no disponible.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "businessEntities", promotionId));
      toast({ title: "Promoción Eliminada", description: `La promoción "${promotionName || 'seleccionada'}" ha sido eliminada.`, variant: "destructive" });
      if (currentBusinessId) {
        fetchBusinessPromotions(currentBusinessId); 
      }
    } catch (error: any) {
      console.error("Promotions Page: Error deleting promotion:", error.code, error.message, error);
      toast({ title: "Error al Eliminar", description: `No se pudo eliminar la promoción. ${error.message}`, variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleNewCodesCreated = async (entityId: string, newCodes: GeneratedCode[], observation?: string) => {
    if (!userProfile?.name) {
        toast({title: "Error", description: "Nombre de usuario no disponible para registrar quién creó los códigos.", variant: "destructive"});
        return;
    }
    if (isSubmitting) {
      console.log("Promotions Page: Submission already in progress, skipping new codes creation.");
      return;
    }
    setIsSubmitting(true); 
    const targetPromotionRef = doc(db, "businessEntities", entityId);
    try {
        const targetPromotionSnap = await getDoc(targetPromotionRef);
        if (!targetPromotionSnap.exists()) {
            toast({title:"Error", description:"Promoción no encontrada para añadir códigos.", variant: "destructive"});
            setIsSubmitting(false);
            return;
        }
        const targetPromotionData = targetPromotionSnap.data() as BusinessManagedEntity;
        const existingCodes = targetPromotionData.generatedCodes || [];

        const newCodesWithDetails = newCodes.map(code => sanitizeObjectForFirestore({
            ...code,
            generatedByName: userProfile?.name || "Sistema", 
            observation: (observation && observation.trim() !== "") ? observation.trim() : null,
            redemptionDate: null, 
            redeemedByInfo: null, 
            isVipCandidate: false,
        }));

        const updatedCodes = [...existingCodes, ...newCodesWithDetails];
    
        await updateDoc(targetPromotionRef, { generatedCodes: updatedCodes });
        toast({title: `${newCodes.length} Código(s) Creado(s)`, description: `Para: ${targetPromotionData.name}. Guardados en la base de datos.`});
        
        if (currentBusinessId) {
          fetchBusinessPromotions(currentBusinessId);
        }
        
        if (selectedEntityForViewingCodes && selectedEntityForViewingCodes.id === entityId) {
            setSelectedEntityForViewingCodes(prev => prev ? {...prev, generatedCodes: updatedCodes} : null);
        }
    } catch (error: any) {
        console.error("Promotions Page: Error saving new codes to Firestore:", error.code, error.message, error);
        toast({title: "Error al Guardar Códigos", description: `No se pudieron guardar los códigos. ${error.message}`, variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  }; 

  const handleCodesUpdatedFromManageDialog = async (entityId: string, updatedCodesFromDialog: GeneratedCode[]) => {
    if (isSubmitting) return;
    if (!currentBusinessId) {
      toast({ title: "Error", description: "ID de negocio no disponible.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const targetPromotionRef = doc(db, "businessEntities", entityId);
     try {
        const targetPromotionSnap = await getDoc(targetPromotionRef);
        if (!targetPromotionSnap.exists()) {
            toast({title:"Error", description:"Promoción no encontrada para actualizar códigos.", variant: "destructive"});
            setIsSubmitting(false);
            return;
        }
        const targetPromotionData = targetPromotionSnap.data() as BusinessManagedEntity;
    
        const updatedCodesForFirestore = updatedCodesFromDialog.map(code => sanitizeObjectForFirestore(code));

        await updateDoc(targetPromotionRef, { generatedCodes: updatedCodesForFirestore });
        toast({title: "Códigos Actualizados", description: `Los códigos para "${targetPromotionData.name}" han sido guardados en la base de datos.`});
        
        if (currentBusinessId) {
          fetchBusinessPromotions(currentBusinessId);
        }
         if (selectedEntityForViewingCodes && selectedEntityForViewingCodes.id === entityId) {
            setSelectedEntityForViewingCodes(prev => prev ? {...prev, generatedCodes: updatedCodesForFirestore} : null);
        }
    } catch (error: any) {
        console.error("Promotions Page: Error saving updated codes to Firestore:", error.code, error.message, error);
        toast({title: "Error al Guardar Códigos", description: `No se pudieron actualizar los códigos. ${error.message}`, variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePromotionStatus = useCallback(async (promotionToToggle: BusinessManagedEntity) => {
    if (isSubmitting) return;
    if (!currentBusinessId || !promotionToToggle.id) {
        toast({ title: "Error", description: "ID de promoción o negocio no disponible.", variant: "destructive" });
        return;
    }
    
    const newStatus = !promotionToToggle.isActive;
    const promotionName = promotionToToggle.name;
        
    setIsSubmitting(true); 

    try {
      await updateDoc(doc(db, "businessEntities", promotionToToggle.id), { isActive: newStatus });
      toast({
        title: "Estado Actualizado",
        description: `La promoción "${promotionName}" ahora está ${newStatus ? "Activa" : "Inactiva"}.`
      });
      if (currentBusinessId) {
        fetchBusinessPromotions(currentBusinessId); 
      }
    } catch (error: any) {
      console.error("Promotions Page: Error updating promotion status:", error.code, error.message, error);
      toast({
        title: "Error al Actualizar Estado",
        description: `No se pudo cambiar el estado de la promoción. ${error.message}`,
        variant: "destructive"
      });
    } finally {
        setIsSubmitting(false); 
    }
  }, [currentBusinessId, isSubmitting, toast, fetchBusinessPromotions]);

  const openCreateCodesDialog = (promotion: BusinessManagedEntity) => {
    if (!isEntityCurrentlyActivatable(promotion)) {
        toast({
            title: "Acción no permitida",
            description: "Esta promoción no está activa o está fuera de su periodo de vigencia.",
            variant: "destructive"
        });
        return;
    }
    setSelectedEntityForCreatingCodes(promotion);
    setShowCreateCodesModal(true);
  };

  const openViewCodesDialog = (promotion: BusinessManagedEntity) => {
    setSelectedEntityForViewingCodes(promotion);
    setShowManageCodesModal(true);
  };

  const openStatsModal = (promotion: BusinessManagedEntity) => {
    setSelectedPromotionForStats(promotion);
    setShowStatsModal(true);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <TicketIconLucide className="h-8 w-8 mr-2" /> Gestión de Promociones
        </h1>
        <Button 
            onClick={() => handleOpenCreateEditModal(null)} 
            className="bg-primary hover:bg-primary/90" 
            disabled={!currentBusinessId || isSubmitting || isLoading}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Crear Promoción
        </Button>
      </div>
      
      {!currentBusinessId && !isLoading && !loadingAuth && !loadingProfile &&(
        <Card className="shadow-lg">
          <CardHeader><CardTitle className="text-destructive">Error de Configuración del Negocio</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">Tu perfil de usuario no está asociado a un negocio o el ID del negocio no está disponible. No se pueden cargar ni crear promociones.</p></CardContent>
        </Card>
      )}

      {currentBusinessId && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Mis Promociones</CardTitle>
            <CardDescription>Administra las promociones ofrecidas por tu negocio.</CardDescription>
            <div className="relative mt-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por nombre o descripción..."
                className="pl-8 w-full sm:w-[300px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
                 <div className="flex min-h-[calc(100vh-25rem)] items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="ml-4 text-lg text-muted-foreground">Cargando promociones...</p>
                </div>
            ) : promotions.length === 0 && !searchTerm ? (
              <p className="text-center text-muted-foreground h-24 flex items-center justify-center">
                No hay promociones registradas. Haz clic en "Crear Promoción" para empezar.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%] min-w-[250px]">Promoción y Gestión</TableHead>
                      <TableHead className="min-w-[140px]">Vigencia</TableHead>
                      <TableHead className="min-w-[180px]">QRs Promocionales</TableHead>
                      <TableHead className="min-w-[150px]">Códigos</TableHead>
                      <TableHead className="text-left min-w-[120px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPromotions.length > 0 ? filteredPromotions.map((promo) => {
                      const codesGeneratedCount = promo.generatedCodes?.length || 0;
                      const codesUsedCount = promo.generatedCodes?.filter(c => c.status === 'redeemed').length || 0;
                      const usageLimitDisplay = promo.usageLimit === undefined || promo.usageLimit === null || promo.usageLimit <= 0 ? 'Ilimitado' : promo.usageLimit;
                      
                      return (
                      <TableRow key={promo.id || `promo-fallback-${Math.random()}`}>
                        <TableCell className="font-medium align-top py-3">
                          <div className="font-semibold text-base">{promo.name}</div>
                          <div className="flex items-center space-x-2 mt-1.5">
                              <Switch
                                  checked={promo.isActive}
                                  onCheckedChange={() => handleTogglePromotionStatus(promo)}
                                  aria-label={`Estado de la promoción ${promo.name}`}
                                  id={`status-switch-${promo.id}`}
                                  disabled={isSubmitting}
                              />
                              <Label htmlFor={`status-switch-${promo.id}`} className="sr-only">
                                  {promo.isActive ? "Activa" : "Inactiva"}
                              </Label>
                              <Badge variant={promo.isActive ? "default" : "outline"} className={cn(promo.isActive && isEntityCurrentlyActivatable(promo) ? "bg-green-500 hover:bg-green-600" : (promo.isActive ? "bg-yellow-500 hover:bg-yellow-600 text-black" : "bg-red-500 hover:bg-red-600 text-white"))}>
                                  {promo.isActive ? (isEntityCurrentlyActivatable(promo) ? "Vigente" : "Activa (Fuera de Fecha)") : "Inactiva"}
                              </Badge>
                          </div>
                          <div className="mt-2.5 space-y-1 flex flex-col items-start">
                            <Button variant="outline" size="xs" onClick={() => handleOpenCreateEditModal(promo)} disabled={isSubmitting} className="px-2 py-1 h-auto text-xs">
                                <Edit className="h-3 w-3 mr-1" /> Editar
                            </Button>
                            <Button variant="outline" size="xs" onClick={() => openStatsModal(promo)} disabled={isSubmitting} className="px-2 py-1 h-auto text-xs">
                                <BarChart3 className="h-3 w-3 mr-1" /> Estadísticas
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="align-top py-3 text-xs">
                          {promo.startDate ? format(parseISO(promo.startDate), "P p", { locale: es }) : 'N/A'}
                          <br />
                          {promo.endDate ? format(parseISO(promo.endDate), "P p", { locale: es }) : 'N/A'}
                        </TableCell>
                        <TableCell className="align-top py-3">
                           <div className="flex flex-col text-xs space-y-0.5">
                                <span>Códigos Generados ({codesGeneratedCount})</span>
                                <span>Códigos Canjeados ({codesUsedCount})</span>
                                <span>Máximo Promociones ({usageLimitDisplay})</span>
                           </div>
                         </TableCell>
                         <TableCell className="align-top py-3">
                            <div className="flex flex-col items-start gap-1">
                                <Button 
                                    variant="outline" 
                                    size="xs" 
                                    onClick={() => openCreateCodesDialog(promo)} 
                                    disabled={!isEntityCurrentlyActivatable(promo) || isSubmitting} 
                                    className="px-2 py-1 h-auto text-xs"
                                >
                                    <QrCodeIcon className="h-3 w-3 mr-1" /> Crear
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="xs" 
                                    onClick={() => openViewCodesDialog(promo)} 
                                    disabled={isSubmitting} 
                                    className="px-2 py-1 h-auto text-xs"
                                >
                                    <ListChecks className="h-3 w-3 mr-1" /> Ver ({codesGeneratedCount})
                                </Button>
                            </div>
                          </TableCell>
                          <TableCell className="align-top py-3">
                             <div className="flex flex-col items-start gap-1">
                                <Button variant="outline" size="xs" onClick={() => handleOpenCreateEditModal(promo, true)} disabled={isSubmitting} className="px-2 py-1 h-auto text-xs">
                                    <Copy className="h-3 w-3 mr-1" /> Duplicar
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="xs" disabled={isSubmitting} className="px-2 py-1 h-auto text-xs">
                                            <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <UIAlertDialogTitle>¿Estás seguro?</UIAlertDialogTitle>
                                            <UIDialogDescription>
                                                Esta acción no se puede deshacer. Esto eliminará permanentemente la promoción:
                                                <span className="font-semibold"> {promo.name}</span> y todos sus códigos asociados.
                                            </UIDialogDescription>
                                        </AlertDialogHeader>
                                        <UIAlertDialogFooter>
                                            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => handleDeletePromotion(promo.id!, promo.name)}
                                                className="bg-destructive hover:bg-destructive/90"
                                                disabled={isSubmitting}
                                            >
                                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                Eliminar
                                            </AlertDialogAction>
                                        </UIAlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </TableCell>
                      </TableRow>
                    )
                    }) : (
                        !isLoading && <TableRow><TableCell colSpan={5} className="text-center h-24">No se encontraron promociones con los filtros aplicados.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      <Dialog open={showCreateEditPromotionModal} onOpenChange={(isOpen) => {
          if (!isOpen) {
              setEditingPromotion(null);
              setIsDuplicating(false);
          }
          setShowCreateEditPromotionModal(isOpen);
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isDuplicating ? `Duplicar Promoción: ${(editingPromotion?.name || 'Promoción').replace(' (Copia)','')} (Copia)` : (editingPromotion ? "Editar Promoción" : "Crear Nueva Promoción")}</DialogTitle>
            <UIDialogDescription>
              {isDuplicating ? "Creando una copia. Ajusta los detalles necesarios." : (editingPromotion ? `Actualiza los detalles de "${editingPromotion.name}".` : "Completa los detalles para tu nueva promoción.")}
            </UIDialogDescription>
          </DialogHeader>
          <BusinessPromotionForm
            promotion={editingPromotion || undefined} 
            onSubmit={handleFormSubmit} 
            onCancel={() => {
                setShowCreateEditPromotionModal(false);
                setEditingPromotion(null);
                setIsDuplicating(false);
            }}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {selectedEntityForCreatingCodes && userProfile && (
        <CreateCodesDialog
          open={showCreateCodesModal}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedEntityForCreatingCodes(null); 
            setShowCreateCodesModal(isOpen);
           }}
          entityName={selectedEntityForCreatingCodes.name}
          entityId={selectedEntityForCreatingCodes.id!}
          existingCodesValues={(selectedEntityForCreatingCodes.generatedCodes || []).map(c => c.value)}
          onCodesCreated={handleNewCodesCreated}
          isSubmittingMain={isSubmitting}
          currentUserProfileName={userProfile.name} 
        />
      )}

      {selectedEntityForViewingCodes && userProfile && (
        <ManageCodesDialog
          open={showManageCodesModal}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedEntityForViewingCodes(null); 
            setShowManageCodesModal(isOpen);
          }}
          entity={selectedEntityForViewingCodes}
          onCodesUpdated={handleCodesUpdatedFromManageDialog}
          onRequestCreateNewCodes={() => {
            const currentEntity = promotions.find(e => e.id === selectedEntityForViewingCodes?.id); 
            if(currentEntity) { 
                if (isEntityCurrentlyActivatable(currentEntity)) {
                    setShowManageCodesModal(false); 
                    setSelectedEntityForCreatingCodes(currentEntity);
                    setShowCreateCodesModal(true);
                } else {
                    toast({
                        title: "Acción no permitida",
                        description: "Esta promoción no está activa o está fuera de su periodo de vigencia.",
                        variant: "destructive"
                    });
                }
            }
          }}
        />
      )}

    <Dialog open={showStatsModal} onOpenChange={(isOpen) => { if(!isOpen) setSelectedPromotionForStats(null); setShowStatsModal(isOpen);}}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Estadísticas para: {selectedPromotionForStats?.name}</DialogTitle>
                <UIDialogDescription>Resumen del rendimiento de la promoción.</UIDialogDescription>
            </DialogHeader>
            {selectedPromotionForStats && (
                <div className="space-y-3 py-4">
                    <p><strong>Códigos Creados:</strong> ({selectedPromotionForStats.generatedCodes?.length || 0})</p>
                    <p><strong>Códigos Canjeados:</strong> ({selectedPromotionForStats.generatedCodes?.filter(c => c.status === 'redeemed').length || 0})</p>
                    <p><strong>Tasa de Canje:</strong> {selectedPromotionForStats.generatedCodes && selectedPromotionForStats.generatedCodes.length > 0 ? 
                        ((selectedPromotionForStats.generatedCodes.filter(c => c.status === 'redeemed').length / selectedPromotionForStats.generatedCodes.length) * 100).toFixed(1) + '%' 
                        : '0%'}
                    </p>
                     <p><strong>Límite de Canjes Configurado:</strong> ({selectedPromotionForStats.usageLimit && selectedPromotionForStats.usageLimit > 0 ? selectedPromotionForStats.usageLimit : 'Ilimitado'})</p>
                </div>
            )}
            <ShadcnDialogFooter> 
                <Button variant="outline" onClick={() => {setShowStatsModal(false); setSelectedPromotionForStats(null);}}>Cerrar</Button>
            </ShadcnDialogFooter>
        </DialogContent>
    </Dialog>
    </div>
  );
}

