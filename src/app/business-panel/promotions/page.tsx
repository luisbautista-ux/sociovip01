
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2, Search, Ticket, BadgeCheck, BadgeX, QrCode, ListChecks, Copy, Loader2 } from "lucide-react";
import type { BusinessManagedEntity, BusinessPromotionFormData, GeneratedCode } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BusinessPromotionForm } from "@/components/business/forms/BusinessPromotionForm";
import { ManageCodesDialog } from "@/components/business/dialogs/ManageCodesDialog";
import { CreateCodesDialog } from "@/components/business/dialogs/CreateCodesDialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { isEntityCurrentlyActivatable } from "@/lib/utils";

const apiClient = {
  getPromotions: async (businessId: string): Promise<BusinessManagedEntity[]> => {
    console.log("API CALL: apiClient.getPromotions for businessId:", businessId);
    await new Promise(resolve => setTimeout(resolve, 1000));
    // return [
    //   { id: "bp1", businessId: "biz1", type: "promotion", name: "Jueves de Alitas BBQ (API)", description: "Todas las alitas BBQ a S/1 cada una.", startDate: "2025-01-01T12:00:00", endDate: "2025-12-31T12:00:00", usageLimit: 0, isActive: true, imageUrl: "https://placehold.co/300x200.png", aiHint: "chicken wings", termsAndConditions: "Válido solo para consumo en local.", generatedCodes: [] },
    // ];
    return [];
  },
  createPromotion: async (businessId: string, data: BusinessPromotionFormData): Promise<BusinessManagedEntity> => {
    console.log("API CALL: apiClient.createPromotion for businessId:", businessId, data);
    await new Promise(resolve => setTimeout(resolve, 700));
    const newPromotion: BusinessManagedEntity = {
      id: `bp${Date.now()}`,
      businessId,
      type: "promotion",
      name: data.name,
      description: data.description,
      termsAndConditions: data.termsAndConditions,
      startDate: format(data.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
      endDate: format(data.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
      usageLimit: data.usageLimit || 0,
      isActive: data.isActive,
      imageUrl: data.imageUrl || (data.aiHint ? `https://placehold.co/300x200.png?text=${encodeURIComponent(data.aiHint.split(' ').slice(0,2).join('+'))}` : `https://placehold.co/300x200.png`),
      aiHint: data.aiHint,
      generatedCodes: [],
    };
    return newPromotion;
  },
  updatePromotion: async (id: string, data: BusinessPromotionFormData, existingPromotion: BusinessManagedEntity): Promise<BusinessManagedEntity> => {
    console.log("API CALL: apiClient.updatePromotion", id, data);
    await new Promise(resolve => setTimeout(resolve, 700));
    return {
      ...existingPromotion,
      name: data.name,
      description: data.description,
      termsAndConditions: data.termsAndConditions,
      startDate: format(data.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
      endDate: format(data.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
      usageLimit: data.usageLimit || 0,
      isActive: data.isActive,
      imageUrl: data.imageUrl || (data.aiHint ? `https://placehold.co/300x200.png?text=${encodeURIComponent(data.aiHint.split(' ').slice(0,2).join('+'))}` : existingPromotion.imageUrl || `https://placehold.co/300x200.png`),
      aiHint: data.aiHint,
    };
  },
  deletePromotion: async (id: string): Promise<void> => {
    console.log("API CALL: apiClient.deletePromotion", id);
    await new Promise(resolve => setTimeout(resolve, 700));
  },
  updatePromotionCodes: async (promotionId: string, codes: GeneratedCode[]): Promise<GeneratedCode[]> => {
    console.log("API CALL: apiClient.updatePromotionCodes", promotionId, codes.length);
    await new Promise(resolve => setTimeout(resolve, 300));
    return codes; // Simulate successful update
  },
  togglePromotionStatus: async (promotionId: string, isActive: boolean): Promise<void> => {
    console.log("API CALL: apiClient.togglePromotionStatus", promotionId, isActive);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
};

const MOCK_BUSINESS_ID = "biz1"; // Assume this comes from logged-in user context

export default function BusinessPromotionsPage() {
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

  const fetchPromotions = async () => {
    setIsLoading(true);
    try {
      const fetchedPromotions = await apiClient.getPromotions(MOCK_BUSINESS_ID);
      setPromotions(fetchedPromotions);
    } catch (error) {
      console.error("Failed to fetch promotions:", error);
      toast({
        title: "Error al Cargar Promociones",
        description: "No se pudieron obtener las promociones. Intenta de nuevo.",
        variant: "destructive",
      });
      setPromotions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        id: '', // New ID will be assigned by backend or upon saving locally before backend
        name: `${promotion.name || 'Promoción'} (Copia)`,
        generatedCodes: [], 
      });
    } else {
      setEditingPromotion(promotion);
    }
    setShowCreateEditPromotionModal(true);
  };

  const handleFormSubmit = async (data: BusinessPromotionFormData) => {
    setIsSubmitting(true);
    try {
      if (editingPromotion && !isDuplicating && editingPromotion.id) { 
        // const updatedPromotion = await apiClient.updatePromotion(editingPromotion.id, data, editingPromotion);
        await apiClient.updatePromotion(editingPromotion.id, data, editingPromotion); // Mock
        toast({ title: "Promoción Actualizada", description: `La promoción "${data.name}" ha sido programada para actualización.` });
      } else { 
        // const newPromotion = await apiClient.createPromotion(MOCK_BUSINESS_ID, data);
        await apiClient.createPromotion(MOCK_BUSINESS_ID, data); // Mock
        toast({ title: isDuplicating ? "Promoción Duplicada" : "Promoción Creada", description: `La promoción "${data.name}" ha sido programada para ${isDuplicating ? 'duplicación' : 'creación'}.` });
      }
      setShowCreateEditPromotionModal(false);
      setEditingPromotion(null);
      setIsDuplicating(false);
      fetchPromotions(); // Re-fetch
    } catch (error) {
      console.error("Failed to submit promotion:", error);
      toast({ title: "Error al Guardar", description: "No se pudo guardar la promoción.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeletePromotion = async (promotionId: string, promotionName?: string) => {
    setIsSubmitting(true); // Use general isSubmitting for delete operation as well
    try {
      await apiClient.deletePromotion(promotionId);
      toast({ title: "Promoción Eliminada", description: `La promoción "${promotionName || 'seleccionada'}" ha sido programada para eliminación.`, variant: "destructive" });
      fetchPromotions(); // Re-fetch
    } catch (error) {
      console.error("Failed to delete promotion:", error);
      toast({ title: "Error al Eliminar", description: "No se pudo eliminar la promoción.", variant: "destructive"});
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
    const targetPromotion = promotions.find(p => p.id === entityId);
    if (!targetPromotion) return;

    const updatedCodes = [...(targetPromotion.generatedCodes || []), ...newCodes];
    // Simulate backend update for codes
    try {
      // await apiClient.updatePromotionCodes(entityId, updatedCodes);
      // For mock, directly update state after simulation
      setPromotions(prevPromotions => prevPromotions.map(promo => 
        promo.id === entityId ? { ...promo, generatedCodes: updatedCodes } : promo
      ));
      toast({title: `${newCodes.length} Código(s) Creado(s)`, description: `Para: ${targetPromotion.name}`});
    } catch (error) {
      toast({title: "Error", description: "No se pudieron guardar los nuevos códigos.", variant: "destructive"});
    }
  };

  const handleCodesUpdatedFromManageDialog = async (entityId: string, updatedCodes: GeneratedCode[]) => {
    const targetPromotion = promotions.find(p => p.id === entityId);
    if (!targetPromotion) return;
    // Simulate backend update for codes
    try {
      // await apiClient.updatePromotionCodes(entityId, updatedCodes);
      setPromotions(prevPromotions => prevPromotions.map(promo => 
        promo.id === entityId ? { ...promo, generatedCodes: updatedCodes } : promo
      ));
       toast({title: "Códigos Actualizados", description: `Para: ${targetPromotion.name}`});
    } catch (error) {
      toast({title: "Error", description: "No se pudieron actualizar los códigos.", variant: "destructive"});
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

  const handleTogglePromotionStatus = async (promotion: BusinessManagedEntity) => {
    const newStatus = !promotion.isActive;
    const originalStatus = promotion.isActive;
    
    // Optimistically update UI
    setPromotions(prev => prev.map(p => p.id === promotion.id ? {...p, isActive: newStatus} : p));

    try {
      await apiClient.togglePromotionStatus(promotion.id, newStatus);
      toast({
        title: "Estado Actualizado",
        description: `La promoción "${promotion.name}" ahora está ${newStatus ? "Activa" : "Inactiva"}.`
      });
    } catch (error) {
      // Revert UI on error
      setPromotions(prev => prev.map(p => p.id === promotion.id ? {...p, isActive: originalStatus} : p));
      toast({
        title: "Error al Actualizar Estado",
        description: "No se pudo cambiar el estado de la promoción.",
        variant: "destructive"
      });
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Ticket className="h-8 w-8 mr-2" /> Gestión de Promociones
        </h1>
        <Button onClick={() => handleOpenCreateEditModal(null)} className="bg-primary hover:bg-primary/90" disabled={isLoading}>
          <PlusCircle className="mr-2 h-4 w-4" /> Crear Promoción
        </Button>
      </div>
      
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
          ) : filteredPromotions.length === 0 && !searchTerm ? (
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
                        {promo.startDate ? format(new Date(promo.startDate), "P", { locale: es }) : 'N/A'} - {promo.endDate ? format(new Date(promo.endDate), "P", { locale: es }) : 'N/A'}
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
                                  {promo.isActive ? <BadgeCheck className="mr-1 h-3 w-3"/> : <BadgeX className="mr-1 h-3 w-3"/>}
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
                              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
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
            const currentEntity = selectedEntityForViewingCodes; 
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

    