

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, Loader2, UserPlus, ListChecks, GitBranch, AlertTriangle } from "lucide-react";
import type { BusinessPromoterLink, BusinessPromoterFormData, InitialDataForPromoterLink, PromoterCommissionEntry, BusinessPromoterLinkWithCommissions, GeneratedCode, PlatformUser, PlatformUserRole } from "@/lib/types";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, writeBatch, runTransaction, arrayUnion, limit } from "firebase/firestore";

import { DniEntryDialog } from "@/components/business/promoters/DniEntryDialog";
import { PaymentDialog } from "@/components/business/promoters/PaymentDialog";
import { PromotersTable } from "@/components/business/promoters/PromotersTable";
import { PromoterMobileCards } from "@/components/business/promoters/PromoterMobileCards";
import { CommissionDetailsDialog } from "@/components/business/promoters/CommissionDetailsDialog";
import { sanitizeObjectForFirestore } from "@/lib/utils";
import { DEFAULT_COMMISSION_PER_CODE } from "@/lib/constants";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogDescription as UIDialogDescription } from "@/components/ui/dialog"; 
import { PlatformUserForm } from "@/components/admin/forms/PlatformUserForm";
import { Info } from "lucide-react";

interface CheckDniResult {
  exists: boolean;
  userData?: PlatformUser;
  isAlreadyLinkedToThisBusiness?: boolean;
  linkData?: BusinessPromoterLink;
}

export default function BusinessPromotersPage() {
    const { userProfile, currentUser } = useAuth();
    const currentBusinessId = userProfile?.businessId;

    const [searchTerm, setSearchTerm] = useState("");
    const [allCommissions, setAllCommissions] = useState<PromoterCommissionEntry[]>([]);
    const [allPromoterLinks, setAllPromoterLinks] = useState<BusinessPromoterLink[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    
    // State for the new flow
    const [showDniEntryModal, setShowDniEntryModal] = useState(false);
    const [showUserFormModal, setShowUserFormModal] = useState(false);
    const [showUserNotFoundAlert, setShowUserNotFoundAlert] = useState(false);
    const [showDniAlreadyExistsAlert, setShowDniAlreadyExistsAlert] = useState(false);
    const [userToLink, setUserToLink] = useState<PlatformUser | null>(null);
    const [dniNotFound, setDniNotFound] = useState("");
    
    const [promoterForPayment, setPromoterForPayment] = useState<{ name: string; uid: string; pendingAmount: number } | null>(null);
    const [promoterForDetails, setPromoterForDetails] = useState<{ name: string; uid: string; commissions: PromoterCommissionEntry[] } | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);


    const fetchData = useCallback(async () => {
        if (!currentBusinessId || !currentUser) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const idToken = await currentUser.getIdToken();
            
            const promoterLinksQuery = query(collection(db, "businessPromoterLinks"), where("businessId", "==", currentBusinessId));
            const promoterLinksSnap = await getDocs(promoterLinksQuery);
            const links = promoterLinksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BusinessPromoterLink));
            setAllPromoterLinks(links);

            const response = await fetch('/api/business-panel/get-commissions-summary', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${idToken}` },
            });
            if (!response.ok) throw new Error('Error al obtener los datos de comisiones.');
            
            const commissions: PromoterCommissionEntry[] = await response.json();
            setAllCommissions(commissions);

        } catch (error: any) {
            console.error("Promoters Page: Failed to fetch data:", error);
            toast({ title: "Error al Cargar Datos", description: `No se pudieron obtener los datos. ${error.message}`, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [currentBusinessId, currentUser, toast]);

    useEffect(() => {
      fetchData();
    }, [fetchData]);

    const consolidatedPromotersData = useMemo((): BusinessPromoterLinkWithCommissions[] => {
        return allPromoterLinks.map(link => {
            const promoterCommissions = allCommissions.filter(c => c.promoterId === link.platformUserUid);
            const pendingAmount = promoterCommissions.reduce((sum, c) => sum + c.commissionPending, 0);
            const paidAmount = promoterCommissions.reduce((sum, c) => sum + c.commissionPaid, 0);

            return {
                ...link,
                pendingAmount,
                paidAmount,
            };
        });
    }, [allPromoterLinks, allCommissions]);

    const filteredPromoters = useMemo(() => {
        return consolidatedPromotersData.filter(promoter => 
            promoter.promoterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            promoter.promoterDni.includes(searchTerm)
        );
    }, [consolidatedPromotersData, searchTerm]);
    
    const totalPages = Math.ceil(filteredPromoters.length / rowsPerPage);
    const paginatedPromoters = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return filteredPromoters.slice(startIndex, startIndex + rowsPerPage);
    }, [filteredPromoters, currentPage, rowsPerPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, rowsPerPage]);

    const handleOpenAddPromoterFlow = () => {
        setShowDniEntryModal(true);
        setUserToLink(null);
    };

    const handleOpenPaymentDialog = (promoter: { uid: string, name: string, pendingAmount: number }) => {
        setPromoterForPayment(promoter);
        setShowPaymentModal(true);
    };

    const handleOpenDetailsDialog = (promoter: BusinessPromoterLinkWithCommissions) => {
        if (!promoter.platformUserUid) return;
        const promoterCommissions = allCommissions.filter(c => c.promoterId === promoter.platformUserUid);
        setPromoterForDetails({ name: promoter.promoterName, uid: promoter.platformUserUid, commissions: promoterCommissions });
        setShowDetailsModal(true);
    };
    
    const checkPromoterExists = async (dni: string): Promise<CheckDniResult> => {
        const userQuery = query(collection(db, "platformUsers"), where("dni", "==", dni), limit(1));
        const userSnap = await getDocs(userQuery);
        
        if (userSnap.empty) {
            return { exists: false };
        }

        const userData = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() } as PlatformUser;
        
        const linkQuery = query(collection(db, "businessPromoterLinks"), where("businessId", "==", currentBusinessId), where("platformUserUid", "==", userData.uid), limit(1));
        const linkSnap = await getDocs(linkQuery);
        
        return {
            exists: true,
            userData: userData,
            isAlreadyLinkedToThisBusiness: !linkSnap.empty,
            linkData: linkSnap.empty ? undefined : { id: linkSnap.docs[0].id, ...linkSnap.docs[0].data() } as BusinessPromoterLink,
        };
    };

    const handleDniVerification = async (result: { docNumber: string; docType: 'dni' | 'ce' }) => {
        setShowDniEntryModal(false);
        setIsSubmitting(true);
        
        try {
            const checkResult = await checkPromoterExists(result.docNumber);
            if (checkResult.exists && checkResult.userData) {
                if (checkResult.isAlreadyLinkedToThisBusiness) {
                    toast({ title: "Promotor ya vinculado", description: `${checkResult.userData.name} ya está vinculado a este negocio.`, variant: "default" });
                } else {
                    setUserToLink(checkResult.userData);
                    setShowDniAlreadyExistsAlert(true);
                }
            } else {
                setDniNotFound(result.docNumber);
                setShowUserNotFoundAlert(true);
            }
        } catch (error: any) {
            toast({ title: "Error de Verificación", description: `No se pudo verificar el DNI. ${error.message}`, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleLinkExistingUser = async () => {
        if (!userToLink || !currentBusinessId) return;
        
        setIsSubmitting(true);
        setShowDniAlreadyExistsAlert(false);

        try {
            const batch = writeBatch(db);
            const userRef = doc(db, "platformUsers", userToLink.uid);
            batch.update(userRef, {
                roles: arrayUnion('promoter'),
                businessIds: arrayUnion(currentBusinessId)
            });

            const linkRef = doc(collection(db, "businessPromoterLinks"));
            batch.set(linkRef, {
                businessId: currentBusinessId,
                promoterDni: userToLink.dni,
                promoterName: userToLink.name,
                promoterEmail: userToLink.email,
                promoterPhone: userToLink.phone || '',
                isActive: true,
                isPlatformUser: true,
                platformUserUid: userToLink.uid,
                joinDate: serverTimestamp(),
            });

            await batch.commit();
            toast({ title: "Promotor Vinculado", description: `${userToLink.name} ha sido vinculado a tu negocio como promotor.` });
            fetchData();
        } catch (error: any) {
            toast({ title: "Error al Vincular", description: `No se pudo vincular al promotor. ${error.message}`, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
            setUserToLink(null);
        }
    };

    const handleConfirmPayment = async (promoterUid: string, entityId: string, amount: number, notes: string | undefined) => {
        setIsSubmitting(true);
        try {
            if (!currentUser) throw new Error("No autenticado.");

            const response = await fetch('/api/business-panel/register-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
                body: JSON.stringify({ promoterUid, entityId, amount, notes }),
            });
            const result = await response.json();

            if (!response.ok) throw new Error(result.error || 'Ocurrió un error en el servidor.');

            toast({ title: "Pago Registrado", description: `Se registró un pago de S/ ${amount.toFixed(2)}.` });
            setShowPaymentModal(false);
            fetchData(); 
        } catch (error: any) {
            toast({ title: "Error al Registrar Pago", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeletePromoterLink = async (link: BusinessPromoterLink) => {
        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            // Remove from businessPromoterLinks
            batch.delete(doc(db, "businessPromoterLinks", link.id));
            
            // Remove businessId from promoter's profile if they have a UID
            if(link.platformUserUid && currentBusinessId){
                const userRef = doc(db, "platformUsers", link.platformUserUid);
                // Atomically remove the businessId from the array
                batch.update(userRef, { businessIds: (await getDoc(userRef)).data()?.businessIds.filter((id: string) => id !== currentBusinessId) });
            }

            await batch.commit();
            toast({ title: "Promotor Desvinculado", description: `${link.promoterName || 'El promotor'} ha sido desvinculado.`, variant: "destructive" });
            fetchData();
        } catch (error: any) {
            toast({ title: "Error al Desvincular", description: `No se pudo desvincular al promotor. ${error.message}`, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTogglePromoterLinkStatus = async (link: BusinessPromoterLink) => {
      setIsSubmitting(true);
      const newStatus = !link.isActive;
      try {
        await updateDoc(doc(db, "businessPromoterLinks", link.id), { isActive: newStatus });
        toast({ title: `Estado Actualizado`, description: `El promotor ${link.promoterName} ahora está ${newStatus ? 'activo' : 'inactivo'}.` });
        fetchData(); 
      } catch (error: any) {
        toast({ title: "Error al Actualizar Estado", description: `No se pudo cambiar el estado. ${error.message}`, variant: "destructive"});
      } finally {
          setIsSubmitting(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold text-primary flex items-center self-start">
            <UserPlus className="h-8 w-8 mr-2" /> Mis Promotores
          </h1>
          <div className="self-end sm:self-center">
            <Button onClick={handleOpenAddPromoterFlow} variant="gradient" disabled={isLoading || !currentBusinessId}>
              <PlusCircle className="mr-2 h-4 w-4" /> Añadir/Vincular Promotor
            </Button>
          </div>
        </div>
        
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Resumen de Comisiones por Promotor</CardTitle>
            <CardDescription>Gestiona tus promotores y sus comisiones acumuladas.</CardDescription>
            <div className="relative mt-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por nombre de promotor o DNI..."
                className="pl-8 w-full sm:w-[300px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="text-sm text-muted-foreground pt-4">
              Mostrando <span className="font-semibold text-foreground">{paginatedPromoters.length}</span> de <span className="font-semibold text-foreground">{filteredPromoters.length}</span> promotores totales.
          </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-60">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="ml-4 text-lg text-muted-foreground">Cargando promotores...</p>
              </div>
            ) : allPromoterLinks.length === 0 && !searchTerm ? (
              <p className="text-center text-muted-foreground h-24 flex items-center justify-center">
                Aún no has vinculado ningún promotor a tu negocio.
              </p>
            ) : (
              <>
                <PromoterMobileCards
                  promoters={paginatedPromoters}
                  onToggleStatus={handleTogglePromoterLinkStatus}
                  onViewDetails={handleOpenDetailsDialog}
                  onEditLink={() => { /* Edit link logic to be implemented if needed */ }}
                  onDeleteLink={handleDeletePromoterLink}
                  onOpenPaymentDialog={handleOpenPaymentDialog}
                  isSubmitting={isSubmitting}
                />
                <PromotersTable
                  promoters={paginatedPromoters}
                  onToggleStatus={handleTogglePromoterLinkStatus}
                  onViewDetails={handleOpenDetailsDialog}
                  onEditLink={() => { /* Edit link logic to be implemented if needed */ }}
                  onDeleteLink={handleDeletePromoterLink}
                  onOpenPaymentDialog={handleOpenPaymentDialog}
                  isSubmitting={isSubmitting}
                />
              </>
            )}
          </CardContent>
          {totalPages > 1 && (
            <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t">
              <div className="flex items-center space-x-2 text-sm">
                <Label htmlFor="rows-per-page-promoters">Filas por página:</Label>
                <Select
                  value={`${rowsPerPage}`}
                  onValueChange={(value) => setRowsPerPage(Number(value))}
                >
                  <SelectTrigger id="rows-per-page-promoters" className="h-8 w-[70px]">
                    <SelectValue placeholder={rowsPerPage} />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50].map((pageSize) => (
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

        <DniEntryDialog
            open={showDniEntryModal}
            onOpenChange={setShowDniEntryModal}
            isSubmitting={isSubmitting}
            onDniVerified={(result) => handleDniVerification(result as any)}
            onAlreadyLinked={(link) => {
                setShowDniEntryModal(false);
                toast({ title: "Promotor ya vinculado", description: `${link.promoterName} ya está vinculado a este negocio.`, variant: "default" });
            }}
        />
        
        <AlertDialog open={showDniAlreadyExistsAlert} onOpenChange={setShowDniAlreadyExistsAlert}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center"><AlertTriangle className="h-6 w-6 text-yellow-500 mr-2"/> Promotor Existente Detectado</AlertDialogTitle>
                    <AlertDialogDescription>
                        El usuario <span className="font-semibold">{userToLink?.name}</span> ya tiene una cuenta. ¿Deseas vincularlo como promotor a tu negocio?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setShowDniAlreadyExistsAlert(false)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLinkExistingUser} className="bg-primary hover:bg-primary/90">
                        <GitBranch className="mr-2 h-4 w-4"/> Vincular Promotor
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
                <AlertDialogDescription className="pt-4 space-y-3">
                    <p>El documento <strong>{dniNotFound}</strong> no corresponde a un usuario con una cuenta en la plataforma.</p>
                    <p>Para añadirlo como promotor, la persona primero debe crear su propia cuenta personal en SocioVIP.</p>
                    <div className="bg-muted p-3 rounded-md text-center">
                        <p className="text-sm font-semibold">Indícale al usuario que se registre en:</p>
                        <a href="/signup" target="_blank" className="text-primary font-bold underline">sociovip.app/signup</a>
                        <p className="text-xs text-muted-foreground mt-1">Una vez registrado, podrás buscarlo por su DNI para vincularlo.</p>
                    </div>
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogAction onClick={() => setShowUserNotFoundAlert(false)} className="bg-primary hover:bg-primary/90">
                    Entendido
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
        
        {showPaymentModal && promoterForPayment && (
            <PaymentDialog
                open={showPaymentModal}
                onOpenChange={setShowPaymentModal}
                promoter={promoterForPayment}
                allCommissions={allCommissions}
                onConfirmPayment={handleConfirmPayment}
                isSubmitting={isSubmitting}
            />
        )}

        {showDetailsModal && promoterForDetails && (
            <CommissionDetailsDialog
                open={showDetailsModal}
                onOpenChange={(isOpen) => {
                    if (!isOpen) setPromoterForDetails(null);
                    setShowDetailsModal(isOpen);
                }}
                promoterName={promoterForDetails.name}
                promoterUid={promoterForDetails.uid}
                commissionEntries={promoterForDetails.commissions}
            />
        )}

      </div>
    );
  }

    
