
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PLATFORM_USER_ROLE_TRANSLATIONS, ROLES_REQUIRING_BUSINESS_ID } from "@/lib/constants";


import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, Timestamp, serverTimestamp, query, where, writeBatch, getDoc } from "firebase/firestore";

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

  const [showDniEntryModal, setShowDniEntryModal] = useState(false);
  const [dniForVerification, setDniForVerification] = useState(""); 
  const [verifiedDniResult, setVerifiedDniResult] = useState<InitialDataForPlatformUserCreation | null>(null);
  const [showCreateEditModal, setShowCreateEditModal] = useState(false); // Unified modal for create/edit form
  const [showDniIsPlatformUserAlert, setShowDniIsPlatformUserAlert] = useState(false);
  const [existingPlatformUserRoles, setExistingPlatformUserRoles] = useState<PlatformUserRole[]>([]); // For the alert

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
          uid: data.uid || docSnap.id, 
          dni: data.dni || "N/A",
          name: data.name || "Nombre no disponible",
          email: data.email,
          roles: Array.isArray(data.roles) ? data.roles : (data.role ? [data.role] : []),
          businessId: data.businessId || null,
          lastLogin: data.lastLogin instanceof Timestamp 
            ? data.lastLogin.toDate().toISOString() 
            : (data.lastLogin ? parseISO(data.lastLogin as string).toISOString() : new Date(Date.now() - Math.random() * 10000000000).toISOString()),
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
  
  const checkDniExists = async (dni: string, excludeUserId?: string): Promise<InitialDataForPlatformUserCreation> => {
    let result: InitialDataForPlatformUserCreation = { dni };

    const collectionsToSearch: { name: string, type: InitialDataForPlatformUserCreation['existingUserType'] }[] = [
        { name: "platformUsers", type: "PlatformUser"},
        { name: "socioVipMembers", type: "SocioVipMember"},
        { name: "qrClients", type: "QrClient"}
    ];

    for (const coll of collectionsToSearch) {
        const q = query(collection(db, coll.name), where("dni", "==", dni));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const docData = snapshot.docs[0].data();
            const docId = snapshot.docs[0].id;

            if (coll.name === "platformUsers") {
                 // If editing, and DNI belongs to the user being edited, it's not a "conflict" for creating this user
                if (excludeUserId && docId === excludeUserId) {
                    continue; // Check next collection or return as if DNI is new for PlatformUser context
                }
                result.existingUserIsPlatformUser = true;
                result.existingPlatformUser = { id: docId, ...docData } as PlatformUser;
                result.existingPlatformUserRoles = (docData as PlatformUser).roles || [];
                result.name = docData.name;
                result.email = docData.email;
                // If it's a PlatformUser, we stop here as it's the highest priority for this check
                return result; 
            } else if (!result.existingUserIsPlatformUser) { // Only populate if not already found as PlatformUser
                result.existingUserType = coll.type;
                result.name = docData.name || (docData.surname ? `${docData.name} ${docData.surname}` : undefined);
                result.email = docData.email; // SocioVIP might have email, QrClient might not
                // Keep searching in case they are also a PlatformUser (higher precedence)
            }
        }
    }
    return result;
  };

  const handleOpenCreateUserFlow = () => {
    setEditingUser(null);
    setVerifiedDniResult(null); 
    dniEntryForm.reset({ dni: "" }); 
    setShowDniIsPlatformUserAlert(false); 
    setDniForVerification(""); 
    setShowDniEntryModal(true); 
  };

  const handleDniVerificationSubmit = async (values: DniEntryValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true); 
    setDniForVerification(values.dni); 
    
    const result = await checkDniExists(values.dni);
    setIsSubmitting(false);
    
    if (result?.existingUserIsPlatformUser && result?.existingPlatformUser) {
      setExistingPlatformUserRoles(result.existingPlatformUserRoles || []);
      setVerifiedDniResult(result); // Store the full result for the alert
      setShowDniIsPlatformUserAlert(true); 
      setShowDniEntryModal(false); 
    } else {
      setVerifiedDniResult(result || { dni: values.dni }); 
      setShowDniEntryModal(false); 
      setShowCreateEditModal(true); 
    }
  };
  
  const handleEditExistingPlatformUser = () => {
      setShowDniIsPlatformUserAlert(false); 
      if (verifiedDniResult?.existingPlatformUser) {
          setEditingUser(verifiedDniResult.existingPlatformUser);
          // verifiedDniResult is already set and can be passed to form
          setShowCreateEditModal(true); 
      }
  };

  const handleCreateOrEditUser = async (data: PlatformUserFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (editingUser) { // Editing existing user
        if (data.dni !== editingUser.dni) { // DNI was changed
          const dniCheckResult = await checkDniExists(data.dni, editingUser.id);
          if (dniCheckResult?.existingUserIsPlatformUser) {
             toast({ title: "Error de DNI", description: `El DNI ${data.dni} ya está registrado para otro usuario de plataforma.`, variant: "destructive" });
             setIsSubmitting(false);
             return;
          }
        }
        const userRef = doc(db, "platformUsers", editingUser.id);
        const userPayload: Partial<PlatformUser> = {
          dni: data.dni,
          name: data.name,
          email: data.email, // Should be disabled in form if already set
          roles: data.roles,
          businessId: data.roles.some(r => ROLES_REQUIRING_BUSINESS_ID.includes(r)) ? data.businessId : null,
          // uid is not updated here, it's immutable once linked to Auth
        };
        await updateDoc(userRef, userPayload);
        toast({ title: "Usuario Actualizado", description: `El usuario "${data.name}" ha sido actualizado.` });
      } else { // Create new user
        if (!verifiedDniResult?.dni) { // Should not happen if DNI entry is mandatory
          toast({ title: "Error Interno", description: "No se pudo obtener el DNI verificado.", variant: "destructive"});
          setIsSubmitting(false);
          return;
        }
        // The checkDniExists was already performed before opening the main form.
        // If existingUserIsPlatformUser was true, the alert should have prevented this.
        // This is a final safeguard.
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
          lastLogin: serverTimestamp(), 
          businessId: data.roles.some(r => ROLES_REQUIRING_BUSINESS_ID.includes(r)) ? data.businessId : null,
        };
        
        // The 'uid' field will be empty. It needs to be manually updated in Firestore
        // after the Firebase Auth account is created and its UID is known.
        const docRef = await addDoc(collection(db, "platformUsers"), newUserPayload);
        toast({ 
          title: "Perfil de Usuario Creado en Firestore", 
          description: `El perfil para "${data.name}" (DNI: ${newUserPayload.dni}) ha sido creado con ID de Documento: ${docRef.id}. IMPORTANTE: Este perfil necesita ser vinculado a una cuenta de Firebase Authentication con un UID para que el usuario pueda iniciar sesión. Actualiza el campo 'uid' en este documento Firestore con el UID de Firebase Auth.`,
          duration: 15000,
        });
      }
      
      setShowCreateEditModal(false);
      setEditingUser(null);
      setVerifiedDniResult(null); 
      fetchPlatformUsers(); 

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
                  <TableHead>DNI/CE <span className="text-destructive">*</span></TableHead>
                  <TableHead className="hidden md:table-cell">Email <span className="text-destructive">*</span></TableHead>
                  <TableHead>Roles <span className="text-destructive">*</span></TableHead>
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
                            setVerifiedDniResult(null); 
                            setShowCreateEditModal(true);
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
      
      <UIDialog open={showDniEntryModal} onOpenChange={(isOpen) => {
          if (!isOpen) {
            dniEntryForm.reset();
            setDniForVerification(""); 
          }
          setShowDniEntryModal(isOpen);
      }}>
        <UIDialogContent className="sm:max-w-md">
          <UIDialogHeader>
            <UIDialogTitle>Paso 1: Verificar DNI/CE</UIDialogTitle>
            <UIDialogDescription>
              Ingresa el DNI o Carnet de Extranjería del nuevo usuario para verificar si ya existe en la plataforma.
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
                      <Input placeholder="Número de documento" {...field} autoFocus disabled={isSubmitting}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <UIDialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setShowDniEntryModal(false)} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
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
                : (verifiedDniResult?.existingUserIsPlatformUser 
                    ? "Este DNI ya está registrado como Usuario de Plataforma y no puede ser creado nuevamente. Puede editar el perfil existente desde la lista principal si tiene los permisos."
                    : "Completa los detalles para el perfil del usuario en Firestore. La cuenta de Firebase Authentication debe crearse/vincularse por separado (anotar el UID de Auth).")
              }
            </UIDialogDescription>
          </UIDialogHeader>
          <PlatformUserForm 
            user={editingUser || undefined} 
            initialDataForCreation={!editingUser && verifiedDniResult ? verifiedDniResult : undefined}
            businesses={availableBusinesses}
            onSubmit={handleCreateOrEditUser}
            onCancel={() => { setShowCreateEditModal(false); setEditingUser(null); setVerifiedDniResult(null);}}
            isSubmitting={isSubmitting}
            disableSubmitOverride={!editingUser && !!verifiedDniResult?.existingUserIsPlatformUser}
          />
        </UIDialogContent>
      </UIDialog>

      <AlertDialog open={showDniIsPlatformUserAlert} onOpenChange={setShowDniIsPlatformUserAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
                <AlertTriangle className="text-yellow-500 mr-2 h-6 w-6"/> DNI ya Registrado como Usuario de Plataforma
            </AlertDialogTitle>
            <AlertDialogDescription>
              El DNI <span className="font-semibold">{dniForVerification}</span> ya está registrado en la Plataforma con el/los rol(es) de: <span className="font-semibold">{(existingPlatformUserRoles || []).map(r => PLATFORM_USER_ROLE_TRANSLATIONS[r] || r).join(', ')}</span>.
              <br/><br/>
              ¿Desea editar este perfil de usuario existente? (Se cerrará este flujo de creación).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
                setShowDniIsPlatformUserAlert(false); 
                setVerifiedDniResult(null); // Clear verification result if cancelling creation
                setDniForVerification("");
            }}>No, Cancelar Creación</AlertDialogCancel>
            <AlertDialogAction onClick={handleEditExistingPlatformUser} className="bg-primary hover:bg-primary/90">
                Sí, Editar Perfil Existente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
