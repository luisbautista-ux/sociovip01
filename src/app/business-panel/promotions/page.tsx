
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2, Search, Ticket, QrCode, ListChecks, Copy, Loader2 } from "lucide-react";
import type { BusinessManagedEntity, BusinessPromotionFormData, GeneratedCode } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as UIAlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BusinessPromotionForm } from "@/components/business/forms/BusinessPromotionForm";
import { ManageCodesDialog } from "@/components/business/dialogs/ManageCodesDialog";
import { CreateCodesDialog } from "@/components/business/dialogs/CreateCodesDialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, getDocs, updateDoc, deleteDoc, query, where, serverTimestamp, Timestamp } from "firebase/firestore";

export default function BusinessPromotionsPage() {
  const { userProfile } = useAuth();
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

  const currentBusinessId = userProfile?.businessId;

  const fetchBusinessPromotions = useCallback(async () => {
    console.log('Promotions Page: Attempting to fetch promotions. UserProfile:', userProfile);
    if (!currentBusinessId) {
      console.warn("Promotions Page: No currentBusinessId available from userProfile. Skipping fetch.");
      setPromotions([]);
      setIsLoading(false);
      if (userProfile !== undefined) { // Solo mostrar toast si el perfil ya se intentó cargar
          toast({ title: "Error de Negocio", description: "ID de negocio no disponible en tu perfil.", variant: "destructive", duration: 7000 });
      }
      return;
    }
    
    console.log('Promotions Page: Querying promotions with businessId:', currentBusinessId);
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
        return {
          id: docSnap.id,
          businessId: data.businessId,
          type: data.type as 'promotion',
          name: data.name || "Promoción sin nombre",
          description: data.description || "",
          termsAndConditions: data.termsAndConditions || "",
          startDate: data.startDate instanceof Timestamp ? data.startDate.toDate().toISOString() : (data.startDate || new Date().toISOString()),
          endDate: data.endDate instanceof Timestamp ? data.endDate.toDate().toISOString() : (data.endDate || new Date().toISOString()),
          usageLimit: data.usageLimit === undefined ? 0 : data.usageLimit,
          isActive: data.isActive === undefined ? true : data.isActive,
          imageUrl: data.imageUrl || "",
          aiHint: data.aiHint || "",
          generatedCodes: data.generatedCodes || [],
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : undefined),
        };
      });
      setPromotions(fetchedPromotions);
      console.log("Promotions Page: Fetched promotions successfully:", fetchedPromotions);
    } catch (error: any) {
      console.error("Promotions Page: Error fetching promotions:", error.code, error.message, error);
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
    if (userProfile) { 
        fetchBusinessPromotions();
    } else if (userProfile === null) { // Perfil cargado pero es null (ej. error de auth o sin perfil)
        setIsLoading(false); 
        setPromotions([]);
    }
    // Si userProfile es undefined, se espera a que se cargue
  }, [userProfile, fetchBusinessPromotions]);


  const filteredPromotions = promotions.filter(promo =>
    (promo.name && typeof promo.name === 'string' ? promo.name.toLowerCase().includes(searchTerm.toLowerCase()) : false) ||
    (promo.description && typeof promo.description === 'string' ? promo.description.toLowerCase().includes(searchTerm.toLowerCase()) : false)
  ).sort((a, b) => { 
      const aActive = isEntityCurrentlyActivatable(a);
      const bActive = isEntityCurrentlyActivatable(b);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      if (a.isActive && !b.isActive) return -1; 
      if (!a.isActive && b.isActive) return 1;
      return (a.name || "").localeCompare(b.name || "");
  });

  const handleOpenCreateEditModal = (promotion: BusinessManagedEntity | null, duplicate = false) => {
    setIsDuplicating(duplicate);
    if (duplicate && promotion) {
      setEditingPromotion({
        ...promotion,
        id: '', 
        name: `${promotion.name || 'Promoción'} (Copia)`,
        generatedCodes: [], 
        isActive: true, 
        ticketTypes: [], // promotions don't have these
        eventBoxes: [],
        assignedPromoters: [],
      });
    } else {
      setEditingPromotion(promotion);
    }
    setShowCreateEditPromotionModal(true);
  };

  const handleFormSubmit = async (data: BusinessPromotionFormData) => {
    if (!currentBusinessId) {
      toast({ title: "Error de Negocio", description: "ID de negocio no disponible. No se puede guardar la promoción.", variant: "destructive", duration: 7000 });
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);

    const promotionPayloadForFirestore: Omit<BusinessManagedEntity, 'id' | 'createdAt' | 'maxAttendance' | 'ticketTypes' | 'eventBoxes' | 'assignedPromoters'> & { createdAt?: any } = {
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
      generatedCodes: editingPromotion && !isDuplicating ? editingPromotion.generatedCodes || [] : [],
    };
    
    console.log("Promotions Page: Saving promotion with payload:", JSON.stringify(promotionPayloadForFirestore, null, 2));

    try {
      if (editingPromotion && !isDuplicating && editingPromotion.id) {
        const promotionRef = doc(db, "businessEntities", editingPromotion.id);
        const updateData = {
            ...promotionPayloadForFirestore,
            startDate: Timestamp.fromDate(new Date(promotionPayloadForFirestore.startDate)),
            endDate: Timestamp.fromDate(new Date(promotionPayloadForFirestore.endDate)),
        };
        await updateDoc(promotionRef, updateData);
        toast({ title: "Promoción Actualizada", description: `La promoción "${data.name}" ha sido actualizada.` });
      } else {
        const createData = {
            ...promotionPayloadForFirestore,
            startDate: Timestamp.fromDate(new Date(promotionPayloadForFirestore.startDate)),
            endDate: Timestamp.fromDate(new Date(promotionPayloadForFirestore.endDate)),
            createdAt: serverTimestamp(),
        };
        const docRef = await addDoc(collection(db, "businessEntities"), createData);
        toast({ title: isDuplicating ? "Promoción Duplicada" : "Promoción Creada", description: `La promoción "${data.name}" ha sido creada con ID: ${docRef.id}.` });
      }
      setShowCreateEditPromotionModal(false);
      setEditingPromotion(null);
      setIsDuplicating(false);
      fetchBusinessPromotions(); 
    } catch (error: any) {
      console.error("Promotions Page: Error saving promotion:", error.code, error.message, error);
      let desc = `No se pudo guardar la promoción. ${error.message}`;
      if (error.code === 'permission-denied') {
          desc = `Error de permisos al guardar la promoción. Asegúrate de que tu usuario (${userProfile?.email}) esté correctamente asignado al negocio con ID: ${currentBusinessId} en 'platformUsers' y que las reglas de Firestore lo permitan. Payload: ${JSON.stringify(promotionPayloadForFirestore)}`;
      }
      toast({ title: "Error al Guardar", description: desc, variant: "destructive", duration: 10000});
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
      console.error("Promotions Page: Error deleting promotion:", error.code, error.message, error);
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
    const targetPromotion = promotions.find(p => p.id === entityId) || (editingPromotion?.id === entityId ? editingPromotion : null);
    if (!targetPromotion) {
        toast({title:"Error", description:"Promoción no encontrada para añadir códigos.", variant: "destructive"});
        return;
    }
    
    const updatedCodes = [...(targetPromotion.generatedCodes || []), ...newCodes];
    
    try {
        await updateDoc(doc(db, "businessEntities", entityId), { generatedCodes: updatedCodes });
        toast({title: `${newCodes.length} Código(s) Creado(s)`, description: `Para: ${targetPromotion.name}. Guardados en la base de datos.`});
        fetchBusinessPromotions(); 
        if (editingPromotion?.id === entityId) {
            setEditingPromotion(prev => prev ? {...prev, generatedCodes: updatedCodes} : null);
        }
    } catch (error: any) {
        console.error("Promotions Page: Error saving new codes to Firestore:", error.code, error.message, error);
        toast({title: "Error al Guardar Códigos", description: `No se pudieron guardar los códigos. ${error.message}`, variant: "destructive"});
    }
  };

  const handleCodesUpdatedFromManageDialog = async (entityId: string, updatedCodes: GeneratedCode[]) => {
    if (!currentBusinessId) {
      toast({ title: "Error", description: "ID de negocio no disponible.", variant: "destructive" });
      return;
    }
    const targetPromotion = promotions.find(p => p.id === entityId) || (editingPromotion?.id === entityId ? editingPromotion : null);
     if (!targetPromotion) {
        toast({title:"Error", description:"Promoción no encontrada para actualizar códigos.", variant: "destructive"});
        return;
    }
    
     try {
        await updateDoc(doc(db, "businessEntities", entityId), { generatedCodes: updatedCodes });
        toast({title: "Códigos Actualizados", description: `Los códigos para "${targetPromotion.name}" han sido guardados.`});
        fetchBusinessPromotions();
        if (editingPromotion?.id === entityId) {
             setEditingPromotion(prev => prev ? {...prev, generatedCodes: updatedCodes} : null);
        }
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
    const originalStatus = promotionToToggle.isActive; // Save original status for potential revert
    const promotionName = promotionToToggle.name;

    // Optimistic UI update
    setPromotions(prev => 
        prev.map(p => p.id === promotionToToggle.id ? {...p, isActive: newStatus} : p)
    );
    if (editingPromotion && editingPromotion.id === promotionToToggle.id) {
        setEditingPromotion(prev => prev ? {...prev, isActive: newStatus} : null);
    }

    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "businessEntities", promotionToToggle.id), { isActive: newStatus });
      toast({
        title: "Estado Actualizado",
        description: `La promoción "${promotionName}" ahora está ${newStatus ? "Activa" : "Inactiva"}.`
      });
    } catch (error: any) {
      console.error("Promotions Page: Error updating promotion status:", error.code, error.message, error);
      // Revert UI on error
      setPromotions(prev => 
        prev.map(p => p.id === promotionToToggle.id ? {...p, isActive: originalStatus} : p)
      );
       if (editingPromotion && editingPromotion.id === promotionToToggle.id) {
        setEditingPromotion(prev => prev ? {...prev, isActive: originalStatus} : null);
      }
      toast({
        title: "Error al Actualizar Estado",
        description: `No se pudo cambiar el estado de la promoción. ${error.message}`,
        variant: "destructive"
      });
    } finally {
        setIsSubmitting(false);
    }
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
      
      {!currentBusinessId && !isLoading && userProfile !== undefined && ( // userProfile !== undefined means auth check has happened
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-destructive">Error de Configuración del Negocio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Tu perfil de usuario no está asociado a un negocio o el ID del negocio no está disponible.
              Por favor, contacta al superadministrador para que configure tu acceso.
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
                                  <Badge variant={promo.isActive ? "default" : "outline"} className={promo.isActive ? "bg-green-500 hover:bg-green-600" : ""}>
                                      {promo.isActive ? "Activa" : "Inactiva"}
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
                            <Button variant="ghost" size="icon" title="Duplicar Promoción" onClick={() => handleOpenCreateEditModal(promo, true)} disabled={isSubmitting}>
                              <Copy className="h-4 w-4" />
                              <span className="sr-only">Duplicar</span>
                            </Button>
                            <Button variant="ghost" size="icon" title="Editar Promoción" onClick={() => handleOpenCreateEditModal(promo)} disabled={isSubmitting}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Editar</span>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Eliminar Promoción" className="text-destructive hover:text-destructive" disabled={isSubmitting}>
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Eliminar</span>
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
          onOpenChange={setShowCreateCodesModal}
          entityName={selectedEntityForCreatingCodes.name}
          entityId={selectedEntityForCreatingCodes.id}
          existingCodesValues={(selectedEntityForCreatingCodes.generatedCodes || []).map(c => c.value)}
          onCodesCreated={handleNewCodesCreated}
          isSubmitting={isSubmitting} 
        />
      )}

      {selectedEntityForViewingCodes && (
        <ManageCodesDialog
          open={showManageCodesModal}
          onOpenChange={(isOpen) => {
            setShowManageCodesModal(isOpen);
            if (!isOpen) setSelectedEntityForViewingCodes(null);
          }}
          entity={selectedEntityForViewingCodes}
          onCodesUpdated={handleCodesUpdatedFromManageDialog}
          onRequestCreateNewCodes={() => {
            const currentEntity = promotions.find(e => e.id === selectedEntityForViewingCodes?.id); 
            setShowManageCodesModal(false); 
            if(currentEntity) { 
                setTimeout(() => { 
                    if (isEntityCurrentlyActivatable(currentEntity)) {
                        setSelectedEntityForCreatingCodes(currentEntity);
                        setShowCreateCodesModal(true);
                    } else {
                        toast({
                            title: "No se pueden crear códigos",
                            description: "Esta promoción no está activa o está fuera de su periodo de vigencia.",
                            variant: "destructive"
                        });
                    }
                }, 0);
            }
          }}
        />
      )}
    </div>
  );
}

    
  