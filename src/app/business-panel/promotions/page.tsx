

"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as ShadcnCardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog as ShadcnDialog,
  DialogContent as ShadcnDialogContent,
  DialogHeader as ShadcnDialogHeader,
  DialogTitle as ShadcnDialogTitle,
  DialogDescription as ShadcnDialogDescription,
  DialogFooter as ShadcnDialogFooter,
} from "@/components/ui/dialog";
import { Ticket as TicketIconLucide, PlusCircle, Edit, Trash2, Search, BarChart3, Copy, ListChecks, QrCode as QrCodeIcon, Loader2, AlertTriangle, MoreVertical } from "lucide-react";
import type { BusinessManagedEntity, BusinessPromotionFormData, GeneratedCode, Business, QrTemplateLayout } from "@/lib/types";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BusinessPromotionForm } from "@/components/business/forms/BusinessPromotionForm";
import { ManageCodesDialog } from "@/components/business/dialogs/ManageCodesDialog";
import { CreateCodesDialog } from "@/components/business/dialogs/CreateCodesDialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { isEntityCurrentlyActivatable, sanitizeObjectForFirestore } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc, query, where, serverTimestamp, Timestamp, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function BusinessPromotionsPage() {
  const { userProfile, loadingAuth, loadingProfile } = useAuth();
  const { toast } = useToast();
  
  const [promotions, setPromotions] = useState<BusinessManagedEntity[]>([]);
  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);
  const [businessDetails, setBusinessDetails] = useState<Business | null>(null);
  
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
    if (loadingAuth || loadingProfile) {
      setIsLoadingPageData(true);
      return;
    }

    if (userProfile?.businessId) {
      setCurrentBusinessId(userProfile.businessId);
    } else {
      setIsLoadingPageData(false);
    }
  }, [userProfile, loadingAuth, loadingProfile]);


  const fetchBusinessData = useCallback(async (businessIdToFetch: string) => {
    setIsLoadingPageData(true);
    try {
      // Fetch Business Details
      const businessDocRef = doc(db, "businesses", businessIdToFetch);
      const businessSnap = await getDoc(businessDocRef);
      if (businessSnap.exists()) {
        setBusinessDetails({ id: businessSnap.id, ...businessSnap.data() } as Business);
      } else {
         toast({ title: "Error", description: "No se encontraron los datos del negocio.", variant: "destructive" });
      }

      // Fetch Promotions
      const q = query(
        collection(db, "businessEntities"),
        where("businessId", "==", businessIdToFetch),
        where("type", "==", "promotion")
      );
      const querySnapshot = await getDocs(q);

      const fetchedPromotions: BusinessManagedEntity[] = querySnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const nowISO = new Date().toISOString();
        
        let startDateStr: string = data.startDate?.toDate?.().toISOString() || data.startDate || nowISO;
        let endDateStr: string = data.endDate?.toDate?.().toISOString() || data.endDate || nowISO;
        let createdAtStr: string | undefined = data.createdAt?.toDate?.().toISOString() || data.createdAt;

        return {
          id: docSnap.id,
          businessId: data.businessId || businessIdToFetch,
          type: "promotion",
          name: data.name || "Promoción sin nombre",
          description: data.description || "",
          termsAndConditions: data.termsAndConditions || "",
          startDate: startDateStr,
          endDate: endDateStr,
          usageLimit: data.usageLimit === undefined || data.usageLimit === null ? 0 : Number(data.usageLimit),
          isActive: data.isActive === undefined ? true : data.isActive,
          imageUrl: data.imageUrl || "",
          imageObjectPosition: data.imageObjectPosition,
          aiHint: data.aiHint || "",
          generatedCodes: Array.isArray(data.generatedCodes) ? data.generatedCodes.map(gc => sanitizeObjectForFirestore(gc as GeneratedCode)) : [],
          createdAt: createdAtStr,
          ticketTypes: [], 
          eventBoxes: [],  
          assignedPromoters: [], 
          maxAttendance: 0,
          qrTemplateImageUrl: data.qrTemplateImageUrl || "",
          templateObjectPosition: data.templateObjectPosition,
          qrTemplateLayout: data.qrTemplateLayout,
        };
      });
      
      const sortedPromotions = fetchedPromotions.sort((a,b) => (new Date(b.createdAt || 0)).getTime() - (new Date(a.createdAt || 0)).getTime());
      setPromotions(sortedPromotions);

    } catch (error: any) {
        toast({
          title: "Error al Cargar Datos",
          description: `No se pudieron obtener las promociones o datos del negocio. ${error.message}`,
          variant: "destructive",
          duration: 7000,
        });
      setPromotions([]); 
    } finally {
      setIsLoadingPageData(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentBusinessId) {
        fetchBusinessData(currentBusinessId);
    }
  }, [currentBusinessId, fetchBusinessData]);


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
      const { id, generatedCodes, createdAt, ticketTypes, eventBoxes, assignedPromoters, maxAttendance, ...promoToDuplicateRaw } = promotion;
      const promoToDuplicate = sanitizeObjectForFirestore(promoToDuplicateRaw) as Omit<BusinessManagedEntity, 'id' | 'generatedCodes' | 'createdAt' | 'ticketTypes' | 'eventBoxes' | 'assignedPromoters' | 'maxAttendance'>;
      
      const now = new Date();
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const newPromoForDuplication: BusinessManagedEntity = {
        ...promoToDuplicate,
        id: '', 
        name: `${promotion.name || 'Promoción'} (Copia)`,
        generatedCodes: [], 
        isActive: true, 
        createdAt: undefined, 
        businessId: promoToDuplicate.businessId || currentBusinessId || "",
        type: "promotion",
        startDate: promoToDuplicate.startDate ? new Date(promoToDuplicate.startDate).toISOString() : now.toISOString(),
        endDate: promoToDuplicate.endDate ? new Date(promoToDuplicate.endDate).toISOString() : oneWeekFromNow.toISOString(),
        usageLimit: promoToDuplicate.usageLimit === undefined ? 0 : promoToDuplicate.usageLimit,
        imageUrl: promoToDuplicate.imageUrl || "",
        imageObjectPosition: promoToDuplicate.imageObjectPosition,
        aiHint: promoToDuplicate.aiHint || "",
        termsAndConditions: promoToDuplicate.termsAndConditions || "",
        ticketTypes: [], 
        eventBoxes: [],  
        assignedPromoters: [], 
        maxAttendance: 0, 
      };
      setEditingPromotion(newPromoForDuplication);
    } else {
      setEditingPromotion(promotion ? sanitizeObjectForFirestore(promotion) as BusinessManagedEntity : null);
    }
    setShowCreateEditPromotionModal(true);
  };

  const handleFormSubmit = async (data: BusinessPromotionFormData) => {
    if (!currentBusinessId) {
      toast({ title: "Error de Negocio", description: "ID de negocio no disponible para guardar la promoción.", variant: "destructive", duration: 7000 });
      return;
    }
    setIsSubmitting(true);

    try {
      let finalImageUrl = editingPromotion?.imageUrl || "";
      let finalQrTemplateUrl = editingPromotion?.qrTemplateImageUrl || "";
      const isNewEntity = !editingPromotion || !editingPromotion.id || isDuplicating;
      const entityId = isNewEntity ? doc(collection(db, "businessEntities")).id : editingPromotion.id;
      
      const oldImageUrl = !isNewEntity && editingPromotion?.imageUrl ? editingPromotion.imageUrl : null;
      const oldQrTemplateUrl = !isNewEntity && editingPromotion?.qrTemplateImageUrl ? editingPromotion.qrTemplateImageUrl : null;

      if (data.imageFile) {
        toast({ title: "Subiendo imagen principal...", description: "Por favor, espera." });
        const storageRef = ref(storage, `promotion-images/${currentBusinessId}/${entityId}/${data.imageFile.name}`);
        const uploadResult = await uploadBytes(storageRef, data.imageFile);
        finalImageUrl = await getDownloadURL(uploadResult.ref);
      }
      
      if (data.qrTemplateFile) {
        toast({ title: "Subiendo plantilla de QR...", description: "Por favor, espera." });
        const templateStorageRef = ref(storage, `promotion-qr-templates/${currentBusinessId}/${entityId}/${data.qrTemplateFile.name}`);
        const templateUploadResult = await uploadBytes(templateStorageRef, data.qrTemplateFile);
        finalQrTemplateUrl = await getDownloadURL(templateUploadResult.ref);
      }

      const promotionPayloadBase = {
        name: data.name,
        description: data.description,
        termsAndConditions: data.termsAndConditions || "",
        startDate: data.startDate,
        endDate: data.endDate,
        usageLimit: data.usageLimit === undefined || data.usageLimit === null || isNaN(Number(data.usageLimit)) ? 0 : Number(data.usageLimit),
        isActive: data.isActive,
        imageUrl: finalImageUrl,
        imageObjectPosition: data.imageObjectPosition,
        qrTemplateImageUrl: finalQrTemplateUrl,
        templateObjectPosition: data.templateObjectPosition,
        qrTemplateLayout: data.qrTemplateLayout,
      };

      const fullPayloadForFirestore: Omit<BusinessManagedEntity, 'id' | 'createdAt'> & { createdAt?: any } = {
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

      if (isNewEntity) {
        await setDoc(doc(db, "businessEntities", entityId), { ...sanitizedPayload, createdAt: serverTimestamp() });
        toast({ title: isDuplicating ? "Promoción Duplicada" : "Promoción Creada", description: `La promoción "${data.name}" ha sido creada.` });
      } else {
        await updateDoc(doc(db, "businessEntities", entityId), sanitizedPayload);
        toast({ title: "Promoción Actualizada", description: `La promoción "${data.name}" ha sido actualizada.` });
      }
      
      if (data.imageFile && oldImageUrl && oldImageUrl.includes("firebase")) {
        try { const oldImageRef = ref(storage, oldImageUrl); await deleteObject(oldImageRef); } catch (e: any) { if (e.code !== 'storage/object-not-found') console.warn("Could not delete old promotion image:", e); }
      }
      if (data.qrTemplateFile && oldQrTemplateUrl && oldQrTemplateUrl.includes("firebase")) {
        try { const oldTemplateRef = ref(storage, oldQrTemplateUrl); await deleteObject(oldTemplateRef); } catch (e: any) { if (e.code !== 'storage/object-not-found') console.warn("Could not delete old QR template image:", e); }
      }

      setShowCreateEditPromotionModal(false);
      if (currentBusinessId) fetchBusinessData(currentBusinessId);
    } catch (error: any) {
      toast({ title: "Error al Guardar", description: `No se pudo guardar la promoción. ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeletePromotion = async (promotionToDelete: BusinessManagedEntity) => {
    if (isSubmitting || !currentBusinessId) {
      toast({ title: "Error", description: "Operación no permitida o ID de negocio no disponible.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "businessEntities", promotionToDelete.id));
      toast({ title: "Promoción Eliminada", description: `La promoción "${promotionToDelete.name || 'seleccionada'}" ha sido eliminada.`, variant: "destructive" });

      if (promotionToDelete.imageUrl && promotionToDelete.imageUrl.includes("firebase")) {
        try { const imageRef = ref(storage, promotionToDelete.imageUrl); await deleteObject(imageRef); } catch (e: any) { if (e.code !== 'storage/object-not-found') console.warn("Could not delete promotion image:", e); }
      }
      if (promotionToDelete.qrTemplateImageUrl && promotionToDelete.qrTemplateImageUrl.includes("firebase")) {
        try { const templateRef = ref(storage, promotionToDelete.qrTemplateImageUrl); await deleteObject(templateRef); } catch (e: any) { if (e.code !== 'storage/object-not-found') console.warn("Could not delete QR template image:", e); }
      }

      if (currentBusinessId) fetchBusinessData(currentBusinessId); 
    } catch (error: any) {
      toast({ title: "Error al Eliminar", description: `No se pudo eliminar la promoción. ${error.message}`, variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleNewCodesCreated = async (entityId: string, newCodes: GeneratedCode[], observation?: string): Promise<void> => {
    if (!userProfile?.name || !userProfile.uid) {
        toast({title: "Error de Usuario", description: "No se pudo obtener el nombre del usuario para registrar los códigos.", variant: "destructive"});
        throw new Error("User profile not available");
    }

    const targetPromotionRef = doc(db, "businessEntities", entityId);
    try {
        const targetPromotionSnap = await getDoc(targetPromotionRef);
        if (!targetPromotionSnap.exists()) {
            throw new Error("Entity not found");
        }
        const targetPromotionData = targetPromotionSnap.data() as BusinessManagedEntity;
        
        const newCodesWithDetails: GeneratedCode[] = newCodes.map(code => (sanitizeObjectForFirestore({
            ...code,
            id: code.id || `code-${entityId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            entityId: entityId,
            value: code.value,
            status: "available", 
            generatedByName: userProfile.name, 
            generatedByUid: userProfile.uid,
            generatedDate: code.generatedDate || new Date().toISOString(),
            observation: (observation && observation.trim() !== "") ? observation.trim() : null,
            redemptionDate: null, 
            redeemedByInfo: null, 
            isVipCandidate: false,
        }) as GeneratedCode));
        
        const existingSanitizedCodes = (targetPromotionData.generatedCodes || []).map(c => sanitizeObjectForFirestore(c as GeneratedCode));
        const updatedCodes = [...existingSanitizedCodes, ...newCodesWithDetails];
            
        await updateDoc(targetPromotionRef, { generatedCodes: updatedCodes });
        
        // Update local state instead of re-fetching
        setPromotions(prevPromos => prevPromos.map(p => 
            p.id === entityId ? { ...p, generatedCodes: updatedCodes } : p
        ));
        
        toast({title: `${newCodes.length} Código(s) Creado(s)`, description: `Para: ${targetPromotionData.name}.`});
        
    } catch (error: any) {
        toast({title: "Error al Guardar Códigos", description: `No se pudieron guardar los códigos. ${error.message}`, variant: "destructive"});
        throw error; // Re-throw to be caught by the dialog
    }
  }; 

  const handleCodesUpdatedFromManageDialog = async (entityId: string, updatedCodesFromDialog: GeneratedCode[]) => {
    if (isSubmitting) return;
    if (!currentBusinessId) {
      toast({ title: "Error", description: "ID de negocio no disponible.", variant: "destructive" });
      setIsSubmitting(false);
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
        
        if (currentBusinessId) fetchBusinessData(currentBusinessId);
        if (editingPromotion && editingPromotion.id === entityId) {
             setEditingPromotion(prev => prev ? {...prev, generatedCodes: updatedCodesForFirestore} : null);
        }
         if (selectedEntityForViewingCodes && selectedEntityForViewingCodes.id === entityId) {
            setSelectedEntityForViewingCodes(prev => prev ? {...prev, generatedCodes: updatedCodesForFirestore} : null);
        }
    } catch (error: any) {
        toast({title: "Error al Guardar Códigos", description: `No se pudieron actualizar los códigos. ${error.message}`, variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleTogglePromotionStatus = async (promotionToToggle: BusinessManagedEntity) => {
    if (isSubmitting || !currentBusinessId || !promotionToToggle.id) {
      toast({ title: "Error", description: "Datos insuficientes para cambiar el estado.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const newStatus = !promotionToToggle.isActive;
    
    try {
      await updateDoc(doc(db, "businessEntities", promotionToToggle.id), { isActive: newStatus });
      
      setPromotions(prev => 
        prev.map(p => 
          p.id === promotionToToggle.id ? { ...p, isActive: newStatus } : p
        )
      );

      toast({
        title: "Estado Actualizado",
        description: `La promoción "${promotionToToggle.name}" ahora está ${newStatus ? "Activa" : "Inactiva"}.`
      });
    } catch (error: any) {
      toast({ title: "Error", description: "No se pudo actualizar el estado de la promoción.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

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
  
  if (isLoadingPageData) { 
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando información...</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-primary flex items-center self-start">
          <TicketIconLucide className="h-8 w-8 mr-2" /> Promociones
        </h1>
        <div className="self-end sm:self-center">
          <Button 
              onClick={() => handleOpenCreateEditModal(null)} 
              variant="gradient"
              disabled={!currentBusinessId || isSubmitting || isLoadingPageData}
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Crear Promoción
          </Button>
        </div>
      </div>
      
      {!currentBusinessId && !isLoadingPageData && userProfile && (userProfile.roles.includes('business_admin') || userProfile.roles.includes('staff')) && (
        <Card className="shadow-lg">
          <CardHeader><UIAlertDialogTitle className="text-destructive">Error de Configuración del Negocio</UIAlertDialogTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">Tu perfil de usuario no está asociado a un negocio o el ID del negocio no está disponible. No se pueden cargar ni crear promociones.</p></CardContent>
        </Card>
      )}

      {currentBusinessId && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Mis Promociones</CardTitle>
            <ShadcnCardDescription>Administra las promociones ofrecidas por tu negocio.</ShadcnCardDescription>
            <div className="relative mt-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por nombre o descripción..."
                className="pl-8 w-full sm:w-[300px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoadingPageData}
              />
            </div>
          </CardHeader>
          <CardContent>
            {promotions.length === 0 && !searchTerm ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border border-dashed rounded-md p-4 text-center">
                <AlertTriangle className="h-10 w-10 mb-2 text-yellow-500"/>
                <p className="font-semibold">No hay promociones registradas.</p>
                <p className="text-sm">Haz clic en "Crear Promoción" para empezar.</p>
              </div>
            ) : (
              <>
                {/* Mobile View */}
                <div className="md:hidden space-y-4">
                  {filteredPromotions.map(promo => {
                    const codesRedeemedCount = promo.generatedCodes?.filter(c => c.status === 'redeemed' || c.status === 'used').length || 0;
                    const codesCreatedCount = promo.generatedCodes?.length || 0;
                    const isActivatable = isEntityCurrentlyActivatable(promo);
                    return(
                      <Card key={promo.id} className="overflow-hidden">
                        <CardHeader className="p-4">
                          <CardTitle>{promo.name}</CardTitle>
                          <ShadcnCardDescription>Vigencia: {format(parseISO(promo.startDate), "dd/MM")} - {format(parseISO(promo.endDate), "dd/MM")}</ShadcnCardDescription>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                              <Switch id={`mobile-status-${promo.id}`} checked={promo.isActive} onCheckedChange={() => handleTogglePromotionStatus(promo)} disabled={isSubmitting}/>
                              <Label htmlFor={`mobile-status-${promo.id}`}>
                                <Badge variant={promo.isActive ? "default" : "outline"} className={cn(promo.isActive && isActivatable ? "bg-green-500 hover:bg-green-600" : (promo.isActive ? "bg-yellow-500 hover:bg-yellow-600 text-black" : "bg-red-500 hover:bg-red-600 text-white"), "text-xs")}>
                                  {promo.isActive ? (isActivatable ? "Vigente" : "Fuera de Fecha") : "Inactiva"}
                                </Badge>
                              </Label>
                            </div>
                            <div className="text-right text-xs">
                              <p>Creados: {codesCreatedCount}</p>
                              <p>Canjeados: {codesRedeemedCount}</p>
                              <p>Límite: {promo.usageLimit && promo.usageLimit > 0 ? promo.usageLimit : '∞'}</p>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="p-2 bg-muted/50 justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white px-3 h-8">
                                Acciones
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem
                                onClick={() => openCreateCodesDialog(promo)}
                                disabled={!isActivatable}
                              >
                                <QrCodeIcon className="h-4 w-4 mr-2" />
                                Crear Códigos
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openViewCodesDialog(promo)}
                              >
                                <ListChecks className="h-4 w-4 mr-2" />
                                Ver Códigos ({promo.generatedCodes?.length || 0})
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleOpenCreateEditModal(promo, false)}
                              >
                                <Edit className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openStatsModal(promo)}>
                                <BarChart3 className="h-4 w-4 mr-2" />
                                Estadísticas
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleOpenCreateEditModal(promo, true)}
                              >
                                <Copy className="h-4 w-4 mr-2" /> Duplicar
                              </DropdownMenuItem>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                    className="text-destructive focus:bg-destructive/10 focus:text-destructive-foreground"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <UIAlertDialogTitle>
                                      ¿Confirmar eliminación?
                                    </UIAlertDialogTitle>
                                    <AlertDialogDescription>
                                      Se eliminará la promoción "{promo.name}".
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <UIAlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancelar
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeletePromotion(promo)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </UIAlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </CardFooter>
                      </Card>
                    )
                  })}
                </div>
                {/* Desktop View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[250px]">Promoción y Gestión</TableHead>
                        <TableHead className="min-w-[220px]">QRs y Códigos</TableHead>
                        <TableHead className="min-w-[180px]">Vigencia</TableHead>
                        <TableHead className="min-w-[180px] text-left">Acciones Adicionales</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPromotions.length > 0 ? filteredPromotions.map((promo) => {
                        const codesRedeemedCount = promo.generatedCodes?.filter(c => c.status === 'redeemed' || c.status === 'used').length || 0;
                        const codesCreatedCount = promo.generatedCodes?.length || 0;
                        const isActivatable = isEntityCurrentlyActivatable(promo);
                        
                        return (
                        <TableRow key={promo.id || `promo-fallback-${Math.random()}`}>
                          <TableCell className="font-medium align-top py-3">
                              <div className="font-semibold text-base">{promo.name}</div>
                              <div className="flex items-center space-x-2 mt-1.5 mb-2">
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
                                  <Badge variant={promo.isActive ? "default" : "outline"} 
                                        className={cn(promo.isActive && isActivatable ? "bg-green-500 hover:bg-green-600" : (promo.isActive ? "bg-yellow-500 hover:bg-yellow-600 text-black" : "bg-red-500 hover:bg-red-600 text-white"), "text-xs")}>
                                      {promo.isActive ? (isActivatable ? "Vigente" : "Activa (Fuera de Fecha)") : "Inactiva"}
                                  </Badge>
                              </div>
                            <div className="flex flex-col items-start gap-1">
                                  <Button 
                                      variant="outline" 
                                      size="xs" 
                                      onClick={() => openCreateCodesDialog(promo)} 
                                      disabled={!isActivatable || isSubmitting} 
                                      className="px-2 py-1 h-auto text-xs"
                                  >
                                      <QrCodeIcon className="h-3 w-3 mr-1" /> Crear Códigos
                                  </Button>
                                  <Button 
                                      variant="outline" 
                                      size="xs" 
                                      onClick={() => openViewCodesDialog(promo)} 
                                      disabled={isSubmitting} 
                                      className="px-2 py-1 h-auto text-xs"
                                  >
                                      <ListChecks className="h-3 w-3 mr-1" /> Ver Códigos ({codesCreatedCount})
                                  </Button>
                                  <Button variant="outline" size="xs" onClick={() => handleOpenCreateEditModal(promo, false)} disabled={isSubmitting} className="px-2 py-1 h-auto text-xs">
                                      <Edit className="h-3 w-3 mr-1" /> Editar
                                  </Button>
                                  <Button variant="outline" size="xs" onClick={() => openStatsModal(promo)} disabled={isSubmitting} className="px-2 py-1 h-auto text-xs">
                                      <BarChart3 className="h-3 w-3 mr-1" /> Estadísticas
                                  </Button>
                              </div>
                          </TableCell>
                          <TableCell className="align-top py-3 text-xs">
                            <div className="flex flex-col">
                                  <span>Códigos Creados: ({codesCreatedCount})</span>
                                  <span>QRs Generados: ({codesRedeemedCount})</span>
                                  <span>Límite de canjes: ({(promo.usageLimit && promo.usageLimit > 0) ? promo.usageLimit : 'Ilimitado'})</span>
                            </div>
                          </TableCell>
                          <TableCell className="align-top py-3 text-xs">
                            {promo.startDate ? format(parseISO(promo.startDate), "P p", { locale: es }) : 'N/A'}
                            <br />
                            {promo.endDate ? format(parseISO(promo.endDate), "P p", { locale: es }) : 'N/A'}
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
                                              <AlertDialogDescription>
                                                  Esta acción no se puede deshacer. Esto eliminará permanentemente la promoción:
                                                  <span className="font-semibold"> {promo.name}</span> y todos sus códigos asociados.
                                              </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <UIAlertDialogFooter>
                                              <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                                              <AlertDialogAction
                                                  onClick={() => handleDeletePromotion(promo)}
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
                      );
                      }) : (
                          !isLoadingPageData && <TableRow><TableCell colSpan={4} className="text-center h-24">No se encontraron promociones con los filtros aplicados.</TableCell></TableRow> 
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
      
      <ShadcnDialog open={showCreateEditPromotionModal} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setEditingPromotion(null);
          setIsDuplicating(false);
        }
        setShowCreateEditPromotionModal(isOpen);
      }}>
      {showCreateEditPromotionModal && (
        <ShadcnDialogContent className="sm:max-w-2xl">
          <ShadcnDialogHeader>
            <ShadcnDialogTitle>
              {isDuplicating && editingPromotion
                ? `Duplicar Promoción: ${(editingPromotion.name || 'Promoción').replace(' (Copia)', '')} (Copia)`
                : editingPromotion
                  ? `Editar Promoción: ${editingPromotion.name}`
                  : "Crear Nueva Promoción"}
            </ShadcnDialogTitle>
            <ShadcnDialogDescription>
              {isDuplicating
                ? "Creando una copia. Ajusta los detalles necesarios."
                : (editingPromotion ? `Actualiza los detalles de "${editingPromotion.name}".` : "Completa los detalles para tu nueva promoción.")}
            </ShadcnDialogDescription>
          </ShadcnDialogHeader>
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
        </ShadcnDialogContent>
      )}
      </ShadcnDialog>

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
          currentUserProfileUid={userProfile.uid}
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
                        description: `Esta ${currentEntity.type === 'event' ? 'evento' : 'promoción'} no está activa o está fuera de su periodo de vigencia.`,
                        variant: "destructive"
                    });
                }
            }
          }}
          isPromoterView={false} 
          currentUserProfileName={userProfile.name}
          currentUserProfileUid={userProfile.uid}
          businessPersonalPhone={businessDetails?.personalPhone}
        />
      )}

      <ShadcnDialog open={showStatsModal} onOpenChange={(isOpen) => { if(!isOpen) setSelectedPromotionForStats(null); setShowStatsModal(isOpen);}}>
      {showStatsModal && selectedPromotionForStats && (
        <ShadcnDialogContent className="sm:max-w-md">
            <ShadcnDialogHeader>
                <ShadcnDialogTitle>Estadísticas para: {selectedPromotionForStats.name}</ShadcnDialogTitle>
                <ShadcnDialogDescription>Resumen del rendimiento de la promoción.</ShadcnDialogDescription>
            </ShadcnDialogHeader>
            <div className="space-y-3 py-4">
                <p><strong>Códigos Creados:</strong> ({selectedPromotionForStats.generatedCodes?.length || 0})</p>
                <p><strong>QRs Canjeados por Clientes:</strong> ({selectedPromotionForStats.generatedCodes?.filter(c => c.status === 'redeemed' || c.status === 'used').length || 0})</p>
                <p><strong>QRs Usados en Puerta:</strong> ({selectedPromotionForStats.generatedCodes?.filter(c => c.status === 'used').length || 0})</p>
                <p><strong>Tasa de Uso (Usados/Canjeados):</strong> 
                    {(() => {
                        const redeemed = selectedPromotionForStats.generatedCodes?.filter(c => c.status === 'redeemed' || c.status === 'used').length || 0;
                        const used = selectedPromotionForStats.generatedCodes?.filter(c => c.status === 'used').length || 0;
                        return redeemed > 0 ? `${((used / redeemed) * 100).toFixed(1)}%` : '0%';
                    })()}
                </p>
                  <p><strong>Límite de Canjes:</strong> ({(selectedPromotionForStats.usageLimit && selectedPromotionForStats.usageLimit > 0) ? selectedPromotionForStats.usageLimit : 'Ilimitado'})</p>
            </div>
            <ShadcnDialogFooter> 
                <Button variant="outline" onClick={() => {setShowStatsModal(false); setSelectedPromotionForStats(null);}}>Cerrar</Button>
            </ShadcnDialogFooter>
        </ShadcnDialogContent>
      )}
    </ShadcnDialog>
    </div>
  );
}
