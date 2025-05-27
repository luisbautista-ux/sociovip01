
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Users, PlusCircle, Download, Search, Edit, Trash2, Loader2 } from "lucide-react";
import type { PlatformUser, PlatformUserFormData, Business } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { PlatformUserForm } from "@/components/admin/forms/PlatformUserForm";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

// Mock businesses for the form selector - in a real app, this would be fetched
const mockBusinessesForForm: Business[] = [
  { id: "biz1", name: "Pandora Lounge Bar", contactEmail: "contacto@pandora.com", joinDate: "2023-01-15T00:00:00Z", activePromotions: 3 },
  { id: "biz2", name: "El Rincón Bohemio", contactEmail: "info@rinconbohemio.pe", joinDate: "2023-03-22T00:00:00Z", activePromotions: 5 },
  { id: "biz3", name: "La Noche Estrellada Cafe", contactEmail: "reservas@lanoche.com", joinDate: "2023-05-10T00:00:00Z", activePromotions: 2 },
];

const apiClient = {
  getPlatformUsers: async (): Promise<PlatformUser[]> => {
    console.log("API CALL: apiClient.getPlatformUsers");
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Example: return initial empty list or a few users
    // return [
    //   { id: "su1", name: "Admin Principal (API)", email: "superadmin@sociovip.app", role: "superadmin", lastLogin: "2024-07-20T10:00:00Z" },
    // ];
    return [];
  },
  createPlatformUser: async (data: PlatformUserFormData): Promise<PlatformUser> => {
    console.log("API CALL: apiClient.createPlatformUser", data);
    await new Promise(resolve => setTimeout(resolve, 700));
    const newUser: PlatformUser = {
      id: `user${Date.now()}`,
      ...data,
      lastLogin: new Date().toISOString(),
    };
    return newUser;
  },
  updatePlatformUser: async (id: string, data: PlatformUserFormData): Promise<PlatformUser> => {
    console.log("API CALL: apiClient.updatePlatformUser", id, data);
    await new Promise(resolve => setTimeout(resolve, 700));
    return {
      id,
      ...data,
      lastLogin: new Date().toISOString(), // Placeholder, should preserve original
    };
  },
  deletePlatformUser: async (id: string): Promise<void> => {
    console.log("API CALL: apiClient.deletePlatformUser", id);
    await new Promise(resolve => setTimeout(resolve, 700));
  },
};


const roleTranslations: Record<PlatformUser['role'], string> = {
  superadmin: "Super Admin",
  business_admin: "Admin Negocio",
  staff: "Staff Negocio",
};

export default function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // In a real app, fetch businesses if needed, or pass them down if already available globally
  const [availableBusinesses, setAvailableBusinesses] = useState<Business[]>(mockBusinessesForForm);

  const fetchPlatformUsers = async () => {
    setIsLoading(true);
    try {
      const fetchedUsers = await apiClient.getPlatformUsers();
      setPlatformUsers(fetchedUsers);
    } catch (error) {
      console.error("Failed to fetch platform users:", error);
      toast({
        title: "Error al Cargar Usuarios",
        description: "No se pudieron obtener los datos de los usuarios. Intenta de nuevo.",
        variant: "destructive",
      });
      setPlatformUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlatformUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = platformUsers.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleExport = () => {
    if (filteredUsers.length === 0) {
      toast({ title: "Sin Datos", description: "No hay usuarios para exportar.", variant: "destructive" });
      return;
    }
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

  const handleCreateUser = async (data: PlatformUserFormData) => {
    setIsSubmitting(true);
    try {
      // const newUser = await apiClient.createPlatformUser(data);
      await apiClient.createPlatformUser(data); // Mock call
      toast({ title: "Usuario Creado", description: `El usuario "${data.name}" ha sido programado para creación.` });
      setShowCreateModal(false);
      fetchPlatformUsers(); // Re-fetch
    } catch (error) {
      console.error("Failed to create user:", error);
      toast({ title: "Error al Crear", description: "No se pudo crear el usuario.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async (data: PlatformUserFormData) => {
    if (!editingUser) return;
    setIsSubmitting(true);
    try {
      // const updatedUser = await apiClient.updatePlatformUser(editingUser.id, data);
      await apiClient.updatePlatformUser(editingUser.id, data); // Mock call
      toast({ title: "Usuario Actualizado", description: `El usuario "${data.name}" ha sido programado para actualización.` });
      setEditingUser(null);
      fetchPlatformUsers(); // Re-fetch
    } catch (error) {
      console.error("Failed to update user:", error);
      toast({ title: "Error al Actualizar", description: "No se pudo actualizar el usuario.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName?: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true); // Use general isSubmitting for delete action as well
    try {
      await apiClient.deletePlatformUser(userId);
      toast({ title: "Usuario Eliminado", description: `El usuario "${userName || 'seleccionado'}" ha sido programado para eliminación.`, variant: "destructive" });
      fetchPlatformUsers(); // Re-fetch
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast({ title: "Error al Eliminar", description: "No se pudo eliminar el usuario.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const getBusinessName = (businessId?: string) => {
    if (!businessId) return "N/A (Super Admin)";
    return availableBusinesses.find(b => b.id === businessId)?.name || "Negocio Desconocido";
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Users className="h-8 w-8 mr-2" /> Gestión de Usuarios de Plataforma
        </h1>
        <div className="flex space-x-2">
           <Button onClick={handleExport} variant="outline" disabled={isLoading || platformUsers.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="bg-primary hover:bg-primary/90" disabled={isLoading}>
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
              disabled={isLoading}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center items-center h-60">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-4 text-lg text-muted-foreground">Cargando usuarios...</p>
            </div>
          ) : filteredUsers.length === 0 && !searchTerm ? (
             <p className="text-center text-muted-foreground h-24 flex items-center justify-center">
              No hay usuarios registrados. Haz clic en "Crear Usuario" para empezar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="hidden lg:table-cell">Negocio Asociado</TableHead>
                  <TableHead>Último Acceso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'superadmin' ? 'default' : (user.role === 'business_admin' ? 'secondary' : 'outline')}>
                          {roleTranslations[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{getBusinessName(user.businessId)}</TableCell>
                      <TableCell>{format(new Date(user.lastLogin), "P p", { locale: es })}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditingUser(user)} disabled={isSubmitting}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Editar</span>
                        </Button>
                        {user.role !== 'superadmin' && ( // Prevent deleting superadmin
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
                                  Esta acción no se puede deshacer. Esto eliminará permanentemente al usuario 
                                  <span className="font-semibold"> {user.name}</span>.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user.id, user.name)}
                                  className="bg-destructive hover:bg-destructive/90"
                                  disabled={isSubmitting}
                                >
                                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">No se encontraron usuarios con los filtros aplicados.</TableCell>
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
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
            <DialogDescription>Completa los detalles para registrar un nuevo usuario de plataforma.</DialogDescription>
          </DialogHeader>
          <PlatformUserForm 
            businesses={availableBusinesses}
            onSubmit={handleCreateUser}
            onCancel={() => setShowCreateModal(false)}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuario: {editingUser.name}</DialogTitle>
              <DialogDescription>Actualiza los detalles del usuario.</DialogDescription>
            </DialogHeader>
            <PlatformUserForm 
              user={editingUser}
              businesses={availableBusinesses}
              onSubmit={handleEditUser}
              onCancel={() => setEditingUser(null)}
              isSubmitting={isSubmitting}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

    