
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Building, PlusCircle, Download, Search, Edit, Trash2, Loader2 } from "lucide-react";
import type { Business, BusinessFormData } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { BusinessForm } from "@/components/admin/forms/BusinessForm";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { db } from "@/lib/firebase"; 
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, Timestamp, serverTimestamp } from "firebase/firestore";

export default function AdminBusinessesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateEditModal, setShowCreateEditModal] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchBusinesses = useCallback(async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "businesses"));
      const fetchedBusinesses: Business[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name,
          contactEmail: data.contactEmail,
          joinDate: data.joinDate instanceof Timestamp ? data.joinDate.toDate().toISOString() : (data.joinDate || new Date().toISOString()),
          activePromotions: data.activePromotions || 0, // Assuming this might still be relevant or calculated elsewhere
          ruc: data.ruc,
          razonSocial: data.razonSocial,
          department: data.department,
          province: data.province,
          district: data.district,
          address: data.address,
          managerName: data.managerName,
          managerDni: data.managerDni,
          businessType: data.businessType,
        };
      });
      setBusinesses(fetchedBusinesses);
    } catch (error) {
      console.error("Failed to fetch businesses:", error);
      toast({
        title: "Error al Cargar Negocios",
        description: "No se pudieron obtener los datos de los negocios. Intenta de nuevo.",
        variant: "destructive",
      });
      setBusinesses([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);


  const filteredBusinesses = businesses.filter(biz =>
    (biz.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (biz.contactEmail?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (biz.ruc?.includes(searchTerm) || false) ||
    (biz.razonSocial?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    if (filteredBusinesses.length === 0) {
      toast({ title: "Sin Datos", description: "No hay negocios para exportar.", variant: "destructive" });
      return;
    }
    const headers = ["ID", "Nombre Comercial", "Razón Social", "RUC", "Email Contacto", "Fecha Ingreso", "Giro", "Departamento", "Provincia", "Distrito", "Dirección", "Gerente", "DNI Gerente"];
    const rows = filteredBusinesses.map(biz => [
      biz.id,
      biz.name,
      biz.razonSocial || "N/A",
      biz.ruc || "N/A",
      biz.contactEmail,
      biz.joinDate ? format(parseISO(biz.joinDate as string), "dd/MM/yyyy", { locale: es }) : 'N/A',
      biz.businessType || "N/A",
      biz.department || "N/A",
      biz.province || "N/A",
      biz.district || "N/A",
      biz.address || "N/A",
      biz.managerName || "N/A",
      biz.managerDni || "N/A",
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

  const handleOpenCreateModal = () => {
    setEditingBusiness(null);
    setShowCreateEditModal(true);
  };
  
  const handleOpenEditModal = (business: Business) => {
    setEditingBusiness(business);
    setShowCreateEditModal(true);
  };

  const handleCreateOrEditBusiness = async (data: BusinessFormData) => {
    setIsSubmitting(true);
    const businessPayload = {
        name: data.name,
        contactEmail: data.contactEmail,
        ruc: data.ruc || null,
        razonSocial: data.razonSocial || null,
        department: data.department || null,
        province: data.province || null,
        district: data.district || null,
        address: data.address || null,
        managerName: data.managerName || null,
        managerDni: data.managerDni || null,
        businessType: data.businessType || null,
        // activePromotions and joinDate are handled differently
    };

    try {
      if (editingBusiness) { // Editing
        const businessRef = doc(db, "businesses", editingBusiness.id);
        await updateDoc(businessRef, businessPayload);
        toast({ title: "Negocio Actualizado", description: `El negocio "${data.name}" ha sido actualizado.` });
      } else { // Creating
        const docRef = await addDoc(collection(db, "businesses"), {
          ...businessPayload,
          joinDate: serverTimestamp(), 
          activePromotions: 0, // Default for new business
        });
        toast({ title: "Negocio Creado", description: `El negocio "${data.name}" ha sido creado con ID: ${docRef.id}.` });
      }
      setShowCreateEditModal(false);
      setEditingBusiness(null);
      fetchBusinesses(); 
    } catch (error) {
      console.error("Failed to create/update business:", error);
      toast({ title: "Error al Guardar", description: "No se pudo guardar el negocio.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeleteBusiness = async (businessId: string, businessName?: string) => {
    // Prevent action if already submitting (e.g. double click)
    if (isSubmitting) return; 
    
    setIsSubmitting(true); // Set submitting for this specific delete operation
    try {
      await deleteDoc(doc(db, "businesses", businessId));
      toast({ title: "Negocio Eliminado", description: `El negocio "${businessName || 'seleccionado'}" ha sido eliminado.`, variant: "destructive" });
      fetchBusinesses(); // Re-fetch
    } catch (error) {
      console.error("Failed to delete business:", error);
      toast({ title: "Error al Eliminar", description: "No se pudo eliminar el negocio.", variant: "destructive"});
    } finally {
      setIsSubmitting(false); // Reset submitting state for delete
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
          <Button onClick={handleOpenCreateModal} className="bg-primary hover:bg-primary/90" disabled={isLoading}>
            <PlusCircle className="mr-2 h-4 w-4" /> Crear Negocio
          </Button>
        </div>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Lista de Negocios Afiliados</CardTitle>
          <CardDescription>Negocios que utilizan la plataforma SocioVIP. Haz clic en un negocio para ver más detalles o editar.</CardDescription>
           <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nombre, email, RUC, razón social..."
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
          ) : businesses.length === 0 && !searchTerm ? (
            <p className="text-center text-muted-foreground h-24 flex items-center justify-center">
              No hay negocios registrados. Haz clic en "Crear Negocio" para empezar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre Comercial</TableHead>
                    <TableHead className="hidden xl:table-cell">Razón Social</TableHead>
                    <TableHead className="hidden md:table-cell">RUC</TableHead>
                    <TableHead className="hidden lg:table-cell">Email Contacto</TableHead>
                    <TableHead className="hidden xl:table-cell">Giro</TableHead>
                    <TableHead>Fecha Ingreso</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBusinesses.length > 0 ? (
                    filteredBusinesses.map((biz) => (
                      <TableRow key={biz.id}>
                        <TableCell className="font-medium">{biz.name}</TableCell>
                        <TableCell className="hidden xl:table-cell">{biz.razonSocial || "N/A"}</TableCell>
                        <TableCell className="hidden md:table-cell">{biz.ruc || "N/A"}</TableCell>
                        <TableCell className="hidden lg:table-cell">{biz.contactEmail}</TableCell>
                        <TableCell className="hidden xl:table-cell">{biz.businessType || "N/A"}</TableCell>
                        <TableCell>{biz.joinDate ? format(parseISO(biz.joinDate as string), "P", { locale: es }) : 'N/A'}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEditModal(biz)} disabled={isSubmitting}>
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
                      <TableCell colSpan={7} className="text-center h-24">No se encontraron negocios con los filtros aplicados.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={showCreateEditModal} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setShowCreateEditModal(false);
          setEditingBusiness(null);
        } else {
            setShowCreateEditModal(true); // Ensure it opens if needed
        }
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingBusiness ? `Editar Negocio: ${editingBusiness.name}` : "Crear Nuevo Negocio"}</DialogTitle>
            <DialogDescription>{editingBusiness ? "Actualiza los detalles del negocio." : "Completa los detalles para registrar un nuevo negocio."}</DialogDescription>
          </DialogHeader>
          <BusinessForm 
            business={editingBusiness || undefined}
            onSubmit={handleCreateOrEditBusiness} 
            onCancel={() => { setShowCreateEditModal(false); setEditingBusiness(null);}}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
