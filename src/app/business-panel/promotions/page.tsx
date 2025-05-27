
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
    if (!currentBusinessId) {
      console.log("BusinessPromotionsPage: No currentBusinessId, skipping fetch.");
      setPromotions([]);
      setIsLoading(false);
      return;
    }
    console.log("BusinessPromotionsPage: Fetching promotions for businessId:", currentBusinessId);
    setIsLoading(true);
    try {
      const q = query(
        collection(db, "businessEntities"),
        where("businessId", "==", currentBusinessId),
        where("type", "==", "promotion")
      );
      const querySnapshot = await getDocs(q);
      console.log("BusinessPromotionsPage: Firestore query executed. Snapshot size:", querySnapshot.size);
      const fetchedPromotions: BusinessManagedEntity[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          businessId: data.businessId,
          type: data.type as 'promotion', // Aseguramos que el tipo sea promoción
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
        };
      });
      setPromotions(fetchedPromotions);
      console.log("BusinessPromotionsPage: Fetched promotions:", fetchedPromotions);
    } catch (error: any) {
      console.error("BusinessPromotionsPage: Failed to fetch promotions:", error.code, error.message, error);
      toast({
        title: "Error al Cargar Promociones",
        description: `No se pudieron obtener las promociones. ${error.message}`,
        variant: "destructive",
      });
      setPromotions([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentBusinessId, toast]);

  useEffect(() => {
    if (userProfile) { // Solo intentar cargar si el perfil del usuario (y por ende businessId) está disponible
        fetchBusinessPromotions();
    } else {
        // Si no hay perfil de usuario (puede estar cargando o no tener acceso), no intentar cargar promociones
        setIsLoading(false); 
        setPromotions([]);
    }
  }, [userProfile, fetchBusinessPromotions]);


  const filteredPromotions = promotions.filter(promo =>
    (promo.name && typeof promo.name === 'string' ? promo.name.toLowerCase().includes(searchTerm.toLowerCase()) : false) ||
    (promo.description && typeof promo.description === 'string' ? promo.description.toLowerCase().includes(searchTerm.toLowerCase()) : false)
  ).sort((a, b) => { 
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
        isActive: true, // Las copias suelen activarse por defecto
      });
    } else {
      setEditingPromotion(promotion);
    }
    setShowCreateEditPromotionModal(true);
  };

  const handleFormSubmit = async (data: BusinessPromotionFormData) => {
    if (!currentBusinessId) {
      toast({ title: "Error de Negocio", description: "ID de negocio no disponible.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const promotionPayloadForFirestore: Omit<BusinessManagedEntity, 'id' | 'createdAt'> & { createdAt?: any } = {
      businessId: currentBusinessId,
      type: "promotion",
      name: data.name,
      description: data.description,
      termsAndConditions: data.termsAndConditions || "",
      startDate: data.startDate.toISOString(),
      endDate: data.endDate.toISOString(),
      usageLimit: data.usageLimit || 0,
      isActive: data.isActive,
      imageUrl: data.imageUrl || (data.aiHint ? `https://placehold.co/300x200.png?text=${encodeURIComponent(data.aiHint.split(' ').slice(0,2).join('+'))}` : `https://placehold.co/300x200.png`),
      aiHint: data.aiHint || "",
      generatedCodes: editingPromotion && !isDuplicating ? editingPromotion.generatedCodes || [] : [], // Mantener códigos si se edita, limpiar si se duplica o crea
    };
    
    console.log("BusinessPromotionsPage: Submitting promotion payload:", promotionPayloadForFirestore);

    try {
      if (editingPromotion && !isDuplicating && editingPromotion.id) {
        const promotionRef = doc(db, "businessEntities", editingPromotion.id);
        // Convertir fechas a Timestamps para la actualización
        const updateData = {
            ...promotionPayloadForFirestore,
            startDate: Timestamp.fromDate(new Date(promotionPayloadForFirestore.startDate)),
            endDate: Timestamp.fromDate(new Date(promotionPayloadForFirestore.endDate)),
        };
        await updateDoc(promotionRef, updateData);
        toast({ title: "Promoción Actualizada", description: `La promoción "${data.name}" ha sido actualizada.` });
      } else {
        // Convertir fechas a Timestamps para la creación
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
      console.error("BusinessPromotionsPage: Failed to submit promotion:", error.code, error.message, error);
      toast({ title: "Error al Guardar", description: `No se pudo guardar la promoción. ${error.message}`, variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeletePromotion = async (promotionId: string, promotionName?: string) => {
    if (!currentBusinessId) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "businessEntities", promotionId));
      toast({ title: "Promoción Eliminada", description: `La promoción "${promotionName || 'seleccionada'}" ha sido eliminada.`, variant: "destructive" });
      fetchBusinessPromotions(); 
    } catch (error: any) {
      console.error("BusinessPromotionsPage: Failed to delete promotion:", error.code, error.message, error);
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
    if (!currentBusinessId) return;
    const targetPromotion = promotions.find(p => p.id === entityId);
    if (!targetPromotion) {
        toast({title:"Error", description:"Promoción no encontrada para añadir códigos.", variant: "destructive"});
        return;
    }
    
    const updatedCodes = [...(targetPromotion.generatedCodes || []), ...newCodes];
    
    try {
        await updateDoc(doc(db, "businessEntities", entityId), { generatedCodes: updatedCodes });
        toast({title: `${newCodes.length} Código(s) Creado(s)`, description: `Para: ${targetPromotion.name}. Guardados en la base de datos.`});
        fetchBusinessPromotions(); // Re-fetch to update the list and the specific promotion in state
        if (editingPromotion?.id === entityId) { // Also update editingPromotion if it's being managed in a modal
            setEditingPromotion(prev => prev ? {...prev, generatedCodes: updatedCodes} : null);
        }
    } catch (error: any) {
        console.error("BusinessPromotionsPage: Failed to save new codes to Firestore:", error);
        toast({title: "Error al Guardar Códigos", description: `No se pudieron guardar los códigos. ${error.message}`, variant: "destructive"});
    }
  };

  const handleCodesUpdatedFromManageDialog = async (entityId: string, updatedCodes: GeneratedCode[]) => {
    if (!currentBusinessId) return;
    const targetPromotion = promotions.find(p => p.id === entityId);
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
        console.error("BusinessPromotionsPage: Failed to save updated codes to Firestore:", error);
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
    if (!currentBusinessId || !promotionToToggle.id) return;
    
    const newStatus = !promotionToToggle.isActive;
    const originalStatus = promotionToToggle.isActive;
    const promotionName = promotionToToggle.name;

    // Optimistic UI update
    setPromotions(prev => 
        prev.map(p => p.id === promotionToToggle.id ? {...p, isActive: newStatus} : p)
    );

    setIsSubmitting(true); // Use general isSubmitting for this operation too
    try {
      await updateDoc(doc(db, "businessEntities", promotionToToggle.id), { isActive: newStatus });
      toast({
        title: "Estado Actualizado",
        description: `La promoción "${promotionName}" ahora está ${newStatus ? "Activa" : "Inactiva"}.`
      });
    } catch (error: any) {
      console.error("BusinessPromotionsPage: Failed to update promotion status:", error.code, error.message, error);
      // Revert UI on error
      setPromotions(prev => 
        prev.map(p => p.id === promotionToToggle.id ? {...p, isActive: originalStatus} : p)
      );
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
      
      {!currentBusinessId && !isLoading && (
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden md:table-cell">Vigencia</TableHead>
                    <TableHead className="hidden lg:table-cell text-center">Canjes</TableHead>
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

    