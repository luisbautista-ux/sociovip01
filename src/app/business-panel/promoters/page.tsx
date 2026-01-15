

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, Loader2, UserPlus, ListChecks } from "lucide-react";
import type { BusinessPromoterLink, BusinessPromoterFormData, InitialDataForPromoterLink, PromoterCommissionEntry, BusinessPromoterLinkWithCommissions, GeneratedCode } from "@/lib/types";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, writeBatch, runTransaction } from "firebase/firestore";

import { DniEntryDialog } from "@/components/business/promoters/DniEntryDialog";
import { PromoterFormDialog } from "@/components/business/promoters/PromoterFormDialog";
import { PaymentDialog } from "@/components/business/promoters/PaymentDialog";
import { PromotersTable } from "@/components/business/promoters/PromotersTable";
import { PromoterMobileCards } from "@/components/business/promoters/PromoterMobileCards";
import { CommissionDetailsDialog } from "@/components/business/promoters/CommissionDetailsDialog";
import { sanitizeObjectForFirestore } from "@/lib/utils";
import { DEFAULT_COMMISSION_PER_CODE } from "@/lib/constants";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function BusinessPromotersPage() {
    const { userProfile, currentUser } = useAuth();
    const currentBusinessId = userProfile?.businessId;

    const [searchTerm, setSearchTerm] = useState("");
    const [allCommissions, setAllCommissions] = useState<PromoterCommissionEntry[]>([]);
    const [allPromoterLinks, setAllPromoterLinks] = useState<BusinessPromoterLink[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    
    const [modalStep, setModalStep] = useState<'closed' | 'dni_entry' | 'promoter_form'>('closed');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    
    const [editingPromoterLink, setEditingPromoterLink] = useState<BusinessPromoterLink | null>(null);
    const [verifiedPromoterDniResult, setVerifiedPromoterDniResult] = useState<InitialDataForPromoterLink | null>(null);
    const [promoterForPayment, setPromoterForPayment] = useState<{ name: string; uid: string; pendingAmount: number } | null>(null);
    const [promoterForDetails, setPromoterForDetails] = useState<{ name: string; uid: string; commissions: PromoterCommissionEntry[] } | null>(null);
    
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
            
            // 1. Fetch all promoter links for the business
            const promoterLinksQuery = query(collection(db, "businessPromoterLinks"), where("businessId", "==", currentBusinessId));
            const promoterLinksSnap = await getDocs(promoterLinksQuery);
            const links = promoterLinksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BusinessPromoterLink));
            setAllPromoterLinks(links);

            // 2. Fetch all commission data for the business
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
        setModalStep('dni_entry');
        setEditingPromoterLink(null);
        setVerifiedPromoterDniResult(null);
    };

    const handleOpenEditLink = (link: BusinessPromoterLink) => {
        setEditingPromoterLink(link);
        setVerifiedPromoterDniResult(null);
        setModalStep('promoter_form');
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


    const handleAddOrEditPromoterLink = async (data: BusinessPromoterFormData) => {
      if (!currentBusinessId || !currentUser) {
          toast({ title: "Error de Sesión", description: "No se puede completar la operación.", variant: "destructive" });
          return;
      }
      setIsSubmitting(true);
      try {
        const idToken = await currentUser.getIdToken();
        
        if (editingPromoterLink) { 
          const linkRef = doc(db, "businessPromoterLinks", editingPromoterLink.id);
          const { password, ...updatePayload } = data;
          await updateDoc(linkRef, sanitizeObjectForFirestore(updatePayload as any));
          toast({ title: "Vínculo Actualizado", description: `Se actualizó la información para ${data.promoterName}.` });
        
        } else if (verifiedPromoterDniResult?.existingPlatformUserPromoter) {
           const linkPayload = {
              promoterUid: verifiedPromoterDniResult.existingPlatformUserPromoter.uid,
              promoterData: {
                  promoterDni: verifiedPromoterDniResult.dni,
                  promoterName: data.promoterName,
                  promoterEmail: data.promoterEmail,
                  promoterPhone: data.promoterPhone || "",
              }
            };
            const response = await fetch('/api/business-panel/link-promoter', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }, 
                body: JSON.stringify(linkPayload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error al vincular promotor.');
          toast({ title: "Promotor Vinculado", description: `${data.promoterName} ha sido vinculado a tu negocio.` });

        } else if(verifiedPromoterDniResult) { 
          if(!data.password) throw new Error("La contraseña es requerida para un nuevo promotor.");
          const creationPayload = {
            email: data.promoterEmail, password: data.password, displayName: data.promoterName,
            firestoreData: {
              dni: verifiedPromoterDniResult.dni, name: data.promoterName, email: data.promoterEmail,
              phone: data.promoterPhone,
              commissionRate: '' 
            }
          };
          const response = await fetch('/api/business-panel/create-promoter', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }, 
            body: JSON.stringify(creationPayload)
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Error al crear promotor.');
          toast({ title: "Promotor Creado y Vinculado", description: `Se creó el usuario para ${data.promoterName}.` });
        }
        
        setModalStep('closed');
        fetchData();
      } catch (error: any) {
        toast({ title: "Error al Guardar", description: `No se pudo procesar la solicitud. ${error.message}`, variant: "destructive"});
      } finally {
        setIsSubmitting(false);
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
            fetchData(); // Vuelve a cargar todos los datos
        } catch (error: any) {
            toast({ title: "Error al Registrar Pago", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeletePromoterLink = async (link: BusinessPromoterLink) => {
        setIsSubmitting(true);
        try {
            await deleteDoc(doc(db, "businessPromoterLinks", link.id));
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
                  onEditLink={handleOpenEditLink}
                  onDeleteLink={handleDeletePromoterLink}
                  onOpenPaymentDialog={handleOpenPaymentDialog}
                  isSubmitting={isSubmitting}
                />
                <PromotersTable
                  promoters={paginatedPromoters}
                  onToggleStatus={handleTogglePromoterLinkStatus}
                  onViewDetails={handleOpenDetailsDialog}
                  onEditLink={handleOpenEditLink}
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

        {modalStep === 'dni_entry' && (
            <DniEntryDialog
                open={modalStep === 'dni_entry'}
                onOpenChange={(isOpen) => !isOpen && setModalStep('closed')}
                isSubmitting={isSubmitting}
                onDniVerified={(result) => {
                    setVerifiedPromoterDniResult(result);
                    setModalStep('promoter_form');
                }}
                onAlreadyLinked={(link) => {
                    setModalStep('closed');
                    handleOpenEditLink(link);
                }}
            />
        )}
        
        {modalStep === 'promoter_form' && (
            <PromoterFormDialog
                open={modalStep === 'promoter_form'}
                onOpenChange={(isOpen) => !isOpen && setModalStep('closed')}
                isSubmitting={isSubmitting}
                promoterLinkToEdit={editingPromoterLink}
                initialData={verifiedPromoterDniResult}
                onSubmit={handleAddOrEditPromoterLink}
            />
        )}
        
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

    