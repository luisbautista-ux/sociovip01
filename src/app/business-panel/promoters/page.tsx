
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, Loader2, UserPlus } from "lucide-react";
import type { BusinessPromoterLink, BusinessPromoterFormData, InitialDataForPromoterLink, PromoterCommissionEntry } from "@/lib/types";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where } from "firebase/firestore";

import { DniEntryDialog } from "@/components/business/promoters/DniEntryDialog";
import { PromoterFormDialog } from "@/components/business/promoters/PromoterFormDialog";
import { PaymentDialog } from "@/components/business/promoters/PaymentDialog";
import { PromotersTable } from "@/components/business/promoters/PromotersTable";
import { PromoterMobileCards } from "@/components/business/promoters/PromoterMobileCards";
import { sanitizeObjectForFirestore } from "@/lib/utils";

export default function BusinessPromotersPage() {
    const { userProfile, currentUser } = useAuth();
    const currentBusinessId = userProfile?.businessId;

    const [searchTerm, setSearchTerm] = useState("");
    const [commissionData, setCommissionData] = useState<PromoterCommissionEntry[]>([]);
    const [linksData, setLinksData] = useState<BusinessPromoterLink[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    
    // State for modal visibility control
    const [modalStep, setModalStep] = useState<'closed' | 'dni_entry' | 'promoter_form'>('closed');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    
    const [editingPromoterLink, setEditingPromoterLink] = useState<BusinessPromoterLink | null>(null);
    const [verifiedPromoterDniResult, setVerifiedPromoterDniResult] = useState<InitialDataForPromoterLink | null>(null);
    const [promoterForPayment, setPromoterForPayment] = useState<{ name: string; uid: string; pendingAmount: number } | null>(null);

    const fetchData = useCallback(async () => {
        if (!currentBusinessId || !currentUser) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const idToken = await currentUser.getIdToken();
            const response = await fetch('/api/business-panel/get-commissions-summary', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${idToken}` },
            });
            if (!response.ok) throw new Error('Error al obtener los datos de comisiones.');
            
            const commissions: PromoterCommissionEntry[] = await response.json();
            
            const promoterLinksQuery = query(collection(db, "businessPromoterLinks"), where("businessId", "==", currentBusinessId));
            const promoterLinksSnap = await getDocs(promoterLinksQuery);
            const promoterLinks = promoterLinksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BusinessPromoterLink));
            const promoterUids = new Set(promoterLinks.map(link => link.platformUserUid));
            
            setLinksData(promoterLinks);
            setCommissionData(commissions.filter(comm => promoterUids.has(comm.promoterId)));

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

    const filteredCommissionsDetails = useMemo(() => {
        const promoterCommissionTotals = commissions.reduce((acc, comm) => {
            if (!acc[comm.promoterId]) {
                acc[comm.promoterId] = {
                    ...comm,
                    commissionPending: 0,
                    commissionPaid: 0,
                    promoterCodesRedeemed: 0,
                    entityName: 'Todas',
                    entityType: 'promotion'
                };
            }
            acc[comm.promoterId].commissionPending += comm.commissionPending;
            acc[comm.promoterId].commissionPaid += comm.commissionPaid;
            acc[comm.promoterId].promoterCodesRedeemed += comm.promoterCodesRedeemed;
            return acc;
        }, {} as Record<string, PromoterCommissionEntry>);

        return Object.values(promoterCommissionTotals).filter(comm => 
            comm.promoterName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [commissions, searchTerm]);

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
          const { password, ...updatePayload } = data; // password is not part of link
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
              commissionRate: '' // Commission rate is on the link, not the user
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

    const handleConfirmPayment = async (promoterUid: string, amount: number, notes?: string) => {
        if (!currentUser) {
            toast({ title: "Error", description: "No se puede registrar el pago. Sesión no válida.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            const idToken = await currentUser.getIdToken();
            const response = await fetch('/api/business-panel/register-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ promoterUid, amount, notes }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error al registrar el pago.');
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
                placeholder="Buscar por nombre de promotor..."
                className="pl-8 w-full sm:w-[300px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-60">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="ml-4 text-lg text-muted-foreground">Cargando promotores...</p>
              </div>
            ) : linksData.length === 0 && !searchTerm ? (
              <p className="text-center text-muted-foreground h-24 flex items-center justify-center">
                Aún no has vinculado ningún promotor a tu negocio.
              </p>
            ) : (
              <>
                <PromoterMobileCards
                  commissions={filteredCommissionsDetails}
                  links={linksData}
                  onToggleStatus={handleTogglePromoterLinkStatus}
                  onRegisterPayment={handleOpenPaymentDialog}
                  onEditLink={handleOpenEditLink}
                  onDeleteLink={handleDeletePromoterLink}
                  isSubmitting={isSubmitting}
                />
                <PromotersTable
                  commissions={filteredCommissionsDetails}
                  links={linksData}
                  onToggleStatus={handleTogglePromoterLinkStatus}
                  onRegisterPayment={handleOpenPaymentDialog}
                  onEditLink={handleOpenEditLink}
                  onDeleteLink={handleDeletePromoterLink}
                  isSubmitting={isSubmitting}
                />
              </>
            )}
          </CardContent>
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
        
        {showPaymentModal && (
            <PaymentDialog
                open={showPaymentModal}
                onOpenChange={setShowPaymentModal}
                promoter={promoterForPayment}
                onConfirmPayment={handleConfirmPayment}
                isSubmitting={isSubmitting}
            />
        )}
      </div>
    );
  }

    

    