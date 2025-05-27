
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2, Search, UserPlus, Percent, ShieldCheck, ShieldX, Loader2 } from "lucide-react";
import type { BusinessPromoterLink, PromoterProfile, BusinessPromoterFormData } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BusinessPromoterForm } from "@/components/business/forms/BusinessPromoterForm";
import { cn } from "@/lib/utils";

// Mock data for global promoter profiles - in a real app, this might come from a shared DB or admin setup
const mockGlobalPromoters: PromoterProfile[] = [
  { id: "pp1", name: "Carlos Santana", email: "carlos.santana@promo.com", phone: "+51911223344"},
  { id: "pp2", name: "Lucia Fernandez", email: "lucia.fernandez@promo.com", phone: "+51955667788"},
  { id: "pp3", name: "Pedro Pascal", email: "pedro.pascal@promo.com"},
];

const apiClient = {
  getBusinessPromoterLinks: async (businessId: string): Promise<(BusinessPromoterLink & { promoterProfile?: PromoterProfile })[]> => {
    console.log("API CALL: apiClient.getBusinessPromoterLinks for businessId:", businessId);
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Example:
    // return [
    //   { id: "bpl1", businessId, promoterProfileId: "pp1", commissionRate: "10% (API)", isActive: true, joinDate: "2024-05-10T00:00:00Z", promoterProfile: mockGlobalPromoters.find(p => p.id === "pp1") },
    // ];
    return [];
  },
  linkPromoterToBusiness: async (businessId: string, data: BusinessPromoterFormData): Promise<(BusinessPromoterLink & { promoterProfile?: PromoterProfile })> => {
    console.log("API CALL: apiClient.linkPromoterToBusiness", businessId, data);
    await new Promise(resolve => setTimeout(resolve, 700));
    
    let promoterProfile = mockGlobalPromoters.find(p => p.email === data.promoterEmail); // Simulate finding or creating global promoter
    if (!promoterProfile) {
      promoterProfile = { id: `pp${Date.now()}`, name: data.promoterName, email: data.promoterEmail, phone: data.promoterPhone };
      // In real app, save this new promoterProfile to global list/DB
      mockGlobalPromoters.push(promoterProfile); 
    }
    const newLink: (BusinessPromoterLink & { promoterProfile?: PromoterProfile }) = {
      id: `bpl${Date.now()}`,
      businessId,
      promoterProfileId: promoterProfile.id,
      commissionRate: data.commissionRate,
      isActive: true,
      joinDate: new Date().toISOString(),
      promoterProfile: promoterProfile,
    };
    return newLink;
  },
  updatePromoterLink: async (linkId: string, data: Pick<BusinessPromoterFormData, 'commissionRate'>, existingLink: (BusinessPromoterLink & { promoterProfile?: PromoterProfile })): Promise<(BusinessPromoterLink & { promoterProfile?: PromoterProfile })> => {
    console.log("API CALL: apiClient.updatePromoterLink", linkId, data);
    await new Promise(resolve => setTimeout(resolve, 700));
    return { ...existingLink, commissionRate: data.commissionRate };
  },
  togglePromoterLinkStatus: async (linkId: string, isActive: boolean): Promise<void> => {
    console.log("API CALL: apiClient.togglePromoterLinkStatus", linkId, isActive);
     await new Promise(resolve => setTimeout(resolve, 500));
  },
  deletePromoterLink: async (linkId: string): Promise<void> => {
    console.log("API CALL: apiClient.deletePromoterLink", linkId);
    await new Promise(resolve => setTimeout(resolve, 700));
  },
};

const MOCK_BUSINESS_ID = "biz1";

export default function BusinessPromotersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPromoterLink, setEditingPromoterLink] = useState<(BusinessPromoterLink & { promoterProfile?: PromoterProfile }) | null>(null);
  const [promoterLinks, setPromoterLinks] = useState<(BusinessPromoterLink & { promoterProfile?: PromoterProfile })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchPromoterLinks = async () => {
    setIsLoading(true);
    try {
      const fetchedLinks = await apiClient.getBusinessPromoterLinks(MOCK_BUSINESS_ID);
      setPromoterLinks(fetchedLinks);
    } catch (error) {
       console.error("Failed to fetch promoter links:", error);
      toast({
        title: "Error al Cargar Promotores",
        description: "No se pudieron obtener los promotores vinculados. Intenta de nuevo.",
        variant: "destructive",
      });
      setPromoterLinks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPromoterLinks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const filteredPromoters = promoterLinks.filter(link =>
    link.promoterProfile?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    link.promoterProfile?.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddOrEditPromoter = async (data: BusinessPromoterFormData) => {
    setIsSubmitting(true);
    try {
      if (editingPromoterLink) { 
        // await apiClient.updatePromoterLink(editingPromoterLink.id, { commissionRate: data.commissionRate }, editingPromoterLink);
        await apiClient.updatePromoterLink(editingPromoterLink.id, data, editingPromoterLink); // Mock call
        toast({ title: "Promotor Actualizado", description: `Se actualizó la comisión para ${editingPromoterLink.promoterProfile?.name}.` });
        setEditingPromoterLink(null);
      } else { 
        // await apiClient.linkPromoterToBusiness(MOCK_BUSINESS_ID, data);
         await apiClient.linkPromoterToBusiness(MOCK_BUSINESS_ID, data); // Mock call
        toast({ title: "Promotor Añadido", description: `${data.promoterName} ha sido programado para vinculación.` });
        setShowAddModal(false);
      }
      fetchPromoterLinks();
    } catch (error) {
      console.error("Failed to add/edit promoter link:", error);
      toast({ title: "Error al Guardar", description: "No se pudo procesar la solicitud del promotor.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
      // Close modal only on successful creation
      if (!editingPromoterLink && !isSubmitting) setShowAddModal(false);
      if (editingPromoterLink && !isSubmitting) setEditingPromoterLink(null);


    }
  };
  
  const handleDeletePromoterLink = async (linkId: string, promoterName?: string) => {
    setIsSubmitting(true);
    try {
      await apiClient.deletePromoterLink(linkId);
      toast({ title: "Promotor Desvinculado", description: `${promoterName || 'El promotor'} ha sido programado para desvinculación.`, variant: "destructive" });
      fetchPromoterLinks();
    } catch (error) {
       console.error("Failed to delete promoter link:", error);
      toast({ title: "Error al Desvincular", description: "No se pudo desvincular el promotor.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePromoterLinkStatus = async (link: (BusinessPromoterLink & { promoterProfile?: PromoterProfile })) => {
    const newStatus = !link.isActive;
    const originalStatus = link.isActive;
    
    // Optimistic UI update
    setPromoterLinks(prev => prev.map(l => l.id === link.id ? { ...l, isActive: newStatus } : l));

    try {
      await apiClient.togglePromoterLinkStatus(link.id, newStatus);
      toast({ title: `Estado Actualizado`, description: `El promotor ${link.promoterProfile?.name} ahora está ${newStatus ? 'activo' : 'inactivo'}.` });
    } catch (error) {
      // Revert UI on error
      setPromoterLinks(prev => prev.map(l => l.id === link.id ? { ...l, isActive: originalStatus } : l));
      toast({ title: "Error al Actualizar Estado", description: "No se pudo cambiar el estado del promotor.", variant: "destructive"});
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <UserPlus className="h-8 w-8 mr-2" /> Gestión de Promotores
        </h1>
        <Button onClick={() => { setEditingPromoterLink(null); setShowAddModal(true);}} className="bg-primary hover:bg-primary/90" disabled={isLoading}>
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
              disabled={isLoading}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-60">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-4 text-lg text-muted-foreground">Cargando promotores...</p>
            </div>
          ) : filteredPromoters.length === 0 && !searchTerm ? (
             <p className="text-center text-muted-foreground h-24 flex items-center justify-center">
              No hay promotores vinculados. Haz clic en "Añadir Promotor" para empezar.
            </p>
          ) : (
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
                          onClick={() => togglePromoterLinkStatus(link)}
                          className={cn("text-xs px-2 py-1 h-auto", link.isActive ? "text-green-600 hover:text-green-700" : "text-red-600 hover:text-red-700")}
                          disabled={isSubmitting}
                        >
                          {link.isActive ? <ShieldCheck className="mr-1 h-4 w-4"/> : <ShieldX className="mr-1 h-4 w-4"/>}
                          {link.isActive ? "Activo" : "Inactivo"}
                        </Button>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{format(new Date(link.joinDate), "P", { locale: es })}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingPromoterLink(link); setShowAddModal(true); }} disabled={isSubmitting}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Editar</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={isSubmitting}>
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
                              <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeletePromoterLink(link.id, link.promoterProfile?.name)}
                                className="bg-destructive hover:bg-destructive/90"
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
                    <TableCell colSpan={6} className="text-center h-24">No se encontraron promotores con los filtros aplicados.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={showAddModal} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setEditingPromoterLink(null); 
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
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

    