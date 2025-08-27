
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogDescription as UIDialogDescription, DialogFooter as UIDialogFooter } from "@/components/ui/dialog";
import { Users, PlusCircle, Download, Search, Edit, Trash2, Loader2, AlertTriangle } from "lucide-react";
import type { PlatformUser, PlatformUserFormData, Business, QrClient, SocioVipMember, PlatformUserRole, InitialDataForPlatformUserCreation } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { PlatformUserForm } from "@/components/admin/forms/PlatformUserForm";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as UIAlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage as FormMessageHook } from "@/components/ui/form";
import { PLATFORM_USER_ROLE_TRANSLATIONS, ROLES_REQUIRING_BUSINESS_ID } from "@/lib/constants";

import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, Timestamp, serverTimestamp, query, where, writeBatch, getDoc, setDoc, DocumentData } from "firebase/firestore";

const DniEntrySchema = z.object({
  dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres."),
});
type DniEntryValues = z.infer<typeof DniEntrySchema>;

interface CheckDniResult {
  exists: boolean;
  userType?: 'PlatformUser' | 'SocioVipMember' | 'QrClient';
  platformUserRoles?: PlatformUserRole[];
  platformUserData?: PlatformUser;
  socioVipData?: SocioVipMember;
  qrClientData?: QrClient;
}


export default function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const { toast } = useToast();

  const [availableBusinesses, setAvailableBusinesses] = useState<Business[]>([]);
  const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(false); // Only load when needed

  const [showDniEntryModal, setShowDniEntryModal] = useState(false);
  const [dniForVerification, setDniForVerification] = useState(""); 
  const [verifiedDniResult, setVerifiedDniResult] = useState<InitialDataForPlatformUserCreation | null>(null);
  const [showCreateEditModal, setShowCreateEditModal] = useState(false); 
  
  const [showDniIsPlatformUserAlert, setShowDniIsPlatformUserAlert] = useState(false);
  const [existingPlatformUserToEdit, setExistingPlatformUserToEdit] = useState<PlatformUser | null>(null);
  const [existingPlatformUserRoles, setExistingPlatformUserRoles] = useState<PlatformUserRole[]>([]);


  const dniEntryForm = useForm<DniEntryValues>({
    resolver: zodResolver(DniEntrySchema),
    defaultValues: { dni: "" },
  });

  const fetchBusinessesForForm = useCallback(async () => {
    // Only fetch if not already loaded
    if (availableBusinesses.length > 0) {
      return;
    }
    setIsLoadingBusinesses(true);
    try {
      const querySnapshot = await getDocs(collection(db, "businesses"));
      const fetchedBusinesses: Business[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name,
          // Only map essential fields needed for the form
          contactEmail: "", joinDate: "", // Not needed for the form
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
  }, [availableBusinesses.length, toast]);

  const fetchPlatformUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "platformUsers"));
      const querySnapshot = await getDocs(q);
      const fetchedUsers: PlatformUser[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        let rolesArray: PlatformUserRole[] = [];
        if (data.roles && Array.isArray(data.roles)) {
            rolesArray = data.roles as PlatformUserRole[];
        } else if (data.role && typeof data.role === 'string') { 
            rolesArray = [data.role as PlatformUserRole];
        }

        return {
          id: docSnap.id,
          uid: data.uid || docSnap.id, 
          dni: data.dni || "N/A",
          name: data.name || "Nombre no disponible",
          email: data.email,
          roles: rolesArray,
          businessId: data.businessId || null,
          lastLogin: data.lastLogin instanceof Timestamp 
            ? data.lastLogin.toDate().toISOString() 
            : (data.lastLogin ? (typeof data.lastLogin === 'string' ? parseISO(data.lastLogin).toISOString() : new Date(data.lastLogin?.seconds * 1000 || Date.now()).toISOString()) : new Date().toISOString()),
        };
      });
      setPlatformUsers(fetchedUsers);
    } catch (error: any) {
      console.error("Failed to fetch platform users:", error);
      toast({
        title: "Error al Cargar Usuarios",
        description: "No se pudieron obtener los datos de los usuarios de plataforma. Error: " + error.message,
        variant: "destructive",
      });
      setPlatformUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPlatformUsers();
    // Don't fetch businesses here initially. Fetch them only when the modal is opened.
  }, [fetchPlatformUsers]);

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
    const headers = ["ID Documento", "UID Auth", "DNI/CE", "Nombre", "Email", "Roles", "ID Negocio Asociado", "Último Acceso"];
    const rows = filteredUsers.map(user => [
      user.id,
      user.uid || "N/A",
      user.dni,
      user.name,
      user.email,
      user.roles.map(r => PLATFORM_USER_ROLE_TRANSLATIONS[r as PlatformUserRole] || r).join(', ') || "N/A",
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
  
const checkDniExists = async (dniToVerify: string): Promise<CheckDniResult> => {
    let result: CheckDniResult = { exists: false };

    if (!dniToVerify || typeof dniToVerify !== 'string' || dniToVerify.trim() === '') {
      console.error("checkDniExists: DNI a verificar es inválido.", dniToVerify);
      return result; // Devuelve 'no existe' si el DNI es inválido para la consulta
    }

    // 1. Check platformUsers
    const platformUsersQuery = query(collection(db, "platformUsers"), where("dni", "==", dniToVerify));
    const platformUsersSnapshot = await getDocs(platformUsersQuery);
    if (!platformUsersSnapshot.empty) {
        const docData = platformUsersSnapshot.docs[0].data() as PlatformUser;
        const docId = platformUsersSnapshot.docs[0].id;
        result.exists = true;
        result.userType = 'PlatformUser';
        result.platformUserData = { id: docId, uid: docData.uid || docId, ...docData };
        result.platformUserRoles = docData.roles || [];
        return result; 
    }

    // 2. If not PlatformUser, check SocioVipMember
    const socioVipQuery = query(collection(db, "socioVipMembers"), where("dni", "==", dniToVerify));
    const socioVipSnapshot = await getDocs(socioVipQuery);
    if (!socioVipSnapshot.empty) {
      const docData = socioVipSnapshot.docs[0].data() as SocioVipMember;
      result.exists = true;
      result.userType = 'SocioVipMember';
      result.socioVipData = { id: socioVipSnapshot.docs[0].id, ...docData };
      return result;
    }

    // 3. If not PlatformUser or SocioVipMember, check QrClient
    const qrClientQuery = query(collection(db, "qrClients"), where("dni", "==", dniToVerify));
    const qrClientSnapshot = await getDocs(qrClientQuery);
    if (!qrClientSnapshot.empty) {
      const docData = qrClientSnapshot.docs[0].data() as QrClient;
      result.exists = true;
      result.userType = 'QrClient';
      result.qrClientData = { id: qrClientSnapshot.docs[0].id, ...docData };
      return result;
    }
    
    return result; 
  };


  const handleOpenCreateUserFlow = () => {
    fetchBusinessesForForm(); // Pre-fetch businesses when flow starts
    setEditingUser(null);
    setVerifiedDniResult(null); 
    dniEntryForm.reset({ dni: "" }); 
    setShowDniIsPlatformUserAlert(false); 
    setExistingPlatformUserToEdit(null);
    setExistingPlatformUserRoles([]);
    setDniForVerification(""); 
    setShowDniEntryModal(true); 
  };

  const handleDniVerificationSubmit = async (values: DniEntryValues) => {
    if (isSubmitting) return;
    
    const dniToVerifyCleaned = values.dni.trim();
    if (!dniToVerifyCleaned) {
        toast({ title: "DNI Requerido", description: "Por favor, ingresa un DNI/CE válido.", variant: "destructive"});
        return;
    }

    setIsSubmitting(true); 
    setDniForVerification(dniToVerifyCleaned); 
    
    const result = await checkDniExists(dniToVerifyCleaned);
    setIsSubmitting(false);
    
    let initialData: InitialDataForPlatformUserCreation = { dni: dniToVerifyCleaned };

    if (result.exists) {
        if (result.userType === 'PlatformUser' && result.platformUserData) {
            setExistingPlatformUserToEdit(result.platformUserData);
            setExistingPlatformUserRoles(result.platformUserRoles || []);
            initialData.existingPlatformUser = result.platformUserData;
            initialData.existingPlatformUserRoles = result.platformUserRoles || [];
            setShowDniIsPlatformUserAlert(true); 
            setShowDniEntryModal(false); 
            return; 
        } else if (result.userType === 'SocioVipMember' && result.socioVipData) {
            initialData.name = `${result.socioVipData.name} ${result.socioVipData.surname}`;
            initialData.email = result.socioVipData.email;
            initialData.preExistingUserType = 'SocioVipMember';
        } else if (result.userType === 'QrClient' && result.qrClientData) {
            initialData.name = `${result.qrClientData.name} ${result.qrClientData.surname}`;
            // QrClients no tienen email por defecto en el tipo
            initialData.preExistingUserType = 'QrClient';
        }
    }
    
    setVerifiedDniResult(initialData);
    setEditingUser(null); 
    setShowDniEntryModal(false); 
    setShowCreateEditModal(true); 
  };
  
  const handleEditExistingPlatformUser = () => {
      setShowDniIsPlatformUserAlert(false); 
      if (existingPlatformUserToEdit) {
          fetchBusinessesForForm(); // Ensure businesses are loaded for edit form
          setEditingUser(existingPlatformUserToEdit);
          setVerifiedDniResult(null); // Clear initial data as we are editing
          setShowCreateEditModal(true); 
      }
      setExistingPlatformUserToEdit(null);
      setExistingPlatformUserRoles([]);
  };

  const handleCreateOrEditUser = async (data: PlatformUserFormData, isEditing: boolean) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const finalBusinessId = (data.roles.includes('superadmin') || data.roles.includes('promoter') || !ROLES_REQUIRING_BUSINESS_ID.some(r => data.roles.includes(r as PlatformUserRole)))
      ? null
      : data.businessId;

    try {
      if (isEditing && editingUser) { 
        const userRef = doc(db, "platformUsers", editingUser.uid); 
        
        if (data.dni !== editingUser.dni) {
            const dniCheck = await checkDniExists(data.dni);
            if (dniCheck.exists && dniCheck.platformUserData?.uid !== editingUser.uid) {
                 toast({ title: "Error de DNI", description: `El DNI ${data.dni} ya está registrado para otro Usuario de Plataforma.`, variant: "destructive" });
                 setIsSubmitting(false);
                 return;
            }
        }
        
        const userPayload: Partial<Omit<PlatformUser, 'id' | 'lastLogin'>> = { 
          name: data.name,
          roles: data.roles,
          businessId: finalBusinessId,
          dni: data.dni,
        };
        await updateDoc(userRef, userPayload);
        toast({ title: "Usuario Actualizado", description: `El perfil de "${data.name}" ha sido actualizado.` });
      } else { 
        // --- CREATION LOGIC ---
        const creationPayload = {
          email: data.email,
          password: data.password, // This now comes from the form
          displayName: data.name,
          firestoreData: {
            dni: data.dni,
            name: data.name,
            email: data.email,
            roles: data.roles,
            businessId: finalBusinessId,
          }
        };

        const response = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(creationPayload),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Error desconocido al crear usuario.');
        }

        toast({ 
          title: "Usuario Creado Exitosamente", 
          description: `Se creó el usuario "${data.name}" con UID: ${result.uid}.`,
        });
      }
      
      setShowCreateEditModal(false);
      setEditingUser(null);
      setVerifiedDniResult(null); 
      fetchPlatformUsers(); 

    } catch (error: any) {
      console.error("Failed to create/update user:", error);
      let description = "No se pudo guardar el usuario.";
      if (error.code === 'permission-denied') {
        description = "Error de permisos. Verifica las reglas de Firestore."
      } else if (error.message.includes("Function where() called with invalid data")) {
        description = "Error interno: datos inválidos para la consulta. Revisa el DNI.";
      } else {
        description = error.message; // Use error from API call
      }
      toast({ title: "Error al Guardar", description, variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: PlatformUser) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "platformUsers", user.uid)); // Asumimos que user.uid es el ID del documento
      toast({ title: "Perfil de Usuario Eliminado", description: `El perfil del usuario "${user.name}" ha sido eliminado.`, variant: "destructive", duration: 7000 });
      fetchPlatformUsers();
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast({ title: "Error al Eliminar", description: "No se pudo eliminar el perfil del usuario.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const getBusinessName = (businessId?: string | null): string => {
    if (!businessId) return "N/A";
    const business = availableBusinesses.find(b => b.id === businessId);
    return business?.name || `ID: ${businessId.substring(0, 6)}...`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-gradient flex items-center">
          <Users className="h-8 w-8 mr-2" /> Gestión de Usuarios de Plataforma
        </h1>
        <div className="flex space-x-2">
           <Button onClick={handleExport} variant="outline" disabled={isLoading || platformUsers.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          <Button onClick={handleOpenCreateUserFlow} variant="gradient" disabled={isLoading}>
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
          {isLoading ? (
             <div className="flex justify-center items-center h-60">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-4 text-lg text-muted-foreground">Cargando usuarios...</p>
            </div>
          ) : platformUsers.length === 0 && !searchTerm ? (
             <p className="text-center text-muted-foreground h-24 flex items-center justify-center">
              No hay usuarios registrados. Haz clic en "Crear Usuario" para empezar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>DNI/CE <span className="text-destructive">*</span></TableHead>
                    <TableHead className="hidden md:table-cell">Email <span className="text-destructive">*</span></TableHead>
                    <TableHead>Roles <span className="text-destructive">*</span></TableHead>
                    <TableHead className="hidden lg:table-cell">Negocio Asociado</TableHead>
                    <TableHead className="hidden xl:table-cell">Último Acceso</TableHead>
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
                                  {PLATFORM_USER_ROLE_TRANSLATIONS[role as PlatformUserRole] || role}
                              </Badge>
                          ))}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">{getBusinessName(user.businessId)}</TableCell>
                        <TableCell className="hidden xl:table-cell">{user.lastLogin ? format(new Date(user.lastLogin), "P p", { locale: es }) : "N/A"}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => {
                              handleEditExistingPlatformUser();
                              setExistingPlatformUserToEdit(user);
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
                                <UIAlertDialogTitle>¿Estás seguro?</UIAlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Esto eliminará permanentemente el perfil del usuario 
                                  <span className="font-semibold"> {user.name}</span> (UID: {user.uid}) de Firestore. No elimina la cuenta de Firebase Authentication.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user)}
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
            </div>
          )}
        </CardContent>
      </Card>
      
      <UIDialog open={showDniEntryModal} onOpenChange={(isOpen) => {
          if (!isOpen) {
            dniEntryForm.reset();
            setDniForVerification(""); 
            setVerifiedDniResult(null);
            setExistingPlatformUserToEdit(null);
            setExistingPlatformUserRoles([]);
          }
          setShowDniEntryModal(isOpen);
      }}>
        <UIDialogContent className="sm:max-w-md">
          <UIDialogHeader>
            <UIDialogTitle>Paso 1: Verificar DNI/CE</UIDialogTitle>
            <UIDialogDescription>
              Ingresa el DNI o Carnet de Extranjería del nuevo usuario para verificar si ya existe.
            </UIDialogDescription>
          </UIDialogHeader>
          <Form {...dniEntryForm}>
            <form onSubmit={dniEntryForm.handleSubmit(handleDniVerificationSubmit)} className="space-y-4 py-2">
              <FormField
                control={dniEntryForm.control}
                name="dni"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DNI / Carnet de Extranjería <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Número de documento" {...field} maxLength={15} autoFocus disabled={isSubmitting}/>
                    </FormControl>
                    <FormMessageHook />
                  </FormItem>
                )}
              />
              <UIDialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setShowDniEntryModal(false)} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" variant="gradient" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verificar DNI"}
                </Button>
              </UIDialogFooter>
            </form>
          </Form>
        </UIDialogContent>
      </UIDialog>

       <UIDialog open={showCreateEditModal} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setEditingUser(null);
          setVerifiedDniResult(null); 
        }
        setShowCreateEditModal(isOpen);
      }}>
        <UIDialogContent className="sm:max-w-lg">
          <UIDialogHeader>
            <UIDialogTitle>
              {editingUser 
                ? `Editar Usuario: ${editingUser.name}` 
                : "Paso 2: Completar Perfil de Usuario de Plataforma"
              }
            </UIDialogTitle>
            <UIDialogDescription>
              {editingUser 
                ? "Actualiza los detalles del perfil del usuario." 
                : "Completa los detalles para crear el usuario en Firebase Authentication y su perfil en Firestore."
              }
            </UIDialogDescription>
          </UIDialogHeader>
          { isLoadingBusinesses ? (
              <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-3 text-muted-foreground">Cargando negocios...</p>
              </div>
            ) : (
                <PlatformUserForm 
                  user={editingUser || undefined} 
                  initialDataForCreation={!editingUser ? verifiedDniResult : undefined}
                  businesses={availableBusinesses}
                  onSubmit={handleCreateOrEditUser}
                  onCancel={() => { setShowCreateEditModal(false); setEditingUser(null); setVerifiedDniResult(null);}}
                  isSubmitting={isSubmitting}
                  disableSubmitOverride={!editingUser && !!(verifiedDniResult?.existingPlatformUser)}
                />
            )
          }
        </UIDialogContent>
      </UIDialog>

      <AlertDialog open={showDniIsPlatformUserAlert} onOpenChange={setShowDniIsPlatformUserAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <UIAlertDialogTitle className="flex items-center">
                <AlertTriangle className="text-yellow-500 mr-2 h-6 w-6"/> DNI ya Registrado como Usuario de Plataforma
            </UIAlertDialogTitle>
            <AlertDialogDescription>
              El DNI <span className="font-semibold">{dniForVerification}</span> ya está registrado en la Plataforma con el/los rol(es) de: <span className="font-semibold">{(existingPlatformUserRoles || []).map(r => PLATFORM_USER_ROLE_TRANSLATIONS[r as PlatformUserRole] || r).join(', ')}</span>.
              <br/><br/>
              ¿Desea editar este perfil de usuario existente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
                setShowDniIsPlatformUserAlert(false); 
                setVerifiedDniResult(null); 
                setDniForVerification("");
                setExistingPlatformUserToEdit(null);
                setExistingPlatformUserRoles([]);
            }} disabled={isSubmitting}>No, Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEditExistingPlatformUser} className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sí, Editar Perfil Existente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
