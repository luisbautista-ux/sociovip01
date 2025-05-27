
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Users, PlusCircle, Download, Search, Edit, Trash2, Loader2, ShieldQuestion, AlertTriangle } from "lucide-react";
import type { PlatformUser, PlatformUserFormData, Business, QrClient, SocioVipMember } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { PlatformUserForm, type InitialDataForPlatformUserCreation } from "@/components/admin/forms/PlatformUserForm";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";


import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, Timestamp, serverTimestamp, query, where, writeBatch, getDoc } from "firebase/firestore";

const roleTranslations: Record<PlatformUser['role'], string> = {
  superadmin: "Super Admin",
  business_admin: "Admin Negocio",
  staff: "Staff Negocio",
  promoter: "Promotor",
  host: "Anfitrión",
};

// Schema for DNI entry modal
const DniEntrySchema = z.object({
  dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres."),
});
type DniEntryValues = z.infer<typeof DniEntrySchema>;

export default function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [availableBusinesses, setAvailableBusinesses] = useState<Business[]>([]);
  const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(true);

  // State for DNI-first flow
  const [showDniEntryModal, setShowDniEntryModal] = useState(false);
  const [dniForVerification, setDniForVerification] = useState(""); // Not strictly needed if form handles it
  const [verifiedDniResult, setVerifiedDniResult] = useState<InitialDataForPlatformUserCreation & { isPlatformUser?: boolean, existingUserRole?: PlatformUser['role'] } | null>(null);
  const [showCreateEditUserModal, setShowCreateEditUserModal] = useState(false);
  const [showDniIsPlatformUserAlert, setShowDniIsPlatformUserAlert] = useState(false);


  const dniEntryForm = useForm<DniEntryValues>({
    resolver: zodResolver(DniEntrySchema),
    defaultValues: { dni: "" },
  });

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
          uid: data.uid || docSnap.id, // Fallback if uid not present, should be rare
          dni: data.dni || "N/A",
          name: data.name || "Nombre no disponible",
          email: data.email,
          role: data.role,
          businessId: data.businessId,
          lastLogin: data.lastLogin instanceof Timestamp 
            ? data.lastLogin.toDate().toISOString() 
            : (data.lastLogin ? new Date(data.lastLogin).toISOString() : new Date(Date.now() - Math.random() * 10000000000).toISOString()), // Default if missing with random past date
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
    // ... (export logic remains the same)
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

  const checkDniExists = async (dni: string, excludeUserId?: string): Promise<{
    exists: boolean;
    userType?: 'PlatformUser' | 'SocioVipMember' | 'QrClient';
    userData?: PlatformUser | SocioVipMember | QrClient;
    userRole?: PlatformUser['role'];
  }> => {
    const collectionsToSearch: Array<{ name: string; type: 'PlatformUser' | 'SocioVipMember' | 'QrClient' }> = [
      { name: "platformUsers", type: "PlatformUser" },
      { name: "socioVipMembers", type: "SocioVipMember" },
      { name: "qrClients", type: "QrClient" }
    ];

    for (const coll of collectionsToSearch) {
      const q = query(collection(db, coll.name), where("dni", "==", dni));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data() as any; // Type assertion
        const docId = snapshot.docs[0].id;

        if (excludeUserId && docId === excludeUserId && coll.type === "PlatformUser") {
          continue; 
        }
        return { 
            exists: true, 
            userType: coll.type, 
            userData: { id: docId, ...docData } as PlatformUser | SocioVipMember | QrClient,
            userRole: coll.type === 'PlatformUser' ? docData.role : undefined
        };
      }
    }
    return { exists: false };
  };

  const handleOpenCreateUserFlow = () => {
    setEditingUser(null);
    setVerifiedDniResult(null);
    dniEntryForm.reset({ dni: "" });
    setShowDniIsPlatformUserAlert(false);
    setShowDniEntryModal(true);
  };

  const handleDniVerificationSubmit = async (values: DniEntryValues) => {
    setIsSubmitting(true); // For DNI verification step
    const result = await checkDniExists(values.dni);
    setIsSubmitting(false);

    if (result.exists && result.userType === 'PlatformUser') {
      setVerifiedDniResult({ 
        dni: values.dni, 
        isPlatformUser: true, 
        existingUserRole: result.userRole 
      });
      setShowDniIsPlatformUserAlert(true);
      setShowDniEntryModal(false); 
    } else {
      setVerifiedDniResult({
        dni: values.dni,
        name: result.userData?.name,
        email: (result.userData as SocioVipMember)?.email, // Only SocioVIP has email among non-platform users
        existingUserType: result.userType,
        isPlatformUser: false,
      });
      setShowDniEntryModal(false);
      setShowCreateEditUserModal(true);
    }
  };

  const handleCreateOrEditUser = async (data: PlatformUserFormData, isEditing: boolean) => {
    setIsSubmitting(true);
    try {
      // DNI check for editing if DNI was changed (DNI field is disabled on create after verification)
      if (isEditing && editingUser && data.dni !== editingUser.dni) {
        const dniCheckResult = await checkDniExists(data.dni, editingUser.id);
        if (dniCheckResult.exists) {
          toast({
            title: "DNI ya Registrado",
            description: `El DNI ${data.dni} ya está registrado como ${dniCheckResult.userType}. No se puede duplicar.`,
            variant: "destructive",
            duration: 5000,
          });
          setIsSubmitting(false);
          return;
        }
      }

      if (isEditing && editingUser) { 
        const userRef = doc(db, "platformUsers", editingUser.id);
        const updatedUserPayload: Partial<PlatformUser> = {
          dni: data.dni,
          name: data.name,
          role: data.role,
          // Email is not editable through this form after creation
        };
        if (['business_admin', 'staff', 'host'].includes(data.role)) {
          updatedUserPayload.businessId = data.businessId;
        } else {
          updatedUserPayload.businessId = null; 
        }
        await updateDoc(userRef, updatedUserPayload);
        toast({ title: "Usuario Actualizado", description: `El usuario "${data.name}" ha sido actualizado.` });
      } else { // Create new user
        const newUserPayload: Omit<PlatformUser, 'id' | 'lastLogin' | 'uid'> & { lastLogin: any; uid?: string } = {
          dni: data.dni, // DNI comes from verifiedDniResult or editingUser
          name: data.name,
          email: data.email,
          role: data.role,
          lastLogin: serverTimestamp(),
        };
        if (['business_admin', 'staff', 'host'].includes(data.role)) {
          newUserPayload.businessId = data.businessId;
        } else {
          newUserPayload.businessId = null;
        }
        await addDoc(collection(db, "platformUsers"), newUserPayload);
        toast({ 
          title: "Perfil de Usuario Creado en Firestore", 
          description: `El perfil para "${data.name}" ha sido creado. Recuerda crear/vincular su cuenta de Firebase Authentication con el UID correspondiente.` 
        });
      }
      
      setShowCreateEditUserModal(false);
      setEditingUser(null);
      setVerifiedDniResult(null); // Reset verified DNI after successful operation
      fetchPlatformUsers();

    } catch (error) {
      console.error("Failed to create/update user:", error);
      toast({ title: "Error al Guardar", description: "No se pudo guardar el usuario.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName?: string) => {
    // ... (delete logic remains the same)
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
          <Button onClick={handleOpenCreateUserFlow} className="bg-primary hover:bg-primary/90" disabled={isLoading || isLoadingBusinesses}>
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
                        <Button variant="ghost" size="icon" onClick={() => {setEditingUser(user); setVerifiedDniResult(null); setShowCreateEditUserModal(true);}} disabled={isSubmitting}>
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
      
      {/* DNI Entry Modal */}
      <Dialog open={showDniEntryModal} onOpenChange={(isOpen) => {
          if (!isOpen) dniEntryForm.reset();
          setShowDniEntryModal(isOpen);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verificar DNI/CE</DialogTitle>
            <DialogDescription>
              Ingresa el DNI o Carnet de Extranjería del nuevo usuario para verificar si ya existe.
            </DialogDescription>
          </DialogHeader>
          <Form {...dniEntryForm}>
            <form onSubmit={dniEntryForm.handleSubmit(handleDniVerificationSubmit)} className="space-y-4 py-2">
              <FormField
                control={dniEntryForm.control}
                name="dni"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DNI / Carnet de Extranjería</FormLabel>
                    <FormControl>
                      <Input placeholder="Número de documento" {...field} autoFocus disabled={isSubmitting}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setShowDniEntryModal(false)} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verificar DNI"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Main Create/Edit User Modal */}
       <Dialog open={showCreateEditUserModal} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setEditingUser(null);
          setVerifiedDniResult(null); // Clear verified DNI when modal closes
        }
        setShowCreateEditUserModal(isOpen);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUser ? `Editar Usuario: ${editingUser.name}` : "Crear Nuevo Usuario de Plataforma"}</DialogTitle>
            <DialogDescription>
              {editingUser ? "Actualiza los detalles del perfil del usuario." : 
              (verifiedDniResult?.isPlatformUser ? "Este DNI ya es un Usuario de Plataforma. No se puede crear un nuevo perfil." : 
              "Completa los detalles para el perfil del usuario en Firestore. La cuenta de Firebase Authentication debe crearse/vincularse por separado.")}
            </DialogDescription>
          </DialogHeader>
          <PlatformUserForm 
            user={editingUser || undefined}
            initialDataForCreation={!editingUser && verifiedDniResult ? verifiedDniResult : undefined}
            businesses={availableBusinesses}
            onSubmit={handleCreateOrEditUser}
            onCancel={() => { setShowCreateEditUserModal(false); setEditingUser(null); setVerifiedDniResult(null);}}
            isSubmitting={isSubmitting || (verifiedDniResult?.isPlatformUser && !editingUser) || false}
          />
        </DialogContent>
      </Dialog>

      {/* Alert Dialog if DNI already is a Platform User */}
      <AlertDialog open={showDniIsPlatformUserAlert} onOpenChange={setShowDniIsPlatformUserAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
                <AlertTriangle className="text-yellow-500 mr-2 h-6 w-6"/> DNI ya Registrado como Usuario de Plataforma
            </AlertDialogTitle>
            <AlertDialogDescription>
              El DNI <span className="font-semibold">{verifiedDniResult?.dni}</span> ya está registrado como un Usuario de Plataforma
              con el rol de <span className="font-semibold">{verifiedDniResult?.existingUserRole ? roleTranslations[verifiedDniResult.existingUserRole] : 'Desconocido'}</span>.
              No se puede crear un nuevo perfil de plataforma. Puede editar el perfil existente si es necesario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowDniIsPlatformUserAlert(false)}>Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
    