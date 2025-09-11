
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; 
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as UIDialogDescription } from "@/components/ui/dialog";
import { Building, PlusCircle, Download, Search, Edit, Trash2, Loader2, ExternalLink } from "lucide-react";
import type { Business, BusinessFormData } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { BusinessForm } from "@/components/admin/forms/BusinessForm";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter as ShadcnAlertDialogFooter, AlertDialogHeader, AlertDialogTitle as UIAlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"; 
import { db } from "@/lib/firebase"; 
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, Timestamp, serverTimestamp, query, where, limit } from "firebase/firestore";
import Link from "next/link";
import { sanitizeObjectForFirestore } from "@/lib/utils";


export default function AdminBusinessesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateEditModal, setShowCreateEditModal] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingUrlPaths, setExistingUrlPaths] = useState<string[]>([]);
  const { toast } = useToast();

  const fetchBusinesses = useCallback(async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "businesses"));
      const fetchedBusinesses: Business[] = [];
      const paths: string[] = [];
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        const businessData: Business = {
          id: docSnap.id,
          name: data.name || "Nombre no disponible",
          contactEmail: data.contactEmail || "Email no disponible",
          joinDate: data.joinDate instanceof Timestamp ? data.joinDate.toDate().toISOString() : (data.joinDate || new Date().toISOString()),
          ruc: data.ruc || undefined,
          razonSocial: data.razonSocial || undefined,
          department: data.department || undefined,
          province: data.province || undefined,
          district: data.district || undefined,
          address: data.address || undefined,
          managerName: data.managerName || undefined,
          managerDni: data.managerDni || undefined,
          businessType: data.businessType || undefined,
          logoUrl: data.logoUrl || undefined,
          publicCoverImageUrl: data.publicCoverImageUrl || undefined,
          slogan: data.slogan || undefined,
          publicContactEmail: data.publicContactEmail || undefined,
          publicPhone: data.publicPhone || undefined,
          publicAddress: data.publicAddress || undefined,
          customUrlPath: data.customUrlPath || undefined,
        };
        fetchedBusinesses.push(businessData);
        if (data.customUrlPath && data.customUrlPath.trim() !== "") {
          paths.push(data.customUrlPath.trim());
        }
      });
      setBusinesses(fetchedBusinesses.sort((a,b) => new Date(b.joinDate as string).getTime() - new Date(a.joinDate as string).getTime()));
      setExistingUrlPaths(paths);
    } catch (error: any) {
      console.error("Failed to fetch businesses:", error);
      toast({
        title: "Error al Cargar Negocios",
        description: `No se pudieron obtener los datos de los negocios. ${error.message}`,
        variant: "destructive",
      });
      setBusinesses([]); 
      setExistingUrlPaths([]);
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
      toast({ title: "Sin Datos", description: "No hay negocios para exportar.", variant: "default" });
      return;
    }
    const headers = ["ID", "Nombre Comercial", "Razón Social", "RUC", "Email Contacto", "Fecha Ingreso", "Giro", "Departamento", "Provincia", "Distrito", "Dirección", "Gerente", "DNI Gerente", "URL Personalizada", "Logo URL", "Portada URL", "Slogan", "Email Público", "Teléfono Público", "Dirección Pública"];
    const rows = filteredBusinesses.map(biz => [
      biz.id, biz.name, biz.razonSocial || "N/A", biz.ruc || "N/A", biz.contactEmail,
      biz.joinDate ? format(parseISO(biz.joinDate as string), "dd/MM/yyyy", { locale: es }) : 'N/A',
      biz.businessType || "N/A", biz.department || "N/A", biz.province || "N/A", biz.district || "N/A", biz.address || "N/A",
      biz.managerName || "N/A", biz.managerDni || "N/A", 
      biz.customUrlPath ? `sociosvip.app/b/${biz.customUrlPath}` : `sociosvip.app/business/${biz.id}`,
      biz.logoUrl || "N/A", biz.publicCoverImageUrl || "N/A", biz.slogan || "N/A",
      biz.publicContactEmail || "N/A", biz.publicPhone || "N/A", biz.publicAddress || "N/A",
    ]);
    let csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n"); 
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sociosvip_negocios.csv");
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

  const checkCustomUrlPathUniqueness = async (path: string, currentBusinessId?: string): Promise<boolean> => {
    if (!path || path.trim() === "") return true; 
    const q = query(collection(db, "businesses"), where("customUrlPath", "==", path.toLowerCase().trim()), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return true;
    return snapshot.docs[0].id === currentBusinessId;
  };


  const handleCreateOrEditBusiness = async (data: BusinessFormData, currentBusinessId?: string): Promise<{success: boolean; error?: string}> => {
    setIsSubmitting(true);
    
    const cleanedCustomUrlPath = data.customUrlPath && data.customUrlPath.trim() !== "" 
        ? data.customUrlPath.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') 
        : null; // Ensure it's null if empty

    if (cleanedCustomUrlPath) {
      const isUnique = await checkCustomUrlPathUniqueness(cleanedCustomUrlPath, currentBusinessId);
      if (!isUnique) {
        setIsSubmitting(false);
        toast({ title: "Error de URL", description: "La Ruta URL Personalizada ya está en uso. Por favor, elige otra.", variant: "destructive" });
        return { success: false, error: "La Ruta URL Personalizada ya está en uso." };
      }
    }
    
    const businessPayloadRaw: Omit<Partial<Business>, 'id' | 'joinDate'> & { joinDate?: any } = {
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
        logoUrl: data.logoUrl || null,
        publicCoverImageUrl: data.publicCoverImageUrl || null,
        slogan: data.slogan || null,
        publicContactEmail: data.publicContactEmail || null,
        publicPhone: data.publicPhone || null,
        publicAddress: data.publicAddress || null,
        customUrlPath: cleanedCustomUrlPath, 
    };
    
    const businessPayload = sanitizeObjectForFirestore(businessPayloadRaw);

    try {
      if (currentBusinessId) { 
        const businessRef = doc(db, "businesses", currentBusinessId);
        await updateDoc(businessRef, businessPayload);
        toast({ title: "Negocio Actualizado", description: `El negocio "${data.name}" ha sido actualizado.` });
      } else { 
        businessPayload.joinDate = serverTimestamp();
        const docRef = await addDoc(collection(db, "businesses"), businessPayload);
        toast({ title: "Negocio Creado", description: `El negocio "${data.name}" ha sido creado con ID: ${docRef.id}.` });
      }
      setShowCreateEditModal(false);
      setEditingBusiness(null);
      await fetchBusinesses(); // Await fetchBusinesses
      return { success: true };
    } catch (error: any) {
      console.error("Failed to create/update business:", error);
      toast({ title: "Error al Guardar", description: `No se pudo guardar el negocio. ${error.message}`, variant: "destructive"});
      return { success: false, error: error.message };
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeleteBusiness = async (businessId: string, businessName?: string) => {
    if (isSubmitting) return; 
    
    setIsSubmitting(true); 
    try {
      await deleteDoc(doc(db, "businesses", businessId));
      toast({ title: "Negocio Eliminado", description: `El negocio "${businessName || 'seleccionado'}" ha sido eliminado.`, variant: "destructive" });
      await fetchBusinesses(); // Await fetchBusinesses
    } catch (error: any) {
      console.error("Failed to delete business:", error);
      toast({ title: "Error al Eliminar", description: `No se pudo eliminar el negocio. ${error.message}`, variant: "destructive"});
    } finally {
      setIsSubmitting(false); 
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-gradient flex items-center">
          <Building className="h-8 w-8 mr-2" /> Gestión de Negocios
        </h1>
        <div className="flex space-x-2">
          <Button onClick={handleExport} variant="outline" disabled={isLoading || businesses.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          <Button onClick={handleOpenCreateModal} variant="gradient" disabled={isLoading}>
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
                    <TableHead className="hidden lg:table-cell">Giro</TableHead>
                    <TableHead>URL Pública</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBusinesses.length > 0 ? (
                    filteredBusinesses.map((biz) => {
                      const publicLink = biz.customUrlPath && biz.customUrlPath.trim() !== ""
                        ? `/b/${biz.customUrlPath.trim()}`
                        : `/business/${biz.id}`;
                      const displayUrl = biz.customUrlPath && biz.customUrlPath.trim() !== ""
                        ? `sociosvip.app/b/${biz.customUrlPath.trim()}`
                        : `sociosvip.app/business/${biz.id}`;

                      return (
                      <TableRow key={biz.id}>
                        <TableCell className="font-medium">{biz.name}</TableCell>
                        <TableCell className="hidden xl:table-cell">{biz.razonSocial || "N/A"}</TableCell>
                        <TableCell className="hidden md:table-cell">{biz.ruc || "N/A"}</TableCell>
                        <TableCell className="hidden lg:table-cell">{biz.businessType || "N/A"}</TableCell>
                        <TableCell>
                           <Link href={publicLink} target="_blank" className="text-primary hover:underline text-xs flex items-center">
                              {displayUrl} <ExternalLink className="ml-1 h-3 w-3" />
                            </Link>
                        </TableCell>
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
                                <UIAlertDialogTitle>¿Estás seguro?</UIAlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Esto eliminará permanentemente el negocio
                                  <span className="font-semibold"> {biz.name}</span> y todas sus entidades asociadas (promociones, eventos, etc.).
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <ShadcnAlertDialogFooter>
                                <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteBusiness(biz.id, biz.name)}
                                  className="bg-destructive hover:bg-destructive/90"
                                  disabled={isSubmitting}
                                >
                                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  Eliminar
                                </AlertDialogAction>
                              </ShadcnAlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    )})
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">No se encontraron negocios con los filtros aplicados.</TableCell>
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
          setEditingBusiness(null);
        }
        setShowCreateEditModal(isOpen); 
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingBusiness ? `Editar Negocio: ${editingBusiness.name}` : "Crear Nuevo Negocio"}</DialogTitle>
            <UIDialogDescription>{editingBusiness ? "Actualiza los detalles del negocio." : "Completa los detalles para registrar un nuevo negocio."}</UIDialogDescription>
          </DialogHeader>
          <BusinessForm 
            business={editingBusiness || undefined}
            onSubmit={handleCreateOrEditBusiness} 
            onCancel={() => { setShowCreateEditModal(false); setEditingBusiness(null);}}
            isSubmittingForm={isSubmitting}
            existingCustomUrlPaths={existingUrlPaths.filter(p => editingBusiness && p === editingBusiness.customUrlPath ? false : true)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

    
