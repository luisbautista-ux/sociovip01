
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Users, PlusCircle, Download, Search, Edit, Trash2, Loader2, ShieldQuestion } from "lucide-react";
import type { PlatformUser, PlatformUserFormData, Business } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { PlatformUserForm } from "@/components/admin/forms/PlatformUserForm";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, Timestamp, serverTimestamp, query, where, writeBatch } from "firebase/firestore";

const roleTranslations: Record<PlatformUser['role'], string> = {
  superadmin: "Super Admin",
  business_admin: "Admin Negocio",
  staff: "Staff Negocio",
  promoter: "Promotor",
  host: "Anfitrión",
};

export default function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateEditModal, setShowCreateEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [availableBusinesses, setAvailableBusinesses] = useState<Business[]>([]);
  const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(true);

  const fetchBusinessesForForm = useCallback(async () => {
    setIsLoadingBusinesses(true);
    try {
      const querySnapshot = await getDocs(collection(db, "businesses"));
      const fetchedBusinesses: Business[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name,
          contactEmail: data.contactEmail, 
          joinDate: data.joinDate instanceof Timestamp ? data.joinDate.toDate().toISOString() : new Date(data.joinDate).toISOString(),
          activePromotions: data.activePromotions || 0,
        };
      });
      setAvailableBusinesses(fetchedBusinesses);
    } catch (error) {
      console.error("Failed to fetch businesses for form:", error);
      toast({
        title: "Error al Cargar Negocios",
        description: "No se pudieron obtener los negocios para el formulario de usuarios.",
        variant: "destructive",
      });
      setAvailableBusinesses([]);
    } finally {
      setIsLoadingBusinesses(false);
    }
  }, [toast]);

  const fetchPlatformUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "platformUsers"));
      const fetchedUsers: PlatformUser[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          uid: data.uid || docSnap.id, 
          dni: data.dni || "N/A", // Add DNI
          name: data.name,
          email: data.email,
          role: data.role,
          businessId: data.businessId,
          lastLogin: data.lastLogin instanceof Timestamp ? data.lastLogin.toDate().toISOString() : new Date(Date.now() - Math.random() * 10000000000).toISOString(), // Default if missing with random past date
        };
      });
      setPlatformUsers(fetchedUsers);
    } catch (error) {
      console.error("Failed to fetch platform users:", error);
      toast({
        title: "Error al Cargar Usuarios",
        description: "No se pudieron obtener los datos de los usuarios.",
        variant: "destructive",
      });
      setPlatformUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPlatformUsers();
    fetchBusinessesForForm();
  }, [fetchPlatformUsers, fetchBusinessesForForm]);

  const filteredUsers = platformUsers.filter(user =>
    (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.dni?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );
  
  const handleExport = () => {
    if (filteredUsers.length === 0) {
      toast({ title: "Sin Datos", description: "No hay usuarios para exportar.", variant: "destructive" });
      return;
    }
    const headers = ["ID", "UID", "DNI/CE", "Nombre", "Email", "Rol", "ID Negocio Asociado", "Último Acceso"];
    const rows = filteredUsers.map(user => [
      user.id,
      user.uid || "N/A",
      user.dni,
      user.name,
      user.email,
      roleTranslations[user.role] || user.role,
      user.businessId || "N/A",
      user.lastLogin ? format(new Date(user.lastLogin), "dd/MM/yyyy HH:mm", { locale: es }) : "N/A"
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

  // Simulated check for DNI existence across relevant collections
  const checkDniExists = async (dni: string, excludeUserId?: string): Promise<{exists: boolean, type?: string, existingUserId?: string}> => {
    const collectionsToSearch = [
      { name: "platformUsers", type: "Usuario de Plataforma" },
      { name: "socioVipMembers", type: "Socio VIP" },
      { name: "qrClients", type: "Cliente QR" }
    ];

    for (const coll of collectionsToSearch) {
      const q = query(collection(db, coll.name), where("dni", "==", dni));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        // If we are editing, make sure the found DNI is not from the user itself
        if (excludeUserId && snapshot.docs.some(d => d.id === excludeUserId && coll.name === "platformUsers")) {
            continue;
        }
        return { exists: true, type: coll.type, existingUserId: snapshot.docs[0].id };
      }
    }
    return { exists: false };
  };


  const handleCreateOrEditUser = async (data: PlatformUserFormData, isEditing: boolean) => {
    setIsSubmitting(true);
    try {
      // DNI Uniqueness Check (only for new users or if DNI changed on edit)
      if (!isEditing || (isEditing && editingUser && data.dni !== editingUser.dni)) {
        const dniCheckResult = await checkDniExists(data.dni, isEditing ? editingUser?.id : undefined);
        if (dniCheckResult.exists) {
          toast({
            title: "DNI ya Registrado",
            description: `El DNI ${data.dni} ya está registrado como ${dniCheckResult.type}. No se puede duplicar.`,
            variant: "destructive",
            duration: 5000,
          });
          setIsSubmitting(false);
          return;
        }
      }

      if (isEditing && editingUser) { // Update existing user
        const userRef = doc(db, "platformUsers", editingUser.id);
        const updatedUserPayload: Partial<PlatformUser> = {
          dni: data.dni, // DNI can be updated if changed (assuming policy allows)
          name: data.name,
          role: data.role,
          // Email is not editable through this form after creation (linked to Auth UID usually)
        };
        if (['business_admin', 'staff', 'host'].includes(data.role)) {
          updatedUserPayload.businessId = data.businessId;
        } else {
          updatedUserPayload.businessId = null; 
        }
        await updateDoc(userRef, updatedUserPayload);
        toast({ title: "Usuario Actualizado", description: `El usuario "${data.name}" ha sido actualizado.` });
      } else { // Create new user
        // For creating a new PlatformUser, an Auth account should be created first
        // (e.g., by SuperAdmin via Firebase Admin SDK, or by user via a generic signup).
        // Then, this profile is created in Firestore, linking via Auth UID.
        // For now, we are just creating the Firestore profile. UID needs to be manually added later.
        const newUserPayload: Omit<PlatformUser, 'id' | 'lastLogin' | 'uid'> & { lastLogin: any, uid?: string } = {
          dni: data.dni,
          name: data.name,
          email: data.email, // Email for new user
          role: data.role,
          lastLogin: serverTimestamp(),
          // uid will be undefined here, needs to be linked post-Firebase Auth account creation
        };
        if (['business_admin', 'staff', 'host'].includes(data.role)) {
          newUserPayload.businessId = data.businessId;
        } else {
          newUserPayload.businessId = null;
        }
        // The UID from Firebase Auth should be added to this document later for login to work.
        // const docRef = 
        await addDoc(collection(db, "platformUsers"), newUserPayload);
        toast({ 
          title: "Perfil de Usuario Creado en Firestore", 
          description: `El perfil para "${data.name}" ha sido creado. Recuerda crear/vincular su cuenta de Firebase Authentication con el UID correspondiente.` 
        });
      }
      
      setShowCreateEditModal(false);
      setEditingUser(null);
      fetchPlatformUsers();

    } catch (error) {
      console.error("Failed to create/update user:", error);
      toast({ title: "Error al Guardar", description: "No se pudo guardar el usuario.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleDeleteUser = async (userId: string, userName?: string) => {
    // Consider preventing deletion of the currently logged-in superadmin
    // or if it's the last superadmin.
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "platformUsers", userId));
      toast({ title: "Usuario Eliminado", description: `El usuario "${userName || 'seleccionado'}" ha sido eliminado.`, variant: "destructive" });
      fetchPlatformUsers();
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast({ title: "Error al Eliminar", description: "No se pudo eliminar el usuario.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const getBusinessName = (user: PlatformUser): string => {
    if (user.role === 'superadmin') return "N/A (Super Admin)";
    if (user.role === 'promoter') return "N/A (Promotor Global)";
    
    if (!user.businessId && (user.role === 'business_admin' || user.role === 'staff' || user.role === 'host')) {
      return "Error: Negocio No Asignado";
    }
    if (user.businessId) {
      const business = availableBusinesses.find(b => b.id === user.businessId);
      return business?.name || `ID: ${user.businessId.substring(0,6)}... (No encontrado)`; 
    }
    return "N/A";
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
          <Button onClick={() => { setEditingUser(null); setShowCreateEditModal(true); }} className="bg-primary hover:bg-primary/90" disabled={isLoading || isLoadingBusinesses}>
            <PlusCircle className="mr-2 h-4 w-4" /> Crear Usuario
          </Button>
        </div>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
          <CardDescription>Administradores, staff, promotores y anfitriones de la plataforma.</CardDescription>
           <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nombre, email, DNI..."
              className="pl-8 w-full sm:w-[300px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading || isLoadingBusinesses ? (
             <div className="flex justify-center items-center h-60">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-4 text-lg text-muted-foreground">Cargando datos...</p>
            </div>
          ) : platformUsers.length === 0 && !searchTerm ? (
             <p className="text-center text-muted-foreground h-24 flex items-center justify-center">
              No hay usuarios registrados. Haz clic en "Crear Usuario" para empezar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">DNI/CE</TableHead>
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
                      <TableCell className="hidden sm:table-cell">{user.dni}</TableCell>
                      <TableCell className="hidden md:table-cell">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'superadmin' ? 'default' : (['business_admin', 'host'].includes(user.role) ? 'secondary' : 'outline')}>
                          {roleTranslations[user.role] || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{getBusinessName(user)}</TableCell>
                      <TableCell>{user.lastLogin ? format(new Date(user.lastLogin), "P p", { locale: es }) : "N/A"}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => {setEditingUser(user); setShowCreateEditModal(true);}} disabled={isSubmitting}>
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
                                Esta acción no se puede deshacer. Esto eliminará permanentemente el perfil del usuario 
                                <span className="font-semibold"> {user.name}</span> de Firestore. No elimina la cuenta de Firebase Authentication.
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
                                Eliminar Perfil
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">No se encontraron usuarios con los filtros aplicados.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
       <Dialog open={showCreateEditModal} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setEditingUser(null);
        }
        setShowCreateEditModal(isOpen);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? `Editar Usuario: ${editingUser.name}` : "Crear Nuevo Usuario de Plataforma"}</DialogTitle>
            <DialogDescription>
              {editingUser ? "Actualiza los detalles del perfil del usuario." : 
              "Completa los detalles para el perfil del usuario en Firestore. La cuenta de Firebase Authentication debe crearse/vincularse por separado."}
            </DialogDescription>
          </DialogHeader>
          <PlatformUserForm 
            user={editingUser || undefined}
            businesses={availableBusinesses}
            onSubmit={handleCreateOrEditUser}
            onCancel={() => { setShowCreateEditModal(false); setEditingUser(null);}}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

    