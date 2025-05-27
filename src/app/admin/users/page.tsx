
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Users, PlusCircle, Download, Search, Edit, Trash2, Loader2, AlertTriangle } from "lucide-react";
import type { PlatformUser, PlatformUserFormData, Business, QrClient, SocioVipMember, PlatformUserRole, InitialDataForPlatformUserCreation } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { PlatformUserForm } from "@/components/admin/forms/PlatformUserForm";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PLATFORM_USER_ROLE_TRANSLATIONS, ROLES_REQUIRING_BUSINESS_ID } from "@/lib/constants";


import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, Timestamp, serverTimestamp, query, where, writeBatch, getDoc } from "firebase/firestore";

// This schema is only for the DNI entry modal
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

  // State for DNI-first creation flow
  const [showDniEntryModal, setShowDniEntryModal] = useState(false);
  const [dniForVerification, setDniForVerification] = useState(""); // For displaying in alert
  
  // Stores the result of DNI check: DNI string, existing user data (if any), and its type
  const [verifiedDniResult, setVerifiedDniResult] = useState<InitialDataForPlatformUserCreation | null>(null);
  
  const [showCreateEditUserModal, setShowCreateEditUserModal] = useState(false);
  
  // State for alert if DNI is already a Platform User
  const [showDniIsPlatformUserAlert, setShowDniIsPlatformUserAlert] = useState(false);
  const [existingPlatformUserRoles, setExistingPlatformUserRoles] = useState<PlatformUserRole[]>([]);


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
          joinDate: data.joinDate instanceof Timestamp ? data.joinDate.toDate().toISOString() : new Date(data.joinDate || Date.now()).toISOString(),
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
      const q = query(collection(db, "platformUsers"));
      const querySnapshot = await getDocs(q);
      const fetchedUsers: PlatformUser[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          uid: data.uid || docSnap.id, // Fallback for old data or if uid isn't explicitly set to doc id
          dni: data.dni || "N/A",
          name: data.name || "Nombre no disponible",
          email: data.email,
          roles: Array.isArray(data.roles) ? data.roles : (data.role ? [data.role] : []), // Handle old 'role' field
          businessId: data.businessId || null,
          lastLogin: data.lastLogin instanceof Timestamp 
            ? data.lastLogin.toDate().toISOString() 
            : (data.lastLogin ? new Date(data.lastLogin).toISOString() : new Date(Date.now() - Math.random() * 10000000000).toISOString()), // Mock last login
        };
      });
      setPlatformUsers(fetchedUsers);
    } catch (error) {
      console.error("Failed to fetch platform users:", error);
      toast({
        title: "Error al Cargar Usuarios",
        description: "No se pudieron obtener los datos de los usuarios de plataforma.",
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
    const headers = ["ID", "UID", "DNI/CE", "Nombre", "Email", "Roles", "ID Negocio Asociado", "Último Acceso"];
    const rows = filteredUsers.map(user => [
      user.id,
      user.uid || "N/A",
      user.dni,
      user.name,
      user.email,
      user.roles.map(r => PLATFORM_USER_ROLE_TRANSLATIONS[r] || r).join(', ') || "N/A",
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

  // Function to check if DNI exists across relevant collections
  // Returns data for pre-filling or alerting
  const checkDniExists = async (dni: string, excludeUserId?: string): Promise<InitialDataForPlatformUserCreation | null> => {
    if (!dni) return { dni: "" }; // Should be caught by form validation, but good to be safe

    // Check platformUsers
    const platformUsersQuery = query(collection(db, "platformUsers"), where("dni", "==", dni));
    const platformUsersSnapshot = await getDocs(platformUsersQuery);
    if (!platformUsersSnapshot.empty) {
        const platformUserDoc = platformUsersSnapshot.docs[0];
        // If we are editing, and the found DNI belongs to the user being edited, it's not a "conflict" for this user.
        if (excludeUserId && platformUserDoc.id === excludeUserId) {
            // Continue checking other collections or return null if no other user has this DNI
        } else {
            const data = platformUserDoc.data() as PlatformUser; // Assume type
            return {
                dni: dni,
                existingUserIsPlatformUser: true,
                existingUserType: 'PlatformUser',
                existingPlatformUser: { id: platformUserDoc.id, ...data },
                existingPlatformUserRoles: data.roles || [],
            };
        }
    }

    // Check socioVipMembers
    const socioVipQuery = query(collection(db, "socioVipMembers"), where("dni", "==", dni));
    const socioVipSnapshot = await getDocs(socioVipQuery);
    if (!socioVipSnapshot.empty) {
        const data = socioVipSnapshot.docs[0].data() as SocioVipMember;
        return {
            dni: dni,
            existingUserIsOtherType: true,
            existingUserType: 'SocioVipMember',
            name: data.name,
            email: data.email,
            // Can add more fields from SocioVipMember if needed for pre-fill
        };
    }

    // Check qrClients
    const qrClientQuery = query(collection(db, "qrClients"), where("dni", "==", dni));
    const qrClientSnapshot = await getDocs(qrClientQuery);
    if (!qrClientSnapshot.empty) {
        const data = qrClientSnapshot.docs[0].data() as QrClient;
        return {
            dni: dni,
            existingUserIsOtherType: true,
            existingUserType: 'QrClient',
            name: `${data.name} ${data.surname}`, 
            // QrClients don't have email in current model, phone and dob could be added if needed
        };
    }
    return { dni: dni }; // DNI is new or only for other types not yet checked (or belongs to user being edited)
  };


  const handleOpenCreateUserFlow = () => {
    setEditingUser(null);
    setVerifiedDniResult(null); // Reset verified DNI result
    dniEntryForm.reset({ dni: "" }); // Reset DNI form
    setShowDniIsPlatformUserAlert(false); // Reset alert
    setDniForVerification(""); // Clear DNI for alert display
    setShowDniEntryModal(true); // Show DNI entry modal
  };

  const handleDniVerificationSubmit = async (values: DniEntryValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true); // Use general isSubmitting for this step as well
    setDniForVerification(values.dni); // Store DNI for display in alert, if needed
    
    const result = await checkDniExists(values.dni);
    setIsSubmitting(false);
    setVerifiedDniResult(result || { dni: values.dni }); // Ensure verifiedDniResult is always set

    if (result?.existingUserIsPlatformUser && result?.existingPlatformUser) {
      setExistingPlatformUserRoles(result.existingPlatformUserRoles || []);
      setShowDniIsPlatformUserAlert(true); // Show alert that DNI is already a PlatformUser
      setShowDniEntryModal(false); // Close DNI entry modal
    } else {
      // DNI is new, or exists as QrClient/SocioVIP (but not PlatformUser)
      setShowDniEntryModal(false); // Close DNI entry modal
      setShowCreateEditUserModal(true); // Open main form for creating a new PlatformUser profile
    }
  };
  
  const handleEditExistingPlatformUser = () => {
      setShowDniIsPlatformUserAlert(false); // Close the alert
      if (verifiedDniResult?.existingPlatformUser) {
          // Set editingUser to the existing platform user's data
          setEditingUser(verifiedDniResult.existingPlatformUser);
          // verifiedDniResult might still be useful for the form if it needs to know DNI was verified
          setShowCreateEditUserModal(true); // Open main form in edit mode
      }
  };


  const handleCreateOrEditUser = async (data: PlatformUserFormData, isEditingOperation: boolean) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (isEditingOperation && editingUser) { // Editing existing user
        // DNI check if it was changed (currently DNI is disabled on edit form)
        if (data.dni !== editingUser.dni) {
          const dniCheckResult = await checkDniExists(data.dni, editingUser.id); // exclude current user
          if (dniCheckResult?.existingUserIsPlatformUser) {
             toast({ title: "Error de DNI", description: `El DNI ${data.dni} ya está registrado para otro usuario de plataforma.`, variant: "destructive" });
             setIsSubmitting(false);
             return;
          }
        }

        const userRef = doc(db, "platformUsers", editingUser.id);
        const updatedUserPayload: Partial<PlatformUser> = {
          dni: data.dni, // DNI is part of form data, even if disabled for edit
          name: data.name,
          email: data.email, // Email also disabled for edit if exists
          roles: data.roles,
          businessId: (data.roles.some(r => ROLES_REQUIRING_BUSINESS_ID.includes(r))) ? data.businessId : null,
          // lastLogin will be updated by Firebase Auth typically, or serverTimestamp on specific actions
        };
        
        await updateDoc(userRef, updatedUserPayload);
        toast({ title: "Usuario Actualizado", description: `El usuario "${data.name}" ha sido actualizado.` });

      } else { // Create new user (DNI comes from verifiedDniResult)
        if (!verifiedDniResult?.dni) {
          toast({ title: "Error Interno", description: "No se pudo obtener el DNI verificado.", variant: "destructive"});
          setIsSubmitting(false);
          return;
        }
        // Final check, though UI flow (showDniIsPlatformUserAlert) should prevent this if DNI already is PlatformUser
        if (verifiedDniResult.existingUserIsPlatformUser) {
            toast({ title: "Error", description: `El DNI ${verifiedDniResult.dni} ya está registrado como Usuario de Plataforma. No se puede crear un nuevo perfil.`, variant: "destructive" });
            setIsSubmitting(false);
            return;
        }

        const newUserPayload: Omit<PlatformUser, 'id' | 'uid' | 'lastLogin'> & { lastLogin: any } = {
          dni: verifiedDniResult.dni,
          name: data.name,
          email: data.email,
          roles: data.roles, 
          lastLogin: serverTimestamp(), // Set lastLogin on creation
          businessId: (data.roles.some(r => ROLES_REQUIRING_BUSINESS_ID.includes(r))) ? data.businessId : null,
        };
        
        // The UID will be added manually by the superadmin after creating the Firebase Auth account
        // or by a backend process if Admin SDK is used for Auth user creation.
        // The document ID will be auto-generated by Firestore.
        const docRef = await addDoc(collection(db, "platformUsers"), newUserPayload);
        toast({ 
          title: "Perfil de Usuario Creado en Firestore", 
          description: `El perfil para "${data.name}" (DNI: ${newUserPayload.dni}) ha sido creado. IMPORTANTE: Este perfil necesita ser vinculado a una cuenta de Firebase Authentication con un UID para que el usuario pueda iniciar sesión. El ID del documento Firestore es: ${docRef.id}.` ,
          duration: 10000,
        });
      }
      
      setShowCreateEditUserModal(false);
      setEditingUser(null);
      setVerifiedDniResult(null); // Clear verified DNI after successful operation
      fetchPlatformUsers(); // Refresh the list

    } catch (error) {
      console.error("Failed to create/update user:", error);
      toast({ title: "Error al Guardar", description: "No se pudo guardar el usuario.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName?: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "platformUsers", userId));
      toast({ title: "Usuario Eliminado", description: `El perfil del usuario "${userName || 'seleccionado'}" ha sido eliminado de Firestore. Esto no elimina la cuenta de Firebase Authentication.`, variant: "destructive", duration: 7000 });
      fetchPlatformUsers();
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast({ title: "Error al Eliminar", description: "No se pudo eliminar el perfil del usuario.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const getBusinessName = (user: PlatformUser): string => {
    if (user.roles.includes('superadmin')) return "N/A (Super Admin)";
    if (user.roles.includes('promoter')) return "N/A (Promotor Global)";
    
    if (!user.businessId && (user.roles.some(r => ROLES_REQUIRING_BUSINESS_ID.includes(r)))) {
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
                  <TableHead>DNI/CE</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Roles</TableHead>
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
                      <TableCell>{user.dni}</TableCell>
                      <TableCell className="hidden md:table-cell">{user.email}</TableCell>
                      <TableCell>
                        {user.roles && user.roles.map(role => (
                            <Badge key={role} variant={role === 'superadmin' ? 'default' : (ROLES_REQUIRING_BUSINESS_ID.includes(role) ? 'secondary' : 'outline')} className="mr-1 mb-1 text-xs">
                                {PLATFORM_USER_ROLE_TRANSLATIONS[role] || role}
                            </Badge>
                        ))}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{getBusinessName(user)}</TableCell>
                      <TableCell>{user.lastLogin ? format(new Date(user.lastLogin), "P p", { locale: es }) : "N/A"}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => {
                            setEditingUser(user); 
                            setVerifiedDniResult(null); // Not verifying DNI when editing an existing user via this button
                            setShowCreateEditUserModal(true);
                        }} disabled={isSubmitting}>
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
      
      {/* DNI Entry Modal for New User Creation */}
      <Dialog open={showDniEntryModal} onOpenChange={(isOpen) => {
          if (!isOpen) {
            dniEntryForm.reset();
            setDniForVerification(""); // Clear DNI for verification when modal closes
          }
          setShowDniEntryModal(isOpen);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Paso 1: Verificar DNI/CE</DialogTitle>
            <DialogDescription>
              Ingresa el DNI o Carnet de Extranjería del nuevo usuario para verificar si ya existe en la plataforma.
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

      {/* Main User Creation/Editing Modal */}
       <Dialog open={showCreateEditUserModal} onOpenChange={(isOpen) => {
        if (!isOpen) {
          // Reset states when closing this modal
          setEditingUser(null);
          setVerifiedDniResult(null); 
        }
        setShowCreateEditUserModal(isOpen);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingUser 
                ? `Editar Usuario: ${editingUser.name}` 
                : "Paso 2: Completar Perfil de Usuario de Plataforma"
              }
            </DialogTitle>
            <DialogDescription>
              {editingUser 
                ? "Actualiza los detalles del perfil del usuario." 
                : (verifiedDniResult?.existingUserIsPlatformUser 
                    ? "Este DNI ya es un Usuario de Plataforma. No se puede crear un nuevo perfil aquí. Edite desde la lista principal." // Should be caught by alert
                    : "Completa los detalles para el perfil del usuario en Firestore. La cuenta de Firebase Authentication debe crearse/vincularse por separado.")
              }
            </DialogDescription>
          </DialogHeader>
          <PlatformUserForm 
            user={editingUser || undefined} // Pass current editing user or undefined for new
            initialDataForCreation={!editingUser && verifiedDniResult ? verifiedDniResult : undefined}
            businesses={availableBusinesses}
            onSubmit={(data) => handleCreateOrEditUser(data, !!editingUser)} // Pass isEditing flag
            onCancel={() => { setShowCreateEditUserModal(false); setEditingUser(null); setVerifiedDniResult(null);}}
            isSubmitting={isSubmitting}
            // Disable form submit if DNI is already a platform user and we are in creation flow
            disableSubmitOverride={!editingUser && !!verifiedDniResult?.existingUserIsPlatformUser}
          />
        </DialogContent>
      </Dialog>

      {/* Alert Dialog if DNI is already a Platform User */}
      <AlertDialog open={showDniIsPlatformUserAlert} onOpenChange={setShowDniIsPlatformUserAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
                <AlertTriangle className="text-yellow-500 mr-2 h-6 w-6"/> DNI ya Registrado como Usuario de Plataforma
            </AlertDialogTitle>
            <AlertDialogDescription>
              El DNI <span className="font-semibold">{dniForVerification}</span> ya está registrado en la Plataforma con el/los rol(es) de: <span className="font-semibold">{(existingPlatformUserRoles || []).map(r => PLATFORM_USER_ROLE_TRANSLATIONS[r] || r).join(', ')}</span>.
              <br/><br/>
              ¿Desea editar este perfil de usuario existente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDniIsPlatformUserAlert(false)}>No, Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEditExistingPlatformUser} className="bg-primary hover:bg-primary/90">
                Sí, Editar Perfil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
