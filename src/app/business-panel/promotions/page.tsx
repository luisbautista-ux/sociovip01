
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2, Search, Ticket, BadgeCheck, BadgeX } from "lucide-react";
import type { BusinessManagedEntity, BusinessPromotionFormData } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BusinessPromotionForm } from "@/components/business/forms/BusinessPromotionForm";

// Mock data for business promotions - In a real app, this would be fetched for the logged-in business
let mockBusinessPromotions: BusinessManagedEntity[] = [
  { id: "bp1", businessId: "biz1", type: "promotion", name: "Jueves de Alitas BBQ", description: "Todas las alitas BBQ a S/1 cada una.", startDate: "2024-08-01", endDate: "2024-12-31", usageLimit: 0, isActive: true, imageUrl: "https://placehold.co/300x200.png", aiHint: "chicken wings" },
  { id: "bp2", businessId: "biz1", type: "promotion", name: "Happy Hour Extendido", description: "Tragos seleccionados 2x1 de 5 PM a 9 PM.", startDate: "2024-07-15", endDate: "2024-10-31", usageLimit: 500, isActive: true, imageUrl: "https://placehold.co/300x200.png", aiHint: "cocktails bar" },
  { id: "bp3", businessId: "biz1", type: "promotion", name: "Promo Cumpleañero Mes", description: "Si cumples años este mes, tu postre es gratis.", startDate: "2024-01-01", endDate: "2024-12-31", isActive: false, imageUrl: "https://placehold.co/300x200.png", aiHint: "birthday cake" },
];


export default function BusinessPromotionsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<BusinessManagedEntity | null>(null);
  const [promotions, setPromotions] = useState<BusinessManagedEntity[]>(mockBusinessPromotions);
  const { toast } = useToast();

  const filteredPromotions = promotions.filter(promo =>
    promo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    promo.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreatePromotion = (data: BusinessPromotionFormData) => {
    const newPromotion: BusinessManagedEntity = {
      id: `bp${Date.now()}`,
      businessId: "biz1", // This would come from the logged-in business context
      type: "promotion",
      name: data.name,
      description: data.description,
      startDate: format(data.startDate, "yyyy-MM-dd"),
      endDate: format(data.endDate, "yyyy-MM-dd"),
      usageLimit: data.usageLimit || 0, // 0 for unlimited
      isActive: data.isActive,
      imageUrl: data.imageUrl || (data.aiHint ? `https://placehold.co/300x200.png?text=${encodeURIComponent(data.aiHint.split(' ').slice(0,2).join('+'))}` : `https://placehold.co/300x200.png`),
      aiHint: data.aiHint,
    };
    setPromotions(prev => [newPromotion, ...prev]);
    setShowCreateModal(false);
    toast({ title: "Promoción Creada", description: `La promoción "${newPromotion.name}" ha sido creada.` });
  };

  const handleEditPromotion = (data: BusinessPromotionFormData) => {
    if (!editingPromotion) return;
    const updatedPromotion: BusinessManagedEntity = {
      ...editingPromotion,
      name: data.name,
      description: data.description,
      startDate: format(data.startDate, "yyyy-MM-dd"),
      endDate: format(data.endDate, "yyyy-MM-dd"),
      usageLimit: data.usageLimit || 0,
      isActive: data.isActive,
      imageUrl: data.imageUrl || (data.aiHint ? `https://placehold.co/300x200.png?text=${encodeURIComponent(data.aiHint.split(' ').slice(0,2).join('+'))}` : editingPromotion.imageUrl || `https://placehold.co/300x200.png`),
      aiHint: data.aiHint,
    };
    setPromotions(prev => prev.map(p => p.id === editingPromotion.id ? updatedPromotion : p));
    setEditingPromotion(null);
    toast({ title: "Promoción Actualizada", description: `La promoción "${updatedPromotion.name}" ha sido actualizada.` });
  };
  
  const handleDeletePromotion = (promotionId: string) => {
    setPromotions(prev => prev.filter(p => p.id !== promotionId));
    toast({ title: "Promoción Eliminada", description: `La promoción ha sido eliminada.`, variant: "destructive" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Ticket className="h-8 w-8 mr-2" /> Gestión de Promociones
        </h1>
        <Button onClick={() => setShowCreateModal(true)} className="bg-primary hover:bg-primary/90">
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
                <TableHead className="hidden lg:table-cell text-center">Límite Usos</TableHead>
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
                    <TableCell className="hidden lg:table-cell text-center">{promo.usageLimit === 0 ? "Ilimitado" : promo.usageLimit || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant={promo.isActive ? "default" : "outline"} className={promo.isActive ? "bg-green-500 hover:bg-green-600" : ""}>
                        {promo.isActive ? <BadgeCheck className="mr-1 h-3 w-3"/> : <BadgeX className="mr-1 h-3 w-3"/>}
                        {promo.isActive ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditingPromotion(promo)}>
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
      
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear Nueva Promoción</DialogTitle>
            <DialogDescription>Completa los detalles para tu nueva promoción.</DialogDescription>
          </DialogHeader>
          <BusinessPromotionForm
            onSubmit={handleCreatePromotion} 
            onCancel={() => setShowCreateModal(false)} 
          />
        </DialogContent>
      </Dialog>

      {editingPromotion && (
         <Dialog open={!!editingPromotion} onOpenChange={() => setEditingPromotion(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Promoción: {editingPromotion.name}</DialogTitle>
               <DialogDescription>Actualiza los detalles de la promoción.</DialogDescription>
            </DialogHeader>
            <BusinessPromotionForm
              promotion={editingPromotion} 
              onSubmit={handleEditPromotion} 
              onCancel={() => setEditingPromotion(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
