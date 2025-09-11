
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogDescription as UIDialogDescription, DialogFooter as UIDialogFooter } from "@/components/ui/dialog";
import { Star, PlusCircle, Download, Search, Edit, Trash2, Mail, Phone, Award, ShieldCheck, CalendarDays, Cake, Filter, Loader2, AlertTriangle, Info } from "lucide-react";
import type { SocioVipMember, SocioVipMemberFormData, QrClient, PlatformUser, InitialDataForSocioVipCreation } from "@/lib/types";
import { format, getMonth, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SocioVipMemberForm } from "@/components/admin/forms/SocioVipMemberForm";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as UIAlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MEMBERSHIP_STATUS_TRANSLATIONS, MEMBERSHIP_STATUS_COLORS, MESES_DEL_ANO_ES, PLATFORM_USER_ROLE_TRANSLATIONS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, Timestamp, query, where, DocumentData } from "firebase/firestore";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage as FormMessageHook } from "@/components/ui/form"; 
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";


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
        if (!/^\d{1,20}$/.test(data.docNumber)) { // Permitir cualquier longitud de 1 a 20 para CE
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "El Carnet de Extranjería debe contener solo dígitos numéricos.",
                path: ['docNumber'],
            });
        }
    }
});
type DniEntryValues = z.infer<typeof DniEntrySchema>;


interface CheckSocioDniResult {
  existsAsSocioVip: boolean;
  socioVipData?: SocioVipMember;
  existsAsQrClient: boolean;
  qrClientData?: QrClient;
  existsAsPlatformUser: boolean;
  platformUserData?: PlatformUser;
}


export default function AdminSocioVipPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [birthdayMonthFilter, setBirthdayMonthFilter] = useState<string>("all");
  const [joinMonthFilter, setJoinMonthFilter] = useState<string>("all");
  
  const [editingMember, setEditingMember] = useState<SocioVipMember | null>(null);
  const [members, setMembers] = useState<SocioVipMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [showDniEntryModal, setShowDniEntryModal] = useState(false);
  const [dniForSocioVerification, setDniForSocioVerification] = useState("");
  const [verifiedSocioDniResult, setVerifiedSocioDniResult] = useState<InitialDataForSocioVipCreation | null>(null);
  
  const [showCreateEditModal, setShowCreateEditModal] = useState(false); 
  
  const [showDniIsAlreadySocioVipAlert, setShowDniIsAlreadySocioVipAlert] = useState(false);
  const [existingSocioVipToEdit, setExistingSocioVipToEdit] = useState<SocioVipMember | null>(null);

  const dniEntryForm = useForm<DniEntryValues>({
    resolver: zodResolver(DniEntrySchema),
    defaultValues: { docType: 'dni', docNumber: "" },
  });
  const watchedDocType = dniEntryForm.watch('docType');

  const fetchSocioVipMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "socioVipMembers"));
      const fetchedMembers: SocioVipMember[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        
        const toSafeISOString = (dateValue: any): string | undefined => {
            if (!dateValue) return undefined;
            if (dateValue instanceof Timestamp) return dateValue.toDate().toISOString();
            if (dateValue instanceof Date) return dateValue.toISOString();
            if (typeof dateValue === 'string') {
              const parsedDate = new Date(dateValue);
              return isValid(parsedDate) ? parsedDate.toISOString() : undefined;
            }
            return undefined;
        };

        return {
          id: docSnap.id,
          name: data.name,
          surname: data.surname,
          dni: data.dni,
          phone: data.phone,
          email: data.email,
          address: data.address,
          profession: data.profession,
          preferences: Array.isArray(data.preferences) ? data.preferences : [],
          loyaltyPoints: data.loyaltyPoints || 0,
          membershipStatus: data.membershipStatus || 'inactive',
          staticQrCodeUrl: data.staticQrCodeUrl,
          authUid: data.authUid,
          joinDate: toSafeISOString(data.joinDate) || new Date().toISOString(),
          dob: toSafeISOString(data.dob)
        } as SocioVipMember;
      });
      setMembers(fetchedMembers);
    } catch (error: any) {
      console.error("Failed to fetch Socio VIP members:", error);
      toast({
        title: "Error al Cargar Socios VIP",
        description: "No se pudieron obtener los datos. Error: " + error.message,
        variant: "destructive",
      });
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSocioVipMembers();
  }, [fetchSocioVipMembers]);

  const filteredMembers = members.filter(member => {
    const searchMatch = (
      (member.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (member.surname?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (member.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (member.dni?.includes(searchTerm) || false)
    );

    const birthdayMatch = birthdayMonthFilter === "all" ||
      (member.dob && typeof member.dob === 'string' && getMonth(parseISO(member.dob)) === parseInt(birthdayMonthFilter));

    const joinMatch = joinMonthFilter === "all" ||
      (member.joinDate && typeof member.joinDate === 'string' && getMonth(parseISO(member.joinDate)) === parseInt(joinMonthFilter));

    return searchMatch && birthdayMatch && joinMatch;
  });

  const handleExport = () => {
    if (filteredMembers.length === 0) {
      toast({ title: "Sin Datos", description: "No hay socios para exportar.", variant: "destructive" });
      return;
    }
    const headers = ["ID", "Nombre", "Apellido", "Email", "Teléfono", "DNI/CE", "Fec. Nac.", "Puntos", "Estado Membresía", "Fecha Ingreso", "Dirección", "Profesión", "Preferencias"];
    const rows = filteredMembers.map(mem => [
      mem.id, mem.name, mem.surname, mem.email, mem.phone, mem.dni,
      mem.dob && typeof mem.dob === 'string' ? format(parseISO(mem.dob), "dd/MM/yyyy", { locale: es }) : "N/A",
      mem.loyaltyPoints, MEMBERSHIP_STATUS_TRANSLATIONS[mem.membershipStatus as keyof typeof MEMBERSHIP_STATUS_TRANSLATIONS],
      mem.joinDate ? format(parseISO(mem.joinDate as string), "dd/MM/yyyy", { locale: es }) : "N/A",
      mem.address || "N/A", mem.profession || "N/A", mem.preferences?.join(', ') || "N/A"
    ]);
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sociovip_socios_vip.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Exportación Exitosa", description: "Archivo CSV generado."});
  };

const checkDniAcrossCollections = async (dniToVerify: string): Promise<CheckSocioDniResult> => {
    let result: CheckSocioDniResult = { 
      existsAsSocioVip: false, 
      existsAsQrClient: false, 
      existsAsPlatformUser: false 
    };

    if (!dniToVerify || typeof dniToVerify !== 'string' || dniToVerify.trim() === '') {
      console.error("checkDniAcrossCollections (SocioVIP): DNI a verificar es inválido.", dniToVerify);
      return result;
    }

    const socioVipQuery = query(collection(db, "socioVipMembers"), where("dni", "==", dniToVerify));
    const socioVipSnapshot = await getDocs(socioVipQuery);
    if (!socioVipSnapshot.empty) {
      result.existsAsSocioVip = true;
      result.socioVipData = { id: socioVipSnapshot.docs[0].id, ...socioVipSnapshot.docs[0].data() } as SocioVipMember;
      return result; // Si ya es Socio VIP, no necesitamos verificar más para este flujo
    }

    const qrClientQuery = query(collection(db, "qrClients"), where("dni", "==", dniToVerify));
    const qrClientSnapshot = await getDocs(qrClientQuery);
    if (!qrClientSnapshot.empty) {
      result.existsAsQrClient = true;
      result.qrClientData = { id: qrClientSnapshot.docs[0].id, ...qrClientSnapshot.docs[0].data() } as QrClient;
    }

    const platformUsersQuery = query(collection(db, "platformUsers"), where("dni", "==", dniToVerify));
    const platformUsersSnapshot = await getDocs(platformUsersQuery);
    if (!platformUsersSnapshot.empty) {
      result.existsAsPlatformUser = true;
      result.platformUserData = { id: platformUsersSnapshot.docs[0].id, ...platformUsersSnapshot.docs[0].data() } as PlatformUser;
    }
    return result;
  };

  const handleOpenCreateSocioVipFlow = () => {
    setEditingMember(null);
    setVerifiedSocioDniResult(null);
    dniEntryForm.reset({ docType: 'dni', docNumber: "" });
    setShowDniIsAlreadySocioVipAlert(false);
    setExistingSocioVipToEdit(null);
    setDniForSocioVerification("");
    setShowDniEntryModal(true);
  };

  const handleSocioDniVerificationSubmit = async (values: DniEntryValues) => {
    if (isSubmitting) return;

    const docNumberCleaned = values.docNumber.trim();
    if (!docNumberCleaned) {
        toast({ title: "Número de Documento Requerido", description: "Por favor, ingresa un número de documento válido.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    setDniForSocioVerification(docNumberCleaned);

    let fetchedNameFromApi: string | undefined = undefined;
    let fetchedSurnameFromApi: string | undefined = undefined;

    if (values.docType === 'dni') {
      try {
        const response = await fetch('/api/admin/consult-dni', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dni: docNumberCleaned }),
        });
        const data = await response.json();
        if (response.ok && data.nombreCompleto) {
          const nameParts = data.nombreCompleto.split(' ');
          fetchedSurnameFromApi = nameParts.slice(0, 2).join(' '); // Apellido paterno y materno
          fetchedNameFromApi = nameParts.slice(2).join(' '); // Nombres
          toast({ title: "DNI Encontrado", description: `Nombre: ${data.nombreCompleto}` });
        } else if (!response.ok) {
           toast({ title: "Consulta DNI", description: data.error || "No se pudo obtener el nombre para este DNI.", variant: "default" });
        }
      } catch (error) {
        console.error("Error calling DNI consultation API route:", error);
        toast({ title: "Error de Red", description: "No se pudo comunicar con el servicio de consulta de DNI.", variant: "destructive" });
      }
    }
    
    const result = await checkDniAcrossCollections(docNumberCleaned);
    setIsSubmitting(false);
    
    if (result.existsAsSocioVip && result.socioVipData) {
        setExistingSocioVipToEdit(result.socioVipData); 
        setShowDniIsAlreadySocioVipAlert(true);
        setShowDniEntryModal(false);
    } else {
        let initialData: InitialDataForSocioVipCreation = { dni: docNumberCleaned };
        
        // Prioritize API data for name if available
        if(fetchedNameFromApi) initialData.name = fetchedNameFromApi;
        if(fetchedSurnameFromApi) initialData.surname = fetchedSurnameFromApi;

        if (result.existsAsQrClient && result.qrClientData) {
            initialData.existingUserType = 'QrClient';
            if(!initialData.name) initialData.name = result.qrClientData.name;
            if(!initialData.surname) initialData.surname = result.qrClientData.surname;
            initialData.phone = result.qrClientData.phone;
            
            // --- FIX ---
            // Ensure `dob` is always a string when passed as initial data
            if (result.qrClientData.dob) {
              if (result.qrClientData.dob instanceof Timestamp) {
                  initialData.dob = result.qrClientData.dob.toDate().toISOString();
              } else if (typeof result.qrClientData.dob === 'string') {
                  initialData.dob = result.qrClientData.dob;
              } else if (result.qrClientData.dob instanceof Date) {
                  initialData.dob = result.qrClientData.dob.toISOString();
              }
            }

        } else if (result.existsAsPlatformUser && result.platformUserData) {
            initialData.existingUserType = 'PlatformUser';
            if (!initialData.name && !initialData.surname) { // only if API fails
              const nameParts = result.platformUserData.name.split(' ');
              initialData.name = nameParts.slice(1).join(' ');
              initialData.surname = nameParts[0];
            }
            initialData.email = result.platformUserData.email;
        }
        setVerifiedSocioDniResult(initialData); 
        setShowDniEntryModal(false);
        setEditingMember(null); 
        setShowCreateEditModal(true); 
    }
  };

  const handleEditExistingSocioVip = () => {
      setShowDniIsAlreadySocioVipAlert(false);
      if (existingSocioVipToEdit) {
          setEditingMember(existingSocioVipToEdit);
          setVerifiedSocioDniResult(null); 
          setShowCreateEditModal(true); 
      }
      setExistingSocioVipToEdit(null);
  };


  const handleCreateOrEditMember = async (data: SocioVipMemberFormData) => {
    setIsSubmitting(true);
    try {
      const memberDni = editingMember ? data.dni : verifiedSocioDniResult?.dni;
      if (!memberDni) {
        toast({ title: "Error Interno", description: "DNI no disponible para la operación.", variant: "destructive"});
        setIsSubmitting(false);
        return;
      }

      if (editingMember) { 
        if (data.dni !== editingMember.dni) { 
            const dniCheckResult = await checkDniAcrossCollections(data.dni);
            if (dniCheckResult.existsAsSocioVip && dniCheckResult.socioVipData?.id !== editingMember.id) { 
                toast({ title: "Error de DNI", description: `El DNI/CE ${data.dni} ya está registrado para otro Socio VIP.`, variant: "destructive" });
                setIsSubmitting(false);
                return;
            }
        }
        const memberRef = doc(db, "socioVipMembers", editingMember.id);
        await updateDoc(memberRef, {
          ...data,
          dni: data.dni,
          dob: Timestamp.fromDate(data.dob),
          preferences: data.preferences?.split(',').map(p => p.trim()).filter(p => p) || [],
        });
        toast({ title: "Socio VIP Actualizado", description: `El socio "${data.name} ${data.surname}" ha sido actualizado.` });
      } else { 
        if (!verifiedSocioDniResult?.dni) { 
          toast({ title: "Error Interno", description: "No se pudo obtener el DNI/CE verificado.", variant: "destructive"});
          setIsSubmitting(false);
          return;
        }
        
        const newMemberPayload = {
          ...data,
          dni: verifiedSocioDniResult.dni, 
          joinDate: Timestamp.fromDate(new Date()),
          dob: Timestamp.fromDate(data.dob),
          preferences: data.preferences?.split(',').map(p => p.trim()).filter(p => p) || [],
          staticQrCodeUrl: `https://placehold.co/100x100.png?text=${(data.name || '').substring(0,3).toUpperCase()}QR`,
          authUid: null, 
        };
        const docRef = await addDoc(collection(db, "socioVipMembers"), newMemberPayload);
        toast({ title: "Socio VIP Creado", description: `El socio "${data.name} ${data.surname}" ha sido creado con ID: ${docRef.id}.` });
      }
      setShowCreateEditModal(false);
      setEditingMember(null);
      setVerifiedSocioDniResult(null);
      fetchSocioVipMembers();
    } catch (error: any) {
      console.error("Failed to create/update Socio VIP member:", error);
      let description = "No se pudo guardar el Socio VIP.";
       if (error.code === 'permission-denied') {
        description = "Error de permisos. Verifica las reglas de Firestore."
      } else if (error.message.includes("Function where() called with invalid data")) {
        description = "Error interno: datos inválidos para la consulta. Revisa el DNI.";
      }
      toast({ title: "Error al Guardar", description, variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMember = async (member: SocioVipMember) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "socioVipMembers", member.id));
      toast({ title: "Socio VIP Eliminado", description: `El socio "${member.name} ${member.surname}" ha sido eliminado.`, variant: "destructive" });
      fetchSocioVipMembers();
    } catch (error) {
      console.error("Failed to delete Socio VIP member:", error);
      toast({ title: "Error al Eliminar", description: "No se pudo eliminar el Socio VIP.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
        <h1 className="text-3xl font-bold text-gradient flex items-center">
          <Star className="h-8 w-8 mr-2" /> Gestión de Socios VIP
        </h1>
        <div className="flex space-x-2">
          <Button onClick={handleExport} variant="outline" disabled={isLoading || members.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          <Button onClick={handleOpenCreateSocioVipFlow} variant="gradient" disabled={isLoading}>
            <PlusCircle className="mr-2 h-4 w-4" /> Crear Socio VIP
          </Button>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Lista de Socios VIP</CardTitle>
          <CardDescription>Miembros exclusivos de la plataforma SocioVIP.</CardDescription>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 items-end">
            <div className="relative">
              <Label htmlFor="search-members">Buscar Socio</Label>
              <Search className="absolute left-2.5 top-[calc(1.75rem+0.625rem)] h-4 w-4 text-muted-foreground" />
              <Input
                id="search-members"
                type="search"
                placeholder="Buscar por nombre, email, DNI/CE..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="birthday-month-filter">
                <Cake className="inline-block h-4 w-4 mr-1 text-muted-foreground"/>
                Filtrar por Mes de Cumpleaños
              </Label>
              <Select value={birthdayMonthFilter} onValueChange={setBirthdayMonthFilter} disabled={isLoading}>
                <SelectTrigger id="birthday-month-filter">
                  <SelectValue placeholder="Todos los meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {MESES_DEL_ANO_ES.map((mes, index) => (
                    <SelectItem key={index} value={index.toString()}>{mes}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="join-month-filter">
                 <CalendarDays className="inline-block h-4 w-4 mr-1 text-muted-foreground"/>
                Filtrar por Mes de Registro
              </Label>
              <Select value={joinMonthFilter} onValueChange={setJoinMonthFilter} disabled={isLoading}>
                <SelectTrigger id="join-month-filter">
                  <SelectValue placeholder="Todos los meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {MESES_DEL_ANO_ES.map((mes, index) => (
                    <SelectItem key={index} value={index.toString()}>{mes}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-60">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-4 text-lg text-muted-foreground">Cargando socios VIP...</p>
            </div>
          ) : members.length === 0 && !searchTerm && birthdayMonthFilter === "all" && joinMonthFilter === "all" ? (
            <p className="text-center text-muted-foreground h-24 flex items-center justify-center">
              No hay Socios VIP registrados. Haz clic en "Crear Socio VIP" para empezar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre Completo</TableHead>
                  <TableHead className="hidden lg:table-cell"><Mail className="inline-block h-4 w-4 mr-1 text-muted-foreground"/>Email</TableHead>
                  <TableHead className="hidden md:table-cell"><Phone className="inline-block h-4 w-4 mr-1 text-muted-foreground"/>Teléfono</TableHead>
                  <TableHead className="hidden xl:table-cell">DNI/CE <span className="text-destructive">*</span></TableHead>
                  <TableHead><Cake className="inline-block h-4 w-4 mr-1 text-muted-foreground"/>Fec. Nac. <span className="text-destructive">*</span></TableHead>
                  <TableHead className="text-center"><Award className="inline-block h-4 w-4 mr-1 text-muted-foreground"/>Puntos</TableHead>
                  <TableHead><ShieldCheck className="inline-block h-4 w-4 mr-1 text-muted-foreground"/>Estado Membresía</TableHead>
                  <TableHead className="hidden lg:table-cell"><CalendarDays className="inline-block h-4 w-4 mr-1 text-muted-foreground"/>Fecha Ingreso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.length > 0 ? (
                  filteredMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name} {member.surname}</TableCell>
                      <TableCell className="hidden lg:table-cell">{member.email}</TableCell>
                      <TableCell className="hidden md:table-cell">{member.phone}</TableCell>
                      <TableCell className="hidden xl:table-cell">{member.dni}</TableCell>
                      <TableCell>{member.dob && typeof member.dob === 'string' ? format(parseISO(member.dob), "P", { locale: es }) : "N/A"}</TableCell>
                      <TableCell className="text-center">{member.loyaltyPoints}</TableCell>
                      <TableCell>
                        <Badge variant={MEMBERSHIP_STATUS_COLORS[member.membershipStatus as keyof typeof MEMBERSHIP_STATUS_COLORS]}>
                          {MEMBERSHIP_STATUS_TRANSLATIONS[member.membershipStatus as keyof typeof MEMBERSHIP_STATUS_TRANSLATIONS]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{member.joinDate && typeof member.joinDate === 'string' ? format(parseISO(member.joinDate), "P", { locale: es }) : "N/A"}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => {
                            setEditingMember(member);
                            setVerifiedSocioDniResult(null); 
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
                              <UIAlertDialogTitle>¿Estás seguro?</UIAlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Esto eliminará permanentemente al socio
                                <span className="font-semibold"> {member.name} {member.surname}</span>.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteMember(member)}
                                className="bg-destructive hover:bg-destructive/90"
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center h-24">No se encontraron socios VIP con los filtros aplicados.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <UIDialog open={showDniEntryModal} onOpenChange={setShowDniEntryModal}>
        <UIDialogContent className="sm:max-w-md">
          <UIDialogHeader>
            <UIDialogTitle>Paso 1: Verificar Documento</UIDialogTitle>
            <UIDialogDescription>
              Ingresa el documento para verificar si la persona ya existe en la plataforma.
            </UIDialogDescription>
          </UIDialogHeader>
          <Form {...dniEntryForm}>
            <form onSubmit={dniEntryForm.handleSubmit(handleSocioDniVerificationSubmit)} className="space-y-4 py-2">
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
                                dniEntryForm.setValue('docNumber', '');
                                dniEntryForm.clearErrors('docNumber');
                            }}
                            defaultValue={field.value}
                            className="grid grid-cols-2 gap-2"
                        >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                                <Label
                                    htmlFor="docType-dni-sociovip"
                                    className={cn(
                                        "w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer",
                                        field.value === 'dni' && "bg-primary text-primary-foreground border-primary"
                                    )}
                                >
                                    <FormControl>
                                        <RadioGroupItem value="dni" id="docType-dni-sociovip" className="sr-only" />
                                    </FormControl>
                                    DNI
                                </Label>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                                 <Label
                                    htmlFor="docType-ce-sociovip"
                                    className={cn(
                                        "w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer",
                                        field.value === 'ce' && "bg-primary text-primary-foreground border-primary"
                                    )}
                                >
                                    <FormControl>
                                        <RadioGroupItem value="ce" id="docType-ce-sociovip" className="sr-only" />
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
                        placeholder={watchedDocType === 'dni' ? "8 dígitos numéricos" : "10-20 dígitos numéricos"} 
                        {...field} 
                        maxLength={20}
                        onChange={(e) => {
                            const numericValue = e.target.value.replace(/[^0-9]/g, '');
                            if (watchedDocType === 'dni' && numericValue.length > 8) {
                                field.onChange(numericValue.slice(0, 8));
                            } else {
                                field.onChange(numericValue);
                            }
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
        <UIDialogContent className="sm:max-w-2xl">
          <UIDialogHeader>
            <UIDialogTitle>
              {editingMember
                ? `Editar Socio VIP: ${editingMember.name} ${editingMember.surname}`
                : "Paso 2: Completar Perfil de Socio VIP"
              }
            </UIDialogTitle>
             <UIDialogDescription>
              {editingMember
                ? "Actualiza los detalles del Socio VIP."
                : (verifiedSocioDniResult?.existingUserType 
                    ? `Este DNI pertenece a un ${PLATFORM_USER_ROLE_TRANSLATIONS[verifiedSocioDniResult.existingUserType as keyof typeof PLATFORM_USER_ROLE_TRANSLATIONS] || 'usuario existente'}. Algunos datos han sido pre-rellenados.`
                    : "Completa los detalles para el perfil del Socio VIP.")
              }
            </UIDialogDescription>
          </UIDialogHeader>
          <SocioVipMemberForm
            member={editingMember || undefined}
            initialData={!editingMember && verifiedSocioDniResult ? verifiedSocioDniResult : undefined}
            onSubmit={handleCreateOrEditMember}
            onCancel={() => { setShowCreateEditModal(false); setEditingMember(null); setVerifiedSocioDniResult(null);}}
            isSubmitting={isSubmitting}
            disableSubmitOverride={false}
          />
        </UIDialogContent>
      </UIDialog>

      <AlertDialog open={showDniIsAlreadySocioVipAlert} onOpenChange={setShowDniIsAlreadySocioVipAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <UIAlertDialogTitle className="flex items-center">
                <AlertTriangle className="text-yellow-500 mr-2 h-6 w-6"/> DNI/CE ya Registrado como Socio VIP
            </UIAlertDialogTitle>
            <AlertDialogDescription>
              El DNI/CE <span className="font-semibold">{dniForSocioVerification}</span> ya está registrado como Socio VIP
              (<span className="font-semibold">{existingSocioVipToEdit?.name} {existingSocioVipToEdit?.surname}</span>).
              <br/><br/>
              ¿Desea editar este perfil de Socio VIP existente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDniIsAlreadySocioVipAlert(false); setExistingSocioVipToEdit(null); }}>No, Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEditExistingSocioVip} className="bg-primary hover:bg-primary/90">
                Sí, Editar Perfil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

    