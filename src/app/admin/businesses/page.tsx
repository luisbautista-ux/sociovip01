
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Building, PlusCircle, Download, Search } from "lucide-react";
import type { Business } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Input } from "@/components/ui/input";
// TODO: Import Dialog components for create/edit forms

// Mock Data
const mockBusinesses: Business[] = [
  { id: "biz1", name: "Pandora Lounge Bar", contactEmail: "contacto@pandora.com", joinDate: "2023-01-15T00:00:00Z", activePromotions: 3 },
  { id: "biz2", name: "El Rincón Bohemio", contactEmail: "info@rinconbohemio.pe", joinDate: "2023-03-22T00:00:00Z", activePromotions: 5 },
  { id: "biz3", name: "La Noche Estrellada Cafe", contactEmail: "reservas@lanoche.com", joinDate: "2023-05-10T00:00:00Z", activePromotions: 2 },
  { id: "biz4", name: "Disco Club Inferno", contactEmail: "manager@inferno.club", joinDate: "2023-07-01T00:00:00Z", activePromotions: 7 },
];

export default function AdminBusinessesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  // const [showCreateModal, setShowCreateModal] = useState(false);
  // const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);

  const filteredBusinesses = mockBusinesses.filter(biz =>
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
          <Button /* onClick={() => setShowCreateModal(true)} */ className="bg-primary hover:bg-primary/90">
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
                <TableHead>Promos Activas</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBusinesses.length > 0 ? (
                filteredBusinesses.map((biz) => (
                  <TableRow key={biz.id}>
                    <TableCell>{biz.name}</TableCell>
                    <TableCell className="hidden md:table-cell">{biz.contactEmail}</TableCell>
                    <TableCell>{format(new Date(biz.joinDate), "P", { locale: es })}</TableCell>
                    <TableCell className="text-center">{biz.activePromotions}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" /* onClick={() => setEditingBusiness(biz)} */>Editar</Button>
                      {/* Add delete button with confirmation */}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                 <TableRow>
                  <TableCell colSpan={5} className="text-center">No se encontraron negocios.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* TODO: Add Dialog for Create/Edit Business Form 
      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Negocio</DialogTitle>
            </DialogHeader>
            <p className="text-center p-8">Formulario para crear negocio (Próximamente).</p>
             <BusinessForm onSubmit={(data) => console.log(data)} /> 
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
              <Button type="submit" form="business-form">Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {editingBusiness && (
         <Dialog open={!!editingBusiness} onOpenChange={() => setEditingBusiness(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Negocio: {editingBusiness.name}</DialogTitle>
            </DialogHeader>
             <p className="text-center p-8">Formulario para editar negocio: {editingBusiness.name} (Próximamente).</p>
             <BusinessForm business={editingBusiness} onSubmit={(data) => console.log(data)} /> 
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingBusiness(null)}>Cancelar</Button>
              <Button type="submit" form="business-form">Guardar Cambios</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      */}
       <p className="text-sm text-muted-foreground text-center p-4">
        Funcionalidad de creación y edición de negocios será implementada próximamente.
      </p>
    </div>
  );
}
