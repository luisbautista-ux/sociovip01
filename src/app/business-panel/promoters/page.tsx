
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2, Search, UserPlus, Percent, ShieldCheck, ShieldX } from "lucide-react";
import type { BusinessPromoterLink, PromoterProfile, BusinessPromoterFormData } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BusinessPromoterForm } from "@/components/business/forms/BusinessPromoterForm";
import { cn } from "@/lib/utils"; // Added import

// Mock data for global promoter profiles
const mockGlobalPromoters: PromoterProfile[] = [
  { id: "pp1", name: "Carlos Santana", email: "carlos.santana@promo.com", phone: "+51911223344"},
  { id: "pp2", name: "Lucia Fernandez", email: "lucia.fernandez@promo.com", phone: "+51955667788"},
  { id: "pp3", name: "Pedro Pascal", email: "pedro.pascal@promo.com"},
];

// Mock data for promoter links specific to this business
let mockBusinessPromoterLinks: (BusinessPromoterLink & { promoterProfile?: PromoterProfile })[] = [
  { 
    id: "bpl1", 
    businessId: "biz1", 
    promoterProfileId: "pp1", 
    commissionRate: "10% por venta", 
    isActive: true, 
    joinDate: "2024-05-10T00:00:00Z",
    promoterProfile: mockGlobalPromoters.find(p => p.id === "pp1") 
  },
  { 
    id: "bpl2", 
    businessId: "biz1", 
    promoterProfileId: "pp2", 
    commissionRate: "S/2 por QR redimido", 
    isActive: true, 
    joinDate: "2024-06-15T00:00:00Z",
    promoterProfile: mockGlobalPromoters.find(p => p.id === "pp2") 
  },
   { 
    id: "bpl3", 
    businessId: "biz1", 
    promoterProfileId: "pp3", 
    commissionRate: "5% primer mes", 
    isActive: false, 
    joinDate: "2024-07-01T00:00:00Z",
    promoterProfile: mockGlobalPromoters.find(p => p.id === "pp3") 
  },
];


export default function BusinessPromotersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPromoterLink, setEditingPromoterLink] = useState<(BusinessPromoterLink & { promoterProfile?: PromoterProfile }) | null>(null);
  const [promoterLinks, setPromoterLinks] = useState<(BusinessPromoterLink & { promoterProfile?: PromoterProfile })[]>(mockBusinessPromoterLinks);
  const { toast } = useToast();

  const filteredPromoters = promoterLinks.filter(link =>
    link.promoterProfile?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    link.promoterProfile?.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddOrEditPromoter = (data: BusinessPromoterFormData) => {
    if (editingPromoterLink) { // Editing existing link
      setPromoterLinks(prev => prev.map(link => 
        link.id === editingPromoterLink.id 
        ? { ...link, commissionRate: data.commissionRate } 
        : link
      ));
      toast({ title: "Promotor Actualizado", description: `Se actualizó la comisión para ${editingPromoterLink.promoterProfile?.name}.` });
      setEditingPromoterLink(null);
    } else { // Adding new promoter
      // In a real app, first check if promoterEmail exists in mockGlobalPromoters
      // If yes, use that promoterProfileId. If no, create new PromoterProfile.
      let promoterProfile = mockGlobalPromoters.find(p => p.email === data.promoterEmail);
      if (!promoterProfile) {
        promoterProfile = {
          id: `pp${Date.now()}`,
          name: data.promoterName,
          email: data.promoterEmail,
          phone: data.promoterPhone,
        };
        // In real app, save this new promoterProfile to global list/DB
        mockGlobalPromoters.push(promoterProfile); 
      }

      const newLink: (BusinessPromoterLink & { promoterProfile?: PromoterProfile }) = {
        id: `bpl${Date.now()}`,
        businessId: "biz1", // From logged-in business context
        promoterProfileId: promoterProfile.id,
        commissionRate: data.commissionRate,
        isActive: true,
        joinDate: new Date().toISOString(),
        promoterProfile: promoterProfile,
      };
      setPromoterLinks(prev => [newLink, ...prev]);
      toast({ title: "Promotor Añadido", description: `${promoterProfile.name} ha sido añadido a tu lista de promotores.` });
      setShowAddModal(false);
    }
  };
  
  const handleDeletePromoterLink = (linkId: string) => {
    const linkToDelete = promoterLinks.find(link => link.id === linkId);
    setPromoterLinks(prev => prev.filter(link => link.id !== linkId));
    toast({ title: "Promotor Desvinculado", description: `${linkToDelete?.promoterProfile?.name || 'El promotor'} ha sido desvinculado.`, variant: "destructive" });
  };

  const togglePromoterLinkStatus = (linkId: string) => {
    setPromoterLinks(prev => prev.map(link => 
      link.id === linkId ? { ...link, isActive: !link.isActive } : link
    ));
    const link = promoterLinks.find(l => l.id === linkId);
    toast({ title: `Estado Actualizado`, description: `El promotor ${link?.promoterProfile?.name} ahora está ${link?.isActive ? 'inactivo' : 'activo'}.` });
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <UserPlus className="h-8 w-8 mr-2" /> Gestión de Promotores
        </h1>
        <Button onClick={() => { setEditingPromoterLink(null); setShowAddModal(true);}} className="bg-primary hover:bg-primary/90">
          <PlusCircle className="mr-2 h-4 w-4" /> Añadir Promotor
        </Button>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Mis Promotores</CardTitle>
          <CardDescription>Personas que ayudan a promocionar tu negocio.</CardDescription>
           <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nombre o email del promotor..."
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
                <TableHead>Nombre Promotor</TableHead>
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
                    <TableCell className="font-medium">{link.promoterProfile?.name || "N/A"}</TableCell>
                    <TableCell className="hidden md:table-cell">{link.promoterProfile?.email || "N/A"}</TableCell>
                    <TableCell>{link.commissionRate || "No definida"}</TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => togglePromoterLinkStatus(link.id)}
                        className={cn("text-xs px-2 py-1 h-auto", link.isActive ? "text-green-600 hover:text-green-700" : "text-red-600 hover:text-red-700")}
                      >
                        {link.isActive ? <ShieldCheck className="mr-1 h-4 w-4"/> : <ShieldX className="mr-1 h-4 w-4"/>}
                        {link.isActive ? "Activo" : "Inactivo"}
                      </Button>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{format(new Date(link.joinDate), "P", { locale: es })}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingPromoterLink(link); setShowAddModal(true); }}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Editar</span>
                      </Button>
                       <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Desvincular</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Seguro que quieres desvincular?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción desvinculará al promotor <span className="font-semibold">{link.promoterProfile?.name}</span> de tu negocio.
                              No se eliminará su perfil global de promotor.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeletePromoterLink(link.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
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
                  <TableCell colSpan={6} className="text-center h-24">No se encontraron promotores vinculados.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={showAddModal} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setEditingPromoterLink(null); // Clear editing state when dialog closes
        }
        setShowAddModal(isOpen);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPromoterLink ? "Editar Vínculo con Promotor" : "Añadir Nuevo Promotor"}</DialogTitle>
            <DialogDescription>
              {editingPromoterLink 
                ? `Actualiza la tasa de comisión para ${editingPromoterLink.promoterProfile?.name}. Los datos del promotor no se pueden cambiar aquí.`
                : "Ingresa los datos del promotor. Si ya existe en la plataforma por su email, se vinculará. Sino, se creará un nuevo perfil de promotor."
              }
            </DialogDescription>
          </DialogHeader>
          <BusinessPromoterForm
            promoterLink={editingPromoterLink || undefined}
            onSubmit={handleAddOrEditPromoter} 
            onCancel={() => { setShowAddModal(false); setEditingPromoterLink(null); }}
            isEditing={!!editingPromoterLink}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
