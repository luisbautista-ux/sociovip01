
"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode as QrCodeIcon, ListChecks, Gift, Search, AlertTriangle, DollarSign, BarChart3 } from "lucide-react";
import type { BusinessManagedEntity, GeneratedCode, PromoterProfile } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CreateCodesDialog } from "@/components/business/dialogs/CreateCodesDialog";
import { ManageCodesDialog } from "@/components/business/dialogs/ManageCodesDialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { isEntityCurrentlyActivatable, sanitizeObjectForFirestore } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp, doc, updateDoc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription as UIDialogDescription,
  DialogFooter as UIDialogFooterAliased 
} from "@/components/ui/dialog";

export default function PromoterEntitiesPage() {
  const { userProfile, loadingAuth, loadingProfile } = useAuth();
  const [entities, setEntities] = useState<BusinessManagedEntity[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const { toast } = useToast();

  const [showCreateCodesModal, setShowCreateCodesModal] = useState(false);
  const [selectedEntityForCreatingCodes, setSelectedEntityForCreatingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const [showManageCodesModal, setShowManageCodesModal] = useState(false);
  const [selectedEntityForViewingCodes, setSelectedEntityForViewingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedEntityForStats, setSelectedEntityForStats] = useState<BusinessManagedEntity | null>(null);

  const fetchAssignedEntities = useCallback(async () => {
    if (!userProfile || (!userProfile.uid && !userProfile.dni) ) { 
      console.log("Promoter Entities Page: No userProfile or identifying promoter ID (uid/dni), skipping fetch.");
      setIsLoading(false);
      setEntities([]);
      return;
    }
    setIsLoading(true);
    try {
      const promoterIdentifier = userProfile.uid || userProfile.dni || userProfile.name; // Fallback chain
      console.log("Promoter Entities Page: Fetching for promoterIdentifier (UID/DNI/Name):", promoterIdentifier, "Profile Name for matching:", userProfile.name);
      
      // Promoters need to see all entities to filter by assignment client-side
      // This query might need to be more specific if performance becomes an issue
      const entitiesQuery = query(collection(db, "businessEntities")); 
      const entitiesSnap = await getDocs(entitiesQuery);
      
      const fetchedEntities: BusinessManagedEntity[] = [];
      entitiesSnap.forEach(docSnap => {
        const data = docSnap.data() as Omit<BusinessManagedEntity, 'id'>; 
        
        const isAssignedToThisPromoter = data.assignedPromoters?.some(
          // Match by UID (preferred), DNI, or fall back to name if IDs aren't consistently used in assignedPromoters
          ap => ap.promoterProfileId === userProfile.uid || 
                ap.promoterProfileId === userProfile.dni || 
                ap.promoterName === userProfile.name
        );
        
        if (isAssignedToThisPromoter) {
            const nowISO = new Date().toISOString();
            
            let startDateStr: string;
            if (data.startDate instanceof Timestamp) startDateStr = data.startDate.toDate().toISOString();
            else if (typeof data.startDate === 'string') startDateStr = data.startDate;
            else if (data.startDate instanceof Date) startDateStr = data.startDate.toISOString();
            else { 
              console.warn(`Promoter Entities Page: Entity ${docSnap.id} missing or invalid startDate. Using fallback.`);
              startDateStr = nowISO; 
            }

            let endDateStr: string;
            if (data.endDate instanceof Timestamp) endDateStr = data.endDate.toDate().toISOString();
            else if (typeof data.endDate === 'string') endDateStr = data.endDate;
            else if (data.endDate instanceof Date) endDateStr = data.endDate.toISOString();
            else { 
              console.warn(`Promoter Entities Page: Entity ${docSnap.id} missing or invalid endDate. Using fallback.`);
              endDateStr = nowISO; 
            }
            
            let createdAtStr: string | undefined;
            if (data.createdAt instanceof Timestamp) createdAtStr = data.createdAt.toDate().toISOString();
            else if (typeof data.createdAt === 'string') createdAtStr = data.createdAt;
            else if (data.createdAt instanceof Date) createdAtStr = data.createdAt.toISOString();
            else createdAtStr = undefined;

            fetchedEntities.push({
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
            });
        }
      });
      
      setEntities(fetchedEntities.sort((a,b) => {
        if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (a.createdAt) return -1;
        if (b.createdAt) return 1;
        if (a.startDate && b.startDate) return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
        return 0;
      }));
      console.log("Promoter Entities Page: Fetched entities assigned to promoter:", fetchedEntities.length);

    } catch (error: any) {
      console.error("Promoter Entities Page: Error fetching assigned entities:", error.code, error.message, error);
      toast({ title: "Error al cargar entidades", description: `No se pudieron cargar tus promociones/eventos asignados. ${error.message}`, variant: "destructive"});
      setEntities([]);
    } finally {
      setIsLoading(false);
    }
  }, [userProfile, toast]);

  useEffect(() => {
    if (!loadingAuth && !loadingProfile && userProfile) {
      fetchAssignedEntities();
    } else if (!loadingAuth && !loadingProfile && !userProfile) {
      setIsLoading(false);
      setEntities([]);
    }
  }, [userProfile, fetchAssignedEntities, loadingAuth, loadingProfile]);


  const filteredEntities = useMemo(() => {
    return entities.filter(entity =>
        (entity.name || "").toLowerCase().includes(searchTerm.toLowerCase()) 
    ).sort((a, b) => { 
        const aActiveCurrent = isEntityCurrentlyActivatable(a);
        const bActiveCurrent = isEntityCurrentlyActivatable(b);
        if (aActiveCurrent && !bActiveCurrent) return -1;
        if (!aActiveCurrent && bActiveCurrent) return 1;
        if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (a.startDate && b.startDate) return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
        return 0;
    });
  }, [entities, searchTerm]);
  
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

  const handleNewCodesCreated = async (entityId: string, newCodes: GeneratedCode[], observationFromDialog?: string) => {
    if (!userProfile?.name) {
        toast({title: "Error de Usuario", description: "Nombre de promotor no disponible para registrar los códigos.", variant: "destructive"});
        return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    const targetEntityRef = doc(db, "businessEntities", entityId);
    try {
        const targetEntitySnap = await getDoc(targetEntityRef);
        if (!targetEntitySnap.exists()) {
            toast({title:"Error", description:"Entidad no encontrada para añadir códigos.", variant: "destructive"});
            setIsSubmitting(false);
            return;
        }
        const targetEntityData = targetEntitySnap.data() as BusinessManagedEntity;
        
        const newCodesWithDetails: GeneratedCode[] = newCodes.map(code => (sanitizeObjectForFirestore({
            ...code,
            id: code.id || `code-${entityId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            entityId: entityId,
            generatedByName: userProfile.name, 
            generatedDate: code.generatedDate || new Date().toISOString(),
            status: code.status || 'available', 
            observation: observationFromDialog || null,
            redemptionDate: null, 
            redeemedByInfo: null, 
            isVipCandidate: false,
        }) as GeneratedCode));
        
        const existingSanitizedCodes = (targetEntityData.generatedCodes || []).map(c => sanitizeObjectForFirestore(c as GeneratedCode));
        const updatedCodes = [...existingSanitizedCodes, ...newCodesWithDetails];
    
        await updateDoc(targetEntityRef, { generatedCodes: updatedCodes });
        toast({title: "Códigos Creados", description: `${newCodes.length} código(s) añadido(s) a "${targetEntityData.name}".`});
        
        fetchAssignedEntities(); // Refrescar la lista de entidades (y sus códigos)
        
        // Actualizar el estado local para el modal de visualización si está abierto para esta entidad
        if (selectedEntityForViewingCodes && selectedEntityForViewingCodes.id === entityId) {
          setSelectedEntityForViewingCodes(prev => prev ? {...prev, generatedCodes: updatedCodes} : null);
        }
    } catch (error: any) {
        console.error("Promoter Entities Page: Error saving new codes to Firestore:", error.code, error.message, error);
        toast({title: "Error al Guardar Códigos", description: `No se pudieron guardar los códigos. ${error.message}`, variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCodesUpdatedFromManageDialog = async (entityId: string, updatedCodesFromDialog: GeneratedCode[]) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const targetEntityRef = doc(db, "businessEntities", entityId);
    try {
        const targetEntitySnap = await getDoc(targetEntityRef);
        if (!targetEntitySnap.exists()) {
            toast({title:"Error", description:"Entidad no encontrada para actualizar códigos.", variant: "destructive"});
            setIsSubmitting(false);
            return;
        }
        const targetEntityData = targetEntitySnap.data() as BusinessManagedEntity;
    
        // El promotor solo puede eliminar códigos generados por él mismo
        const promoterGeneratedCodesFromDialog = updatedCodesFromDialog.filter(c => c.generatedByName === userProfile?.name);
        const otherCodesInDb = (targetEntityData.generatedCodes || []).filter(c => c.generatedByName !== userProfile?.name);
        const finalCodesToSave = [...otherCodesInDb, ...promoterGeneratedCodesFromDialog].map(c => sanitizeObjectForFirestore(c));

        await updateDoc(targetEntityRef, { generatedCodes: finalCodesToSave });
        toast({title: "Mis Códigos Actualizados", description: `Tus códigos para "${targetEntityData.name}" han sido actualizados.`});
        
        fetchAssignedEntities();
        if (selectedEntityForViewingCodes && selectedEntityForViewingCodes.id === entityId) {
            setSelectedEntityForViewingCodes(prev => prev ? {...prev, generatedCodes: finalCodesToSave} : null);
        }
    } catch (error: any) {
        console.error("Promoter Entities Page: Error updating codes in Firestore:", error.code, error.message, error);
        toast({title: "Error al Actualizar Códigos", description: `No se pudieron actualizar tus códigos. ${error.message}`, variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const getPromoterCodeStats = (entity: BusinessManagedEntity) => {
    if (!userProfile?.name) return { created: 0, used: 0 };
    const promoterCodes = entity.generatedCodes?.filter(c => c.generatedByName === userProfile.name) || [];
    const createdCount = promoterCodes.length;
    const utilizedCount = promoterCodes.filter(c => c.status === 'redeemed').length;
    return { created: createdCount, used: utilizedCount };
  };

  const getMockCommission = (entity: BusinessManagedEntity): string => {
      if (!userProfile?.name) return "S/ 0.00";
      const promoterCodes = entity.generatedCodes?.filter(c => c.generatedByName === userProfile.name) || [];
      const utilizedCount = promoterCodes.filter(c => c.status === 'redeemed').length;
      
      const assignment = entity.assignedPromoters?.find(
        ap => ap.promoterProfileId === userProfile.uid || 
              ap.promoterProfileId === userProfile.dni || 
              ap.promoterName === userProfile.name
      );
      let commissionPerCode = 0.50; 

      if (assignment && assignment.commissionRules && assignment.commissionRules.length > 0) {
        const generalRule = assignment.commissionRules.find(
            r => (r.appliesTo === 'event_general' || r.appliesTo === 'promotion_general') && 
                 r.commissionType === 'fixed' 
        );
        if (generalRule && typeof generalRule.commissionValue === 'number') {
            commissionPerCode = generalRule.commissionValue;
        }
      }
      return `S/ ${(utilizedCount * commissionPerCode).toFixed(2)}`;
  };

  const openStatsModal = (entity: BusinessManagedEntity) => {
    setSelectedEntityForStats(entity);
    setShowStatsModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Cargando tus entidades asignadas...</p>
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
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Tus Promociones y Eventos Activos</CardTitle>
          <CardDescription>Genera códigos para las promociones y eventos que te han sido asignados. Los códigos que crees se guardarán en el sistema.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nombre de promoción o evento..."
              className="pl-8 w-full sm:w-[300px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredEntities.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%] min-w-[250px]">Entidad y Gestión</TableHead>
                    <TableHead className="min-w-[100px]">Tipo</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[180px]">Vigencia</TableHead>
                    <TableHead className="text-left min-w-[180px]">Mis Códigos (Promotor)</TableHead>
                    <TableHead className="text-center hidden lg:table-cell min-w-[140px]">Comisión Estimada</TableHead>
                    <TableHead className="text-left min-w-[220px]">Acciones de Códigos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntities.map((entity) => {
                    const promoterStats = getPromoterCodeStats(entity);
                    const isActivatable = isEntityCurrentlyActivatable(entity);
                    return (
                    <TableRow key={entity.id || `entity-fallback-${Math.random()}`}>
                      <TableCell className="font-medium align-top py-3">
                          <div className="font-semibold text-base">{entity.name}</div>
                          <div className="mt-1.5">
                              <Badge variant={entity.isActive && isActivatable ? "default" : "outline"} 
                                     className={cn(entity.isActive && isActivatable ? "bg-green-500 hover:bg-green-600" : "bg-slate-500 hover:bg-slate-600 text-white")}>
                                  {entity.isActive && isActivatable ? "Vigente" : (entity.isActive ? "Activa (Fuera de Fecha)" : "Inactiva por Negocio")}
                              </Badge>
                          </div>
                          <div className="mt-2.5 flex flex-col items-start gap-1">
                              <Button variant="outline" size="xs" onClick={() => openStatsModal(entity)} className="px-2 py-1 h-auto text-xs">
                                  <BarChart3 className="h-3 w-3 mr-1" /> Estadísticas
                              </Button>
                          </div>
                      </TableCell>
                      <TableCell className="align-top py-3">
                        <Badge variant="secondary">{entity.type === 'promotion' ? 'Promoción' : 'Evento'}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell align-top py-3 text-xs">
                        {entity.startDate ? format(parseISO(entity.startDate), "P p", { locale: es }) : 'N/A'} - <br/>{entity.endDate ? format(parseISO(entity.endDate), "P p", { locale: es }) : 'N/A'}
                      </TableCell>
                      <TableCell className="align-top py-3 text-left">
                          <div className="flex flex-col text-xs space-y-0.5">
                              <span>Mis Códigos Creados ({promoterStats.created})</span>
                              <span>Mis Códigos Usados ({promoterStats.used})</span>
                          </div>
                      </TableCell>
                      <TableCell className="text-center hidden lg:table-cell align-top py-3">{getMockCommission(entity)}</TableCell>
                      <TableCell className="align-top py-3">
                          <div className="flex flex-col items-start gap-1">
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
                                  <ListChecks className="h-3 w-3 mr-1" /> Ver Mis Códigos ({promoterStats.created})
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
                <AlertTriangle className="h-10 w-10 mb-2 text-yellow-500"/>
                <p className="font-semibold">No tienes promociones o eventos asignados que coincidan con tu búsqueda, o no hay entidades activas para ti.</p>
                <p className="text-sm">Contacta al administrador del negocio si esperabas ver alguna entidad.</p>
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
        />
      )}

      {selectedEntityForViewingCodes && userProfile && (
        <ManageCodesDialog
          open={showManageCodesModal}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedEntityForViewingCodes(null);
            setShowManageCodesModal(isOpen);
          }}
          entity={selectedEntityForViewingCodes ? { 
            ...selectedEntityForViewingCodes,
            generatedCodes: (selectedEntityForViewingCodes.generatedCodes || []).filter(
              c => c.generatedByName === userProfile.name 
            )
          } : null }
          onCodesUpdated={handleCodesUpdatedFromManageDialog} 
          onRequestCreateNewCodes={() => { 
            const originalEntity = entities.find(e => e.id === selectedEntityForViewingCodes?.id);
            if(originalEntity) {
                 if (isEntityCurrentlyActivatable(originalEntity)) {
                    setShowManageCodesModal(false); 
                    setSelectedEntityForCreatingCodes(originalEntity);
                    setShowCreateCodesModal(true);
                 } else {
                    toast({
                        title: "Acción no permitida",
                        description: "Esta promoción o evento ya no está activo o está fuera de su periodo de vigencia.",
                        variant: "destructive",
                    });
                 }
            }
          }}
          isPromoterView={true} 
          currentUserProfileName={userProfile.name} // Pasar el nombre para habilitar eliminación de sus propios códigos
        />
      )}

      {selectedEntityForStats && userProfile && (
         <Dialog open={showStatsModal} onOpenChange={(isOpen) => {if(!isOpen) setSelectedEntityForStats(null); setShowStatsModal(isOpen);}}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Estadísticas de Promotor para: {selectedEntityForStats?.name}</DialogTitle>
                    <UIDialogDescription>Resumen de tus códigos y rendimiento para esta entidad.</UIDialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-4">
                    <p><strong>Mis Códigos Creados:</strong> ({(selectedEntityForStats.generatedCodes?.filter(c=> c.generatedByName === userProfile.name).length || 0)})</p>
                    <p><strong>Mis Códigos Usados:</strong> ({(selectedEntityForStats.generatedCodes?.filter(c => c.generatedByName === userProfile.name && c.status === 'redeemed').length || 0)})</p>
                    <p><strong>Mi Tasa de Canje:</strong> 
                        {(() => {
                            const promoterCodes = selectedEntityForStats.generatedCodes?.filter(c => c.generatedByName === userProfile.name) || [];
                            const total = promoterCodes.length;
                            const redeemed = promoterCodes.filter(c => c.status === 'redeemed').length;
                            return total > 0 ? `${((redeemed / total) * 100).toFixed(1)}%` : '0%';
                        })()}
                    </p>
                    <p><strong>Comisión Estimada (Ejemplo):</strong> {getMockCommission(selectedEntityForStats)}</p>
                </div>
                <UIDialogFooterAliased>
                    <Button variant="outline" onClick={() => {setShowStatsModal(false); setSelectedEntityForStats(null);}}>Cerrar</Button>
                </UIDialogFooterAliased>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

