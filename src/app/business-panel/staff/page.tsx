

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogDescription as UIDialogDescription } from "@/components/ui/dialog"; 
import { Users, PlusCircle, Search, Edit, Trash2, Loader2, AlertTriangle, Info, MoreVertical, GitBranch } from "lucide-react";
import type { PlatformUser, PlatformUserFormData, QrClient, SocioVipMember, PlatformUserRole, InitialDataForPlatformUserCreation } from "@/lib/types";
import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as ShadcnAlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { PLATFORM_USER_ROLE_TRANSLATIONS } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, deleteDoc, query, where, updateDoc, limit } from "firebase/firestore";
import { PlatformUserForm } from "@/components/admin/forms/PlatformUserForm";
import { DniEntryDialog } from "@/components/business/promoters/DniEntryDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError, type SecurityRuleContext } from "@/lib/errors";


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
  
  const [showDniEntryModal, setShowDniEntryModal] = useState(false);
  const [showUserFormModal, setShowUserFormModal] = useState(false);

  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  
  const [showDniIsPlatformUserAlert, setShowDniIsPlatformUserAlert] = useState(false);
  const [showUserNotFoundAlert, setShowUserNotFoundAlert] = useState(false);
  const [dniNotFound, setDniNotFound] = useState("");
  const [existingPlatformUserToEdit, setExistingPlatformUserToEdit] = useState<PlatformUser | null>(null);

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
        if (data.roles.includes('staff') || data.roles.includes('lector_qr') || data.roles.includes('business_admin')) {
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
    const platformUserQuery = query(collection(db, "platformUsers"), where("dni", "==", dniToVerify), limit(1));
    const platformUserSnap = await getDocs(platformUserQuery);

    if (!platformUserSnap.empty) {
        const docData = platformUserSnap.docs[0].data();
        result = {
            exists: true,
            userType: 'PlatformUser',
            platformUserData: { id: platformUserSnap.docs[0].id, ...docData } as PlatformUser
        };
    }
    return result; 
  };
  
  const handleOpenCreateUserFlow = () => {
    setEditingUser(null);
    setExistingPlatformUserToEdit(null);
    setShowDniIsPlatformUserAlert(false);
    setShowUserNotFoundAlert(false);
    setDniNotFound("");
    setShowDniEntryModal(true); 
  };
  
  const handleDniVerificationSubmit = async (docNumber: string) => {
    setIsSubmitting(true);
    setShowDniEntryModal(false);

    try {
        const result = await checkDniExists(docNumber);
        
        if (result.exists && result.userType === 'PlatformUser' && result.platformUserData) {
            setExistingPlatformUserToEdit(result.platformUserData);
            setShowDniIsPlatformUserAlert(true);
        } else {
            setDniNotFound(docNumber);
            setShowUserNotFoundAlert(true);
        }
    } catch (error: any) {
        toast({ title: "Error de Verificación", description: "No se pudo completar la búsqueda. " + error.message, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleReassignRole = () => {
      if (existingPlatformUserToEdit) {
          setEditingUser(existingPlatformUserToEdit);
          setShowUserFormModal(true); 
      }
      setShowDniIsPlatformUserAlert(false);
  };

  const handleCreateOrEditUser = async (data: PlatformUserFormData, isEditing: boolean) => {
    if (isSubmitting || !currentBusinessId || !currentUser) {
      toast({ title: "Error", description: "Operación no permitida o negocio no identificado.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    
    if (isEditing) {
        const userRef = doc(db, "platformUsers", data.uid!);
        const isReassigning = existingPlatformUserToEdit && existingPlatformUserToEdit.uid === data.uid;
        
        const rolesAllowed: PlatformUserRole[] = ['business_admin', 'staff', 'lector_qr'];
        const finalRoles = data.roles.filter(role => rolesAllowed.includes(role as PlatformUserRole));
        
        if (userProfile?.uid === data.uid && !finalRoles.some(r => r === 'business_admin' || r === 'staff')) {
          toast({ title: "Acción no permitida", description: "No puedes quitarte a ti mismo el rol de administrador o staff.", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
        
        const userPayload: Partial<PlatformUser> = {
          name: data.name,
          dni: data.dni,
          roles: finalRoles,
          businessId: isReassigning ? currentBusinessId : data.businessId,
        };

        if(isReassigning) {
            userPayload.businessIds = []; 
        }

        updateDoc(userRef, userPayload)
          .then(() => {
              toast({ title: isReassigning ? "Usuario Reasignado" : "Usuario Actualizado", description: `El perfil de "${data.name}" ha sido actualizado.` });
              setShowUserFormModal(false);
              setEditingUser(null);
              fetchStaffMembers();
          })
          .catch(async (serverError) => {
              const permissionError = new FirestorePermissionError({
                  path: userRef.path,
                  operation: 'update',
                  requestResourceData: userPayload,
              } as SecurityRuleContext);
              errorEmitter.emit('permission-error', permissionError);
          })
          .finally(() => {
              setIsSubmitting(false);
          });
    } else {
        toast({ title: "Acción no soportada", description: "La creación de usuarios se realiza desde el panel de Super Administrador.", variant: "destructive" });
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

  const PromoterMobileCards = ({ filteredStaff }: { filteredStaff: PlatformUser[] }) => {
    if (filteredStaff.length === 0) {
      return (
        <div className="md:hidden text-center h-24 flex items-center justify-center">
            <p>No se encontró personal.</p>
        </div>
      );
    }
    return (
      <div className="md:hidden space-y-4">
        {filteredStaff.map((staff) => (
          <Card key={staff.id} className="overflow-hidden">
            <CardHeader className="p-4">
              <CardTitle className="font-headline">{staff.name}</CardTitle>
              <CardDescription>{staff.email}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">DNI/CE</span>
                <span className="font-semibold">{staff.dni}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Roles</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {staff.roles?.map(role => (
                    <Badge key={role} variant="secondary" className="text-xs">
                        {PLATFORM_USER_ROLE_TRANSLATIONS[role as PlatformUserRole] || role}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-2 bg-muted/50 justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white px-3 h-8">
                    Acciones
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => { setEditingUser(staff); setShowUserFormModal(true); }} disabled={isSubmitting}>
                    <Edit className="h-4 w-4 mr-2" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator/>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem 
                        onSelect={(e) => e.preventDefault()} 
                        className="text-destructive focus:bg-destructive/10"
                        disabled={isSubmitting || staff.uid === userProfile?.uid}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle><ShadcnAlertDialogDescription>Eliminarás el perfil de <span className="font-semibold">{staff.name}</span>. Esta acción no elimina su cuenta de acceso.</ShadcnAlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteUser(staff)} className="bg-destructive hover:bg-destructive/90" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Eliminar Perfil"}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-primary flex items-center self-start">
          <Users className="h-8 w-8 mr-2" /> Mi Personal
        </h1>
        <div className="self-end sm:self-center">
            <Button onClick={handleOpenCreateUserFlow} variant="gradient" disabled={isLoading || !currentBusinessId}>
              <PlusCircle className="mr-2 h-4 w-4" /> Añadir Personal
            </Button>
        </div>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Miembros del Personal</CardTitle>
          <CardDescription>Administra los usuarios staff y lectores QR de tu negocio.</CardDescription>
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
          <>
            <PromoterMobileCards filteredStaff={filteredStaff} />
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>DNI/CE</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.map((staff) => (
                    <TableRow key={staff.id}>
                      <TableCell className="font-medium">{staff.name}</TableCell>
                      <TableCell>{staff.dni}</TableCell>
                      <TableCell>{staff.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {staff.roles?.map(role => (
                              <Badge key={role} variant="secondary" className="text-xs">
                                  {PLATFORM_USER_ROLE_TRANSLATIONS[role as PlatformUserRole] || role}
                              </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingUser(staff); setShowUserFormModal(true); }} disabled={isSubmitting}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={isSubmitting || staff.uid === userProfile?.uid}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle><ShadcnAlertDialogDescription>Eliminarás el perfil de <span className="font-semibold">{staff.name}</span>. Esta acción no elimina su cuenta de acceso.</ShadcnAlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(staff)} className="bg-destructive hover:bg-destructive/90" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Eliminar Perfil"}</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        </CardContent>
      </Card>
      
      {showDniEntryModal && (
        <DniEntryDialog
            open={showDniEntryModal}
            onOpenChange={(isOpen) => !isOpen && setShowDniEntryModal(false)}
            isSubmitting={isSubmitting}
            onDniVerified={(result) => {
                setShowDniEntryModal(false);
                handleDniVerificationSubmit(result.dni);
            }}
            onAlreadyLinked={(link) => {
                setShowDniEntryModal(false);
                setExistingPlatformUserToEdit(link as any);
                setShowDniIsPlatformUserAlert(true);
            }}
        />
      )}
      
      {showUserFormModal && (
        <UIDialog open={showUserFormModal} onOpenChange={setShowUserFormModal}>
            <UIDialogContent className="sm:max-w-lg">
            <UIDialogHeader>
                <UIDialogTitle className="font-headline">{editingUser ? `Editar Personal: ${editingUser.name}` : "Asignar Rol"}</UIDialogTitle>
                <UIDialogDescription>{editingUser ? "Actualiza los detalles del perfil." : "Asigna un rol a este usuario."}</UIDialogDescription>
            </UIDialogHeader>
            <PlatformUserForm 
                user={editingUser || undefined}
                businesses={[]}
                allowedRoles={['staff', 'lector_qr']}
                onSubmit={handleCreateOrEditUser}
                onCancel={() => {setShowUserFormModal(false); setEditingUser(null);}}
                isSubmitting={isSubmitting}
            />
            </UIDialogContent>
        </UIDialog>
      )}

      <AlertDialog open={showDniIsPlatformUserAlert} onOpenChange={setShowDniIsPlatformUserAlert}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center"><AlertTriangle className="h-6 w-6 text-yellow-500 mr-2"/> Usuario Existente Detectado</AlertDialogTitle>
                <ShadcnAlertDialogDescription>
                    El usuario <span className="font-semibold">{existingPlatformUserToEdit?.name}</span> ya existe en la plataforma.
                    <br/><br/>
                    ¿Deseas editar sus roles para este negocio?
                </ShadcnAlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowDniIsPlatformUserAlert(false)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleReassignRole} className="bg-primary hover:bg-primary/90">
                    <GitBranch className="mr-2 h-4 w-4"/> Editar Roles
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       <AlertDialog open={showUserNotFoundAlert} onOpenChange={setShowUserNotFoundAlert}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center">
                    <Info className="h-6 w-6 mr-2 text-blue-500"/> Usuario no Registrado
                </AlertDialogTitle>
                <ShadcnAlertDialogDescription className="pt-4 space-y-3">
                    <p>El documento <strong>{dniNotFound}</strong> no corresponde a un usuario con una cuenta en la plataforma.</p>
                    <p>Para añadirlo a tu equipo, el usuario primero debe crear su cuenta personal en SocioVIP.</p>
                    <div className="bg-muted p-3 rounded-md text-center">
                        <p className="text-sm font-semibold">Indícale al usuario que se registre en:</p>
                        <a href="/signup" target="_blank" className="text-primary font-bold underline">sociovip.app/signup</a>
                        <p className="text-xs text-muted-foreground mt-1">Una vez registrado, podrás buscarlo por su DNI para asignarle un rol.</p>
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
