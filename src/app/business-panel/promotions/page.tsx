
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter as UIDialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2, Search, Ticket, QrCode, ListChecks, Copy, Loader2, BarChart3 } from "lucide-react";
import type { BusinessManagedEntity, BusinessPromotionFormData, GeneratedCode } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as UIAlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BusinessPromotionForm } from "@/components/business/forms/BusinessPromotionForm";
import { ManageCodesDialog } from "@/components/business/dialogs/ManageCodesDialog";
import { CreateCodesDialog } from "@/components/business/dialogs/CreateCodesDialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { isEntityCurrentlyActivatable, sanitizeObjectForFirestore } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, getDocs, updateDoc, deleteDoc, query, where, serverTimestamp, Timestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function BusinessPromotionsPage() {
  const { userProfile } = useAuth();
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateEditPromotionModal, setShowCreateEditPromotionModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<BusinessManagedEntity | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [promotions, setPromotions] = useState<BusinessManagedEntity[]>([]);
  
  const [showManageCodesModal, setShowManageCodesModal] = useState(false);
  const [selectedEntityForViewingCodes, setSelectedEntityForViewingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const [showCreateCodesModal, setShowCreateCodesModal] = useState(false);
  const [selectedEntityForCreatingCodes, setSelectedEntityForCreatingCodes] = useState<BusinessManagedEntity | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedPromotionForStats, setSelectedPromotionForStats] = useState<BusinessManagedEntity | null>(null);


  useEffect(() => {
    const businessIdFromProfile = userProfile?.businessId;
    if (businessIdFromProfile) {
      setCurrentBusinessId(businessIdFromProfile);
    } else if (userProfile && (userProfile.roles.includes('business_admin') || userProfile.roles.includes('staff')) && !businessIdFromProfile) {
      toast({ title: "Error de Negocio", description: "Tu perfil de usuario no está asociado a un negocio.", variant: "destructive", duration: 7000 });
      setIsLoading(false);
    }
  }, [userProfile, toast]);

  const fetchBusinessPromotions = useCallback(async () => {
    if (!currentBusinessId) {
      console.warn("Promotions Page: No currentBusinessId available. Skipping fetch.");
      setPromotions([]);
      setIsLoading(false);
      return;
    }
    console.log("Promotions Page: UserProfile for query:", userProfile);
    console.log("Promotions Page: Querying promotions with businessId:", currentBusinessId);
    setIsLoading(true);
    try {
      const q = query(
        collection(db, "businessEntities"),
        where("businessId", "==", currentBusinessId),
        where("type", "==", "promotion")
      );
      const querySnapshot = await getDocs(q);
      console.log("Promotions Page: Firestore query executed. Snapshot size:", querySnapshot.size);

      const fetchedPromotions: BusinessManagedEntity[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const nowISO = new Date().toISOString();
        
        const generatedCodes = Array.isArray(data.generatedCodes) ? data.generatedCodes.map(gc => sanitizeObjectForFirestore({
            ...gc,
            observation: gc.observation ?? null,
            redemptionDate: gc.redemptionDate ?? null,
            redeemedByInfo: gc.redeemedByInfo ?? null,
            isVipCandidate: gc.isVipCandidate ?? false
        })) : [];

        return {
          id: docSnap.id,
          businessId: data.businessId || currentBusinessId,
          type: "promotion",
          name: data.name || "Promoción sin nombre",
          description: data.description || "",
          termsAndConditions: data.termsAndConditions || "",
          startDate: data.startDate instanceof Timestamp ? data.startDate.toDate().toISOString() : (typeof data.startDate === 'string' ? data.startDate : nowISO),
          endDate: data.endDate instanceof Timestamp ? data.endDate.toDate().toISOString() : (typeof data.endDate === 'string' ? data.endDate : nowISO),
          usageLimit: data.usageLimit === undefined || data.usageLimit === null ? 0 : data.usageLimit,
          isActive: data.isActive === undefined ? true : data.isActive,
          imageUrl: data.imageUrl || "",
          aiHint: data.aiHint || "",
          generatedCodes: generatedCodes,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : undefined),
          // Fields not applicable for promotions from BusinessManagedEntity are defaulted or empty
          ticketTypes: [], 
          eventBoxes: [],  
          assignedPromoters: Array.isArray(data.assignedPromoters) ? data.assignedPromoters : [],
          maxAttendance: 0, 
        };
      });
      setPromotions(fetchedPromotions.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
      console.log("Promotions Page: Fetched promotions successfully:", fetchedPromotions);
    } catch (error: any) {
      console.error("Promotions Page: Error fetching promotions:", error);
      toast({
        title: "Error al Cargar Promociones",
        description: `No se pudieron obtener las promociones. ${error.message}`,
        variant: "destructive",
      });
      setPromotions([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentBusinessId, userProfile, toast]);

  useEffect(() => {
    if (currentBusinessId) {
        fetchBusinessPromotions();
    } else if (userProfile === null || (userProfile && !currentBusinessId && (userProfile.roles.includes('business_admin') || userProfile.roles.includes('staff')))) {
        setIsLoading(false); 
        setPromotions([]);
    }
  }, [currentBusinessId, userProfile, fetchBusinessPromotions]);


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
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });
  }, [promotions, searchTerm]);


  const handleOpenCreateEditModal = (promotion: BusinessManagedEntity | null, duplicate = false) => {
    setIsSubmitting(false);
    setIsDuplicating(duplicate);
    if (duplicate && promotion) {
      const { id, generatedCodes, createdAt, ticketTypes, eventBoxes, assignedPromoters, maxAttendance, ...promoToDuplicate } = promotion;
      setEditingPromotion({
        ...promoToDuplicate,
        id: '', 
        name: `${promotion.name || 'Promoción'} (Copia)`,
        generatedCodes: [], 
        isActive: true, 
        // Fields not applicable for promotions
        ticketTypes: [], 
        eventBoxes: [],
        assignedPromoters: [],
        maxAttendance: 0,
        createdAt: undefined, 
      } as BusinessManagedEntity);
    } else {
      setEditingPromotion(promotion);
    }
    setShowCreateEditPromotionModal(true);
  };

  const handleFormSubmit = async (data: BusinessPromotionFormData) => {
    if (!currentBusinessId) {
      toast({ title: "Error de Negocio", description: "ID de negocio no disponible para guardar la promoción.", variant: "destructive", duration: 7000 });
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);
    console.log("Promotions Page: UserProfile for save:", userProfile);
    console.log("Promotions Page: Current Business ID for save:", currentBusinessId);

    const promotionPayloadBase: Omit<BusinessManagedEntity, 'id' | 'createdAt' | 'generatedCodes' | 'ticketTypes' | 'eventBoxes' | 'assignedPromoters' | 'maxAttendance'> = {
      businessId: currentBusinessId,
      type: "promotion",
      name: data.name,
      description: data.description,
      termsAndConditions: data.termsAndConditions || "",
      startDate: data.startDate.toISOString(), 
      endDate: data.endDate.toISOString(),   
      usageLimit: data.usageLimit === undefined || data.usageLimit === null ? 0 : data.usageLimit,
      isActive: data.isActive,
      imageUrl: data.imageUrl || (data.aiHint ? `https://placehold.co/300x200.png?text=${encodeURIComponent(data.aiHint.split(' ').slice(0,2).join('+'))}` : `https://placehold.co/300x200.png`),
      aiHint: data.aiHint || "",
    };
    
    const promotionPayloadForFirestore = sanitizeObjectForFirestore({
        ...promotionPayloadBase,
        startDate: Timestamp.fromDate(new Date(promotionPayloadBase.startDate)),
        endDate: Timestamp.fromDate(new Date(promotionPayloadBase.endDate)),
        // These are specific to BusinessManagedEntity but not directly from BusinessPromotionFormData for promotions
        generatedCodes: (editingPromotion && !isDuplicating ? editingPromotion.generatedCodes : []) || [],
        ticketTypes: [],
        eventBoxes: [],
        assignedPromoters: (editingPromotion && !isDuplicating ? editingPromotion.assignedPromoters : []) || [],
        maxAttendance: 0,
    });
    console.log('Promotions Page: Saving promotion with payload:', promotionPayloadForFirestore);


    try {
      if (editingPromotion && !isDuplicating && editingPromotion.id) {
        const { id, createdAt, ...updateData } = promotionPayloadForFirestore; 
        if (createdAt && !(createdAt instanceof Timestamp) && typeof createdAt !== 'function') {
            delete updateData.createdAt;
        }
        await updateDoc(doc(db, "businessEntities", editingPromotion.id), updateData);
        toast({ title: "Promoción Actualizada", description: `La promoción "${data.name}" ha sido actualizada.` });
      } else {
        let createData = { ...promotionPayloadForFirestore, createdAt: serverTimestamp() };
        if (createData.id === '') delete createData.id; 

        const docRef = await addDoc(collection(db, "businessEntities"), createData);
        toast({ title: isDuplicating ? "Promoción Duplicada" : "Promoción Creada", description: `La promoción "${data.name}" ha sido creada con ID: ${docRef.id}.` });
      }
      setShowCreateEditPromotionModal(false);
      setEditingPromotion(null);
      setIsDuplicating(false);
      fetchBusinessPromotions(); 
    } catch (error: any) {
      console.error("Promotions Page: Error saving promotion:", error);
      toast({ title: "Error al Guardar Promoción", description: `No se pudo guardar la promoción. ${error.message}`, variant: "destructive", duration: 10000});
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeletePromotion = async (promotionId: string, promotionName?: string) => {
    if (!currentBusinessId) {
        toast({ title: "Error", description: "ID de negocio no disponible.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "businessEntities", promotionId));
      toast({ title: "Promoción Eliminada", description: `La promoción "${promotionName || 'seleccionada'}" ha sido eliminada.`, variant: "destructive" });
      fetchBusinessPromotions(); 
    } catch (error: any) {
      console.error("Promotions Page: Error deleting promotion:", error);
      toast({ title: "Error al Eliminar", description: `No se pudo eliminar la promoción. ${error.message}`, variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateCodesDialog = (promotion: BusinessManagedEntity) => {
    if (!isEntityCurrentlyActivatable(promotion)) {
      toast({ 
        title: "No se pueden crear códigos", 
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
  
 const handleNewCodesCreated = async (entityId: string, newCodes: GeneratedCode[], observation?: string) => {
    if (!currentBusinessId) {
        toast({ title: "Error", description: "ID de negocio no disponible.", variant: "destructive" });
        return;
    }
    
    const targetPromotionRef = doc(db, "businessEntities", entityId);
    try {
        const targetPromotionSnap = await getDoc(targetPromotionRef);
        if (!targetPromotionSnap.exists()) {
            toast({title:"Error", description:"Promoción no encontrada para añadir códigos.", variant: "destructive"});
            return;
        }
        const targetPromotionData = targetPromotionSnap.data() as BusinessManagedEntity;
        const existingCodes = targetPromotionData.generatedCodes || [];

        const newCodesWithDetails = newCodes.map(code => {
            const newCodeItem: GeneratedCode = {
                ...code,
                observation: (observation && observation.trim() !== "") ? observation.trim() : null,
                redemptionDate: null, 
                redeemedByInfo: null, 
                isVipCandidate: false,
            };
            return sanitizeObjectForFirestore(newCodeItem); 
        });

        const updatedCodes = [...existingCodes, ...newCodesWithDetails];
    
        await updateDoc(targetPromotionRef, { generatedCodes: updatedCodes });
        toast({title: `${newCodes.length} Código(s) Creado(s)`, description: `Para: ${targetPromotionData.name}. Guardados en la base de datos.`});
        
        fetchBusinessPromotions(); 

    } catch (error: any) {
        console.error("Promotions Page: Error saving new codes to Firestore:", error.code, error.message, error);
        toast({title: "Error al Guardar Códigos", description: `No se pudieron guardar los códigos. ${error.message}`, variant: "destructive"});
    }
  };


  const handleCodesUpdatedFromManageDialog = async (entityId: string, updatedCodesFromDialog: GeneratedCode[]) => {
    if (!currentBusinessId) {
      toast({ title: "Error", description: "ID de negocio no disponible.", variant: "destructive" });
      return;
    }
    
    const targetPromotionRef = doc(db, "businessEntities", entityId);
     try {
        const targetPromotionSnap = await getDoc(targetPromotionRef);
        if (!targetPromotionSnap.exists()) {
            toast({title:"Error", description:"Promoción no encontrada para actualizar códigos.", variant: "destructive"});
            return;
        }
        const targetPromotionData = targetPromotionSnap.data() as BusinessManagedEntity;
    
        const updatedCodesForFirestore = updatedCodesFromDialog.map(code => sanitizeObjectForFirestore(code));

        await updateDoc(targetPromotionRef, { generatedCodes: updatedCodesForFirestore });
        toast({title: "Códigos Actualizados", description: `Los códigos para "${targetPromotionData.name}" han sido guardados en la base de datos.`});
        
        fetchBusinessPromotions();
    } catch (error: any) {
        console.error("Promotions Page: Error saving updated codes to Firestore:", error.code, error.message, error);
        toast({title: "Error al Guardar Códigos", description: `No se pudieron actualizar los códigos. ${error.message}`, variant: "destructive"});
    }
  };

  const getRedemptionCount = (promotion: BusinessManagedEntity) => {
    const redeemedCount = promotion.generatedCodes?.filter(c => c.status === 'redeemed').length || 0;
    const totalGenerated = promotion.generatedCodes?.length || 0;
    if (promotion.usageLimit && promotion.usageLimit > 0) {
      return `${redeemedCount} / ${promotion.usageLimit}`;
    }
    return `${redeemedCount} / ${totalGenerated === 0 ? '∞' : totalGenerated } (Generados)`;
  };

  const handleTogglePromotionStatus = async (promotionToToggle: BusinessManagedEntity) => {
    if (!currentBusinessId || !promotionToToggle.id) {
        toast({ title: "Error", description: "ID de promoción o negocio no disponible.", variant: "destructive" });
        return;
    }
    
    const newStatus = !promotionToToggle.isActive;
    const promotionName = promotionToToggle.name;

    if (isSubmitting) return;
    setIsSubmitting(true); 
    try {
      await updateDoc(doc(db, "businessEntities", promotionToToggle.id), { isActive: newStatus });
      toast({
        title: "Estado Actualizado",
        description: `La promoción "${promotionName}" ahora está ${newStatus ? "Activa" : "Inactiva"}.`
      });
       fetchBusinessPromotions();
    } catch (error: any) {
      console.error("Promotions Page: Error updating promotion status:", error);
      toast({
        title: "Error al Actualizar Estado",
        description: `No se pudo cambiar el estado de la promoción. ${error.message}`,
        variant: "destructive"
      });
    } finally {
        setIsSubmitting(false); 
    }
  };

  const openStatsModal = (promotion: BusinessManagedEntity) => {
    setSelectedPromotionForStats(promotion);
    setShowStatsModal(true);
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Ticket className="h-8 w-8 mr-2" /> Gestión de Promociones
        </h1>
        <Button onClick={() => handleOpenCreateEditModal(null)} className="bg-primary hover:bg-primary/90" disabled={isLoading || !currentBusinessId}>
          <PlusCircle className="mr-2 h-4 w-4" /> Crear Promoción
        </Button>
      </div>
      
      {!currentBusinessId && !isLoading && userProfile && (userProfile.roles.includes('business_admin') || userProfile.roles.includes('staff')) &&( 
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-destructive">Error de Configuración del Negocio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Tu perfil de usuario no está asociado a un negocio o el ID del negocio no está disponible.
            </p>
          </CardContent>
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
              <div className="flex justify-center items-center h-60">
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
                      <TableHead>Nombre</TableHead>
                      <TableHead className="hidden md:table-cell">Vigencia</TableHead>
                      <TableHead className="hidden lg:table-cell text-center">Canjes / Límite</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                      <TableHead>Códigos</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPromotions.length > 0 ? (
                      filteredPromotions.map((promo) => (
                        <TableRow key={promo.id}>
                          <TableCell className="font-medium">{promo.name}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {promo.startDate ? format(parseISO(promo.startDate), "P", { locale: es }) : 'N/A'} - {promo.endDate ? format(parseISO(promo.endDate), "P", { locale: es }) : 'N/A'}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-center">{getRedemptionCount(promo)}</TableCell>
                          <TableCell className="text-center">
                              <div className="flex items-center justify-center space-x-2">
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
                                  <Badge variant={promo.isActive ? "default" : "outline"} className={cn(promo.isActive ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600 text-white", !isEntityCurrentlyActivatable(promo) && promo.isActive && "bg-yellow-500 hover:bg-yellow-600 text-black")}>
                                      {promo.isActive ? (isEntityCurrentlyActivatable(promo) ? "Vigente" : "Activa (Fuera de Fecha)") : "Inactiva"}
                                  </Badge>
                              </div>
                          </TableCell>
                          <TableCell className="space-x-1">
                            <Button variant="default" size="xs" onClick={() => openCreateCodesDialog(promo)} disabled={!isEntityCurrentlyActivatable(promo) || isSubmitting} className="bg-accent hover:bg-accent/90 text-accent-foreground px-2 py-1 h-auto">
                              <QrCode className="h-3 w-3 mr-1" /> Crear
                            </Button>
                            <Button variant="outline" size="xs" onClick={() => openViewCodesDialog(promo)} disabled={isSubmitting} className="px-2 py-1 h-auto">
                              <ListChecks className="h-3 w-3 mr-1" /> Ver ({promo.generatedCodes?.length || 0})
                            </Button>
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="xs" title="Estadísticas" onClick={() => openStatsModal(promo)} disabled={isSubmitting} className="px-2 py-1 h-auto text-muted-foreground hover:text-primary">
                                <BarChart3 className="h-4 w-4 mr-1" /> Estadísticas
                            </Button>
                            <Button variant="ghost" size="icon" title="Duplicar Promoción" onClick={() => handleOpenCreateEditModal(promo, true)} disabled={isSubmitting}>
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Editar Promoción" onClick={() => handleOpenCreateEditModal(promo)} disabled={isSubmitting}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Eliminar Promoción" className="text-destructive hover:text-destructive" disabled={isSubmitting}>
                                  <Trash2 className="h-4 w-4" />
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
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeletePromotion(promo.id, promo.name)}
                                    className="bg-destructive hover:bg-destructive/90"
                                    disabled={isSubmitting}
                                  >
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center h-24">No se encontraron promociones con los filtros aplicados.</TableCell>
                      </TableRow>
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
            <DialogTitle>{isDuplicating ? `Duplicar Promoción: ${editingPromotion?.name?.replace(' (Copia)','') || 'Nueva Promoción'}` : (editingPromotion ? "Editar Promoción" : "Crear Nueva Promoción")}</DialogTitle>
            <DialogDescription>
              {isDuplicating ? "Creando una copia. Ajusta los detalles necesarios." : (editingPromotion ? `Actualiza los detalles de "${editingPromotion.name}".` : "Completa los detalles para tu nueva promoción.")}
            </DialogDescription>
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

      {selectedEntityForCreatingCodes && (
        <CreateCodesDialog
          open={showCreateCodesModal}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedEntityForCreatingCodes(null); 
            setShowCreateCodesModal(isOpen);
           }}
          entityName={selectedEntityForCreatingCodes.name}
          entityId={selectedEntityForCreatingCodes.id}
          existingCodesValues={(selectedEntityForCreatingCodes.generatedCodes || []).map(c => c.value)}
          onCodesCreated={handleNewCodesCreated}
          isSubmittingMain={isSubmitting}
          currentUserProfileName={userProfile?.name} 
        />
      )}

      {selectedEntityForViewingCodes && (
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
                        title: "No se pueden crear códigos",
                        description: "Esta promoción no está activa o está fuera de su periodo de vigencia.",
                        variant: "destructive"
                    });
                }
            }
          }}
        />
      )}

      {/* Modal for Promotion Statistics */}
        <Dialog open={showStatsModal} onOpenChange={setShowStatsModal}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Estadísticas para: {selectedPromotionForStats?.name}</DialogTitle>
                    <DialogDescription>Resumen del rendimiento de la promoción.</DialogDescription>
                </DialogHeader>
                {selectedPromotionForStats && (
                    <div className="space-y-3 py-4">
                        <p><strong>Códigos Generados (Total):</strong> {selectedPromotionForStats.generatedCodes?.length || 0}</p>
                        <p><strong>Códigos Canjeados:</strong> {selectedPromotionForStats.generatedCodes?.filter(c => c.status === 'redeemed').length || 0}</p>
                        <p><strong>Tasa de Canje:</strong> {selectedPromotionForStats.generatedCodes && selectedPromotionForStats.generatedCodes.length > 0 ? 
                            ((selectedPromotionForStats.generatedCodes.filter(c => c.status === 'redeemed').length / selectedPromotionForStats.generatedCodes.length) * 100).toFixed(1) + '%' 
                            : '0%'}
                        </p>
                        {/* Add more promotion-specific stats here if needed */}
                    </div>
                )}
                <UIDialogFooter>
                    <Button variant="outline" onClick={() => setShowStatsModal(false)}>Cerrar</Button>
                </UIDialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
    
  


    