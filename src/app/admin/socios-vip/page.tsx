
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Star, PlusCircle, Download, Search, Edit, Trash2, Mail, Phone, Award, ShieldCheck, CalendarDays, Cake, Filter, Loader2, AlertTriangle, Info } from "lucide-react";
import type { SocioVipMember, SocioVipMemberFormData, QrClient, PlatformUser, InitialDataForSocioVipCreation } from "@/lib/types";
import { format, getMonth, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SocioVipMemberForm } from "@/components/admin/forms/SocioVipMemberForm";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MEMBERSHIP_STATUS_TRANSLATIONS, MEMBERSHIP_STATUS_COLORS, MESES_DEL_ANO_ES } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, Timestamp, query, where } from "firebase/firestore";
import { Form, FormControl, FormField, FormItem, FormMessage as FormMessageHook } from "@/components/ui/form"; // Renamed to avoid conflict
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";


const DniEntrySchema = z.object({
  dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres."),
});
type DniEntryValues = z.infer<typeof DniEntrySchema>;


export default function AdminSocioVipPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [birthdayMonthFilter, setBirthdayMonthFilter] = useState<string>("all");
  const [joinMonthFilter, setJoinMonthFilter] = useState<string>("all");
  
  const [editingMember, setEditingMember] = useState<SocioVipMember | null>(null);
  const [members, setMembers] = useState<SocioVipMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // State for DNI-first creation flow
  const [showDniEntryModal, setShowDniEntryModal] = useState(false);
  const [dniForSocioVerification, setDniForSocioVerification] = useState("");
  const [verifiedSocioDniResult, setVerifiedSocioDniResult] = useState<InitialDataForSocioVipCreation | null>(null);
  
  const [showCreateEditModal, setShowCreateEditModal] = useState(false); // Controls main form modal
  
  const [showDniIsAlreadySocioVipAlert, setShowDniIsAlreadySocioVipAlert] = useState(false);
  const [existingSocioVipToEdit, setExistingSocioVipToEdit] = useState<SocioVipMember | null>(null);

  const dniEntryForm = useForm<DniEntryValues>({
    resolver: zodResolver(DniEntrySchema),
    defaultValues: { dni: "" },
  });

  const fetchSocioVipMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "socioVipMembers"));
      const fetchedMembers: SocioVipMember[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          joinDate: data.joinDate instanceof Timestamp ? data.joinDate.toDate().toISOString() : new Date(data.joinDate || Date.now()).toISOString(),
          dob: data.dob instanceof Timestamp ? data.dob.toDate().toISOString() : new Date(data.dob || Date.now()).toISOString(),
        } as SocioVipMember;
      });
      setMembers(fetchedMembers);
    } catch (error) {
      console.error("Failed to fetch Socio VIP members:", error);
      toast({
        title: "Error al Cargar Socios VIP",
        description: "No se pudieron obtener los datos. Intenta de nuevo.",
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
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.dni.includes(searchTerm)
    );

    const birthdayMatch = birthdayMonthFilter === "all" ||
      (member.dob && getMonth(parseISO(member.dob)) === parseInt(birthdayMonthFilter));

    const joinMatch = joinMonthFilter === "all" ||
      (member.joinDate && getMonth(parseISO(member.joinDate as string)) === parseInt(joinMonthFilter));

    return searchMatch && birthdayMatch && joinMatch;
  });

  const handleExport = () => {
    if (filteredMembers.length === 0) {
      toast({ title: "Sin Datos", description: "No hay socios para exportar.", variant: "destructive" });
      return;
    }
    const headers = ["ID", "Nombre", "Apellido", "Email", "Teléfono", "DNI", "Fec. Nac.", "Puntos", "Estado Membresía", "Fecha Ingreso", "Dirección", "Profesión", "Preferencias"];
    const rows = filteredMembers.map(mem => [
      mem.id, mem.name, mem.surname, mem.email, mem.phone, mem.dni,
      mem.dob ? format(parseISO(mem.dob), "dd/MM/yyyy", { locale: es }) : "N/A",
      mem.loyaltyPoints, MEMBERSHIP_STATUS_TRANSLATIONS[mem.membershipStatus],
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

  const checkDniAcrossCollections = async (dni: string, excludeSocioVipId?: string): Promise<InitialDataForSocioVipCreation | null> => {
    // Check socioVipMembers first
    const socioVipQuery = query(collection(db, "socioVipMembers"), where("dni", "==", dni));
    const socioVipSnapshot = await getDocs(socioVipQuery);
    if (!socioVipSnapshot.empty) {
      const socioDoc = socioVipSnapshot.docs[0];
      if (excludeSocioVipId && socioDoc.id === excludeSocioVipId) {
        // DNI belongs to the Socio VIP being edited, not a conflict for this user
      } else {
        return { dni, existingUserType: 'SocioVipMember', ...socioDoc.data() as SocioVipMember };
      }
    }

    // Check qrClients
    const qrClientQuery = query(collection(db, "qrClients"), where("dni", "==", dni));
    const qrClientSnapshot = await getDocs(qrClientQuery);
    if (!qrClientSnapshot.empty) {
      const data = qrClientSnapshot.docs[0].data() as QrClient;
      return { dni, name: data.name, surname: data.surname, phone: data.phone, dob: data.dob, preExistingUserType: 'QrClient' };
    }

    // Check platformUsers
    const platformUsersQuery = query(collection(db, "platformUsers"), where("dni", "==", dni));
    const platformUsersSnapshot = await getDocs(platformUsersQuery);
    if (!platformUsersSnapshot.empty) {
      const data = platformUsersSnapshot.docs[0].data() as PlatformUser;
      return { dni, name: data.name, email: data.email, preExistingUserType: 'PlatformUser' };
    }
    return { dni }; // DNI is new or only for types not relevant for conflict here
  };

  const handleOpenCreateSocioVipFlow = () => {
    setEditingMember(null);
    setVerifiedSocioDniResult(null);
    dniEntryForm.reset({ dni: "" });
    setShowDniIsAlreadySocioVipAlert(false);
    setDniForSocioVerification("");
    setShowDniEntryModal(true);
  };

  const handleSocioDniVerificationSubmit = async (values: DniEntryValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setDniForSocioVerification(values.dni);

    const result = await checkDniAcrossCollections(values.dni);
    setIsSubmitting(false);
    
    if (result?.existingUserType === 'SocioVipMember') {
        setExistingSocioVipToEdit(result as SocioVipMember); // Cast needed as result is broader
        setShowDniIsAlreadySocioVipAlert(true);
        setShowDniEntryModal(false);
    } else {
        setVerifiedSocioDniResult(result || { dni: values.dni }); // Ensure verifiedSocioDniResult is set
        setShowDniEntryModal(false);
        setShowCreateEditModal(true); // Open main form for creating a new Socio VIP
    }
  };

  const handleEditExistingSocioVip = () => {
      setShowDniIsAlreadySocioVipAlert(false);
      if (existingSocioVipToEdit) {
          setEditingMember(existingSocioVipToEdit);
          setVerifiedSocioDniResult(null); // Not creating, so clear this
          setShowCreateEditModal(true); // Open main form in edit mode
      }
      setExistingSocioVipToEdit(null);
  };


  const handleCreateOrEditMember = async (data: SocioVipMemberFormData) => {
    setIsSubmitting(true);
    try {
      if (editingMember) { // Editing existing member
        if (data.dni !== editingMember.dni) { // DNI was changed
            const dniCheckResult = await checkDniAcrossCollections(data.dni, editingMember.id);
            if (dniCheckResult?.existingUserType === 'SocioVipMember') {
                toast({ title: "Error de DNI", description: `El DNI ${data.dni} ya está registrado para otro Socio VIP.`, variant: "destructive" });
                setIsSubmitting(false);
                return;
            }
        }
        const memberRef = doc(db, "socioVipMembers", editingMember.id);
        const dobString = data.dob instanceof Date ? format(data.dob, "yyyy-MM-dd'T'HH:mm:ss") : editingMember.dob;
        await updateDoc(memberRef, {
          ...data,
          dob: dobString,
          preferences: data.preferences?.split(',').map(p => p.trim()).filter(p => p) || [],
          // joinDate and staticQrCodeUrl are not part of SocioVipMemberFormData, so they are not updated here
        });
        toast({ title: "Socio VIP Actualizado", description: `El socio "${data.name} ${data.surname}" ha sido actualizado.` });
      } else { // Creating new member (DNI comes from verifiedSocioDniResult)
        if (!verifiedSocioDniResult?.dni) {
          toast({ title: "Error Interno", description: "No se pudo obtener el DNI verificado.", variant: "destructive"});
          setIsSubmitting(false);
          return;
        }
         // Final check, though UI flow (alert) should prevent this if DNI already is SocioVipMember
        if (verifiedSocioDniResult.existingUserType === 'SocioVipMember') {
            toast({ title: "Error", description: `El DNI ${verifiedSocioDniResult.dni} ya está registrado como Socio VIP. No se puede crear un nuevo perfil.`, variant: "destructive" });
            setIsSubmitting(false);
            return;
        }

        const newMemberPayload = {
          ...data,
          dni: verifiedSocioDniResult.dni, // Use the verified DNI
          joinDate: Timestamp.fromDate(new Date()),
          dob: format(data.dob, "yyyy-MM-dd'T'HH:mm:ss"),
          preferences: data.preferences?.split(',').map(p => p.trim()).filter(p => p) || [],
          staticQrCodeUrl: `https://placehold.co/100x100.png?text=${data.name.substring(0,3).toUpperCase()}QR` // Placeholder
        };
        const docRef = await addDoc(collection(db, "socioVipMembers"), newMemberPayload);
        toast({ title: "Socio VIP Creado", description: `El socio "${data.name} ${data.surname}" ha sido creado con ID: ${docRef.id}.` });
      }
      setShowCreateEditModal(false);
      setEditingMember(null);
      setVerifiedSocioDniResult(null);
      fetchSocioVipMembers();
    } catch (error) {
      console.error("Failed to create/update Socio VIP member:", error);
      toast({ title: "Error al Guardar", description: "No se pudo guardar el Socio VIP.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMember = async (memberId: string, memberName?: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "socioVipMembers", memberId));
      toast({ title: "Socio VIP Eliminado", description: `El socio "${memberName || 'seleccionado'}" ha sido eliminado.`, variant: "destructive" });
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
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Star className="h-8 w-8 mr-2" /> Gestión de Socios VIP
        </h1>
        <div className="flex space-x-2">
          <Button onClick={handleExport} variant="outline" disabled={isLoading || members.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          <Button onClick={handleOpenCreateSocioVipFlow} className="bg-primary hover:bg-primary/90" disabled={isLoading}>
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
                placeholder="Buscar por nombre, email, DNI..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="birthday-month-filter">Filtrar por Mes de Cumpleaños</Label>
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
              <Label htmlFor="join-month-filter">Filtrar por Mes de Registro</Label>
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
          ) : filteredMembers.length === 0 && !searchTerm && birthdayMonthFilter === "all" && joinMonthFilter === "all" ? (
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
                  <TableHead className="hidden xl:table-cell">DNI</TableHead>
                  <TableHead><Cake className="inline-block h-4 w-4 mr-1 text-muted-foreground"/>Fec. Nac.</TableHead>
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
                      <TableCell>{member.dob ? format(parseISO(member.dob), "P", { locale: es }) : "N/A"}</TableCell>
                      <TableCell className="text-center">{member.loyaltyPoints}</TableCell>
                      <TableCell>
                        <Badge variant={MEMBERSHIP_STATUS_COLORS[member.membershipStatus]}>
                          {MEMBERSHIP_STATUS_TRANSLATIONS[member.membershipStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{member.joinDate ? format(parseISO(member.joinDate as string), "P", { locale: es }) : "N/A"}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => {
                            setEditingMember(member);
                            setVerifiedSocioDniResult(null); // Not verifying DNI when editing from list
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
                                Esta acción no se puede deshacer. Esto eliminará permanentemente al socio
                                <span className="font-semibold"> {member.name} {member.surname}</span>.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteMember(member.id, `${member.name} ${member.surname}`)}
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

      {/* DNI Entry Modal for New Socio VIP Creation */}
      <Dialog open={showDniEntryModal} onOpenChange={(isOpen) => {
          if (!isOpen) {
            dniEntryForm.reset();
            setDniForSocioVerification("");
          }
          setShowDniEntryModal(isOpen);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Paso 1: Verificar DNI/CE del Socio VIP</DialogTitle>
            <DialogDescription>
              Ingresa el DNI o Carnet de Extranjería del nuevo Socio VIP para verificar su existencia.
            </DialogDescription>
          </DialogHeader>
          <Form {...dniEntryForm}>
            <form onSubmit={dniEntryForm.handleSubmit(handleSocioDniVerificationSubmit)} className="space-y-4 py-2">
              <FormField
                control={dniEntryForm.control}
                name="dni"
                render={({ field }) => (
                  <FormItem>
                    <Label>DNI / Carnet de Extranjería</Label>
                    <FormControl>
                      <Input placeholder="Número de documento" {...field} autoFocus disabled={isSubmitting}/>
                    </FormControl>
                    <FormMessageHook />
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

      {/* Main Socio VIP Creation/Editing Modal */}
       <Dialog open={showCreateEditModal} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setEditingMember(null);
          setVerifiedSocioDniResult(null);
        }
        setShowCreateEditModal(isOpen);
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingMember
                ? `Editar Socio VIP: ${editingMember.name} ${editingMember.surname}`
                : "Paso 2: Completar Perfil de Socio VIP"
              }
            </DialogTitle>
             <DialogDescription>
              {editingMember
                ? "Actualiza los detalles del Socio VIP."
                : (verifiedSocioDniResult?.existingUserType === 'SocioVipMember' // Should be caught by alert
                    ? "Este DNI ya es Socio VIP. No se puede crear un nuevo perfil aquí. Edite desde la lista principal."
                    : "Completa los detalles para el perfil del Socio VIP.")
              }
            </DialogDescription>
          </DialogHeader>
          <SocioVipMemberForm
            member={editingMember || undefined}
            initialData={!editingMember && verifiedSocioDniResult ? verifiedSocioDniResult : undefined}
            onSubmit={handleCreateOrEditMember}
            onCancel={() => { setShowCreateEditModal(false); setEditingMember(null); setVerifiedSocioDniResult(null);}}
            isSubmitting={isSubmitting}
            disableSubmitOverride={!editingMember && !!verifiedSocioDniResult?.existingUserType && verifiedSocioDniResult.existingUserType === 'SocioVipMember'}
          />
        </DialogContent>
      </Dialog>

      {/* Alert Dialog if DNI is already a Socio VIP Member */}
      <AlertDialog open={showDniIsAlreadySocioVipAlert} onOpenChange={setShowDniIsAlreadySocioVipAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
                <AlertTriangle className="text-yellow-500 mr-2 h-6 w-6"/> DNI ya Registrado como Socio VIP
            </AlertDialogTitle>
            <AlertDialogDescription>
              El DNI <span className="font-semibold">{dniForSocioVerification}</span> ya está registrado como Socio VIP
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
