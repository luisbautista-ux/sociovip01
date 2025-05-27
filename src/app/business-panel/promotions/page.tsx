
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2, Search, Ticket, BadgeCheck, BadgeX, QrCode, Eye, ListChecks, Copy } from "lucide-react";
import type { BusinessManagedEntity, BusinessPromotionFormData, GeneratedCode } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BusinessPromotionForm } from "@/components/business/forms/BusinessPromotionForm";
import { ManageCodesDialog } from "@/components/business/dialogs/ManageCodesDialog";
import { CreateCodesDialog } from "@/components/business/dialogs/CreateCodesDialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { isEntityCurrentlyActivatable } from "@/lib/utils";

// Mock data for business promotions - In a real app, this would be fetched for the logged-in business
let mockBusinessPromotions: BusinessManagedEntity[] = [
  { 
    id: "bp1", 
    businessId: "biz1", 
    type: "promotion", 
    name: "Jueves de Alitas BBQ", 
    description: "Todas las alitas BBQ a S/1 cada una.", 
    startDate: "2025-01-01T12:00:00",
    endDate: "2025-12-31T12:00:00",
    usageLimit: 0, 
    isActive: true, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "chicken wings",
    termsAndConditions: "Válido solo para consumo en local. Máximo 20 alitas por persona con código.",
    generatedCodes: [
        { id: "codePromo1-1", entityId: "bp1", value: "ALITAS001", status: "available", generatedByName: "Admin Negocio", generatedDate: "2025-01-20T10:00:00Z", observation: "Código de lanzamiento" },
        { id: "codePromo1-2", entityId: "bp1", value: "ALITAS002", status: "redeemed", generatedByName: "Admin Negocio", generatedDate: "2025-01-20T10:05:00Z", redemptionDate: "2025-01-21T12:00:00Z" },
        { id: "codePromo1-3", entityId: "bp1", value: "ALITAS003", status: "available", generatedByName: "Admin Negocio", generatedDate: "2025-01-20T10:06:00Z", observation: "Para clientes frecuentes" },
    ]
  },
  { 
    id: "bp2", 
    businessId: "biz1", 
    type: "promotion", 
    name: "Happy Hour Extendido", 
    description: "Tragos seleccionados 2x1 de 5 PM a 9 PM.", 
    startDate: "2025-01-15T12:00:00",
    endDate: "2025-10-31T12:00:00",
    usageLimit: 500, 
    isActive: true, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "cocktails bar",
    termsAndConditions: "No aplica para tragos premium. Sujeto a disponibilidad.",
    generatedCodes: []
  },
  { 
    id: "bp3", 
    businessId: "biz1", 
    type: "promotion", 
    name: "Promo Cumpleañero Mes", 
    description: "Si cumples años este mes, tu postre es gratis.", 
    startDate: "2025-01-01T12:00:00", 
    endDate: "2025-12-31T12:00:00", 
    isActive: false, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "birthday cake",
    termsAndConditions: "Presentar DNI para validar fecha de nacimiento. Un postre por cumpleañero.",
    generatedCodes: []
  },
];


export default function BusinessPromotionsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateEditPromotionModal, setShowCreateEditPromotionModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<BusinessManagedEntity | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [promotions, setPromotions] = useState<BusinessManagedEntity[]>(mockBusinessPromotions);
  
  const [showManageCodesModal, setShowManageCodesModal] = useState(false);
  const [selectedEntityForViewingCodes, setSelectedEntityForViewingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const [showCreateCodesModal, setShowCreateCodesModal] = useState(false);
  const [selectedEntityForCreatingCodes, setSelectedEntityForCreatingCodes] = useState<BusinessManagedEntity | null>(null);

  const { toast } = useToast();

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
        id: `bp${Date.now()}`, 
        name: `${promotion.name || 'Promoción'} (Copia)`,
        generatedCodes: [], 
      });
    } else {
      setEditingPromotion(promotion);
    }
    setShowCreateEditPromotionModal(true);
  };

  const handleFormSubmit = (data: BusinessPromotionFormData) => {
    if (editingPromotion && !isDuplicating) { 
      const updatedPromotion: BusinessManagedEntity = {
        ...(editingPromotion as BusinessManagedEntity), // Ensure all BusinessManagedEntity fields are spread
        type: "promotion", // Ensure type is set
        name: data.name,
        description: data.description,
        termsAndConditions: data.termsAndConditions,
        startDate: format(data.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
        endDate: format(data.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
        usageLimit: data.usageLimit || 0,
        isActive: data.isActive,
        imageUrl: data.imageUrl || (data.aiHint ? `https://placehold.co/300x200.png?text=${encodeURIComponent(data.aiHint.split(' ').slice(0,2).join('+'))}` : editingPromotion.imageUrl || `https://placehold.co/300x200.png`),
        aiHint: data.aiHint,
      };
      setPromotions(prev => prev.map(p => p.id === editingPromotion.id ? updatedPromotion : p));
      toast({ title: "Promoción Actualizada", description: `La promoción "${updatedPromotion.name}" ha sido actualizada.` });
    } else { 
      const newPromotion: BusinessManagedEntity = {
        id: editingPromotion?.id || `bp${Date.now()}`, 
        businessId: "biz1", // This should come from logged-in user context
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
      setPromotions(prev => [newPromotion, ...prev.filter(p => p.id !== newPromotion.id)]); 
      toast({ title: isDuplicating ? "Promoción Duplicada" : "Promoción Creada", description: `La promoción "${newPromotion.name}" ha sido ${isDuplicating ? 'duplicada' : 'creada'}.` });
    }
    setShowCreateEditPromotionModal(false);
    setEditingPromotion(null);
    setIsDuplicating(false);
  };
  
  const handleDeletePromotion = (promotionId: string) => {
    setPromotions(prev => prev.filter(p => p.id !== promotionId));
    toast({ title: "Promoción Eliminada", description: `La promoción ha sido eliminada.`, variant: "destructive" });
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
  
  const handleNewCodesCreated = (entityId: string, newCodes: GeneratedCode[], observation?: string) => {
    setPromotions(prevPromotions => prevPromotions.map(promo => {
      if (promo.id === entityId) {
        const updatedCodes = [...(promo.generatedCodes || []), ...newCodes];
        return { ...promo, generatedCodes: updatedCodes };
      }
      return promo;
    }));
  };

  const handleCodesUpdatedFromManageDialog = (entityId: string, updatedCodes: GeneratedCode[]) => {
     setPromotions(prevPromotions => prevPromotions.map(promo => 
      promo.id === entityId ? { ...promo, generatedCodes: updatedCodes } : promo
    ));
  };

  const getRedemptionCount = (promotion: BusinessManagedEntity) => {
    const redeemedCount = promotion.generatedCodes?.filter(c => c.status === 'redeemed').length || 0;
    const totalGenerated = promotion.generatedCodes?.length || 0;
    if (promotion.usageLimit && promotion.usageLimit > 0) {
      return `${redeemedCount} / ${promotion.usageLimit}`;
    }
    return `${redeemedCount} / ${totalGenerated === 0 ? '∞' : totalGenerated } (Generados)`;
  };

  const handleTogglePromotionStatus = (promotionId: string) => {
    let promotionNameForToast = "";
    let newStatusForToast = false;

    const updateStatusLogic = (promoToUpdate: BusinessManagedEntity | null): BusinessManagedEntity | null => {
      if (!promoToUpdate || promoToUpdate.id !== promotionId) return promoToUpdate;
      
      promotionNameForToast = promoToUpdate.name;
      newStatusForToast = !promoToUpdate.isActive;
      
      return { ...promoToUpdate, isActive: newStatusForToast };
    };
    
    setPromotions(prevPromotions =>
      prevPromotions.map(promo =>
        promo.id === promotionId ? updateStatusLogic(promo) as BusinessManagedEntity : promo
      )
    );
        
    // Call toast after state updates are queued
    if (promotionNameForToast) {
       setTimeout(() => { // Ensures toast is called after render cycle
        toast({
          title: "Estado Actualizado",
          description: `La promoción "${promotionNameForToast}" ahora está ${newStatusForToast ? "Activa" : "Inactiva"}.`
        });
      }, 0);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Ticket className="h-8 w-8 mr-2" /> Gestión de Promociones
        </h1>
        <Button onClick={() => handleOpenCreateEditModal(null)} className="bg-primary hover:bg-primary/90">
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
            />
          </div>
        </CardHeader>
        <CardContent>
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
                                onCheckedChange={() => handleTogglePromotionStatus(promo.id)}
                                aria-label={`Estado de la promoción ${promo.name}`}
                                id={`status-switch-${promo.id}`}
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
                      <Button variant="default" size="xs" onClick={() => openCreateCodesDialog(promo)} disabled={!isEntityCurrentlyActivatable(promo)} className="bg-accent hover:bg-accent/90 text-accent-foreground px-2 py-1 h-auto">
                        <QrCode className="h-3 w-3 mr-1" /> Crear
                      </Button>
                      <Button variant="outline" size="xs" onClick={() => openViewCodesDialog(promo)} className="px-2 py-1 h-auto">
                        <ListChecks className="h-3 w-3 mr-1" /> Ver ({promo.generatedCodes?.length || 0})
                      </Button>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" title="Duplicar Promoción" onClick={() => handleOpenCreateEditModal(promo, true)}>
                        <Copy className="h-4 w-4" />
                        <span className="sr-only">Duplicar</span>
                      </Button>
                      <Button variant="ghost" size="icon" title="Editar Promoción" onClick={() => handleOpenCreateEditModal(promo)}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Editar</span>
                      </Button>
                       <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="Eliminar Promoción" className="text-destructive hover:text-destructive">
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
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeletePromotion(promo.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
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
                  <TableCell colSpan={6} className="text-center h-24">No se encontraron promociones.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
