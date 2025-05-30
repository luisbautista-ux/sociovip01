
"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as ShadcnCardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode as QrCodeIcon, ListChecks, BarChart3, Loader2, Gift, Building } from "lucide-react";
import type { BusinessManagedEntity, GeneratedCode, Business, PromoterEntityView } from "@/lib/types";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { CreateCodesDialog } from "@/components/business/dialogs/CreateCodesDialog";
import { ManageCodesDialog } from "@/components/business/dialogs/ManageCodesDialog";
import { useToast } from "@/hooks/use-toast";
import { isEntityCurrentlyActivatable, sanitizeObjectForFirestore } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp, doc, updateDoc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription as UIDialogDescription,
  DialogFooter as ShadcnDialogFooter 
} from "@/components/ui/dialog";


export default function PromoterEntitiesPage() {
  const { userProfile, loadingAuth, loadingProfile } = useAuth();
  const [entities, setEntities] = useState<PromoterEntityView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const { toast } = useToast();

  const [showCreateCodesModal, setShowCreateCodesModal] = useState(false);
  const [selectedEntityForCreatingCodes, setSelectedEntityForCreatingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const [showManageCodesModal, setShowManageCodesModal] = useState(false);
  const [selectedEntityForViewingCodes, setSelectedEntityForViewingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedEntityForStats, setSelectedEntityForStats] = useState<PromoterEntityView | null>(null);

  const fetchAssignedEntities = useCallback(async () => {
    if (loadingAuth || loadingProfile) {
      if (!isLoading) setIsLoading(true);
      console.log("Promoter Entities Page: Waiting for auth/profile to load.");
      return;
    }
    if (!userProfile || !(userProfile.uid || userProfile.name)) {
      setEntities([]);
      setIsLoading(false);
      console.warn("Promoter Entities Page: No userProfile UID or Name, cannot fetch entities.");
      if (userProfile === null && !loadingAuth && !loadingProfile) { 
          toast({ title: "Error de Perfil", description: "No se pudo cargar tu perfil de promotor.", variant: "destructive" });
      }
      return;
    }
    
    setIsLoading(true);
    const promoterIdentifierField = userProfile.uid ? "promoterProfileId" : "promoterName";
    const promoterIdentifierValue = userProfile.uid || userProfile.name;
    
    console.log(`Promoter Entities Page: Fetching entities where ${promoterIdentifierField} is assigned to:`, promoterIdentifierValue, "UID:", userProfile.uid, "Name:", userProfile.name);
    
    try {
      const entitiesQuery = query(
        collection(db, "businessEntities"), 
        where("isActive", "==", true)
      ); 
      const entitiesSnap = await getDocs(entitiesQuery);
      console.log("Promoter Entities Page: Fetched all active businessEntities snapshot size:", entitiesSnap.size);
      
      const promoterAssignedEntitiesRaw: BusinessManagedEntity[] = [];
      entitiesSnap.forEach(docSnap => {
        const data = docSnap.data();
        const isAssignedToThisPromoter = (data.assignedPromoters as any[])?.some(
          (ap: any) => (userProfile.uid && ap.promoterProfileId === userProfile.uid) || 
                       (!userProfile.uid && userProfile.name && ap.promoterName === userProfile.name)
        );
        
        if (isAssignedToThisPromoter) {
            const nowISO = new Date().toISOString();
            let startDateStr: string;
            if (data.startDate instanceof Timestamp) startDateStr = data.startDate.toDate().toISOString();
            else if (typeof data.startDate === 'string') startDateStr = data.startDate;
            else if (data.startDate instanceof Date) startDateStr = data.startDate.toISOString();
            else { 
              console.warn(`Promoter Entities Page: Entity ${docSnap.id} for business ${data.businessId} missing or invalid startDate. Using fallback.`);
              startDateStr = nowISO; 
            }

            let endDateStr: string;
            if (data.endDate instanceof Timestamp) endDateStr = data.endDate.toDate().toISOString();
            else if (typeof data.endDate === 'string') endDateStr = data.endDate;
            else if (data.endDate instanceof Date) endDateStr = data.endDate.toISOString();
            else { 
              console.warn(`Promoter Entities Page: Entity ${docSnap.id} for business ${data.businessId} missing or invalid endDate. Using fallback.`);
              endDateStr = nowISO; 
            }
            
            let createdAtStr: string | undefined;
            if (data.createdAt instanceof Timestamp) createdAtStr = data.createdAt.toDate().toISOString();
            else if (typeof data.createdAt === 'string') createdAtStr = data.createdAt;
            else if (data.createdAt instanceof Date) createdAtStr = data.createdAt.toISOString();
            else createdAtStr = undefined;

            const entityToAdd: BusinessManagedEntity = {
              id: docSnap.id,
              businessId: data.businessId || "N/A",
              type: data.type as "promotion" | "event",
              name: data.name || "Entidad sin nombre",
              description: data.description || "",
              termsAndConditions: data.termsAndConditions || "",
              startDate: startDateStr,
              endDate: endDateStr,
              usageLimit: data.usageLimit === undefined || data.usageLimit === null ? 0 : Number(data.usageLimit),
              maxAttendance: data.maxAttendance === undefined || data.maxAttendance === null ? 0 : Number(data.maxAttendance),
              isActive: data.isActive === undefined ? true : data.isActive,
              imageUrl: data.imageUrl || "",
              aiHint: data.aiHint || "",
              generatedCodes: Array.isArray(data.generatedCodes) ? data.generatedCodes.map(gc => sanitizeObjectForFirestore(gc as GeneratedCode)) : [],
              ticketTypes: Array.isArray(data.ticketTypes) ? data.ticketTypes.map(tt => sanitizeObjectForFirestore(tt as any)) : [],
              eventBoxes: Array.isArray(data.eventBoxes) ? data.eventBoxes.map(eb => sanitizeObjectForFirestore(eb as any)) : [],
              assignedPromoters: Array.isArray(data.assignedPromoters) ? data.assignedPromoters.map(ap => sanitizeObjectForFirestore(ap as any)) : [],
              createdAt: createdAtStr,
            };
            if (isEntityCurrentlyActivatable(entityToAdd)) { 
                promoterAssignedEntitiesRaw.push(entityToAdd);
            }
        }
      });
      
      const businessIdsToFetch = new Set(promoterAssignedEntitiesRaw.map(e => e.businessId).filter(id => id && id !== "N/A"));
      const businessesMap = new Map<string, Business>();

      if (businessIdsToFetch.size > 0) {
        const businessesQuery = query(collection(db, "businesses"), where("__name__", "in", Array.from(businessIdsToFetch)));
        const businessesSnapshot = await getDocs(businessesQuery);
        businessesSnapshot.forEach(doc => {
            businessesMap.set(doc.id, { id: doc.id, ...doc.data() } as Business);
        });
      }
      
      const entitiesWithBusinessNames: PromoterEntityView[] = promoterAssignedEntitiesRaw.map(entity => ({
          ...entity,
          businessName: businessesMap.get(entity.businessId)?.name || "Negocio Desconocido",
      }));

      setEntities(entitiesWithBusinessNames.sort((a,b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : (a.startDate ? new Date(a.startDate).getTime() : 0);
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : (b.startDate ? new Date(b.startDate).getTime() : 0);
        return bDate - aDate;
      }));
      console.log("Promoter Entities Page: Fetched and filtered entities assigned to promoter:", entitiesWithBusinessNames.length);

    } catch (error: any) {
      console.error("Promoter Entities Page: Error fetching assigned entities:", error.code, error.message, error);
      toast({ title: "Error al cargar entidades", description: `No se pudieron cargar tus promociones/eventos asignados. ${error.message}`, variant: "destructive"});
      setEntities([]);
    } finally {
      setIsLoading(false);
    }
  }, [userProfile, loadingAuth, loadingProfile, toast, isLoading]);

  useEffect(() => {
    if (!loadingAuth && !loadingProfile) { 
        fetchAssignedEntities();
    } else if (!loadingAuth && !loadingProfile && !userProfile) { 
        setIsLoading(false);
        setEntities([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, loadingAuth, loadingProfile]);

  const getPromoterCodeStats = useCallback((entity: BusinessManagedEntity) => {
    if (!userProfile) return { created: 0, used: 0 };
    
    const promoterCodes = (entity.generatedCodes || []).filter(c => 
        (userProfile.uid && c.generatedByUid === userProfile.uid) || 
        (!userProfile.uid && userProfile.name && c.generatedByName === userProfile.name) 
    );
    return {
      created: promoterCodes.length,
      used: promoterCodes.filter(c => c.status === 'redeemed').length,
    };
  }, [userProfile]);
  
  const openCreateCodesDialog = (entity: BusinessManagedEntity) => {
    if (!isEntityCurrentlyActivatable(entity)) {
      toast({ 
        title: "Acción no permitida", 
        description: "Esta promoción o evento no está activo o está fuera de su periodo de vigencia.", 
        variant: "destructive"
      });
      return;
    }
    setSelectedEntityForCreatingCodes(entity);
    setShowCreateCodesModal(true);
  };

  const openViewCodesDialog = (entity: BusinessManagedEntity) => {
    setSelectedEntityForViewingCodes(entity);
    setShowManageCodesModal(true);
  };
  
  const handleNewCodesCreated = async (entityId: string, newCodes: GeneratedCode[], observation?: string) => {
    if (!userProfile || !userProfile.name || !userProfile.uid) {
        toast({title: "Error de Usuario", description: "Nombre o UID de promotor no disponible para registrar los códigos.", variant: "destructive"});
        setIsSubmitting(false); // Ensure submitting is false if we exit early
        return;
    }
    setIsSubmitting(true); 
    console.log(`Promoter Entities Page: Promoter ${userProfile.name} (UID: ${userProfile.uid}) attempting to add ${newCodes.length} codes for entityId: ${entityId}`);
    
    const targetEntityRef = doc(db, "businessEntities", entityId);
    try {
        const targetEntitySnap = await getDoc(targetEntityRef);
        if (!targetEntitySnap.exists()) {
            toast({title:"Error", description:`La entidad "${entityId}" no fue encontrada.`, variant: "destructive"});
            setIsSubmitting(false);
            return;
        }
        const targetEntityData = targetEntitySnap.data() as BusinessManagedEntity;
        
        const newCodesWithDetails: GeneratedCode[] = newCodes.map((code, index) => (sanitizeObjectForFirestore({
            id: `code-${entityId}-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 9)}`, // Ensure unique ID
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
        toast({title: "Códigos Creados Exitosamente", description: `${newCodes.length} código(s) añadido(s) a "${targetEntityData.name}".`});
        
        fetchAssignedEntities(); // Refrescar la lista completa desde Firestore
        
        // Actualizar el estado local de los modales si están abiertos para la misma entidad
        if (selectedEntityForViewingCodes && selectedEntityForViewingCodes.id === entityId) {
          setSelectedEntityForViewingCodes(prev => prev ? {...prev, generatedCodes: updatedCodes} : null);
        }
         if (selectedEntityForCreatingCodes && selectedEntityForCreatingCodes.id === entityId) {
          // Ya no es necesario actualizar selectedEntityForCreatingCodes aquí porque CreateCodesDialog se cierra
          // y la lista principal se refresca con fetchAssignedEntities.
         }

    } catch (error: any) {
        console.error("Promoter Entities Page: Error saving new codes to Firestore:", error.code, error.message, error);
        toast({title: "Error al Guardar Códigos", description: `No se pudieron guardar los códigos. ${error.message}`, variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleCodesUpdatedFromManageDialog = async (entityId: string, updatedCodesFromDialog: GeneratedCode[]) => {
    if (!userProfile || !userProfile.uid) {
      toast({ title: "Error de Usuario", description: "UID de promotor no disponible para actualizar códigos.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);
    console.log(`Promoter Entities Page: Promoter ${userProfile.name} (UID: ${userProfile.uid}) attempting to update codes for entityId: ${entityId}`);

    const targetEntityRef = doc(db, "businessEntities", entityId);
     try {
        const targetEntitySnap = await getDoc(targetEntityRef);
        if (!targetEntitySnap.exists()) {
            toast({title:"Error", description:`Entidad "${entityId}" no encontrada.`, variant: "destructive"});
            setIsSubmitting(false);
            return;
        }
        const targetEntityData = targetEntitySnap.data() as BusinessManagedEntity;
    
        // Reconstruir la lista de códigos: tomar todos los códigos que NO fueron generados por este promotor,
        // y añadir los códigos actualizados que SÍ fueron generados por este promotor.
        const otherPromotersCodes = (targetEntityData.generatedCodes || []).filter(
            c => c.generatedByUid !== userProfile.uid && c.generatedByName !== userProfile.name 
        ).map(c => sanitizeObjectForFirestore(c as GeneratedCode));
        
        const thisPromotersUpdatedCodes = updatedCodesFromDialog.map(c => sanitizeObjectForFirestore(c as GeneratedCode));

        const finalCodesToSave = [...otherPromotersCodes, ...thisPromotersUpdatedCodes];

        await updateDoc(targetEntityRef, { generatedCodes: finalCodesToSave });
        toast({title: "Mis Códigos Actualizados", description: `Tus códigos para "${targetEntityData.name}" han sido actualizados.`});
        
        fetchAssignedEntities(); 
        if (selectedEntityForViewingCodes && selectedEntityForViewingCodes.id === entityId) {
            setSelectedEntityForViewingCodes(prev => prev ? {...prev, generatedCodes: finalCodesToSave} : null);
        }
    } catch (error: any) {
      console.error("Promoter Entities Page: Error saving updated codes to Firestore (from ManageDialog):", error.code, error.message, error);
      toast({title: "Error al Actualizar Códigos", description: `No se pudieron actualizar tus códigos. ${error.message}`, variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  };

  const openStatsModal = (entity: PromoterEntityView) => {
    setSelectedEntityForStats(entity);
    setShowStatsModal(true);
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
          <Gift className="h-8 w-8 mr-2" /> Promociones y Eventos Asignados
        </h1>
      </div>
      {/* El buscador está oculto según solicitud:
      <Input
        type="search"
        placeholder="Buscar por nombre de promoción/evento o negocio..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-sm"
        disabled={isLoading}
      />
      */}
      <Card className="shadow-lg">
        <CardHeader>
           {/* El título "Entidades Activas y Vigentes para Ti" está oculto */}
        </CardHeader>
        <CardContent>
          {entities.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[250px]">Promociones y Eventos</TableHead>
                    <TableHead className="min-w-[200px]">Mis Códigos y QRs</TableHead>
                    <TableHead className="min-w-[220px]">Acciones de Códigos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entities.map((entity) => {
                    const promoterCodeStats = getPromoterCodeStats(entity);
                    const isActivatable = isEntityCurrentlyActivatable(entity);
                    
                    return (
                    <TableRow key={entity.id || `entity-fallback-${Math.random()}`}>
                      <TableCell className="font-medium align-top py-3">
                          <div className="font-semibold text-base">{entity.name}</div>
                          {entity.businessName && <div className="text-xs text-muted-foreground flex items-center mt-0.5"><Building size={14} className="mr-1"/>{entity.businessName}</div>}
                          {/* El Badge de estado "Vigente para ti" está oculto */}
                      </TableCell>
                      <TableCell className="align-top py-3 text-left text-xs">
                          <div className="flex flex-col space-y-0.5">
                            <div>Códigos Creados ({promoterCodeStats.created})</div>
                            <div>QRs Generados (0)</div>
                            <div>QRs Usados ({promoterCodeStats.used})</div>
                          </div>
                      </TableCell>
                      <TableCell className="align-top py-3">
                          <div className="flex flex-col items-start gap-1">
                              <Button 
                                  variant="outline" 
                                  size="xs" 
                                  onClick={() => openCreateCodesDialog(entity)} 
                                  disabled={!isActivatable || isSubmitting}
                                  className="px-2 py-1 h-auto text-xs w-full justify-start"
                              >
                                  <QrCodeIcon className="h-3 w-3 mr-1" /> Crear Códigos
                              </Button>
                              <Button 
                                  variant="outline" 
                                  size="xs" 
                                  onClick={() => openViewCodesDialog(entity)}
                                  disabled={isSubmitting}
                                  className="px-2 py-1 h-auto text-xs w-full justify-start"
                              >
                                  <ListChecks className="h-3 w-3 mr-1" /> Ver Mis Códigos ({promoterCodeStats.created})
                              </Button>
                          </div>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            </div>
          ) : (
             !isLoading && <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border border-dashed rounded-md p-4 text-center">
                <p className="font-semibold">No tienes promociones o eventos activos asignados.</p>
                <p className="text-sm">Contacta a los negocios para que te asignen a sus campañas.</p>
            </div>
          )}
        </CardContent>
      </Card>

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
            const currentEntity = entities.find(e => e.id === selectedEntityForViewingCodes?.id); 
            if(currentEntity) { 
                 if (isEntityCurrentlyActivatable(currentEntity)) {
                    setShowManageCodesModal(false); 
                    setSelectedEntityForCreatingCodes(currentEntity);
                    setShowCreateCodesModal(true);
                 } else {
                    toast({
                        title: "Acción no permitida",
                        description: "Esta promoción o evento no está activo o está fuera de su periodo de vigencia.",
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

      {selectedEntityForStats && userProfile && (
         <Dialog open={showStatsModal} onOpenChange={(isOpen) => {if(!isOpen) setSelectedEntityForStats(null); setShowStatsModal(isOpen);}}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Estadísticas de Promotor para: {selectedEntityForStats?.name}</DialogTitle>
                    <UIDialogDescription>Resumen de tus códigos y rendimiento para esta entidad ({selectedEntityForStats.businessName}).</UIDialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-4">
                    <p><strong>Mis Códigos Creados:</strong> ({(selectedEntityForStats.generatedCodes?.filter(c=> (userProfile.uid && c.generatedByUid === userProfile.uid) || (!userProfile.uid && userProfile.name && c.generatedByName === userProfile.name) ).length || 0)})</p>
                    <p><strong>Mis Códigos Usados (Canjeados):</strong> ({(selectedEntityForStats.generatedCodes?.filter(c => ((userProfile.uid && c.generatedByUid === userProfile.uid) || (!userProfile.uid && userProfile.name && c.generatedByName === userProfile.name)) && c.status === 'redeemed').length || 0)})</p>
                    <p><strong>Mi Tasa de Canje:</strong> 
                        {(() => {
                            const promoterCodes = (selectedEntityForStats.generatedCodes || []).filter(c => (userProfile.uid && c.generatedByUid === userProfile.uid) || (!userProfile.uid && userProfile.name && c.generatedByName === userProfile.name));
                            const total = promoterCodes.length;
                            const redeemed = promoterCodes.filter(c => c.status === 'redeemed').length;
                            return total > 0 ? `${((redeemed / total) * 100).toFixed(1)}%` : '0%';
                        })()}
                    </p>
                    {/* Aquí podrías añadir más estadísticas específicas del promotor si las tuvieras */}
                </div>
                <ShadcnDialogFooter>
                    <Button variant="outline" onClick={() => {setShowStatsModal(false); setSelectedEntityForStats(null);}}>Cerrar</Button>
                </ShadcnDialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

    