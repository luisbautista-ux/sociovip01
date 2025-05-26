
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Users, PlusCircle, Download, Search } from "lucide-react";
import type { PlatformUser } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Input } from "@/components/ui/input";
// TODO: Import Dialog components for create/edit forms

// Mock Data
const mockPlatformUsers: PlatformUser[] = [
  { id: "su1", name: "Admin Principal", email: "superadmin@sociovip.app", role: "superadmin", lastLogin: "2024-07-20T10:00:00Z" },
  { id: "pu1", name: "Juan Perez (Pandora)", email: "juan.perez@pandora.com", role: "business_admin", businessId: "biz1", lastLogin: "2024-07-19T15:30:00Z" },
  { id: "pu2", name: "Maria Lopez (Pandora)", email: "maria.lopez@pandora.com", role: "staff", businessId: "biz1", lastLogin: "2024-07-20T09:00:00Z" },
  { id: "pu3", name: "Carlos Sanchez (Rincón)", email: "carlos.sanchez@rinconbohemio.pe", role: "business_admin", businessId: "biz2", lastLogin: "2024-07-18T11:00:00Z" },
];

const roleTranslations: Record<PlatformUser['role'], string> = {
  superadmin: "Super Admin",
  business_admin: "Admin Negocio",
  staff: "Staff Negocio",
};

export default function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  // const [showCreateModal, setShowCreateModal] = useState(false);
  // const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);

  const filteredUsers = mockPlatformUsers.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleExport = () => {
    const headers = ["ID", "Nombre", "Email", "Rol", "ID Negocio", "Último Acceso"];
    const rows = filteredUsers.map(user => [
      user.id,
      user.name,
      user.email,
      roleTranslations[user.role],
      user.businessId || "N/A",
      format(new Date(user.lastLogin), "dd/MM/yyyy HH:mm", { locale: es })
    ]);
    let csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sociovip_usuarios_plataforma.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Users className="h-8 w-8 mr-2" /> Gestión de Usuarios de Plataforma
        </h1>
        <div className="flex space-x-2">
           <Button onClick={handleExport} variant="outline">
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          <Button /* onClick={() => setShowCreateModal(true)} */ className="bg-primary hover:bg-primary/90">
            <PlusCircle className="mr-2 h-4 w-4" /> Crear Usuario
          </Button>
        </div>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
          <CardDescription>Administradores de negocios y staff que utilizan la plataforma.</CardDescription>
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
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="hidden lg:table-cell">Negocio Asociado</TableHead>
                <TableHead>Último Acceso</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name}</TableCell>
                    <TableCell className="hidden md:table-cell">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'superadmin' ? 'default' : 'secondary'}>
                        {roleTranslations[user.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{user.businessId || "N/A (Super Admin)"}</TableCell>
                    <TableCell>{format(new Date(user.lastLogin), "P p", { locale: es })}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" /* onClick={() => setEditingUser(user)} */>Editar</Button>
                      {/* Add delete button with confirmation */}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">No se encontraron usuarios.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* TODO: Add Dialog for Create/Edit User Form */}
      <p className="text-sm text-muted-foreground text-center p-4">
        Funcionalidad de creación y edición de usuarios será implementada próximamente.
      </p>
    </div>
  );
}
