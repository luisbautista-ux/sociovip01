
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogDescription as UIDialogDescription, DialogFooter as UIDialogFooter } from "@/components/ui/dialog";
import { Users, PlusCircle, Download, Search, Edit, Trash2, Loader2, AlertTriangle, Check, ChevronsUpDown, MoreVertical, Info } from "lucide-react";
import type { PlatformUser, PlatformUserFormData, Business, QrClient, SocioVipMember, PlatformUserRole, InitialDataForPlatformUserCreation } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { PlatformUserForm } from "@/components/admin/forms/PlatformUserForm";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as ShadcnAlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as UIAlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage as FormMessageHook } from "@/components/ui/form";
import { PLATFORM_USER_ROLE_TRANSLATIONS, ROLES_REQUIRING_BUSINESS_ID } from "@/lib/constants";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn, anyToDate, sanitizeObjectForFirestore } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext"; 
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, Timestamp, serverTimestamp, query, where, writeBatch, getDoc, setDoc, DocumentData } from "firebase/firestore";

const DniEntrySchema = z.object({
  docType: z.enum(['dni', 'ce'], { required_error: "Debes seleccionar un tipo de documento." }),
  docNumber: z.string().min(1, "El número de documento es requerido."),
}).superRefine((data, ctx) => {
    if (data.docType === 'dni') {
        if (!/^\d{8}$/.test(data.docNumber)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "El DNI debe contener exactamente 8 dígitos numéricos.",
                path: ['docNumber'],
            });
        }
    } else if (data.docType === 'ce') {
        // This validation might need adjustment for real CE numbers
        if (!/^\d{9,12}$/.test(data.docNumber)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "El Carnet de Extranjería debe tener entre 9 y 12 dígitos.",
                path: ['docNumber'],
            });
        }
    }
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
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const { toast } = useToast();

  const [availableBusinesses, setAvailableBusinesses] = useState<Business[]>([]);
  const [businessNameMap, setBusinessNameMap] = useState<Map<string, string>>(new Map());

  const [showDniEntryModal, setShowDniEntryModal] = useState(false);
  const [dniForVerification, setDniForVerification] = useState(""); 
  const [verifiedDniResult, setVerifiedDniResult] = useState<InitialDataForPlatformUserCreation | null>(null);
  const [showCreateEditModal, setShowCreateEditModal] = useState(false); 
  
  const [showDniIsPlatformUserAlert, setShowDniIsPlatformUserAlert] = useState(false);
  const [showUserNotFoundAlert, setShowUserNotFoundAlert] = useState(false);
  const [dniNotFound, setDniNotFound] = useState("");

  const [existingPlatformUserToEdit, setExistingPlatformUserToEdit] = useState<PlatformUser | null>(null);
  const [existingPlatformUserRoles, setExistingPlatformUserRoles] = useState<PlatformUserRole[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);


  const dniEntryForm = useForm<DniEntryValues>({
    resolver: zodResolver(DniEntrySchema),
    defaultValues: { docType: 'dni', docNumber: "" },
  });

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch Businesses
      const businessesQuerySnapshot = await getDocs(collection(db, "businesses"));
      const fetchedBusinesses: Business[] = [];
      const nameMap = new Map<string, string>();
      businessesQuerySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        const business: Business = {
          id: docSnap.id,
          name: data.name,
          contactEmail: "", 
          joinDate: "",
        };
        fetchedBusinesses.push(business);
        nameMap.set(docSnap.id, data.name || `ID: ${docSnap.id.substring(0,6)}...`);
      });
      setAvailableBusinesses(fetchedBusinesses);
      setBusinessNameMap(nameMap);

      // Fetch Users
      const usersQuerySnapshot = await getDocs(collection(db, "platformUsers"));
      const fetchedUsers: PlatformUser[] = usersQuerySnapshot.docs.map(docSnap => {
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
          businessIds: data.businessIds || [],
          lastLogin: data.lastLogin, // Keep original data type
        };
      });
      setPlatformUsers(fetchedUsers);

    } catch (error: any) {
      console.error("Failed to fetch initial data:", error);
      toast({
        title: "Error al Cargar Datos",
        description: "No se pudieron obtener los datos de usuarios o negocios.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);


  const filteredUsers = platformUsers.filter(user =>
    (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.dni?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );
  
  const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredUsers.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredUsers, currentPage, rowsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, rowsPerPage]);

  const handleExport = () => {
    if (filteredUsers.length === 0) {
      toast({ title: "Sin Datos", description: "No hay usuarios para exportar.", variant: "destructive" });
      return;
    }
    const headers = ["ID Documento", "UID Auth", "DNI/CE", "Nombre", "Email", "Roles", "Negocio Asociado", "Último Acceso"];
    const rows = filteredUsers.map(user => {
      const lastLoginDate = anyToDate(user.lastLogin);
      return [
        user.id,
        user.uid || "N/A",
        `'${user.dni}`,
        user.name,
        user.email,
        user.roles.map(r => PLATFORM_USER_ROLE_TRANSLATIONS[r as PlatformUserRole] || r).join(', ') || "N/A",
        user.businessId ? (businessNameMap.get(user.businessId) || `ID: ${user.businessId}`) : "N/A",
        lastLoginDate ? format(lastLoginDate, "dd/MM/yyyy HH:mm", { locale: es }) : "N/A"
      ].map(cell => `"${String(cell || '').replace(/"/g, '""')}"`);
    });
    
    const csvContent = [
      headers.map(h => `"${h}"`).join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\n');
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
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
    setEditingUser(null);
    setVerifiedDniResult(null); 
    dniEntryForm.reset({ docType: 'dni', docNumber: "" }); 
    setShowDniIsPlatformUserAlert(false); 
    setExistingPlatformUserToEdit(null);
    setExistingPlatformUserRoles([]);
    setDniForVerification(""); 
    setShowDniEntryModal(true); 
    setShowUserNotFoundAlert(false);
    setDniNotFound("");
  };

  const handleDniVerificationSubmit = async (values: DniEntryValues) => {
    if (isSubmitting) return;
    
    const docNumberCleaned = values.docNumber.trim();
    if (!docNumberCleaned) {
        toast({ title: "Número de Documento Requerido", description: "Por favor, ingresa un número de documento válido.", variant: "destructive"});
        return;
    }

    setIsSubmitting(true); 
    setDniForVerification(docNumberCleaned); 
    
    try {
        const dbCheckResult = await checkDniExists(docNumberCleaned);
        
        if (dbCheckResult.exists && dbCheckResult.userType === 'PlatformUser' && dbCheckResult.platformUserData) {
            setExistingPlatformUserToEdit(dbCheckResult.platformUserData);
            setExistingPlatformUserRoles(dbCheckResult.platformUserRoles || []);
            setShowDniIsPlatformUserAlert(true); 
            setShowDniEntryModal(false);
        } else {
            setDniNotFound(docNumberCleaned);
            setShowUserNotFoundAlert(true);
            setShowDniEntryModal(false);
        }
    } catch (error: any) {
        toast({
            title: "Error de Verificación",
            description: `Hubo un problema al buscar el documento: ${error.message}`,
            variant: "destructive"
        });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleEditExistingPlatformUser = () => {
      setShowDniIsPlatformUserAlert(false); 
      if (existingPlatformUserToEdit) {
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
          businessId: data.businessId,
          businessIds: data.businessIds,
          dni: data.dni,
        };
        await updateDoc(userRef, sanitizeObjectForFirestore(userPayload as DocumentData));
        toast({ title: "Usuario Actualizado", description: `El perfil de "${data.name}" ha sido actualizado.` });
      } else {
        // --- CREATION LOGIC ---
        const creationPayload = {
          email: data.email,
          password: data.password,
          displayName: data.name,
          firestoreData: {
            dni: data.dni,
            name: data.name,
            email: data.email,
            roles: data.roles,
            businessId: data.businessId,
            businessIds: data.businessIds,
          }
        };

        const idToken = await currentUser?.getIdToken();
        if (!idToken) {
          throw new Error("No autenticado. Token no proporcionado.");
        }

        const response = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}` // Pass token in header
          },
          body: JSON.stringify(creationPayload),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Ocurrió un error desconocido al crear el usuario.');
        }

        toast({
          title: "Usuario Creado Exitosamente",
          description: `Se creó el usuario "${data.name}" con UID: ${result.uid || result.firestoreId}.`,
        });
      }
      
      setShowCreateEditModal(false);
      setEditingUser(null);
      setVerifiedDniResult(null);
      fetchInitialData();

    } catch (error: any) {
      console.error("Failed to create/update user:", error);
      toast({ 
        title: "Error al Crear Usuario", 
        description: error.message, 
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userToDelete: PlatformUser) => {
    if (isSubmitting) return;

    if (currentUser?.uid === userToDelete.uid) {
        toast({ title: "Acción no permitida", description: "No puedes eliminar tu propia cuenta.", variant: "destructive" });
        return;
    }
    
    setIsSubmitting(true);
    
    try {
      const idToken = await currentUser?.getIdToken();
      if (!idToken) {
        throw new Error("No autenticado. Token no proporcionado.");
      }

      const response = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ uidToDelete: userToDelete.uid })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error al eliminar el usuario desde el servidor.');
      }
      
      toast({ 
        title: "Usuario Eliminado Exitosamente", 
        description: `El usuario "${userToDelete.name}" ha sido eliminado de la plataforma.`,
        variant: "destructive"
      });
      fetchInitialData(); 
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      toast({ 
        title: "Error al Eliminar", 
        description: `No se pudo eliminar el usuario. ${error.message}`, 
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const watchedDocType = dniEntryForm.watch('docType');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        {/* ✅ Título con ícono al lado izquierdo — CORREGIDO */}
        <h1 className="text-3xl font-bold text-gradient flex items-center gap-2 mb-6">
          <Users className="h-8 w-8 text-primary !block" />
          Usuarios
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
           <div className="text-sm text-muted-foreground pt-4">
            Mostrando <span className="font-semibold text-foreground">{paginatedUsers.length}</span> de <span className="font-semibold text-foreground">{filteredUsers.length}</span> usuarios totales.
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
            <>
              {/* Mobile View */}
              <div className="md:hidden space-y-4">
                {paginatedUsers.map(user => (
                   <Card key={user.id} className="overflow-hidden">
                      <CardHeader className="p-4">
                        <CardTitle>{user.name}</CardTitle>
                        <CardDescription>{user.email}</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">DNI/CE</span>
                            <span className="font-semibold">{user.dni}</span>
                        </div>
                        <div className="flex justify-between items-start">
                            <span className="text-muted-foreground">Roles</span>
                            <div className="flex flex-wrap gap-1 justify-end">
                                {user.roles && user.roles.map(role => (
                                    <Badge key={role} variant={role === 'superadmin' ? 'default' : (ROLES_REQUIRING_BUSINESS_ID.includes(role as PlatformUserRole) || role === 'promoter' ? 'secondary' : 'outline')} className="text-xs">
                                        {PLATFORM_USER_ROLE_TRANSLATIONS[role as PlatformUserRole] || role}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                      </CardContent>
                      <CardFooter className="p-2 bg-muted/50">
                          <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="w-full justify-center">
                                      Acciones <MoreVertical className="ml-2 h-4 w-4"/>
                                  </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onClick={() => { setEditingUser(user); setShowCreateEditModal(true); }} disabled={isSubmitting}>
                                  <Edit className="h-4 w-4 mr-2" /> Editar Usuario
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10" disabled={currentUser?.uid === user.uid}>
                                      <Trash2 className="h-4 w-4 mr-2" /> Eliminar Usuario
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <UIAlertDialogTitle>¿Confirmar eliminación?</UIAlertDialogTitle>
                                      <ShadcnAlertDialogDescription>Eliminarás a "{user.name}" de forma permanente (perfil y cuenta de acceso).</ShadcnAlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteUser(user)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuContent>
                          </DropdownMenu>
                      </CardFooter>
                   </Card>
                ))}
              </div>

              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
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
                    {paginatedUsers.length > 0 ? (
                      paginatedUsers.map((user, index) => {
                        const lastLoginDate = anyToDate(user.lastLogin);
                        const getBusinessDisplay = () => {
                          if (user.roles.includes('promoter')) {
                            if (user.businessIds && user.businessIds.length > 0) {
                              return "Múltiples";
                            }
                            return "N/A";
                          }
                          if (user.businessId) {
                            return businessNameMap.get(user.businessId) || `ID: ${user.businessId.substring(0, 6)}...`;
                          }
                          return "N/A";
                        };

                        return (
                        <TableRow key={user.id}>
                          <TableCell className="text-muted-foreground">{((currentPage - 1) * rowsPerPage) + index + 1}</TableCell>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.dni}</TableCell>
                          <TableCell className="hidden md:table-cell">{user.email}</TableCell>
                          <TableCell>
                            {user.roles && user.roles.map(role => (
                                <Badge key={role} variant={role === 'superadmin' ? 'default' : (ROLES_REQUIRING_BUSINESS_ID.includes(role as PlatformUserRole) || role === 'promoter' ? 'secondary' : 'outline')} className="mr-1 mb-1 text-xs">
                                    {PLATFORM_USER_ROLE_TRANSLATIONS[role as PlatformUserRole] || role}
                                </Badge>
                            ))}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">{getBusinessDisplay()}</TableCell>
                          <TableCell className="hidden xl:table-cell">{lastLoginDate ? format(lastLoginDate, "P p", { locale: es }) : "N/A"}</TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => {
                                setEditingUser(user);
                                setShowCreateEditModal(true);
                            }} disabled={isSubmitting}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Editar</span>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={isSubmitting || currentUser?.uid === user.uid}>
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Eliminar</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <UIAlertDialogTitle>¿Estás seguro?</UIAlertDialogTitle>
                                  <ShadcnAlertDialogDescription>
                                    Esta acción no se puede deshacer. Esto eliminará permanentemente al usuario
                                    <span className="font-semibold"> {user.name}</span> (perfil y cuenta de acceso).
                                  </ShadcnAlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteUser(user)}
                                    className="bg-destructive hover:bg-destructive/90"
                                    disabled={isSubmitting}
                                  >
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Eliminar Usuario
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      )})
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center h-24">No se encontraron usuarios con los filtros aplicados.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
        {totalPages > 1 && (
            <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t">
            <div className="flex items-center space-x-2 text-sm">
                <Label htmlFor="rows-per-page">Filas por página:</Label>
                <Select
                value={`${rowsPerPage}`}
                onValueChange={(value) => setRowsPerPage(Number(value))}
                >
                <SelectTrigger id="rows-per-page" className="h-8 w-[70px]">
                    <SelectValue placeholder={rowsPerPage} />
                </SelectTrigger>
                <SelectContent>
                    {[10, 25, 50, 100].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
            <div className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
            </div>
            <div className="flex items-center space-x-2">
                <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                >
                Anterior
                </Button>
                <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                >
                Siguiente
                </Button>
            </div>
            </CardFooter>
        )}
      </Card>
      
      <UIDialog open={showDniEntryModal} onOpenChange={setShowDniEntryModal}>
        <UIDialogContent className="sm:max-w-md">
          <UIDialogHeader>
            <UIDialogTitle>Paso 1: Verificar Documento</UIDialogTitle>
            <UIDialogDescription>
              Selecciona el tipo de documento e ingresa el número para verificar si ya existe.
            </UIDialogDescription>
          </UIDialogHeader>
          <Form {...dniEntryForm}>
            <form onSubmit={dniEntryForm.handleSubmit(handleDniVerificationSubmit)} className="space-y-4 py-2">
              <FormField
                control={dniEntryForm.control}
                name="docType"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Tipo de Documento</FormLabel>
                    <FormControl>
                        <RadioGroup
                            onValueChange={(value) => {
                                field.onChange(value);
                                dniEntryForm.setValue('docNumber', ''); // Reset docNumber on type change
                                dniEntryForm.clearErrors('docNumber');
                            }}
                            defaultValue={field.value}
                            className="grid grid-cols-2 gap-2"
                        >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                                <Label
                                    htmlFor="docType-dni"
                                    className={cn(
                                        "w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer",
                                        field.value === 'dni' && "bg-primary text-primary-foreground border-primary"
                                    )}
                                >
                                    <FormControl>
                                        <RadioGroupItem value="dni" id="docType-dni" className="sr-only" />
                                    </FormControl>
                                    DNI
                                </Label>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                                 <Label
                                    htmlFor="docType-ce"
                                    className={cn(
                                        "w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer",
                                        field.value === 'ce' && "bg-primary text-primary-foreground border-primary"
                                    )}
                                >
                                    <FormControl>
                                        <RadioGroupItem value="ce" id="docType-ce" className="sr-only" />
                                    </FormControl>
                                    Carnet de Extranjería
                                </Label>
                            </FormItem>
                        </RadioGroup>
                    </FormControl>
                    <FormMessageHook />
                  </FormItem>
                )}
              />
              <FormField
                control={dniEntryForm.control}
                name="docNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Documento <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={watchedDocType === 'dni' ? "8 dígitos numéricos" : "9-12 dígitos numéricos"} 
                        {...field} 
                        maxLength={watchedDocType === 'dni' ? 8 : 12}
                        onChange={(e) => {
                            const numericValue = e.target.value.replace(/[^0-9]/g, '');
                            field.onChange(numericValue);
                        }}
                        autoFocus 
                        disabled={isSubmitting}
                      />
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
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verificar"}
                </Button>
              </UIDialogFooter>
            </form>
          </Form>
        </UIDialogContent>
      </UIDialog>

       <UIDialog open={showCreateEditModal} onOpenChange={setShowCreateEditModal}>
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
          { isLoading ? (
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
                <AlertTriangle className="text-yellow-500 mr-2 h-6 w-6"/> Documento ya Registrado como Usuario de Plataforma
            </UIAlertDialogTitle>
            <ShadcnAlertDialogDescription>
              El documento <span className="font-semibold">{dniForVerification}</span> ya está registrado en la Plataforma con el/los rol(es) de: <span className="font-semibold">{(existingPlatformUserRoles || []).map(r => PLATFORM_USER_ROLE_TRANSLATIONS[r as PlatformUserRole] || r).join(', ')}</span>.
              <br/><br/>
              ¿Desea editar este perfil de usuario existente?
            </ShadcnAlertDialogDescription>
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

      <AlertDialog open={showUserNotFoundAlert} onOpenChange={setShowUserNotFoundAlert}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <UIAlertDialogTitle className="flex items-center">
                    <Info className="h-6 w-6 mr-2 text-blue-500"/> Usuario no Registrado
                </UIAlertDialogTitle>
                <ShadcnAlertDialogDescription className="pt-4 space-y-3">
                    <p>El documento <strong>{dniNotFound}</strong> no corresponde a un usuario con una cuenta en la plataforma.</p>
                    <p>Para asignarle un rol de plataforma (admin, staff, etc.), el usuario primero debe tener una cuenta personal en SocioVIP.</p>
                    <div className="bg-muted p-3 rounded-md text-center">
                        <p className="text-sm font-semibold">Indícale al usuario que se registre en:</p>
                        <a href="/signup" target="_blank" className="text-primary font-bold underline">sociovip.app/signup</a>
                        <p className="text-xs text-muted-foreground mt-1">Una vez registrado, podrás buscar su DNI aquí para asignarle un rol.</p>
                    </div>
                </ShadcnAlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogAction onClick={() => setShowUserNotFoundAlert(false)} className="bg-primary hover:bg-primary/90">
                    Entendido
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    </div>
  );
}

    

    

    

    