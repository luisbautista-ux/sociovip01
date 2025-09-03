
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogDescription as UIDialogDescription, DialogFooter } from "@/components/ui/dialog"; 
import { Users, PlusCircle, Search, Edit, Trash2, Loader2, AlertTriangle } from "lucide-react";
import type { PlatformUser, PlatformUserFormData, QrClient, SocioVipMember, PlatformUserRole, InitialDataForPlatformUserCreation } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { PlatformUserForm } from "@/components/admin/forms/PlatformUserForm"; 
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter as ShadcnAlertDialogFooter, AlertDialogHeader, AlertDialogTitle as UIAlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage as FormMessageHook } from "@/components/ui/form";
import { PLATFORM_USER_ROLE_TRANSLATIONS } from "@/lib/constants";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, deleteDoc, query, where, updateDoc } from "firebase/firestore";

const DniEntrySchema = z.object({
  docType: z.enum(['dni', 'ce'], { required_error: "Debes seleccionar un tipo de documento." }),
  docNumber: z.string().min(1, "El número de documento es requerido."),
}).superRefine((data, ctx) => {
    if (data.docType === 'dni') {
        if (!/^\d{8}$/.test(data.docNumber)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El DNI debe contener exactamente 8 dígitos numéricos.", path: ['docNumber'] });
        }
    } else if (data.docType === 'ce') {
        if (!/^\d{10,20}$/.test(data.docNumber)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El Carnet de Extranjería debe tener entre 10 y 20 dígitos numéricos.", path: ['docNumber'] });
        }
    }
});
type DniEntryValues = z.infer<typeof DniEntrySchema>;

interface CheckDniResult {
  exists: boolean;
  userType?: 'PlatformUser' | 'SocioVipMember' | 'QrClient';
  platformUserData?: PlatformUser;
  socioVipData?: SocioVipMember;
  qrClientData?: QrClient;
}

export default function BusinessStaffPage() {
  const { userProfile, currentUser } = useAuth();
  const currentBusinessId = userProfile?.businessId;
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [staffMembers, setStaffMembers] = useState<PlatformUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [showDniEntryModal, setShowDniEntryModal] = useState(false);
  const [dniForVerification, setDniForVerification] = useState(""); 
  const [verifiedDniResult, setVerifiedDniResult] = useState<InitialDataForPlatformUserCreation | null>(null);
  const [showCreateEditModal, setShowCreateEditModal] = useState(false); 
  
  const [showDniIsPlatformUserAlert, setShowDniIsPlatformUserAlert] = useState(false);
  const [existingPlatformUserToEdit, setExistingPlatformUserToEdit] = useState<PlatformUser | null>(null);

  const dniEntryForm = useForm<DniEntryValues>({
    resolver: zodResolver(DniEntrySchema),
    defaultValues: { docType: 'dni', docNumber: "" },
  });
  const watchedDocType = dniEntryForm.watch('docType');

  const fetchStaffMembers = useCallback(async () => {
    if (!currentBusinessId) {
      setStaffMembers([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const staffQuery = query(collection(db, "platformUsers"), where("businessId", "==", currentBusinessId), where("roles", "array-contains-any", ["staff", "host", "business_admin"]));
      const querySnapshot = await getDocs(staffQuery);
      const fetchedStaff: PlatformUser[] = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, uid: docSnap.id, ...docSnap.data() } as PlatformUser));
      setStaffMembers(fetchedStaff);
    } catch (error: any) {
      toast({ title: "Error al Cargar Personal", description: `No se pudieron obtener los datos. ${error.message}`, variant: "destructive" });
      setStaffMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentBusinessId, toast]);

  useEffect(() => {
    fetchStaffMembers();
  }, [fetchStaffMembers]);

  const filteredStaff = staffMembers.filter(user =>
    (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.dni?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );
  
  const checkDniExists = async (dniToVerify: string): Promise<CheckDniResult> => {
    let result: CheckDniResult = { exists: false };
    const collectionsToCheck: ('platformUsers' | 'socioVipMembers' | 'qrClients')[] = ['platformUsers', 'socioVipMembers', 'qrClients'];

    for (const coll of collectionsToCheck) {
        const q = query(collection(db, coll), where("dni", "==", dniToVerify));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const docData = snapshot.docs[0].data();
            const docId = snapshot.docs[0].id;
            result.exists = true;
            if (coll === 'platformUsers') {
                result.userType = 'PlatformUser';
                result.platformUserData = { id: docId, uid: docData.uid || docId, ...docData } as PlatformUser;
            } else if (coll === 'socioVipMembers') {
                result.userType = 'SocioVipMember';
                result.socioVipData = { id: docId, ...docData } as SocioVipMember;
            } else if (coll === 'qrClients') {
                result.userType = 'QrClient';
                result.qrClientData = { id: docId, ...docData } as QrClient;
            }
            return result;
        }
    }
    return result; 
  };
  
  const handleOpenCreateUserFlow = () => {
    setEditingUser(null);
    setVerifiedDniResult(null); 
    dniEntryForm.reset({ docType: 'dni', docNumber: "" }); 
    setShowDniIsPlatformUserAlert(false); 
    setExistingPlatformUserToEdit(null);
    setDniForVerification(""); 
    setShowDniEntryModal(true); 
  };
  
  const handleDniVerificationSubmit = async (values: DniEntryValues) => {
    if (isSubmitting) return;
    const docNumberCleaned = values.docNumber.trim();
    setIsSubmitting(true);
    setDniForVerification(docNumberCleaned);
    
    let fetchedNameFromApi: string | undefined = undefined;
    if (values.docType === 'dni') {
      try {
        const response = await fetch('/api/admin/consult-dni', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dni: docNumberCleaned }) });
        const data = await response.json();
        if (response.ok && data.nombreCompleto) {
          fetchedNameFromApi = data.nombreCompleto;
          toast({ title: "DNI Encontrado", description: `Nombre: ${fetchedNameFromApi}` });
        } else {
           toast({ title: "Consulta DNI", description: data.error || "No se pudo obtener el nombre para este DNI.", variant: "default" });
        }
      } catch (error) {
        toast({ title: "Error de Red", description: "No se pudo comunicar con el servicio de consulta de DNI.", variant: "destructive" });
      }
    }
    
    const result = await checkDniExists(docNumberCleaned);
    setIsSubmitting(false);
    
    let initialData: InitialDataForPlatformUserCreation = { dni: docNumberCleaned };
    if (fetchedNameFromApi) initialData.name = fetchedNameFromApi;

    if (result.exists) {
        if (result.userType === 'PlatformUser' && result.platformUserData) {
            setExistingPlatformUserToEdit(result.platformUserData);
            initialData.existingPlatformUser = result.platformUserData;
            setShowDniIsPlatformUserAlert(true); 
            setShowDniEntryModal(false); 
            return;
        } else if (result.userType === 'SocioVipMember' && result.socioVipData) {
            initialData.name = fetchedNameFromApi || `${result.socioVipData.name} ${result.socioVipData.surname}`;
            initialData.email = result.socioVipData.email;
            initialData.preExistingUserType = 'SocioVipMember';
        } else if (result.userType === 'QrClient' && result.qrClientData) {
            initialData.name = fetchedNameFromApi || `${result.qrClientData.name} ${result.qrClientData.surname}`;
            initialData.preExistingUserType = 'QrClient';
        }
    }
    
    setVerifiedDniResult(initialData);
    setEditingUser(null); 
    setShowDniEntryModal(false); 
    setShowCreateEditModal(true); 
  };
  
  const handleEditExistingUser = () => {
      setShowDniIsPlatformUserAlert(false); 
      if (existingPlatformUserToEdit) {
          setEditingUser(existingPlatformUserToEdit);
          setVerifiedDniResult(null); 
          setShowCreateEditModal(true); 
      }
      setExistingPlatformUserToEdit(null);
  };
  
  const handleCreateOrEditUser = async (data: PlatformUserFormData, isEditing: boolean) => {
    if (isSubmitting || !currentBusinessId) return;
    setIsSubmitting(true);

    const rolesAllowed: PlatformUserRole[] = ['staff', 'host'];
    const finalRoles = data.roles.filter(role => rolesAllowed.includes(role as PlatformUserRole));
    if (finalRoles.length === 0) {
        toast({ title: "Rol no válido", description: "Solo puedes asignar los roles 'Staff' o 'Anfitrión'.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    try {
      const idToken = await currentUser?.getIdToken();
      if (!idToken) {
          throw new Error("No se pudo obtener el token de autenticación del usuario actual.");
      }

      if (isEditing && editingUser) {
        const userRef = doc(db, "platformUsers", editingUser.uid);
        const userPayload: Partial<PlatformUser> = { name: data.name, roles: finalRoles };
        await updateDoc(userRef, userPayload);
        toast({ title: "Usuario Actualizado", description: `El perfil de "${data.name}" ha sido actualizado.` });
      } else {
        if (!data.email || !data.password) {
          throw new Error("El email y la contraseña son requeridos para crear un nuevo usuario.");
        }
        const creationPayload = {
          email: data.email,
          password: data.password,
          displayName: data.name,
          firestoreData: {
            dni: data.dni,
            name: data.name,
            email: data.email,
            roles: finalRoles
          }
        };

        const response = await fetch('/api/business-panel/create-staff', {
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          }, 
          body: JSON.stringify(creationPayload)
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Ocurrió un error desconocido.');
        }
        toast({ title: "Personal Creado Exitosamente", description: `Se creó el usuario "${data.name}".` });
      }
      setShowCreateEditModal(false);
      setEditingUser(null);
      setVerifiedDniResult(null);
      fetchStaffMembers();
    } catch (error: any) {
      toast({ title: "Error al Guardar", description: `Ocurrió un error. ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: PlatformUser) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "platformUsers", user.uid));
      toast({ title: "Perfil de Usuario Eliminado", description: `El perfil de "${user.name}" ha sido eliminado.`, variant: "destructive" });
      fetchStaffMembers();
    } catch (error: any) {
      toast({ title: "Error al Eliminar", description: "No se pudo eliminar el perfil del usuario.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Users className="h-8 w-8 mr-2" /> Gestión de Personal
        </h1>
        <Button onClick={handleOpenCreateUserFlow} className="bg-primary hover:bg-primary/90" disabled={isLoading || !currentBusinessId}>
          <PlusCircle className="mr-2 h-4 w-4" /> Añadir Personal
        </Button>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Mi Personal</CardTitle>
          <CardDescription>Administra los usuarios staff y anfitriones de tu negocio.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nombre, email o DNI..."
              className="pl-8 w-full sm:w-[300px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </CardHeader>
        <CardContent>
           {isLoading ? (
             <div className="flex justify-center items-center h-60"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-lg text-muted-foreground">Cargando personal...</p></div>
           ) : staffMembers.length === 0 && !searchTerm ? (
             <p className="text-center text-muted-foreground h-24 flex items-center justify-center">No hay personal registrado.</p>
           ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>DNI/CE</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">{staff.name}</TableCell>
                    <TableCell>{staff.dni}</TableCell>
                    <TableCell className="hidden md:table-cell">{staff.email}</TableCell>
                    <TableCell>
                      {staff.roles?.map(role => (
                          <Badge key={role} variant="secondary" className="mr-1 mb-1 text-xs">
                              {PLATFORM_USER_ROLE_TRANSLATIONS[role as PlatformUserRole] || role}
                          </Badge>
                      ))}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingUser(staff); setShowCreateEditModal(true); }} disabled={isSubmitting}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><UIAlertDialogTitle>¿Estás seguro?</UIAlertDialogTitle><AlertDialogDescription>Eliminarás el perfil de <span className="font-semibold">{staff.name}</span>. Esta acción no elimina su cuenta de acceso.</AlertDialogDescription></AlertDialogHeader>
                          <ShadcnAlertDialogFooter>
                            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteUser(staff)} className="bg-destructive hover:bg-destructive/90" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Eliminar Perfil"}</AlertDialogAction>
                          </ShadcnAlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <UIDialog open={showDniEntryModal} onOpenChange={setShowDniEntryModal}>
        <UIDialogContent className="sm:max-w-md">
          <UIDialogHeader><UIDialogTitle>Paso 1: Verificar Documento</UIDialogTitle><UIDialogDescription>Ingresa el documento para verificar si la persona ya existe en la plataforma.</UIDialogDescription></UIDialogHeader>
          <Form {...dniEntryForm}>
            <form onSubmit={dniEntryForm.handleSubmit(handleDniVerificationSubmit)} className="space-y-4 py-2">
              <FormField control={dniEntryForm.control} name="docType" render={({ field }) => (
                  <FormItem className="space-y-2"><FormLabel>Tipo de Documento</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-2">
                            <FormItem className="flex items-center space-x-3 space-y-0"><Label htmlFor="docType-dni-staff" className={cn("w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer", field.value === 'dni' && "bg-primary text-primary-foreground border-primary")}><FormControl><RadioGroupItem value="dni" id="docType-dni-staff" className="sr-only" /></FormControl>DNI</Label></FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0"><Label htmlFor="docType-ce-staff" className={cn("w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer", field.value === 'ce' && "bg-primary text-primary-foreground border-primary")}><FormControl><RadioGroupItem value="ce" id="docType-ce-staff" className="sr-only" /></FormControl>Carnet de Extranjería</Label></FormItem>
                  </RadioGroup></FormControl><FormMessageHook /></FormItem>
              )} />
              <FormField control={dniEntryForm.control} name="docNumber" render={({ field }) => (
                  <FormItem><FormLabel>Número de Documento <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder={watchedDocType === 'dni' ? "8 dígitos" : "10-20 dígitos"} {...field} maxLength={20} onChange={(e) => field.onChange(e.target.value.replace(/[^0-9]/g, ''))} autoFocus disabled={isSubmitting} /></FormControl><FormMessageHook /></FormItem>
              )} />
              <DialogFooter><Button type="button" variant="outline" onClick={() => setShowDniEntryModal(false)} disabled={isSubmitting}>Cancelar</Button><Button type="submit" variant="gradient" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verificar"}</Button></DialogFooter>
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
            <UIDialogTitle>{editingUser ? `Editar Usuario: ${editingUser.name}` : "Paso 2: Completar Perfil"}</UIDialogTitle>
            <UIDialogDescription>{editingUser ? "Actualiza los detalles del perfil." : "Completa los detalles para crear el usuario."}</UIDialogDescription>
          </UIDialogHeader>
          <PlatformUserForm 
            user={editingUser || undefined}
            initialDataForCreation={!editingUser ? verifiedDniResult : undefined}
            businesses={[]} // Business is fixed to current, not selectable
            onSubmit={handleCreateOrEditUser}
            onCancel={() => setShowCreateEditModal(false)}
            isSubmitting={isSubmitting}
          />
        </UIDialogContent>
      </UIDialog>

      <AlertDialog open={showDniIsPlatformUserAlert} onOpenChange={setShowDniIsPlatformUserAlert}>
        <AlertDialogContent>
          <AlertDialogHeader><UIAlertDialogTitle className="flex items-center"><AlertTriangle className="text-yellow-500 mr-2 h-6 w-6"/> Usuario ya Existente</UIAlertDialogTitle><AlertDialogDescription>El documento <span className="font-semibold">{dniForVerification}</span> ya está registrado para <span className="font-semibold">{existingPlatformUserToEdit?.name}</span>. Si no está en tu lista de personal, puede estar asignado a otro negocio. Contacta al Super Admin si necesitas reasignarlo. No puedes crear un duplicado.</AlertDialogDescription></AlertDialogHeader>
          <ShadcnAlertDialogFooter><AlertDialogCancel onClick={() => setShowDniIsPlatformUserAlert(false)}>Entendido</AlertDialogCancel></ShadcnAlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
