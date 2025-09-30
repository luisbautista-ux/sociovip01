"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as ShadcnCardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode as QrCodeIcon, ListChecks, Gift, Building, Loader2, Info, Ticket, Calendar, Box, Star, Search } from "lucide-react";
import type { BusinessManagedEntity, GeneratedCode, Business, PromoterEntityView, EventBox, QrClient, SocioVipMember } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CreateCodesDialog } from "@/components/business/dialogs/CreateCodesDialog";
import { ManageCodesDialog } from "@/components/business/dialogs/ManageCodesDialog";
import { useToast } from "@/hooks/use-toast";
import { isEntityCurrentlyActivatable, sanitizeObjectForFirestore } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp, doc, updateDoc, getDoc, runTransaction } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function PromoterEntitiesPage() {
  const { userProfile, loadingAuth, loadingProfile, currentUser } = useAuth();
  const [promotions, setPromotions] = useState<PromoterEntityView[]>([]);
  const [events, setEvents] = useState<PromoterEntityView[]>([]);
  const [businessesMap, setBusinessesMap] = useState<Map<string, Business>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [showCreateCodesModal, setShowCreateCodesModal] = useState(false);
  const [selectedEntityForCreatingCodes, setSelectedEntityForCreatingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const [showManageCodesModal, setShowManageCodesModal] = useState(false);
  const [selectedEntityForViewingCodes, setSelectedEntityForViewingCodes] = useState<BusinessManagedEntity | null>(null);

  const [showBoxesModal, setShowBoxesModal] = useState(false);
  const [selectedEventForBoxes, setSelectedEventForBoxes] = useState<PromoterEntityView | null>(null);

  const getPromoterCodeStats = useCallback((entityGeneratedCodes: GeneratedCode[] | undefined): { created: number; used: number } => {
    if (!userProfile || !entityGeneratedCodes) return { created: 0, used: 0 };
    
    const promoterIdentifierUid = userProfile.uid;

    const promoterCodes = entityGeneratedCodes.filter(c => c.generatedByUid === promoterIdentifierUid);
    return {
      created: promoterCodes.length,
      used: promoterCodes.filter(c => c.status === 'redeemed' || c.status === 'used').length,
    };
  }, [userProfile]);
  
  const fetchAssignedEntities = useCallback(async () => {
    if (!userProfile || !userProfile.businessIds || userProfile.businessIds.length === 0) {
      console.warn("Promoter Entities Page: No businessIds found in profile, cannot fetch entities.");
      setPromotions([]);
      setEvents([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    console.log(`Promoter Entities Page: Fetching entities for businesses:`, userProfile.businessIds);

    try {
      const assignedBusinessIds = userProfile.businessIds;
      const businessesQuery = query(collection(db, "businesses"), where("__name__", "in", assignedBusinessIds));
      const businessesSnapshot = await getDocs(businessesQuery);
      const businessesDataMap = new Map<string, Business>();
      businessesSnapshot.forEach(doc => {
          businessesDataMap.set(doc.id, { id: doc.id, ...doc.data() } as Business);
      });
      setBusinessesMap(businessesDataMap);

      const entitiesQuery = query(
        collection(db, "businessEntities"),
        where("businessId", "in", assignedBusinessIds),
        where("isActive", "==", true)
      );
      const entitiesSnap = await getDocs(entitiesQuery);
      
      const promoterAssignedPromotions: PromoterEntityView[] = [];
      const promoterAssignedEvents: PromoterEntityView[] = [];

      entitiesSnap.forEach(docSnap => {
        const data = docSnap.data();
        const nowISO = new Date().toISOString();
        let startDateStr: string;
        if (data.startDate instanceof Timestamp) startDateStr = data.startDate.toDate().toISOString();
        else if (typeof data.startDate === 'string') startDateStr = data.startDate;
        else if (data.startDate instanceof Date) startDateStr = data.startDate.toISOString();
        else startDateStr = nowISO;

        let endDateStr: string;
        if (data.endDate instanceof Timestamp) endDateStr = data.endDate.toDate().toISOString();
        else if (typeof data.endDate === 'string') endDateStr = data.endDate;
        else if (data.endDate instanceof Date) endDateStr = data.endDate.toISOString();
        else endDateStr = nowISO;
        
        const entity: BusinessManagedEntity = {
          id: docSnap.id,
          ...data,
          startDate: startDateStr,
          endDate: endDateStr,
        } as BusinessManagedEntity;

        if (isEntityCurrentlyActivatable(entity)) {
          const promoterCodeStats = getPromoterCodeStats(entity.generatedCodes);
          const isAssignedToEvent = (entity.type === 'event' && (entity.assignedPromoters || []).some(p => p.promoterProfileId === userProfile.uid));
          const isPromotion = entity.type === 'promotion';
          
          if(isPromotion || isAssignedToEvent) {
             const enrichedEntity: PromoterEntityView = {
              ...entity,
              businessName: businessesDataMap.get(entity.businessId)?.name || "Negocio Desconocido",
              promoterCodesCreated: promoterCodeStats.created,
              promoterCodesUsed: promoterCodeStats.used,
            };
            if(entity.type === 'promotion') promoterAssignedPromotions.push(enrichedEntity);
            if(entity.type === 'event') promoterAssignedEvents.push(enrichedEntity);
          }
        }
      });
      
      promoterAssignedPromotions.sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      promoterAssignedEvents.sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      setPromotions(promoterAssignedPromotions);
      setEvents(promoterAssignedEvents);
      console.log(`Promoter Entities Page: Fetched ${promoterAssignedPromotions.length} promotions and ${promoterAssignedEvents.length} events.`);

    } catch (error: any) {
      console.error("Promoter Entities Page: Error fetching assigned entities:", error.code, error.message, error);
      toast({ title: "Error al cargar entidades", description: `No se pudieron cargar tus promociones y eventos asignados. ${error.message}`, variant: "destructive"});
      setPromotions([]);
      setEvents([]);
      setBusinessesMap(new Map());
    } finally {
      setIsLoading(false);
    }
  }, [userProfile, toast, getPromoterCodeStats]);

  useEffect(() => {
    if (!loadingAuth && !loadingProfile && userProfile) {
      fetchAssignedEntities();
    } else if (!loadingAuth && !loadingProfile) {
      setIsLoading(false); 
    }
  }, [userProfile, loadingAuth, loadingProfile, fetchAssignedEntities]);

  const handleNewCodesCreated = async (entityId: string, newCodes: GeneratedCode[], observation?: string): Promise<void> => {
    if (!userProfile?.name || !userProfile.uid) {
        toast({ title: "Error de Usuario", description: "Nombre o UID de promotor no disponible.", variant: "destructive" });
        throw new Error("User profile not available");
    }

    try {
        const targetEntityRef = doc(db, "businessEntities", entityId);
        await runTransaction(db, async (transaction) => {
            const targetEntitySnap = await transaction.get(targetEntityRef);
            if (!targetEntitySnap.exists()) {
                throw new Error(`La entidad "${entityId}" no fue encontrada.`);
            }
            const targetEntityData = targetEntitySnap.data() as BusinessManagedEntity;
            
            const newCodesWithDetails: GeneratedCode[] = newCodes.map(code => (sanitizeObjectForFirestore({
                ...code,
                id: code.id || `code-${entityId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                entityId: entityId,
                value: code.value,
                status: 'available',
                generatedByName: userProfile.name,
                generatedByUid: userProfile.uid,
                generatedDate: new Date().toISOString(),
                observation: observation || null,
                redemptionDate: null, 
                redeemedByInfo: null, 
                isVipCandidate: false,
                ownerName: code.ownerName,
                ownerDni: code.ownerDni,
            }) as GeneratedCode));
            
            const existingSanitizedCodes = (targetEntityData.generatedCodes || []).map(c => sanitizeObjectForFirestore(c as GeneratedCode));
            const updatedCodes = [...existingSanitizedCodes, ...newCodesWithDetails];
            
            transaction.update(targetEntityRef, { generatedCodes: updatedCodes });

            // Update local state optimistically inside transaction logic for immediate feedback
             const updateLocalState = (prev: PromoterEntityView[]) => prev.map(e => 
                e.id === entityId ? { ...e, generatedCodes: updatedCodes, promoterCodesCreated: e.promoterCodesCreated + newCodes.length } : e
            );
            setPromotions(updateLocalState);
            setEvents(updateLocalState);
        });
        
        toast({ title: "Códigos Creados", description: `${newCodes.length} código(s) añadido(s).` });
    } catch (error: any) {
        console.error("Promoter Page: Error saving new codes:", error);
        toast({ title: "Error al Guardar Códigos", description: `No se pudieron guardar los códigos. ${error.message}`, variant: "destructive" });
        fetchAssignedEntities(); // Refetch on error to ensure consistency
        throw error;
    }
  };
  
  const handleCodesUpdatedFromManageDialog = async (entityId: string, updatedCodesFromDialog: GeneratedCode[]) => {
    if (!userProfile || !userProfile.uid) {
      toast({ title: "Error de Usuario", description: "UID de promotor no disponible para actualizar códigos.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);
    console.log(`Promoter Entities Page: Promoter ${userProfile.name} (UID: ${userProfile.uid}) updating codes for entityId: ${entityId}`);

    const targetEntityRef = doc(db, "businessEntities", entityId);
    try {
      await runTransaction(db, async (transaction) => {
        const targetEntitySnap = await transaction.get(targetEntityRef);
        if (!targetEntitySnap.exists()) {
            throw new Error(`Entidad "${entityId}" no encontrada para actualizar códigos.`);
        }
        const targetEntityData = targetEntitySnap.data() as BusinessManagedEntity;
        
        const otherPromotersCodes = (targetEntityData.generatedCodes || []).filter(
            c => c.generatedByUid !== userProfile.uid 
        ).map(c => sanitizeObjectForFirestore(c as GeneratedCode));
        
        const thisPromotersUpdatedCodes = updatedCodesFromDialog
            .filter(c => c.generatedByUid === userProfile.uid)
            .map(c => sanitizeObjectForFirestore(c as GeneratedCode));

        const finalCodesToSave = [...otherPromotersCodes, ...thisPromotersUpdatedCodes];

        transaction.update(targetEntityRef, { generatedCodes: finalCodesToSave });
        
        // Optimistic UI update
        const updateLocalState = (prev: PromoterEntityView[]) => prev.map(e => 
            e.id === entityId ? { ...e, generatedCodes: finalCodesToSave } : e
        );
        setPromotions(updateLocalState);
        setEvents(updateLocalState);
      });
      
      toast({ title: "Mis Códigos Actualizados", description: `Tus códigos han sido actualizados.` });
      
    } catch (error: any) {
      console.error("Promoter Entities Page: Error saving updated codes from ManageDialog:", error.code, error.message, error);
      toast({ title: "Error al Actualizar Códigos", description: `No se pudieron actualizar tus códigos. ${error.message}`, variant: "destructive" });
      fetchAssignedEntities();
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateCodesDialog = (entity: PromoterEntityView) => {
    if (!isEntityCurrentlyActivatable(entity)) {
      toast({ 
        title: "Acción no permitida", 
        description: `Esta ${entity.type === 'event' ? 'evento' : 'promoción'} no está activa o está fuera de su periodo de vigencia.`, 
        variant: "destructive"
      });
      return;
    }
    setSelectedEntityForCreatingCodes(entity);
    setShowCreateCodesModal(true);
  };

  const openViewCodesDialog = (entity: PromoterEntityView) => {
    setSelectedEntityForViewingCodes(entity);
    setShowManageCodesModal(true);
  };

  const handleUpdateBoxOwner = async (entityId: string, boxId: string, ownerName: string, ownerDni: string, newStatus: 'reserved' | 'sold') => {
      if (!userProfile) return;
      setIsSubmitting(true);
      const entityRef = doc(db, "businessEntities", entityId);

      try {
          await runTransaction(db, async (transaction) => {
              const entitySnap = await transaction.get(entityRef);
              if (!entitySnap.exists()) throw new Error("El evento ya no existe.");

              const entityData = entitySnap.data() as BusinessManagedEntity;
              const boxes = [...(entityData.eventBoxes || [])];
              const boxIndex = boxes.findIndex(b => b.id === boxId);
              
              if (boxIndex === -1) throw new Error("El box ya no existe.");
              const currentBox = boxes[boxIndex];

              // Allow update only if available or reserved by the same promoter
              if (currentBox.status !== 'available' && currentBox.promoterId !== userProfile.uid) {
                  throw new Error("Este box ya fue reservado por otro promotor.");
              }

              boxes[boxIndex] = {
                ...currentBox,
                status: newStatus,
                ownerName,
                ownerDni,
                promoterId: userProfile.uid,
                promoterName: userProfile.name,
              };

              transaction.update(entityRef, { eventBoxes: boxes });
              
              // Optimistic update for local state
              const updateFunc = (prev: PromoterEntityView[]) => prev.map(e => {
                  if (e.id === entityId) {
                      const updatedEvent = { ...e, eventBoxes: boxes };
                      if (selectedEventForBoxes?.id === entityId) {
                          setSelectedEventForBoxes(updatedEvent);
                      }
                      return updatedEvent;
                  }
                  return e;
              });
              setEvents(updateFunc);
          });
          toast({ title: "Box Actualizado", description: "Los datos del dueño del box se guardaron." });
      } catch (error: any) {
          toast({ title: "Error al Actualizar Box", description: error.message, variant: "destructive" });
      } finally {
          setIsSubmitting(false);
      }
  };
  
  const EntityTable = ({ entitiesToShow, type }: { entitiesToShow: PromoterEntityView[], type: 'promotion' | 'event' }) => {
    if (entitiesToShow.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-24 text-muted-foreground border border-dashed rounded-md p-4 text-center">
            <Info className="h-8 w-8 mb-2 text-primary/70"/>
            <p className="font-semibold">No hay {type === 'event' ? 'eventos' : 'promociones'} activas asignadas.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Vista para pantallas grandes (tabla) */}
        <div className="hidden md:block">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead className="min-w-[300px]">{type === 'event' ? 'Evento' : 'Promoción'}</TableHead>
                    <TableHead className="min-w-[250px]">Mis Códigos y QRs</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {entitiesToShow.map((entity) => {
                    const promoterCodeStats = getPromoterCodeStats(entity.generatedCodes);
                    const isActivatable = isEntityCurrentlyActivatable(entity);
                    
                    return (
                    <React.Fragment key={entity.id || `entity-fallback-${Math.random()}`}>
                        <TableRow>
                            <TableCell className="font-medium align-top py-3 space-y-1">
                                <div className="font-semibold text-base">{entity.name}</div>
                                {entity.businessName && <div className="text-xs text-muted-foreground flex items-center mt-0.5"><Building size={14} className="mr-1"/>{entity.businessName}</div>}
                                <Badge variant={entity.isActive && isActivatable ? "default" : (entity.isActive ? "outline" : "destructive")} 
                                        className={cn(entity.isActive && isActivatable ? "bg-green-500 hover:bg-green-600" : (entity.isActive ? "border-yellow-500 text-yellow-600" : ""), "text-xs mt-1")}>
                                    {entity.isActive ? (isActivatable ? "Vigente" : "Activa (Fuera de Fecha)") : "Inactiva"}
                                </Badge>
                                <div className="flex items-center gap-1 pt-1.5">
                                    <Button variant="outline" size="xs" onClick={() => openCreateCodesDialog(entity)} disabled={!isActivatable || isSubmitting} className="px-2 py-1 h-auto text-xs">
                                        <QrCodeIcon className="h-3 w-3 mr-1" /> Crear Códigos
                                    </Button>
                                    <Button variant="outline" size="xs" onClick={() => openViewCodesDialog(entity)} disabled={isSubmitting} className="px-2 py-1 h-auto text-xs">
                                        <ListChecks className="h-3 w-3 mr-1" /> Ver Mis Códigos ({promoterCodeStats.created})
                                    </Button>
                                    {entity.type === 'event' && entity.eventBoxes && entity.eventBoxes.length > 0 && (
                                        <Button variant="outline" size="xs" onClick={() => {setSelectedEventForBoxes(entity); setShowBoxesModal(true);}} className="px-2 py-1 h-auto text-xs">
                                            <Box className="h-3 w-3 mr-1" /> Ver Boxes ({entity.eventBoxes.length})
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                            
                            <TableCell className="align-top py-3 text-left text-xs">
                            <div className="flex flex-col space-y-0.5">
                                <div>Códigos Creados ({promoterCodeStats.created})</div>
                                <div>QRs Generados ({entity.promoterCodesUsed || 0})</div>
                                <div>QRs Usados ({entity.generatedCodes?.filter(c => c.generatedByUid === userProfile?.uid && c.status === 'used').length || 0})</div>
                            </div>
                            </TableCell>
                        </TableRow>
                    </React.Fragment>
                    )})}
                </TableBody>
            </Table>
        </div>
        {/* Vista para pantallas pequeñas (tarjetas) */}
        <div className="md:hidden space-y-4">
           {entitiesToShow.map(entity => {
                const promoterCodeStats = getPromoterCodeStats(entity.generatedCodes);
                const isActivatable = isEntityCurrentlyActivatable(entity);
                return (
                    <Card key={entity.id} className="overflow-hidden">
                        <CardHeader className="p-4">
                            <CardTitle className="text-lg">{entity.name}</CardTitle>
                            {entity.businessName && <ShadcnCardDescription className="text-xs text-muted-foreground flex items-center pt-1"><Building size={14} className="mr-1.5"/>{entity.businessName}</ShadcnCardDescription>}
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                           <div className="flex justify-between items-start gap-4">
                                <div>
                                    <Badge variant={entity.isActive && isActivatable ? "default" : (entity.isActive ? "outline" : "destructive")} 
                                            className={cn(entity.isActive && isActivatable ? "bg-green-500 hover:bg-green-600" : (entity.isActive ? "border-yellow-500 text-yellow-600" : ""), "text-xs mt-1")}>
                                        {entity.isActive ? (isActivatable ? "Vigente" : "Activa (Fuera de Fecha)") : "Inactiva"}
                                    </Badge>
                                </div>
                                <div className="text-xs text-right shrink-0">
                                    <p>Códigos Creados: <span className="font-semibold">{promoterCodeStats.created}</span></p>
                                    <p>QRs Generados: <span className="font-semibold">{entity.promoterCodesUsed || 0}</span></p>
                                    <p>QRs Usados: <span className="font-semibold">{entity.generatedCodes?.filter(c => c.generatedByUid === userProfile?.uid && c.status === 'used').length || 0}</span></p>
                                </div>
                           </div>
                           <Separator />
                           <div className="flex flex-col gap-2">
                                <Button variant="outline" size="sm" className="w-full" onClick={() => openCreateCodesDialog(entity)} disabled={!isActivatable || isSubmitting}>
                                    <QrCodeIcon className="h-4 w-4 mr-2" /> Crear Códigos
                                </Button>
                                <Button variant="outline" size="sm" className="w-full" onClick={() => openViewCodesDialog(entity)} disabled={isSubmitting}>
                                    <ListChecks className="h-4 w-4 mr-2" /> Ver Mis Códigos
                                </Button>
                                {entity.type === 'event' && entity.eventBoxes && entity.eventBoxes.length > 0 && (
                                    <Button variant="outline" size="sm" className="w-full" onClick={() => {setSelectedEventForBoxes(entity); setShowBoxesModal(true);}}>
                                        <Box className="h-4 w-4 mr-2" /> Ver Boxes ({entity.eventBoxes.length})
                                    </Button>
                                )}
                           </div>
                        </CardContent>
                    </Card>
                )
           })}
        </div>
      </div>
    );
  };
  
  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Cargando campañas asignadas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
      <h1 className="text-3xl font-bold text-gradient flex items-center gap-2 mb-6">
          <Gift className="h-8 w-8 text-primary !block" /> Campañas
        </h1>
      </div>
      
      <section>
        <h2 className="text-2xl font-semibold tracking-tight mb-4 flex items-center"><Ticket className="h-6 w-6 mr-2 text-muted-foreground" />Promociones Activas</h2>
        <Card className="shadow-lg">
            <CardContent className="pt-6">
                <EntityTable entitiesToShow={promotions} type="promotion" />
            </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-2xl font-semibold tracking-tight mb-4 flex items-center"><Calendar className="h-6 w-6 mr-2 text-muted-foreground" />Eventos Activos</h2>
        <Card className="shadow-lg">
            <CardContent className="pt-6">
                <EntityTable entitiesToShow={events} type="event" />
            </CardContent>
        </Card>
      </section>

    <Dialog open={showBoxesModal} onOpenChange={(isOpen) => { if (!isOpen) setSelectedEventForBoxes(null); setShowBoxesModal(isOpen); }}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Boxes para: {selectedEventForBoxes?.name}</DialogTitle>
                <DialogDescription>
                    Gestiona los boxes disponibles para este evento.
                </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto space-y-2 p-1">
                {(selectedEventForBoxes?.eventBoxes && selectedEventForBoxes.eventBoxes.length > 0) ? (
                    selectedEventForBoxes.eventBoxes.map(box => (
                        <BoxManagementCard 
                            key={box.id}
                            box={box}
                            eventId={selectedEventForBoxes.id}
                            userProfile={userProfile}
                            isSubmitting={isSubmitting}
                            onUpdateBoxOwner={handleUpdateBoxOwner}
                            currentUser={currentUser}
                        />
                    ))
                ) : (
                    <p className="text-center text-muted-foreground py-8">Este evento no tiene boxes disponibles.</p>
                )}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setShowBoxesModal(false)}>Cerrar</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    {selectedEntityForCreatingCodes && userProfile && (
        <CreateCodesDialog
          open={showCreateCodesModal}
          onOpenChange={(isOpen) => { if(!isOpen) setSelectedEntityForCreatingCodes(null); setShowCreateCodesModal(isOpen);}}
          entityName={selectedEntityForCreatingCodes.name}
          entityId={selectedEntityForCreatingCodes.id!}
          existingCodesValues={(selectedEntityForCreatingCodes.generatedCodes || []).map(c => c.value)}
          onCodesCreated={handleNewCodesCreated}
          isSubmittingMain={isSubmitting}
          currentUserProfileName={userProfile.name}
          currentUserProfileUid={userProfile.uid}
          maxAttendance={selectedEntityForCreatingCodes.maxAttendance}
          currentCodeCount={selectedEntityForCreatingCodes.generatedCodes?.length || 0}
        />
      )}

    {selectedEntityForViewingCodes && userProfile && (
        <ManageCodesDialog
          open={showManageCodesModal}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedEntityForViewingCodes(null);
            setShowManageCodesModal(isOpen);
          }}
          entity={selectedEntityForViewingCodes}
          onCodesUpdated={handleCodesUpdatedFromManageDialog} 
          onRequestCreateNewCodes={() => { 
            const currentEntity = [...promotions, ...events].find(e => e.id === selectedEntityForViewingCodes?.id); 
            if(currentEntity) { 
                 if (isEntityCurrentlyActivatable(currentEntity)) {
                    setShowManageCodesModal(false); 
                    setSelectedEntityForCreatingCodes(currentEntity);
                    setShowCreateCodesModal(true);
                 } else {
                    toast({
                        title: "Acción no permitida",
                        description: `Esta ${currentEntity.type === 'event' ? 'evento' : 'promoción'} no está activa o está fuera de su periodo de vigencia.`,
                        variant: "destructive",
                    });
                 }
            }
          }}
          isPromoterView={true} 
          currentUserProfileName={userProfile.name}
          currentUserProfileUid={userProfile.uid}
          currentUserProfilePhone={userProfile.phone}
        />
      )}
    </div>
  );
}

function BoxManagementCard({ box, eventId, userProfile, isSubmitting, onUpdateBoxOwner, currentUser }: { box: EventBox; eventId: string; userProfile: any; isSubmitting: boolean; onUpdateBoxOwner: (entityId: string, boxId: string, ownerName: string, ownerDni: string, newStatus: 'reserved' | 'sold') => void; currentUser: any; }) {
    const [ownerDni, setOwnerDni] = useState(box.ownerDni || "");
    const [ownerName, setOwnerName] = useState(box.ownerName || "");
    const [docType, setDocType] = useState<'dni' | 'ce'>('dni');
    const [isDniLoading, setIsDniLoading] = useState(false);

    const isReservedByMe = box.status === 'reserved' && box.promoterId === userProfile?.uid;
    const canManage = box.status === 'available' || isReservedByMe;

    useEffect(() => {
        setOwnerDni(box.ownerDni || "");
        setOwnerName(box.ownerName || "");
    }, [box]);

    const handleVerifyDni = async () => {
        if (!ownerDni || !currentUser) return;
        
        const dniRegex = /^\d{8}$/;
        const ceRegex = /^\d{10,20}$/;

        if (docType === 'dni' && !dniRegex.test(ownerDni)) {
            toast({ title: "DNI Inválido", description: "El DNI debe contener 8 dígitos numéricos.", variant: "destructive" });
            return;
        }
        if (docType === 'ce' && !ceRegex.test(ownerDni)) {
            toast({ title: "CE Inválido", description: "El Carnet de Extranjería debe tener entre 10 y 20 dígitos.", variant: "destructive" });
            return;
        }

        setIsDniLoading(true);
        try {
            const idToken = await currentUser.getIdToken();
            const response = await fetch(`/api/business-panel/get-client-by-dni?dni=${ownerDni}`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.name) {
                    setOwnerName(data.name);
                    toast({ title: "Cliente Encontrado", description: `Se autocompletó el nombre: ${data.name}`});
                } else {
                    toast({ title: "No Encontrado", description: "No se encontró un cliente con ese DNI. Por favor, ingrese el nombre manualmente.", variant: "default"});
                }
            } else {
                 toast({ title: "Error de Búsqueda", description: "No se pudo verificar el DNI.", variant: "destructive"});
            }
        } catch (error) {
            console.error("Error fetching client by DNI:", error);
            toast({ title: "Error de Red", description: "No se pudo conectar con el servidor para verificar el DNI.", variant: "destructive"});
        } finally {
            setIsDniLoading(false);
        }
    };
    

    return (
        <div className="border p-3 rounded-md space-y-3">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="font-semibold">{box.name}</p>
                    <p className="text-sm text-muted-foreground">Capacidad: {box.capacity || 'N/A'}</p>
                    <p className="text-sm font-bold text-primary">S/ {box.cost.toFixed(2)}</p>
                </div>
                <Badge variant={box.status === 'available' ? 'default' : 'secondary'} className={cn("shrink-0", { 'bg-green-500': box.status === 'available', 'bg-blue-600': isReservedByMe, 'bg-gray-500': box.status === 'sold' })}>{isReservedByMe ? "Reservado por ti" : box.status === 'sold' ? `Vendido por ${box.promoterName || 'otro'}` : 'Disponible'}</Badge>
            </div>
            
            {canManage && (
                <div className="space-y-3 pt-3 border-t">
                    <RadioGroup defaultValue="dni" value={docType} onValueChange={(value) => setDocType(value as 'dni' | 'ce')} className="grid grid-cols-2 gap-2">
                        <Label htmlFor={`docType-dni-${box.id}`} className={cn("w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer", docType === 'dni' && "bg-primary text-primary-foreground border-primary")}>
                            <RadioGroupItem value="dni" id={`docType-dni-${box.id}`} className="sr-only" /> DNI
                        </Label>
                        <Label htmlFor={`docType-ce-${box.id}`} className={cn("w-full flex items-center justify-center rounded-md border-2 border-muted bg-popover p-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer", docType === 'ce' && "bg-primary text-primary-foreground border-primary")}>
                            <RadioGroupItem value="ce" id={`docType-ce-${box.id}`} className="sr-only" /> Carnet Ext.
                        </Label>
                    </RadioGroup>

                    <div className="space-y-1">
                        <Label htmlFor={`dni-${box.id}`} className="text-xs">Número de Documento</Label>
                        <div className="flex gap-2">
                            <Input id={`dni-${box.id}`} value={ownerDni} onChange={e => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                const maxLength = docType === 'dni' ? 8 : 20;
                                setOwnerDni(val.slice(0, maxLength));
                            }} placeholder={docType === 'dni' ? "8 dígitos" : "10-20 dígitos"} disabled={isSubmitting || isDniLoading} />
                            <Button size="icon" variant="outline" onClick={handleVerifyDni} disabled={isSubmitting || isDniLoading || !ownerDni}>
                                {isDniLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}
                            </Button>
                        </div>
                    </div>

                     <div className="space-y-1">
                        <Label htmlFor={`name-${box.id}`} className="text-xs">Nombre Dueño</Label>
                        <Input id={`name-${box.id}`} value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Nombre del cliente" disabled={isSubmitting} />
                    </div>
                    <div className="flex gap-2 justify-end">
                       {box.status === 'available' && (
                         <Button size="sm" onClick={() => onUpdateBoxOwner(eventId, box.id, ownerName, ownerDni, 'reserved')} disabled={isSubmitting || !ownerName || !ownerDni}>Reservar</Button>
                       )}
                       {isReservedByMe && (
                         <Button size="sm" onClick={() => onUpdateBoxOwner(eventId, box.id, ownerName, ownerDni, 'sold')} disabled={isSubmitting || !ownerName || !ownerDni}>Marcar como Vendido</Button>
                       )}
                    </div>
                </div>
            )}
        </div>
    );
}
