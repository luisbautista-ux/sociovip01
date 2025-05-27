
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Building, PlusCircle, Download, Search, Edit, Trash2, Loader2 } from "lucide-react";
import type { Business, BusinessFormData } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { BusinessForm } from "@/components/admin/forms/BusinessForm";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

// Mock API client (replace with actual API calls later)
const apiClient = {
  getBusinesses: async (): Promise<Business[]> => {
    console.log("API CALL: apiClient.getBusinesses");
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    // In a real scenario, this would fetch from your backend.
    // For now, returning an empty array or a predefined mock list for testing loaded state.
    // Example with a few items to see the table populated after loading:
    // return [
    //   { id: "biz1", name: "Pandora Lounge Bar (API)", contactEmail: "contacto@pandora.com", joinDate: "2023-01-15T12:00:00Z", activePromotions: 3 },
    //   { id: "biz2", name: "El Rincón Bohemio (API)", contactEmail: "info@rinconbohemio.pe", joinDate: "2023-03-22T12:00:00Z", activePromotions: 5 },
    // ];
    return []; // Start with an empty list after loading
  },
  createBusiness: async (data: BusinessFormData): Promise<Business> => {
    console.log("API CALL: apiClient.createBusiness", data);
    await new Promise(resolve => setTimeout(resolve, 700));
    const newBusiness: Business = {
      id: `biz${Date.now()}`,
      ...data,
      joinDate: new Date().toISOString(),
      activePromotions: 0,
    };
    // In a real app, the backend would return the created business, possibly with an ID from the DB.
    return newBusiness;
  },
  updateBusiness: async (id: string, data: BusinessFormData): Promise<Business> => {
    console.log("API CALL: apiClient.updateBusiness", id, data);
    await new Promise(resolve => setTimeout(resolve, 700));
    // This is a mock update. The actual update would happen on the server.
    // For the frontend, we often get the updated object back or just a success status.
    return {
      id,
      ...data,
      joinDate: new Date().toISOString(), // Placeholder, original joinDate should be preserved
      activePromotions: Math.floor(Math.random() * 5), // Placeholder
    };
  },
  deleteBusiness: async (id: string): Promise<void> => {
    console.log("API CALL: apiClient.deleteBusiness", id);
    await new Promise(resolve => setTimeout(resolve, 700));
    // No return value needed for delete, or perhaps a success status.
  },
};


export default function AdminBusinessesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); // For form submissions
  const { toast } = useToast();

  const fetchBusinesses = async () => {
    setIsLoading(true);
    try {
      const fetchedBusinesses = await apiClient.getBusinesses();
      setBusinesses(fetchedBusinesses);
    } catch (error) {
      console.error("Failed to fetch businesses:", error);
      toast({
        title: "Error al Cargar Negocios",
        description: "No se pudieron obtener los datos de los negocios. Intenta de nuevo.",
        variant: "destructive",
      });
      setBusinesses([]); // Set to empty on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const filteredBusinesses = businesses.filter(biz =>
    (biz.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (biz.contactEmail?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    if (filteredBusinesses.length === 0) {
      toast({ title: "Sin Datos", description: "No hay negocios para exportar.", variant: "destructive" });
      return;
    }
    const headers = ["ID", "Nombre del Negocio", "Email Contacto", "Fecha Ingreso", "Promociones Activas"];
    const rows = filteredBusinesses.map(biz => [
      biz.id,
      biz.name,
      biz.contactEmail,
      format(new Date(biz.joinDate), "dd/MM/yyyy", { locale: es }),
      biz.activePromotions
    ]);
    let csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sociovip_negocios.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateBusiness = async (data: BusinessFormData) => {
    setIsSubmitting(true);
    try {
      // const newBusiness = await apiClient.createBusiness(data); // Real API call
      // For mock, we simulate and then refetch or add locally for immediate UI update
      await apiClient.createBusiness(data);
      toast({ title: "Negocio Creado", description: `El negocio "${data.name}" ha sido programado para creación.` });
      setShowCreateModal(false);
      fetchBusinesses(); // Re-fetch the list from "server"
    } catch (error) {
      console.error("Failed to create business:", error);
      toast({ title: "Error al Crear", description: "No se pudo crear el negocio.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditBusiness = async (data: BusinessFormData) => {
    if (!editingBusiness) return;
    setIsSubmitting(true);
    try {
      // const updatedBusiness = await apiClient.updateBusiness(editingBusiness.id, data); // Real API call
      await apiClient.updateBusiness(editingBusiness.id, data);
      toast({ title: "Negocio Actualizado", description: `El negocio "${data.name}" ha sido programado para actualización.` });
      setEditingBusiness(null);
      fetchBusinesses(); // Re-fetch
    } catch (error) {
      console.error("Failed to update business:", error);
      toast({ title: "Error al Actualizar", description: "No se pudo actualizar el negocio.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeleteBusiness = async (businessId: string, businessName?: string) => {
    // To prevent accidental rapid clicks if delete also triggers a fetch
    if (isSubmitting) return; 
    setIsSubmitting(true);
    try {
      await apiClient.deleteBusiness(businessId);
      toast({ title: "Negocio Eliminado", description: `El negocio "${businessName || 'seleccionado'}" ha sido programado para eliminación.`, variant: "destructive" });
      fetchBusinesses(); // Re-fetch
    } catch (error) {
      console.error("Failed to delete business:", error);
      toast({ title: "Error al Eliminar", description: "No se pudo eliminar el negocio.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Building className="h-8 w-8 mr-2" /> Gestión de Negocios
        </h1>
        <div className="flex space-x-2">
          <Button onClick={handleExport} variant="outline" disabled={isLoading || businesses.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="bg-primary hover:bg-primary/90" disabled={isLoading}>
            <PlusCircle className="mr-2 h-4 w-4" /> Crear Negocio
          </Button>
        </div>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Lista de Negocios Afiliados</CardTitle>
          <CardDescription>Negocios que utilizan la plataforma SocioVIP.</CardDescription>
           <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nombre o email..."
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
              <p className="ml-4 text-lg text-muted-foreground">Cargando negocios...</p>
            </div>
          ) : filteredBusinesses.length === 0 && !searchTerm ? (
            <p className="text-center text-muted-foreground h-24 flex items-center justify-center">
              No hay negocios registrados. Haz clic en "Crear Negocio" para empezar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre del Negocio</TableHead>
                  <TableHead className="hidden md:table-cell">Email Contacto</TableHead>
                  <TableHead>Fecha Ingreso</TableHead>
                  <TableHead className="text-center">Promos Activas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBusinesses.length > 0 ? (
                  filteredBusinesses.map((biz) => (
                    <TableRow key={biz.id}>
                      <TableCell className="font-medium">{biz.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{biz.contactEmail}</TableCell>
                      <TableCell>{format(new Date(biz.joinDate), "P", { locale: es })}</TableCell>
                      <TableCell className="text-center">{biz.activePromotions}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditingBusiness(biz)} disabled={isSubmitting}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Editar</span>
                        </Button>
                         <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={isSubmitting}>
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Eliminar</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Esto eliminará permanentemente el negocio
                                 <span className="font-semibold"> {biz.name}</span>.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteBusiness(biz.id, biz.name)}
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
                    <TableCell colSpan={5} className="text-center h-24">No se encontraron negocios con los filtros aplicados.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Negocio</DialogTitle>
            <DialogDescription>Completa los detalles para registrar un nuevo negocio.</DialogDescription>
          </DialogHeader>
          <BusinessForm 
            onSubmit={handleCreateBusiness} 
            onCancel={() => setShowCreateModal(false)}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {editingBusiness && (
         <Dialog open={!!editingBusiness} onOpenChange={() => setEditingBusiness(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Negocio: {editingBusiness.name}</DialogTitle>
               <DialogDescription>Actualiza los detalles del negocio.</DialogDescription>
            </DialogHeader>
            <BusinessForm 
              business={editingBusiness} 
              onSubmit={handleEditBusiness} 
              onCancel={() => setEditingBusiness(null)}
              isSubmitting={isSubmitting}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

