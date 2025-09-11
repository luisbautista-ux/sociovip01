
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogDescription as UIDialogDescription, DialogFooter } from "@/components/ui/dialog"; 
import { Users, PlusCircle, Search, Edit, Trash2, Loader2, AlertTriangle, Info, ChevronsUpDown, Check } from "lucide-react";
import type { PlatformUser, PlatformUserFormData, QrClient, SocioVipMember, PlatformUserRole, InitialDataForPlatformUserCreation, Business } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter as ShadcnAlertDialogFooter, AlertDialogHeader, AlertDialogTitle as UIAlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { PLATFORM_USER_ROLE_TRANSLATIONS, ALL_PLATFORM_USER_ROLES, ROLES_REQUIRING_BUSINESS_ID } from "@/lib/constants";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, deleteDoc, query, where, updateDoc } from "firebase/firestore";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Alert, AlertTitle } from "@/components/ui/alert";


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


const platformUserFormSchema = z.object({
  uid: z.string().optional(),
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  dni: z.string().min(7, "El DNI/CE debe tener entre 7 y 15 caracteres.").max(15),
  email: z.string().email("Debe ser un email válido."),
  password: z.string().optional(),
  roles: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "Debes seleccionar al menos un rol.",
  }),
  businessId: z.string().optional().nullable(),
  businessIds: z.array(z.string()).optional().nullable(),
});

type PlatformUserFormValues = z.infer<typeof platformUserFormSchema>;

interface PlatformUserFormProps {
  user?: PlatformUser;
  initialDataForCreation?: InitialDataForPlatformUserCreation;
  businesses: Business[];
  onSubmit: (data: PlatformUserFormData, isEditing: boolean) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  disableSubmitOverride?: boolean;
}

function PlatformUserForm({
  user,
  initialDataForCreation,
  businesses,
  onSubmit,
  onCancel,
  isSubmitting = false,
  disableSubmitOverride = false,
}: PlatformUserFormProps) {
  const { userProfile: currentUserProfile } = useAuth();
  const isSuperAdminView = currentUserProfile?.roles.includes('superadmin') || false;

  const isEditing = !!user;
  const needsPassword = !isEditing;
  
  const form = useForm<PlatformUserFormValues>({
    resolver: zodResolver(
      platformUserFormSchema.refine((data) => {
        if (needsPassword && (!data.password || data.password.length < 6)) {
          return false;
        }
        return true;
      }, {
        message: "La contraseña es requerida y debe tener al menos 6 caracteres.",
        path: ["password"],
      }).refine((data) => {
        const hasRoleRequiringBusiness = data.roles.some(role => ROLES_REQUIRING_BUSINESS_ID.includes(role as PlatformUserRole));
        if (hasRoleRequiringBusiness && !data.businessId) {
            return false;
        }
        return true;
      }, {
        message: "Se requiere un ID de negocio para los roles seleccionados.",
        path: ["businessId"],
      })
    ),
    defaultValues: {
      uid: user?.uid || undefined,
      name: user?.name || initialDataForCreation?.name || "",
      dni: user?.dni || initialDataForCreation?.dni || "",
      email: user?.email || initialDataForCreation?.email || "",
      password: "",
      roles: user?.roles || [],
      businessId: user?.businessId || null,
      businessIds: user?.businessIds || [],
    },
  });

  useEffect(() => {
    form.reset({
      uid: user?.uid || undefined,
      name: user?.name || initialDataForCreation?.name || "",
      dni: user?.dni || initialDataForCreation?.dni || "",
      email: user?.email || initialDataForCreation?.email || "",
      password: "",
      roles: user?.roles || [],
      businessId: user?.businessId || null,
      businessIds: user?.businessIds || [],
    });
  }, [user, initialDataForCreation, form]);

  const selectedRoles = form.watch("roles", user?.roles || []);
  const showBusinessIdSelector = isSuperAdminView && selectedRoles.some(role => ROLES_REQUIRING_BUSINESS_ID.includes(role as PlatformUserRole));
  const showMultipleBusinessSelector = isSuperAdminView && selectedRoles.includes('promoter');
  
  const handleSubmit = (values: PlatformUserFormValues) => {
    onSubmit(values, isEditing);
  };
  
  const allowedRoles = isSuperAdminView ? ALL_PLATFORM_USER_ROLES : (['staff', 'host', 'lector_qr'] as PlatformUserRole[]);


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
         {initialDataForCreation?.preExistingUserType && (
             <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-700 dark:text-blue-300">
                  DNI Encontrado como {PLATFORM_USER_ROLE_TRANSLATIONS[initialDataForCreation.preExistingUserType]}
                </AlertTitle>
                <AlertDescription className="text-blue-600 dark:text-blue-400">
                  Algunos datos se han pre-rellenado. Completa el perfil para crear la cuenta de usuario.
                </AlertDescription>
            </Alert>
         )}
        
        <FormField control={form.control} name="dni" render={({ field }) => (
            <FormItem><FormLabel>DNI/CE <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="Número de documento" {...field} disabled={isSubmitting || isEditing || !!initialDataForCreation?.dni} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>Nombre Completo <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="Nombre del usuario" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem><FormLabel>Email <span className="text-destructive">*</span></FormLabel><FormControl><Input type="email" placeholder="usuario@email.com" {...field} disabled={isSubmitting || isEditing} /></FormControl><FormMessage /></FormItem>
        )}/>
        {needsPassword && (
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem><FormLabel>Contraseña <span className="text-destructive">*</span></FormLabel><FormControl><Input type="password" placeholder="Mínimo 6 caracteres" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
          )}/>
        )}
        
        <FormField
          control={form.control}
          name="roles"
          render={() => (
            <FormItem>
              <FormLabel>Roles <span className="text-destructive">*</span></FormLabel>
              <div className="grid grid-cols-2 gap-2">
                {allowedRoles.map((role) => (
                  <FormField
                    key={role}
                    control={form.control}
                    name="roles"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(role)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...(field.value || []), role])
                                : field.onChange((field.value || []).filter((value) => value !== role))
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {PLATFORM_USER_ROLE_TRANSLATIONS[role]}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {showBusinessIdSelector && (
            <FormField control={form.control} name="businessId" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Negocio Principal (Para Staff/Host) <span className="text-destructive">*</span></FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")} disabled={businesses.length === 0}>{field.value ? businesses.find((b) => b.id === field.value)?.name : "Seleccionar negocio"}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-full p-0"><Command><CommandInput placeholder="Buscar negocio..." /><CommandEmpty>No se encontraron negocios.</CommandEmpty><CommandGroup>
                {businesses.map((b) => (<CommandItem value={b.id} key={b.id} onSelect={() => form.setValue("businessId", b.id)}><Check className={cn("mr-2 h-4 w-4", b.id === field.value ? "opacity-100" : "opacity-0")}/>{b.name}</CommandItem>))}
                </CommandGroup></Command></PopoverContent></Popover><FormDescription className="text-xs">Negocio al que el Staff/Host pertenece.</FormDescription><FormMessage /></FormItem>
            )}/>
        )}

        {showMultipleBusinessSelector && (
             <FormField control={form.control} name="businessIds" render={() => (
                <FormItem><FormLabel>Negocios Asignados (Para Promotor)</FormLabel>
                <div className="grid grid-cols-2 gap-2">
                  {businesses.map(biz => (
                     <FormField key={biz.id} control={form.control} name="businessIds" render={({ field }) => (
                       <FormItem className="flex items-center space-x-2"><FormControl><Checkbox
                            checked={field.value?.includes(biz.id)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...(field.value || []), biz.id])
                                : field.onChange((field.value || []).filter((id) => id !== biz.id))
                            }}
                        /></FormControl><FormLabel className="font-normal text-sm">{biz.name}</FormLabel></FormItem>
                     )}/>
                  ))}
                </div>
                <FormDescription className="text-xs">Negocios en los que el promotor puede generar códigos.</FormDescription><FormMessage /></FormItem>
             )}/>
        )}
        
        <DialogFooter className="pt-6">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting || disableSubmitOverride}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Guardar Cambios" : "Crear Usuario"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}


export default function BusinessStaffPage() {
  const { userProfile, currentUser } = useAuth();
  const currentBusinessId = userProfile?.businessId;
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [staffMembers, setStaffMembers] = useState<PlatformUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State for modal visibility control
  const [modalStep, setModalStep] = useState<'closed' | 'dni_entry' | 'user_form'>('closed');
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [verifiedDniResult, setVerifiedDniResult] = useState<InitialDataForPlatformUserCreation | null>(null);

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
      const staffQuery = query(collection(db, "platformUsers"), where("businessId", "==", currentBusinessId));
      const querySnapshot = await getDocs(staffQuery);
      const fetchedStaff: PlatformUser[] = [];
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data() as Omit<PlatformUser, 'id'>;
        if (data.roles.includes('staff') || data.roles.includes('host') || data.roles.includes('business_admin') || data.roles.includes('lector_qr')) {
             fetchedStaff.push({ id: docSnap.id, uid: docSnap.id, ...data });
        }
      });
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
    setExistingPlatformUserToEdit(null);
    setShowDniIsPlatformUserAlert(false);
    setModalStep('dni_entry'); 
  };
  
  const handleDniVerificationSubmit = async (values: DniEntryValues) => {
    if (isSubmitting) return;
    const docNumberCleaned = values.docNumber.trim();
    setIsSubmitting(true);
    
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
    if (fetchedNameFromApi) {
      initialData.name = fetchedNameFromApi;
    }

    if (result.exists) {
        if (result.userType === 'PlatformUser' && result.platformUserData) {
            setExistingPlatformUserToEdit(result.platformUserData);
            initialData.existingPlatformUser = result.platformUserData;
            setModalStep('closed');
            setShowDniIsPlatformUserAlert(true); 
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
    setModalStep('user_form');
  };
  
  const handleEditExistingUser = () => {
      if (existingPlatformUserToEdit) {
          setEditingUser(existingPlatformUserToEdit);
          setModalStep('user_form'); 
      }
      setShowDniIsPlatformUserAlert(false);
  };

  const handleCreateOrEditUser = async (data: PlatformUserFormData, isEditing: boolean) => {
    if (isSubmitting || !currentBusinessId || !currentUser) {
      toast({ title: "Error", description: "Operación no permitida o negocio no identificado.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    try {
      if (isEditing && data.uid) {
        // --- EDITING LOGIC ---
        const userRef = doc(db, "platformUsers", data.uid);
        const rolesAllowed: PlatformUserRole[] = ['business_admin', 'staff', 'host', 'lector_qr'];
        const finalRoles = data.roles.filter(role => rolesAllowed.includes(role as PlatformUserRole));
        
        if (userProfile?.uid === data.uid && !finalRoles.some(r => r === 'business_admin' || r === 'staff')) {
          toast({ title: "Acción no permitida", description: "No puedes quitarte a ti mismo el rol de administrador o staff.", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
        
        const userPayload: Partial<PlatformUser> = { name: data.name, roles: finalRoles };
        await updateDoc(userRef, userPayload);
        toast({ title: "Usuario Actualizado", description: `El perfil de "${data.name}" ha sido actualizado.` });
      } else {
        // --- CREATION LOGIC ---
        if (!data.email || !data.password) {
          throw new Error("El email y la contraseña son requeridos para crear un nuevo usuario.");
        }
        const rolesAllowed: PlatformUserRole[] = ['staff', 'host', 'lector_qr'];
        const finalRoles = data.roles.filter(role => rolesAllowed.includes(role as PlatformUserRole));
        if (finalRoles.length === 0) {
          throw new Error("Rol no válido. Solo puedes asignar 'Staff', 'Anfitrión' o 'Lector QR'.")
        }
        
        const idToken = await currentUser.getIdToken();
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
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
          body: JSON.stringify(creationPayload)
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Ocurrió un error desconocido al crear el usuario.');
        }
        toast({ title: "Personal Creado Exitosamente", description: `Se creó el usuario "${data.name}".` });
      }
      
      setModalStep('closed');
      setEditingUser(null);
      setVerifiedDniResult(null);
      await fetchStaffMembers();

    } catch (error: any) {
      console.error("Error creating/editing staff user:", error);
      toast({ title: "Error al Guardar", description: `Ocurrió un error. ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: PlatformUser) => {
    if (isSubmitting) return;
    if (user.uid === userProfile?.uid) {
        toast({ title: "Acción no permitida", description: "No puedes eliminar tu propio perfil de usuario.", variant: "destructive" });
        return;
    }
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
          <CardDescription>Administra los usuarios staff, anfitriones y lectores QR de tu negocio.</CardDescription>
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
                      <Button variant="ghost" size="icon" onClick={() => { setEditingUser(staff); setModalStep('user_form'); }} disabled={isSubmitting}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={isSubmitting || staff.uid === userProfile?.uid}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
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
      
      <UIDialog open={modalStep !== 'closed'} onOpenChange={(open) => !open && setModalStep('closed')}>
        <UIDialogContent className="sm:max-w-lg">
          {modalStep === 'dni_entry' && (
            <>
              <UIDialogHeader>
                <UIDialogTitle>Paso 1: Verificar Documento</UIDialogTitle>
                <UIDialogDescription>Ingresa el documento para verificar si la persona ya existe en la plataforma.</UIDialogDescription>
              </UIDialogHeader>
              <Form {...dniEntryForm}>
                <form onSubmit={dniEntryForm.handleSubmit(handleDniVerificationSubmit)} className="space-y-4 py-2">
                  <FormField control={dniEntryForm.control} name="docType" render={({ field }) => (
                    <FormItem className="space-y-2"><FormLabel>Tipo de Documento</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-2">
                      <FormItem className="flex items-center space-x-3 space-y-0"><Label htmlFor="docType-dni-staff" className={cn("w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer", field.value === 'dni' && "bg-primary text-primary-foreground border-primary")}><FormControl><RadioGroupItem value="dni" id="docType-dni-staff" className="sr-only" /></FormControl>DNI</Label></FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0"><Label htmlFor="docType-ce-staff" className={cn("w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer", field.value === 'ce' && "bg-primary text-primary-foreground border-primary")}><FormControl><RadioGroupItem value="ce" id="docType-ce-staff" className="sr-only" /></FormControl>Carnet de Extranjería</Label></FormItem>
                    </RadioGroup></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={dniEntryForm.control} name="docNumber" render={({ field }) => (
                    <FormItem><FormLabel>Número de Documento <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder={watchedDocType === 'dni' ? "8 dígitos" : "10-20 dígitos"} {...field} maxLength={20} onChange={(e) => field.onChange(e.target.value.replace(/[^0-9]/g, ''))} autoFocus disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <DialogFooter><Button type="button" variant="outline" onClick={() => setModalStep('closed')} disabled={isSubmitting}>Cancelar</Button><Button type="submit" variant="gradient" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verificar"}</Button></DialogFooter>
                </form>
              </Form>
            </>
          )}
          {modalStep === 'user_form' && (
            <>
              <UIDialogHeader>
                <UIDialogTitle>{editingUser ? `Editar Usuario: ${editingUser.name}` : "Paso 2: Completar Perfil"}</UIDialogTitle>
                <UIDialogDescription>{editingUser ? "Actualiza los detalles del perfil." : "Completa los detalles para crear el usuario."}</UIDialogDescription>
              </UIDialogHeader>
              <PlatformUserForm 
                user={editingUser || undefined}
                initialDataForCreation={!editingUser ? verifiedDniResult : undefined}
                businesses={[]}
                onSubmit={(data) => handleCreateOrEditUser(data, !!editingUser)}
                onCancel={() => {setModalStep('closed'); setEditingUser(null); setVerifiedDniResult(null);}}
                isSubmitting={isSubmitting}
              />
            </>
          )}
        </UIDialogContent>
      </UIDialog>

      <AlertDialog open={showDniIsPlatformUserAlert} onOpenChange={setShowDniIsPlatformUserAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <UIAlertDialogTitle className="flex items-center"><AlertTriangle className="text-yellow-500 mr-2 h-6 w-6"/> Usuario ya Existente</UIAlertDialogTitle>
            <AlertDialogDescription>El documento <span className="font-semibold">{existingPlatformUserToEdit?.dni}</span> ya está registrado para <span className="font-semibold">{existingPlatformUserToEdit?.name}</span>. Si no está en tu lista de personal, puede estar asignado a otro negocio. Contacta al Super Admin si necesitas reasignarlo. No puedes crear un duplicado.</AlertDialogDescription>
          </AlertDialogHeader>
          <ShadcnAlertDialogFooter><AlertDialogCancel onClick={() => setShowDniIsPlatformUserAlert(false)}>Entendido</AlertDialogCancel></ShadcnAlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    