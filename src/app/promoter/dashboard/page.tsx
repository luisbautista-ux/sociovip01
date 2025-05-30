
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2, CheckCircle, QrCode, DollarSign, Gift, Building, ScanLine } from "lucide-react"; // Added Building, ScanLine
import { StatCard } from "@/components/admin/StatCard"; 
import type { BusinessManagedEntity, PromoterProfile } from "@/lib/types";
import { isEntityCurrentlyActivatable } from "@/lib/utils"; // Import the utility

// Mock Data for Promoter Dashboard
const mockLoggedInPromoter: PromoterProfile = {
  id: "pp1",
  uid: "promoterTestUid123", // Assuming promoter has a PlatformUser UID
  name: "Carlos Santana (Promotor)",
  email: "carlos.santana@promo.com",
  phone: "+51911223344"
};

// Using a more realistic structure for assigned entities, similar to how Firestore might store them
const mockAssignedEntities: BusinessManagedEntity[] = [
  { 
    id: "bp1", 
    businessId: "biz1", // Pandora Lounge Bar
    type: "promotion", 
    name: "Jueves de Alitas BBQ (Asignada a Carlos)", 
    description: "Todas las alitas BBQ a S/1 cada una.", 
    startDate: "2025-01-01T12:00:00", 
    endDate: "2025-12-31T12:00:00", 
    usageLimit: 0, 
    isActive: true, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "chicken wings",
    termsAndConditions: "Válido solo para consumo en local.",
    generatedCodes: [ 
        { id: "codePromo1-1", entityId: "bp1", value: "ALITAS001", status: "available", generatedByName: "Admin Negocio Pandora", generatedDate: "2025-07-20T10:00:00Z", observation: "Códigos iniciales" },
        { id: "pp1bp1cd1", entityId: "bp1", value: "PROMOALAS", status: "available", generatedByName: mockLoggedInPromoter.name, generatedByUid: mockLoggedInPromoter.uid, generatedDate: "2025-08-02T10:00:00Z", observation: "Códigos Promotor Carlos" },
        { id: "pp1bp1cd2", entityId: "bp1", value: "WINGKING1", status: "redeemed", generatedByName: mockLoggedInPromoter.name, generatedByUid: mockLoggedInPromoter.uid, generatedDate: "2025-08-03T11:00:00Z", redemptionDate: "2025-08-03T19:00:00Z", redeemedByInfo: { dni:"111", name:"Cliente Alas"} },
    ],
    ticketTypes: [], eventBoxes: [], assignedPromoters: []
  },
  { 
    id: "evt1", 
    businessId: "biz1", // Pandora Lounge Bar
    type: "event", 
    name: "Noche de Karaoke Estelar (Asignada a Carlos)", 
    description: "Saca la estrella que llevas dentro.", 
    startDate: "2025-08-15T12:00:00", 
    endDate: "2025-08-15T23:59:59", 
    maxAttendance: 100, 
    isActive: true, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "karaoke night",
    generatedCodes: [
        { id: "pp1evt1cd1", entityId: "evt1", value: "VOZSTAR01", status: "redeemed", generatedByName: mockLoggedInPromoter.name, generatedByUid: mockLoggedInPromoter.uid, generatedDate: "2025-08-05T10:00:00Z", redemptionDate: "2025-08-15T21:00:00Z", redeemedByInfo: {dni: "222", name: "Cliente Karaoke"} },
        { id: "pp1evt1cd2", entityId: "evt1", value: "STARSHOW2", status: "available", generatedByName: mockLoggedInPromoter.name, generatedByUid: mockLoggedInPromoter.uid, generatedDate: "2025-08-06T10:00:00Z" },
    ],
    ticketTypes: [], eventBoxes: [], assignedPromoters: []
  },
   { 
    id: "bpInactive", 
    businessId: "biz2", // Another Business
    type: "promotion", 
    name: "Promo Pasada (Asignada a Carlos)", 
    description: "Esta promoción ya no está activa.", 
    startDate: "2024-06-01T12:00:00", 
    endDate: "2024-06-30T12:00:00", 
    usageLimit: 0, 
    isActive: false, // This will be filtered out by isEntityCurrentlyActivatable
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "old deal",
    generatedCodes: [],
    ticketTypes: [], eventBoxes: [], assignedPromoters: []
  },
  { 
    id: "evtFuture", 
    businessId: "biz2", // Another Business
    type: "event", 
    name: "Evento Futuro Lejano (Asignada a Carlos)", 
    description: "Planeando con anticipación.", 
    startDate: "2026-01-10T12:00:00", 
    endDate: "2026-01-11T12:00:00", 
    maxAttendance: 50, 
    isActive: true, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "planning future",
    generatedCodes: [],
    ticketTypes: [], eventBoxes: [], assignedPromoters: []
  },
];


const mockRecentActivity = [
  { id: 1, text: "Generaste 10 códigos para 'Noche de Karaoke Estelar'.", date: "Hace 2 horas" },
  { id: 2, text: "Se canjeó un código (VOZSTAR01) que generaste.", date: "Ayer" },
  { id: 3, text: "Asignada nueva promoción: 'Martes de Alitas'.", date: "Hace 2 días" },
];

export default function PromoterDashboardPage() {

  const calculatePromoterStats = () => {
    const activeEntitiesForPromoter = mockAssignedEntities.filter(
      entity => entity.isActive && isEntityCurrentlyActivatable(entity) && 
                (entity.assignedPromoters?.some(ap => ap.promoterProfileId === mockLoggedInPromoter.uid) || 
                 entity.generatedCodes?.some(gc => gc.generatedByUid === mockLoggedInPromoter.uid)) // Simplified check for assignment
    );
    
    const uniqueBusinessIds = new Set(activeEntitiesForPromoter.map(entity => entity.businessId));

    let codesGeneratedByPromoter = 0;
    let codesRedeemedByPromoter = 0;
    
    // Calculate stats based on ALL assigned entities, not just active ones, for historical totals
    mockAssignedEntities.forEach(entity => {
      const promoterCodes = entity.generatedCodes?.filter(c => c.generatedByUid === mockLoggedInPromoter.uid) || [];
      codesGeneratedByPromoter += promoterCodes.length;
      codesRedeemedByPromoter += promoterCodes.filter(c => c.status === 'redeemed').length;
    });

    // Commission is mock, not based on granular rules here
    const commissionEarned = codesRedeemedByPromoter * 0.50; 

    return {
      totalBusinessesAssigned: uniqueBusinessIds.size,
      totalCodesGeneratedByPromoter: codesGeneratedByPromoter,
      totalCodesRedeemedByPromoter: codesRedeemedByPromoter,
      totalCommissionEarned: commissionEarned, // This will be hidden
    };
  };

  const promoterStats = calculatePromoterStats();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary flex items-center">
        <BarChart2 className="h-8 w-8 mr-2" /> Dashboard del Promotor
      </h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"> {/* Adjusted for 3 cards */}
        <StatCard title="Negocios Asignados (Activos)" value={promoterStats.totalBusinessesAssigned} icon={Building} />
        <StatCard title="Códigos Generados por Ti" value={promoterStats.totalCodesGeneratedByPromoter} icon={QrCode} />
        <StatCard title="QRs generados con tus códigos" value={promoterStats.totalCodesGeneratedByPromoter} icon={ScanLine} description="Dato de ejemplo"/>
        <StatCard title="QRs usados por tus clientes" value={promoterStats.totalCodesRedeemedByPromoter} icon={CheckCircle} />
        {/* Comisión Estimada card is now removed */}
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
          <CardDescription>Últimas acciones relacionadas con tus códigos y entidades.</CardDescription>
        </CardHeader>
        <CardContent>
          {mockRecentActivity.length > 0 ? (
            <ul className="space-y-3">
              {mockRecentActivity.map(activity => (
                <li key={activity.id} className="text-sm text-muted-foreground border-b pb-2 last:border-b-0">
                  <span className="block text-foreground">{activity.text}</span>
                  <span className="text-xs">{activity.date}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No hay actividad reciente.</p>
          )}
        </CardContent>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Rendimiento por Entidad (Próximamente)</CardTitle>
          <CardDescription>Aquí verás cuántos de tus códigos se han usado por promoción/evento.</CardDescription>
        </CardHeader>
        <CardContent className="h-40 flex items-center justify-center">
          <p className="text-muted-foreground">Gráficos y tablas de rendimiento aquí.</p>
        </CardContent>
      </Card>
    </div>
  );
}
