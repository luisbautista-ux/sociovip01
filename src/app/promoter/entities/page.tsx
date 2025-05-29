
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode as QrCodeIcon, ListChecks, Gift, Search, AlertTriangle, DollarSign, BarChart3, Edit } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as UIDialogDescription, DialogFooter as UIDialogFooter } from "@/components/ui/dialog";


export default function PromoterEntitiesPage() {
  const { userProfile } = useAuth();
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
    if (!userProfile || !userProfile.uid) {
      setIsLoading(false);
      setEntities([]);
      return;
    }
    setIsLoading(true);
    try {
      const promoterUid = userProfile.uid;
      console.log("Promoter Entities Page: Fetching for promoter UID:", promoterUid);

      // Esta consulta asume que BusinessManagedEntity tiene un array 'assignedPromoters'
      // y cada objeto en ese array tiene 'promoterProfileId' que coincide con el UID del promotor.
      const entitiesQuery = query(
        collection(db, "businessEntities"),
        where("assignedPromoters", "array-contains", { promoterProfileId: promoterUid }) // This is a simplification, exact match on object is tricky.
                                                                                          // A more robust query would be if promoter UIDs are in a simple array.
                                                                                          // OR, query all active entities and filter client-side if assignedPromoters is complex.
      );
      // Temporarily, let's fetch all active entities and filter client-side
      // as "array-contains" with object might not work as expected without exact match.
      const allActiveEntitiesQuery = query(collection(db, "businessEntities"), where("isActive", "==", true));

      const entitiesSnap = await getDocs(allActiveEntitiesQuery); 
      
      const fetchedEntities: BusinessManagedEntity[] = [];
      entitiesSnap.forEach(docSnap => {
        const data = docSnap.data() as Omit<BusinessManagedEntity, 'id'>; 
        
        const isAssignedToThisPromoter = data.assignedPromoters?.some(ap => ap.promoterProfileId === promoterUid);
        
        if (isAssignedToThisPromoter) {
            const nowISO = new Date().toISOString();
            fetchedEntities.push({
              id: docSnap.id,
              ...data,
              startDate: data.startDate instanceof Timestamp ? data.startDate.toDate().toISOString() : (typeof data.startDate === 'string' ? data.startDate : nowISO),
              endDate: data.endDate instanceof Timestamp ? data.endDate.toDate().toISOString() : (typeof data.endDate === 'string' ? data.endDate : nowISO),
              generatedCodes: Array.isArray(data.generatedCodes) ? data.generatedCodes.map(gc => sanitizeObjectForFirestore({...gc})) : [],
            });
        }
      });
      
      setEntities(fetchedEntities.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
      console.log("Promoter Entities Page: Fetched entities assigned to promoter:", fetchedEntities.length);

    } catch (error) {
      console.error("Promoter Entities Page: Error fetching assigned entities:", error);
      toast({ title: "Error al cargar entidades", description: "No se pudieron cargar tus promociones/eventos asignados.", variant: "destructive"});
      setEntities([]);
    } finally {
      setIsLoading(false);
    }
  }, [userProfile, toast]);

  useEffect(() => {
    if (userProfile) {
      fetchAssignedEntities();
    }
  }, [userProfile, fetchAssignedEntities]);


  const filteredEntities = useMemo(() => {
    return entities.filter(entity =>
        (entity.name || "").toLowerCase().includes(searchTerm.toLowerCase()) 
    ).sort((a, b) => { 
        const aActiveCurrent = isEntityCurrentlyActivatable(a);
        const bActiveCurrent = isEntityCurrentlyActivatable(b);
        if (aActiveCurrent && !bActiveCurrent) return -1;
        if (!aActiveCurrent && bActiveCurrent) return 1;
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
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

 const handleNewCodesCreated = async (entityId: string, newCodes: GeneratedCode[], observation?: string) => {
    if (!userProfile || !userProfile.name) {
        toast({title: "Error", description: "Nombre de promotor no disponible.", variant: "destructive"});
        return;
    }
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
        const existingCodes = targetEntityData.generatedCodes || [];

        const newCodesWithDetails = newCodes.map(code => sanitizeObjectForFirestore({
            ...code,
            generatedByName: userProfile.name, 
            observation: (observation && observation.trim() !== "") ? observation.trim() : null,
            redemptionDate: null, 
            redeemedByInfo: null, 
            isVipCandidate: false,
        }));

        const updatedCodes = [...existingCodes, ...newCodesWithDetails];
    
        await updateDoc(targetEntityRef, { generatedCodes: updatedCodes });
        toast({title: `${newCodes.length} Código(s) Creado(s)`, description: `Para: ${targetEntityData.name}. Guardados en la base de datos.`});
        
        fetchAssignedEntities(); 

    } catch (error: any) {
        console.error("Promoter Entities Page: Error saving new codes to Firestore:", error.code, error.message, error);
        toast({title: "Error al Guardar Códigos", description: `No se pudieron guardar los códigos. ${error.message}`, variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleCodesUpdatedFromManageDialog = async (entityId: string, updatedCodesManaged: GeneratedCode[]) => {
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
        
        const otherPromotersCodes = (targetEntityData.generatedCodes || []).filter(
            c => c.generatedByName !== userProfile?.name
        );
        const finalUpdatedCodes = [...otherPromotersCodes, ...updatedCodesManaged.map(c => sanitizeObjectForFirestore(c))];

        await updateDoc(targetEntityRef, { generatedCodes: finalUpdatedCodes });
        toast({title: "Tus Códigos Actualizados", description: `Tus códigos para "${targetEntityData.name}" han sido guardados.`});
        
        fetchAssignedEntities(); 
    } catch (error: any) {
        console.error("Promoter Entities Page: Error saving updated codes to Firestore:", error.code, error.message, error);
        toast({title: "Error al Guardar Códigos", description: `No se pudieron actualizar tus códigos. ${error.message}`, variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const getPromoterCodeStats = (entity: BusinessManagedEntity) => {
    const promoterCodes = entity.generatedCodes?.filter(c => c.generatedByName === userProfile?.name) || [];
    const createdCount = promoterCodes.length;
    const utilizedCount = promoterCodes.filter(c => c.status === 'redeemed').length;
    return `${utilizedCount} / ${createdCount}`; 
  };

  const getMockCommission = (entity: BusinessManagedEntity): string => {
      const promoterCodes = entity.generatedCodes?.filter(c => c.generatedByName === userProfile?.name) || [];
      const utilizedCount = promoterCodes.filter(c => c.status === 'redeemed').length;
      
      const assignment = entity.assignedPromoters?.find(ap => ap.promoterProfileId === userProfile?.uid);
      let commissionPerCode = 0.50; // Default if no specific rule found

      if (assignment && assignment.commissionRules && assignment.commissionRules.length > 0) {
        // Prioritize specific rules if they exist, e.g., a general event/promotion rule
        const generalRule = assignment.commissionRules.find(
            r => r.appliesTo === (entity.type === 'promotion' ? 'promotion_general' : 'event_general') && 
                 r.commissionType === 'fixed'
        );
        if (generalRule) {
            commissionPerCode = generalRule.commissionValue;
        }
        // More complex logic could iterate all rules if commissions are per ticket type, etc.
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
      <h1 className="text-3xl font-bold text-primary flex items-center">
        <Gift className="h-8 w-8 mr-2" /> Promociones y Eventos Asignados
      </h1>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Tus Promociones y Eventos Asignados</CardTitle>
          <CardDescription>Genera códigos para las promociones y eventos que te han sido asignados.</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nombre..."
              className="pl-8 w-full sm:w-[300px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredEntities.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Nombre y Estado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Vigencia</TableHead>
                  <TableHead className="text-center">Mis Códigos (Utilizados/Creados)</TableHead>
                  <TableHead className="text-center hidden lg:table-cell">Comisión Estimada</TableHead>
                  <TableHead>Generar/Ver Códigos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntities.map((entity) => (
                  <TableRow key={entity.id}>
                    <TableCell className="font-medium align-top">
                        <div className="font-semibold">{entity.name}</div>
                        <div className="mt-1">
                            <Badge variant={entity.isActive && isEntityCurrentlyActivatable(entity) ? "default" : "outline"} 
                                   className={cn(entity.isActive && isEntityCurrentlyActivatable(entity) ? "bg-green-500 hover:bg-green-600" : "bg-slate-500 hover:bg-slate-600 text-white")}>
                                {entity.isActive && isEntityCurrentlyActivatable(entity) ? "Vigente" : (entity.isActive ? "Activa (Fuera de Fecha)" : "Inactiva")}
                            </Badge>
                        </div>
                         <div className="flex flex-wrap gap-1 mt-2">
                            <Button variant="outline" size="xs" onClick={() => openStatsModal(entity)} disabled={isSubmitting} className="px-2 py-1 h-auto text-xs">
                                <BarChart3 className="h-3 w-3 mr-1" /> Estadísticas
                            </Button>
                        </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant="outline">{entity.type === 'promotion' ? 'Promoción' : 'Evento'}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell align-top">
                      {entity.startDate ? format(parseISO(entity.startDate), "P", { locale: es }) : 'N/A'} - {entity.endDate ? format(parseISO(entity.endDate), "P", { locale: es }) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-center align-top">{getPromoterCodeStats(entity)}</TableCell>
                    <TableCell className="text-center hidden lg:table-cell align-top">{getMockCommission(entity)}</TableCell>
                    <TableCell className="align-top">
                        <div className="flex flex-col items-start gap-1">
                            <Button 
                                variant="outline" 
                                size="xs" 
                                onClick={() => openCreateCodesDialog(entity)} 
                                disabled={!isEntityCurrentlyActivatable(entity) || isSubmitting}
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
                                <ListChecks className="h-3 w-3 mr-1" /> Ver Mis Códigos ({entity.generatedCodes?.filter(c => c.generatedByName === userProfile?.name).length || 0})
                            </Button>
                        </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border border-dashed rounded-md p-4 text-center">
                <AlertTriangle className="h-10 w-10 mb-2 text-yellow-500"/>
                <p className="font-semibold">No tienes promociones o eventos asignados que coincidan con tu búsqueda o que estén activos.</p>
                <p className="text-sm">Si esperabas ver alguna, contacta al administrador del negocio correspondiente.</p>
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
            generatedCodes: selectedEntityForViewingCodes.generatedCodes?.filter(
              c => c.generatedByName === userProfile.name 
            ) || []
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
        />
      )}

      {selectedEntityForStats && userProfile && (
         <Dialog open={showStatsModal} onOpenChange={setShowStatsModal}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Estadísticas para: {selectedEntityForStats?.name}</DialogTitle>
                    <UIDialogDescription>Resumen de tus códigos para esta entidad.</UIDialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-4">
                    <p><strong>Tus Códigos Generados:</strong> {selectedEntityForStats.generatedCodes?.filter(c=> c.generatedByName === userProfile.name).length || 0}</p>
                    <p><strong>Tus Códigos Canjeados:</strong> {selectedEntityForStats.generatedCodes?.filter(c => c.generatedByName === userProfile.name && c.status === 'redeemed').length || 0}</p>
                    <p><strong>Tu Tasa de Canje:</strong> 
                        {(() => {
                            const promoterCodes = selectedEntityForStats.generatedCodes?.filter(c => c.generatedByName === userProfile.name) || [];
                            const total = promoterCodes.length;
                            const redeemed = promoterCodes.filter(c => c.status === 'redeemed').length;
                            return total > 0 ? `${((redeemed / total) * 100).toFixed(1)}%` : '0%';
                        })()}
                    </p>
                    <p><strong>Comisión Estimada (Ejemplo):</strong> {getMockCommission(selectedEntityForStats)}</p>
                </div>
                <UIDialogFooter>
                    <Button variant="outline" onClick={() => {setShowStatsModal(false); setSelectedEntityForStats(null);}}>Cerrar</Button>
                </UIDialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

    