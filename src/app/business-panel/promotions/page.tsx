
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2, Search, Ticket, BadgeCheck, BadgeX, QrCode, Eye, ListChecks } from "lucide-react";
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

// Mock data for business promotions - In a real app, this would be fetched for the logged-in business
let mockBusinessPromotions: BusinessManagedEntity[] = [
  { 
    id: "bp1", 
    businessId: "biz1", 
    type: "promotion", 
    name: "Jueves de Alitas BBQ", 
    description: "Todas las alitas BBQ a S/1 cada una.", 
    startDate: "2025-01-01T12:00:00", // Updated to 2025
    endDate: "2025-12-31T12:00:00", // Updated to 2025
    usageLimit: 0, 
    isActive: true, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "chicken wings",
    generatedCodes: [
        { id: "codePromo1-1", entityId: "bp1", value: "ALITAS001", status: "available", generatedByName: "Admin Negocio", generatedDate: "2025-01-20T10:00:00Z", observation: "Código de lanzamiento" },
        { id: "codePromo1-2", entityId: "bp1", value: "ALITAS002", status: "redeemed", generatedByName: "Admin Negocio", generatedDate: "2025-01-20T10:05:00Z", redemptionDate: "2025-01-21T12:00:00Z" },
        { id: "codePromo1-3", entityId: "bp1", value: "ALITAS003", status: "available", generatedByName: "Admin Negocio", generatedDate: "2025-01-20T10:06:00Z" },
    ]
  },
  { 
    id: "bp2", 
    businessId: "biz1", 
    type: "promotion", 
    name: "Happy Hour Extendido", 
    description: "Tragos seleccionados 2x1 de 5 PM a 9 PM.", 
    startDate: "2025-01-15T12:00:00", // Updated to 2025
    endDate: "2025-10-31T12:00:00", // Updated to 2025
    usageLimit: 500, 
    isActive: true, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "cocktails bar",
    generatedCodes: []
  },
  { 
    id: "bp3", 
    businessId: "biz1", 
    type: "promotion", 
    name: "Promo Cumpleañero Mes", 
    description: "Si cumples años este mes, tu postre es gratis.", 
    startDate: "2024-01-01T12:00:00", // Kept in past
    endDate: "2024-12-31T12:00:00", // Kept in past
    isActive: false, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "birthday cake",
    generatedCodes: []
  },
];


export default function BusinessPromotionsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateEditPromotionModal, setShowCreateEditPromotionModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<BusinessManagedEntity | null>(null);
  const [promotions, setPromotions] = useState<BusinessManagedEntity[]>(mockBusinessPromotions);
  
  const [showManageCodesModal, setShowManageCodesModal] = useState(false);
  const [selectedEntityForViewingCodes, setSelectedEntityForViewingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const [showCreateCodesModal, setShowCreateCodesModal] = useState(false);
  const [selectedEntityForCreatingCodes, setSelectedEntityForCreatingCodes] = useState<BusinessManagedEntity | null>(null);

  const { toast } = useToast();

  const filteredPromotions = promotions.filter(promo =>
    promo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (promo.description && promo.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreatePromotion = (data: BusinessPromotionFormData) => {
    const newPromotion: BusinessManagedEntity = {
      id: `bp${Date.now()}`,
      businessId: "biz1", 
      type: "promotion",
      name: data.name,
      description: data.description,
      startDate: format(data.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
      endDate: format(data.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
      usageLimit: data.usageLimit || 0, 
      isActive: data.isActive,
      imageUrl: data.imageUrl || (data.aiHint ? `https://placehold.co/300x200.png?text=${encodeURIComponent(data.aiHint.split(' ').slice(0,2).join('+'))}` : `https://placehold.co/300x200.png`),
      aiHint: data.aiHint,
      generatedCodes: [],
    };
    setPromotions(prev => [newPromotion, ...prev]);
    setShowCreateEditPromotionModal(false);
    toast({ title: "Promoción Creada", description: `La promoción "${newPromotion.name}" ha sido creada.` });
  };

  const handleEditPromotion = (data: BusinessPromotionFormData) => {
    if (!editingPromotion) return;
    const updatedPromotion: BusinessManagedEntity = {
      ...editingPromotion,
      name: data.name,
      description: data.description,
      startDate: format(data.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
      endDate: format(data.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
      usageLimit: data.usageLimit || 0,
      isActive: data.isActive,
      imageUrl: data.imageUrl || (data.aiHint ? `https://placehold.co/300x200.png?text=${encodeURIComponent(data.aiHint.split(' ').slice(0,2).join('+'))}` : editingPromotion.imageUrl || `https://placehold.co/300x200.png`),
      aiHint: data.aiHint,
    };
    setPromotions(prev => prev.map(p => p.id === editingPromotion.id ? updatedPromotion : p));
    setEditingPromotion(null);
    setShowCreateEditPromotionModal(false);
    toast({ title: "Promoción Actualizada", description: `La promoción "${updatedPromotion.name}" ha sido actualizada.` });
  };
  
  const handleDeletePromotion = (promotionId: string) => {
    setPromotions(prev => prev.filter(p => p.id !== promotionId));
    toast({ title: "Promoción Eliminada", description: `La promoción ha sido eliminada.`, variant: "destructive" });
  };

  const openCreateCodesDialog = (promotion: BusinessManagedEntity) => {
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


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Ticket className="h-8 w-8 mr-2" /> Gestión de Promociones
        </h1>
        <Button onClick={() => { setEditingPromotion(null); setShowCreateEditPromotionModal(true);}} className="bg-primary hover:bg-primary/90">
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
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPromotions.length > 0 ? (
                filteredPromotions.map((promo) => (
                  <TableRow key={promo.id}>
                    <TableCell className="font-medium">{promo.name}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {format(new Date(promo.startDate), "P", { locale: es })} - {format(new Date(promo.endDate), "P", { locale: es })}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-center">{getRedemptionCount(promo)}</TableCell>
                    <TableCell>
                      <Badge variant={promo.isActive ? "default" : "outline"} className={promo.isActive ? "bg-green-500 hover:bg-green-600" : ""}>
                        {promo.isActive ? <BadgeCheck className="mr-1 h-3 w-3"/> : <BadgeX className="mr-1 h-3 w-3"/>}
                        {promo.isActive ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="sm" onClick={() => openCreateCodesDialog(promo)}>
                        <QrCode className="h-4 w-4 mr-1" /> Crear Códigos
                      </Button>
                       <Button variant="outline" size="sm" onClick={() => openViewCodesDialog(promo)}>
                        <ListChecks className="h-4 w-4 mr-1" /> Ver Códigos ({promo.generatedCodes?.length || 0})
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditingPromotion(promo); setShowCreateEditPromotionModal(true);}}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Editar</span>
                      </Button>
                       <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Eliminar</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Esto eliminará permanentemente la promoción:
                               <span className="font-semibold"> {promo.name}</span>.
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
                  <TableCell colSpan={5} className="text-center h-24">No se encontraron promociones.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={showCreateEditPromotionModal} onOpenChange={setShowCreateEditPromotionModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPromotion ? "Editar Promoción" : "Crear Nueva Promoción"}</DialogTitle>
            <DialogDescription>
              {editingPromotion ? `Actualiza los detalles de "${editingPromotion.name}".` : "Completa los detalles para tu nueva promoción."}
            </DialogDescription>
          </DialogHeader>
          <BusinessPromotionForm
            promotion={editingPromotion || undefined}
            onSubmit={editingPromotion ? handleEditPromotion : handleCreatePromotion} 
            onCancel={() => setShowCreateEditPromotionModal(false)} 
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
            setShowManageCodesModal(false);
            if(selectedEntityForViewingCodes) { 
                 setTimeout(() => openCreateCodesDialog(selectedEntityForViewingCodes), 0); 
            }
          }}
        />
      )}
    </div>
  );
}

    