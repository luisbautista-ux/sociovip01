
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode, ListChecks, Gift, Search, AlertTriangle, DollarSign } from "lucide-react";
import type { BusinessManagedEntity, GeneratedCode, PromoterProfile } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CreateCodesDialog } from "@/components/business/dialogs/CreateCodesDialog";
import { ManageCodesDialog } from "@/components/business/dialogs/ManageCodesDialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { isEntityCurrentlyActivatable } from "@/lib/utils";

// Mock data - In a real app, this would be fetched based on the logged-in promoter
const mockLoggedInPromoter: PromoterProfile = {
  id: "pp1",
  name: "Carlos Santana (Promotor)",
  email: "carlos.santana@promo.com",
  phone: "+51911223344"
};

// Assume these entities are assigned to mockLoggedInPromoter
let mockAssignedEntities: BusinessManagedEntity[] = [
  { 
    id: "bp1", 
    businessId: "biz1", 
    type: "promotion", 
    name: "Jueves de Alitas BBQ (Asignada a Carlos)", 
    description: "Todas las alitas BBQ a S/1 cada una.", 
    startDate: "2025-01-01T12:00:00", 
    endDate: "2025-12-31T12:00:00",   
    usageLimit: 0, 
    isActive: true, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "chicken wings",
    generatedCodes: [ 
        { id: "codePromo1-1", entityId: "bp1", value: "ALITAS001", status: "available", generatedByName: "Admin Negocio", generatedDate: "2025-01-20T10:00:00Z" },
        { id: "pp1bp1cd1", entityId: "bp1", value: "PROMOALAS", status: "available", generatedByName: mockLoggedInPromoter.name, generatedDate: "2025-01-02T10:00:00Z", observation: "Códigos Promotor Carlos" },
        { id: "pp1bp1cd2", entityId: "bp1", value: "WINGKING1", status: "redeemed", generatedByName: mockLoggedInPromoter.name, generatedDate: "2025-01-03T11:00:00Z", redemptionDate: "2025-01-03T19:00:00Z" },
    ]
  },
  { 
    id: "evt1", 
    businessId: "biz1", 
    type: "event", 
    name: "Noche de Karaoke Estelar (Asignada a Carlos)", 
    description: "Saca la estrella que llevas dentro.", 
    startDate: "2025-08-15T12:00:00", 
    endDate: "2025-08-15T12:00:00", 
    maxAttendance: 100, 
    isActive: true, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "karaoke night",
    generatedCodes: [
        { id: "pp1evt1cd1", entityId: "evt1", value: "VOZSTAR01", status: "redeemed", generatedByName: mockLoggedInPromoter.name, generatedDate: "2025-08-05T10:00:00Z", redemptionDate: "2025-08-15T21:00:00Z", redeemedByInfo: {dni: "11223344", name: "Test User"} },
        { id: "pp1evt1cd2", entityId: "evt1", value: "STARSHOW2", status: "available", generatedByName: mockLoggedInPromoter.name, generatedDate: "2025-08-06T10:00:00Z" },
    ]
  },
   { 
    id: "bpInactive", 
    businessId: "biz1", 
    type: "promotion", 
    name: "Promo Pasada (Asignada a Carlos)", 
    description: "Esta promoción ya no está activa.", 
    startDate: "2024-06-01T12:00:00", 
    endDate: "2024-06-30T12:00:00", 
    usageLimit: 0, 
    isActive: false, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "old deal",
    generatedCodes: []
  },
];


export default function PromoterEntitiesPage() {
  const [entities, setEntities] = useState<BusinessManagedEntity[]>(mockAssignedEntities);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const [showCreateCodesModal, setShowCreateCodesModal] = useState(false);
  const [selectedEntityForCreatingCodes, setSelectedEntityForCreatingCodes] = useState<BusinessManagedEntity | null>(null);
  
  const [showManageCodesModal, setShowManageCodesModal] = useState(false);
  const [selectedEntityForViewingCodes, setSelectedEntityForViewingCodes] = useState<BusinessManagedEntity | null>(null);

  const filteredEntities = entities.filter(entity =>
    (entity.name || "").toLowerCase().includes(searchTerm.toLowerCase()) 
  );
  
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

  const handleNewCodesCreated = (entityId: string, newCodes: GeneratedCode[], observation?: string) => {
    setEntities(prevEntities => prevEntities.map(entity => {
      if (entity.id === entityId) {
        const codesWithPromoterName = newCodes.map(code => ({
          ...code,
          generatedByName: mockLoggedInPromoter.name, 
          observation: observation || code.observation 
        }));
        const updatedCodes = [...(entity.generatedCodes || []), ...codesWithPromoterName];
        return { ...entity, generatedCodes: updatedCodes };
      }
      return entity;
    }));
  };
  
  const handleCodesUpdatedFromManageDialog = (entityId: string, updatedCodes: GeneratedCode[]) => {
     setEntities(prevEntities => prevEntities.map(entity => {
      if (entity.id === entityId) {
        const otherCodes = (entity.generatedCodes || []).filter(c => c.generatedByName !== mockLoggedInPromoter.name);
        return { ...entity, generatedCodes: [...otherCodes, ...updatedCodes] };
      }
      return entity;
    }));
  };
  
  const getPromoterCodeStats = (entity: BusinessManagedEntity) => {
    const promoterCodes = entity.generatedCodes?.filter(c => c.generatedByName === mockLoggedInPromoter.name) || [];
    const createdCount = promoterCodes.length;
    const utilizedCount = promoterCodes.filter(c => c.status === 'redeemed').length;
    return `${createdCount} / ${utilizedCount}`;
  };

  const getMockCommission = (entity: BusinessManagedEntity): string => {
      const utilizedCount = entity.generatedCodes?.filter(c => c.generatedByName === mockLoggedInPromoter.name && c.status === 'redeemed').length || 0;
      return `S/ ${(utilizedCount * 0.5).toFixed(2)}`; // Mock commission rate
  };

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
                  <TableHead>Nombre Promoción/Evento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Vigencia</TableHead>
                  <TableHead className="text-center">Mis Códigos (Creados/Utilizados)</TableHead>
                  <TableHead className="text-center hidden lg:table-cell">Comisión Estimada</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntities.map((entity) => (
                  <TableRow key={entity.id}>
                    <TableCell className="font-medium">{entity.name} <Badge variant={entity.isActive ? "default" : "outline"} className={entity.isActive ? "bg-green-600" : "bg-red-600"}>{entity.isActive ? "Activa" : "Inactiva"}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="outline">{entity.type === 'promotion' ? 'Promoción' : 'Evento'}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {entity.startDate ? format(new Date(entity.startDate), "P", { locale: es }) : 'N/A'} - {entity.endDate ? format(new Date(entity.endDate), "P", { locale: es }) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-center">{getPromoterCodeStats(entity)}</TableCell>
                    <TableCell className="text-center hidden lg:table-cell">{getMockCommission(entity)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => openCreateCodesDialog(entity)} 
                        disabled={!isEntityCurrentlyActivatable(entity)}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <QrCode className="h-4 w-4 mr-1" /> Crear Códigos
                      </Button>
                       <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => openViewCodesDialog(entity)}
                       >
                        <ListChecks className="h-4 w-4 mr-1" /> Ver Mis Códigos ({entity.generatedCodes?.filter(c => c.generatedByName === mockLoggedInPromoter.name).length || 0})
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border border-dashed rounded-md p-4 text-center">
                <AlertTriangle className="h-10 w-10 mb-2 text-yellow-500"/>
                <p className="font-semibold">No tienes promociones o eventos asignados que coincidan con tu búsqueda.</p>
                <p className="text-sm">Si esperabas ver alguna, contacta al administrador del negocio.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedEntityForCreatingCodes && (
        <CreateCodesDialog
          open={showCreateCodesModal}
          onOpenChange={setShowCreateCodesModal}
          entityName={selectedEntityForCreatingCodes.name}
          entityId={selectedEntityForCreatingCodes.id}
          existingCodesValues={(selectedEntityForCreatingCodes.generatedCodes || []).map(c => c.value)}
          onCodesCreated={handleNewCodesCreated}
        />
      )}

      {selectedEntityForViewingCodes && (
        <ManageCodesDialog
          open={showManageCodesModal}
          onOpenChange={(isOpen) => {
            setShowManageCodesModal(isOpen);
            if (!isOpen) setSelectedEntityForViewingCodes(null);
          }}
          entity={selectedEntityForViewingCodes ? { 
            ...selectedEntityForViewingCodes,
            generatedCodes: selectedEntityForViewingCodes.generatedCodes?.filter(
              c => c.generatedByName === mockLoggedInPromoter.name
            ) || []
          } : null }
          onCodesUpdated={handleCodesUpdatedFromManageDialog}
          onRequestCreateNewCodes={() => {
            const originalEntity = entities.find(e => e.id === selectedEntityForViewingCodes?.id);
            setShowManageCodesModal(false); 
            if(originalEntity) {
                 // Ensure the entity is still activatable before attempting to open create dialog
                 if (isEntityCurrentlyActivatable(originalEntity)) {
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
    </div>
  );
}
