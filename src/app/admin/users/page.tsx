
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage as FormMessageHook } from "@/components/ui/form";
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
  const [showCreateEditModal, setShowCreateEditModal] = useState(false); 
  
  const [showDniIsPlatformUserAlert, setShowDniIsPlatformUserAlert] = useState(false);
  const [existingPlatformUserRolesForAlert, setExistingPlatformUserRolesForAlert] = useState<PlatformUserRole[]>([]);


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
          // Include other fields from Business type as needed for display or logic
          ruc: data.ruc,
          razonSocial: data.razonSocial,
          department: data.department,
          province: data.province,
          district: data.district,
          address: data.address,
          managerName: data.managerName,
          managerDni: data.managerDni,
          businessType: data.businessType,
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
        let rolesArray: PlatformUserRole[] = [];
        if (data.roles && Array.isArray(data.roles)) {
            rolesArray = data.roles as PlatformUserRole[];
        } else if (data.role && typeof data.role === 'string') { // Fallback for older data structure
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
  
  const checkDniExists = async (dni: string): Promise<InitialDataForPlatformUserCreation> => {
    let result: InitialDataForPlatformUserCreation = { dni };

    // Check platformUsers first
    const platformUsersQuery = query(collection(db, "platformUsers"), where("dni", "==", dni));
    const platformUsersSnapshot = await getDocs(platformUsersQuery);
    if (!platformUsersSnapshot.empty) {
        const docData = platformUsersSnapshot.docs[0].data() as PlatformUser;
        result.userType = 'PlatformUser';
        result.existingPlatformUser = { id: platformUsersSnapshot.docs[0].id, ...docData } as PlatformUser;
        result.existingPlatformUserRoles = docData.roles || [];
        result.name = docData.name;
        result.email = docData.email;
        return result; // DNI is already a PlatformUser, stop here for this flow.
    }

    // Check socioVipMembers
    const socioVipQuery = query(collection(db, "socioVipMembers"), where("dni", "==", dni));
    const socioVipSnapshot = await getDocs(socioVipQuery);
    if (!socioVipSnapshot.empty) {
      const data = socioVipSnapshot.docs[0].data() as SocioVipMember;
      result.userType = 'SocioVipMember';
      result.name = `${data.name} ${data.surname}`;
      result.email = data.email;
      // No need to store socioVipMemberData explicitly here, type is enough for form prefill logic
      return result;
    }

    // Check qrClients
    const qrClientQuery = query(collection(db, "qrClients"), where("dni", "==", dni));
    const qrClientSnapshot = await getDocs(qrClientQuery);
    if (!qrClientSnapshot.empty) {
      const data = qrClientSnapshot.docs[0].data() as QrClient;
      result.userType = 'QrClient';
      result.name = `${data.name} ${data.surname}`;
      // QrClients typically don't have an email, so result.email might remain undefined
      return result;
    }
    
    return result; // DNI not found in any relevant collection
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
    
    setVerifiedDniResult(result); // Store the full result

    if (result?.userType === 'PlatformUser' && result?.existingPlatformUser) {
      setExistingPlatformUserRolesForAlert(result.existingPlatformUserRoles || []);
      setShowDniIsPlatformUserAlert(true); 
      setShowDniEntryModal(false); 
    } else {
      // DNI is new, or QrClient, or SocioVipMember (but not PlatformUser)
      setEditingUser(null); // Ensure we are in creation mode
      setShowDniEntryModal(false); 
      setShowCreateEditModal(true); 
    }
  };
  
  const handleEditExistingPlatformUser = () => {
      setShowDniIsPlatformUserAlert(false); 
      if (verifiedDniResult?.userType === 'PlatformUser' && verifiedDniResult?.existingPlatformUser) {
          setEditingUser(verifiedDniResult.existingPlatformUser);
          setShowCreateEditModal(true); 
      }
  };

  const handleCreateOrEditUser = async (data: PlatformUserFormData, isEditingUser: boolean) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (isEditingUser && editingUser) { 
        const userRef = doc(db, "platformUsers", editingUser.id);
        const userPayload: Partial<PlatformUser> = {
          // DNI is not changed during edit in this flow
          name: data.name,
          // Email is not changed during edit if already set
          roles: data.roles,
          businessId: data.roles.some(r => ROLES_REQUIRING_BUSINESS_ID.includes(r)) ? data.businessId : null,
        };
        await updateDoc(userRef, userPayload);
        toast({ title: "Usuario Actualizado", description: `El usuario "${data.name}" ha sido actualizado.` });
      } else { // Create new user
        // DNI uniqueness check happened before this form, but safeguard here if needed
        if (!verifiedDniResult || !verifiedDniResult.dni) {
            toast({ title: "Error Interno", description: "No se pudo obtener el DNI verificado para la creación.", variant: "destructive"});
            setIsSubmitting(false);
            return;
        }
         // Final check to ensure we are not trying to re-create a PlatformUser
        if (verifiedDniResult.userType === 'PlatformUser') {
             toast({ title: "Error", description: `El DNI ${verifiedDniResult.dni} ya está registrado como Usuario de Plataforma. No se puede crear un nuevo perfil.`, variant: "destructive" });
             setIsSubmitting(false);
             return;
        }

        const newUserPayload: Omit<PlatformUser, 'id' | 'lastLogin'> & { lastLogin: any } = {
          uid: "", // UID from Firebase Auth to be filled in later
          dni: verifiedDniResult.dni,
          name: data.name,
          email: data.email,
          roles: data.roles, 
          lastLogin: serverTimestamp(), 
          businessId: data.roles.some(r => ROLES_REQUIRING_BUSINESS_ID.includes(r)) ? data.businessId : null,
        };
        
        const docRef = await addDoc(collection(db, "platformUsers"), newUserPayload);
        toast({ 
          title: "Perfil de Usuario Creado en Firestore", 
          description: `El perfil para "${data.name}" (DNI: ${newUserPayload.dni}) ha sido creado con ID de Documento: ${docRef.id}. IMPORTANTE: Vincula este perfil a una cuenta de Firebase Auth con el UID correspondiente.`,
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
    
    const rolesThatRequireBusiness = user.roles.filter(role => ROLES_REQUIRING_BUSINESS_ID.includes(role));

    if (rolesThatRequireBusiness.length > 0 && !user.businessId) {
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
                            setVerifiedDniResult(null); // Clear DNI verification result for edit mode
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
              Ingresa el DNI o Carnet de Extranjería del nuevo usuario para verificar si ya existe.
            </UIDialogDescription>
          </UIDialogHeader>
          <Form {...dniEntryForm}>
            <form onSubmit={dniEntryForm.handleSubmit((data) => handleDniVerificationSubmit(data.dni))} className="space-y-4 py-2">
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
            <DialogTitle>
              {editingUser 
                ? `Editar Usuario: ${editingUser.name}` 
                : "Paso 2: Completar Perfil de Usuario de Plataforma"
              }
            </DialogTitle>
            <UIDialogDescription>
              {editingUser 
                ? "Actualiza los detalles del perfil del usuario." 
                : (verifiedDniResult?.userType === 'PlatformUser'
                    ? "Este DNI ya está registrado como Usuario de Plataforma. No se puede crear un nuevo perfil aquí. Edite desde la lista principal si tiene los permisos."
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
            disableSubmitOverride={!editingUser && !!(verifiedDniResult?.userType === 'PlatformUser')}
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
              El DNI <span className="font-semibold">{dniForVerification}</span> ya está registrado en la Plataforma con el/los rol(es) de: <span className="font-semibold">{(existingPlatformUserRolesForAlert || []).map(r => PLATFORM_USER_ROLE_TRANSLATIONS[r] || r).join(', ')}</span>.
              <br/><br/>
              ¿Desea editar este perfil de usuario existente? (Se cerrará este flujo de creación).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
                setShowDniIsPlatformUserAlert(false); 
                setVerifiedDniResult(null); 
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
