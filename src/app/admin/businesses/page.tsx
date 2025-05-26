
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Building, PlusCircle, Download, Search, Edit, Trash2 } from "lucide-react";
import type { Business, BusinessFormData } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { BusinessForm } from "@/components/admin/forms/BusinessForm";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


// Mock Data - make it mutable for updates
let mockBusinesses: Business[] = [
  { id: "biz1", name: "Pandora Lounge Bar", contactEmail: "contacto@pandora.com", joinDate: "2023-01-15T00:00:00Z", activePromotions: 3 },
  { id: "biz2", name: "El Rincón Bohemio", contactEmail: "info@rinconbohemio.pe", joinDate: "2023-03-22T00:00:00Z", activePromotions: 5 },
  { id: "biz3", name: "La Noche Estrellada Cafe", contactEmail: "reservas@lanoche.com", joinDate: "2023-05-10T00:00:00Z", activePromotions: 2 },
  { id: "biz4", name: "Disco Club Inferno", contactEmail: "manager@inferno.club", joinDate: "2023-07-01T00:00:00Z", activePromotions: 7 },
];

export default function AdminBusinessesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>(mockBusinesses); // Local state for businesses
  const { toast } = useToast();

  const filteredBusinesses = businesses.filter(biz =>
    biz.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    biz.contactEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
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

  const handleCreateBusiness = (data: BusinessFormData) => {
    const newBusiness: Business = {
      id: `biz${Date.now()}`,
      ...data,
      joinDate: new Date().toISOString(),
      activePromotions: 0,
    };
    setBusinesses(prev => [newBusiness, ...prev]);
    setShowCreateModal(false);
    toast({ title: "Negocio Creado", description: `El negocio "${newBusiness.name}" ha sido creado.` });
  };

  const handleEditBusiness = (data: BusinessFormData) => {
    if (!editingBusiness) return;
    setBusinesses(prev => prev.map(b => b.id === editingBusiness.id ? { ...editingBusiness, ...data } : b));
    setEditingBusiness(null);
    toast({ title: "Negocio Actualizado", description: `El negocio "${data.name}" ha sido actualizado.` });
  };
  
  const handleDeleteBusiness = (businessId: string) => {
    setBusinesses(prev => prev.filter(b => b.id !== businessId));
    toast({ title: "Negocio Eliminado", description: `El negocio ha sido eliminado.`, variant: "destructive" });
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Building className="h-8 w-8 mr-2" /> Gestión de Negocios
        </h1>
        <div className="flex space-x-2">
          <Button onClick={handleExport} variant="outline">
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="bg-primary hover:bg-primary/90">
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
            />
          </div>
        </CardHeader>
        <CardContent>
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
                      <Button variant="ghost" size="icon" onClick={() => setEditingBusiness(biz)}>
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
                              Esta acción no se puede deshacer. Esto eliminará permanentemente el negocio
                               <span className="font-semibold"> {biz.name}</span>.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteBusiness(biz.id)}
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
                  <TableCell colSpan={5} className="text-center h-24">No se encontraron negocios.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
