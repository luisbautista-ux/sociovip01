
"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as ShadcnCardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode as QrCodeIcon, ListChecks, Gift, Building, Loader2, Info, Ticket, Calendar } from "lucide-react";
import type { BusinessManagedEntity, GeneratedCode, Business, PromoterEntityView } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CreateCodesDialog } from "@/components/business/dialogs/CreateCodesDialog";
import { ManageCodesDialog } from "@/components/business/dialogs/ManageCodesDialog";
import { useToast } from "@/hooks/use-toast";
import { isEntityCurrentlyActivatable, sanitizeObjectForFirestore } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp, doc, updateDoc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

export default function PromoterEntitiesPage() {
  const { userProfile, loadingAuth, loadingProfile } = useAuth();
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
  
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedEntityForStats, setSelectedEntityForStats] = useState<PromoterEntityView | null>(null);

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

  const handleNewCodesCreated = async (entityId: string, newCodes: GeneratedCode[], observation?: string) => {
    if (!userProfile?.name || !userProfile.uid) {
      toast({ title: "Error de Usuario", description: "Nombre o UID de promotor no disponible.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true); // Set submitting at the beginning
    console.log(`Promoter Entities Page: Promoter ${userProfile.name} (UID: ${userProfile.uid}) creating ${newCodes.length} codes for entityId: ${entityId}`);
  
    try {
      const targetEntityRef = doc(db, "businessEntities", entityId);
      const targetEntitySnap = await getDoc(targetEntityRef);
      if (!targetEntitySnap.exists()) {
        toast({ title: "Error", description: `La entidad "${entityId}" no fue encontrada.`, variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      const targetEntityData = targetEntitySnap.data() as BusinessManagedEntity;
      
      const newCodesWithDetails: GeneratedCode[] = newCodes.map((code, index) => (sanitizeObjectForFirestore({
        id: code.id || `code-${entityId}-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
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
      }) as GeneratedCode));
      
      const existingSanitizedCodes = (targetEntityData.generatedCodes || []).map(c => sanitizeObjectForFirestore(c as GeneratedCode));
      const updatedCodes = [...existingSanitizedCodes, ...newCodesWithDetails];
      
      await updateDoc(targetEntityRef, { generatedCodes: updatedCodes });
      toast({ title: "Códigos Creados Exitosamente", description: `${newCodes.length} código(s) añadido(s) a "${targetEntityData.name}".` });
      
      await fetchAssignedEntities();
      
      // Update state for open modals
      if (selectedEntityForViewingCodes?.id === entityId) {
        setSelectedEntityForViewingCodes(prev => prev ? {...prev, generatedCodes: updatedCodes} : null);
      }
      if (selectedEntityForCreatingCodes?.id === entityId) {
        setSelectedEntityForCreatingCodes(prev => prev ? {...prev, generatedCodes: updatedCodes} : null);
      }
    } catch (error: any) {
      console.error("Promoter Entities Page: Error saving new codes to Firestore:", error.code, error.message, error);
      toast({ title: "Error al Guardar Códigos", description: `No se pudieron guardar los códigos. ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false); // Reset submitting at the end
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
      const targetEntitySnap = await getDoc(targetEntityRef);
      if (!targetEntitySnap.exists()) {
        toast({ title: "Error", description: `Entidad "${entityId}" no encontrada para actualizar códigos.`, variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      const targetEntityData = targetEntitySnap.data() as BusinessManagedEntity;
      
      const otherPromotersCodes = (targetEntityData.generatedCodes || []).filter(
        c => c.generatedByUid !== userProfile.uid 
      ).map(c => sanitizeObjectForFirestore(c as GeneratedCode));
      
      const thisPromotersUpdatedCodes = updatedCodesFromDialog
        .filter(c => c.generatedByUid === userProfile.uid)
        .map(c => sanitizeObjectForFirestore(c as GeneratedCode));

      const finalCodesToSave = [...otherPromotersCodes, ...thisPromotersUpdatedCodes];

      await updateDoc(targetEntityRef, { generatedCodes: finalCodesToSave });
      toast({ title: "Mis Códigos Actualizados", description: `Tus códigos para "${targetEntityData.name}" han sido actualizados.` });
      
      fetchAssignedEntities(); 

      if (selectedEntityForViewingCodes?.id === entityId) {
        setSelectedEntityForViewingCodes(prev => prev ? {...prev, generatedCodes: finalCodesToSave} : null);
      }
    } catch (error: any) {
      console.error("Promoter Entities Page: Error saving updated codes from ManageDialog:", error.code, error.message, error);
      toast({ title: "Error al Actualizar Códigos", description: `No se pudieron actualizar tus códigos. ${error.message}`, variant: "destructive" });
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
                    <TableRow key={entity.id || `entity-fallback-${Math.random()}`}>
                        <TableCell className="font-medium align-top py-3 space-y-1">
                            <div className="font-semibold text-base">{entity.name}</div>
                            {entity.businessName && <div className="text-xs text-muted-foreground flex items-center mt-0.5"><Building size={14} className="mr-1"/>{entity.businessName}</div>}
                            <Badge variant={entity.isActive && isActivatable ? "default" : (entity.isActive ? "outline" : "destructive")} 
                                    className={cn(entity.isActive && isActivatable ? "bg-green-500 hover:bg-green-600" : (entity.isActive ? "border-yellow-500 text-yellow-600" : ""), "text-xs mt-1")}>
                                {entity.isActive ? (isActivatable ? "Vigente" : "Activa (Fuera de Fecha)") : "Inactiva"}
                            </Badge>
                            <div className="flex flex-col items-start gap-1 pt-1.5">
                            <Button 
                                variant="outline" 
                                size="xs" 
                                onClick={() => openCreateCodesDialog(entity)} 
                                disabled={!isActivatable || isSubmitting}
                                className="px-2 py-1 h-auto text-xs"
                            >
                                <QrCodeIcon className="h-3 w-3 mr-1" /> Crear Códigos
                            </Button>
                            <Button 
                                variant="outline" 
                                size="xs" 
                                onClick={() => openViewCodesDialog(entity)}
                                disabled={isSubmitting}
                                className="px-2 py-1 h-auto text-xs"
                            >
                                <ListChecks className="h-3 w-3 mr-1" /> Ver Mis Códigos ({promoterCodeStats.created})
                            </Button>
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
                           <div className="flex gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="flex-1"
                                    onClick={() => openCreateCodesDialog(entity)} 
                                    disabled={!isActivatable || isSubmitting}
                                >
                                    <QrCodeIcon className="h-4 w-4 mr-2" /> Crear
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="flex-1"
                                    onClick={() => openViewCodesDialog(entity)}
                                    disabled={isSubmitting}
                                >
                                    <ListChecks className="h-4 w-4 mr-2" /> Ver Códigos
                                </Button>
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
        <p className="ml-4 text-lg text-muted-foreground">Cargando promociones y eventos asignados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Gift className="h-8 w-8 mr-2" /> Promociones y Eventos
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
        />
      )}
    </div>
  );
}
