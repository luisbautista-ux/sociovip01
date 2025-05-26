
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2, CheckCircle, QrCode, DollarSign, Gift } from "lucide-react";
import { StatCard } from "@/components/admin/StatCard"; // Re-using StatCard
import type { BusinessManagedEntity, PromoterProfile } from "@/lib/types";

// Mock Data for Promoter Dashboard - Copied from entities/page.tsx for consistency
const mockLoggedInPromoter: PromoterProfile = {
  id: "pp1",
  name: "Carlos Santana (Promotor)",
  email: "carlos.santana@promo.com",
  phone: "+51911223344"
};

const mockAssignedEntities: BusinessManagedEntity[] = [
  { 
    id: "bp1", 
    businessId: "biz1", 
    type: "promotion", 
    name: "Jueves de Alitas BBQ (Asignada a Carlos)", 
    description: "Todas las alitas BBQ a S/1 cada una.", 
    startDate: "2024-01-01T12:00:00", 
    endDate: "2024-12-31T12:00:00", 
    usageLimit: 0, 
    isActive: true, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "chicken wings",
    generatedCodes: [ 
        { id: "codePromo1-1", entityId: "bp1", value: "ALITAS001", status: "available", generatedByName: "Admin Negocio", generatedDate: "2024-07-20T10:00:00Z" },
        { id: "pp1bp1cd1", entityId: "bp1", value: "PROMOALAS", status: "available", generatedByName: mockLoggedInPromoter.name, generatedDate: "2024-08-02T10:00:00Z", observation: "Códigos Promotor Carlos" },
        { id: "pp1bp1cd2", entityId: "bp1", value: "WINGKING1", status: "redeemed", generatedByName: mockLoggedInPromoter.name, generatedDate: "2024-08-03T11:00:00Z", redemptionDate: "2024-08-03T19:00:00Z" },
    ]
  },
  { 
    id: "evt1", 
    businessId: "biz1", 
    type: "event", 
    name: "Noche de Karaoke Estelar (Asignada a Carlos)", 
    description: "Saca la estrella que llevas dentro.", 
    startDate: "2024-08-15T12:00:00", 
    endDate: "2024-08-15T12:00:00", 
    maxAttendance: 100, 
    isActive: true, 
    imageUrl: "https://placehold.co/300x200.png", 
    aiHint: "karaoke night",
    generatedCodes: [
        { id: "pp1evt1cd1", entityId: "evt1", value: "VOZSTAR01", status: "redeemed", generatedByName: mockLoggedInPromoter.name, generatedDate: "2024-08-05T10:00:00Z", redemptionDate: "2024-08-15T21:00:00Z", redeemedByInfo: {dni: "11223344", name: "Test User"} },
        { id: "pp1evt1cd2", entityId: "evt1", value: "STARSHOW2", status: "available", generatedByName: mockLoggedInPromoter.name, generatedDate: "2024-08-06T10:00:00Z" },
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


const mockRecentActivity = [
  { id: 1, text: "Generaste 10 códigos para 'Noche de Karaoke Estelar'.", date: "Hace 2 horas" },
  { id: 2, text: "Se canjeó un código (KARAOK01) que generaste.", date: "Ayer" },
  { id: 3, text: "Asignada nueva promoción: 'Martes de Alitas'.", date: "Hace 2 días" },
];

export default function PromoterDashboardPage() {

  const calculatePromoterStats = () => {
    const now = new Date();
    const activeEntities = mockAssignedEntities.filter(
      entity => entity.isActive && new Date(entity.startDate) <= now && new Date(entity.endDate) >= now
    );

    let codesGenerated = 0;
    let codesRedeemed = 0;
    let commissionEarned = 0;

    mockAssignedEntities.forEach(entity => { // Iterate over all assigned, not just active for historical data
      const promoterCodes = entity.generatedCodes?.filter(c => c.generatedByName === mockLoggedInPromoter.name) || [];
      codesGenerated += promoterCodes.length;
      const redeemedPromoterCodes = promoterCodes.filter(c => c.status === 'redeemed').length;
      codesRedeemed += redeemedPromoterCodes;
      commissionEarned += redeemedPromoterCodes * 0.50; // Mock commission rate S/ 0.50 per code
    });

    return {
      totalEntitiesAssigned: activeEntities.length,
      totalCodesGeneratedByPromoter: codesGenerated,
      totalCodesRedeemedByPromoter: codesRedeemed,
      totalCommissionEarned: commissionEarned,
    };
  };

  const promoterStats = calculatePromoterStats();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary flex items-center">
        <BarChart2 className="h-8 w-8 mr-2" /> Dashboard del Promotor
      </h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Entidades Asignadas (Activas)" value={promoterStats.totalEntitiesAssigned} icon={Gift} />
        <StatCard title="Códigos Generados por Ti" value={promoterStats.totalCodesGeneratedByPromoter} icon={QrCode} />
        <StatCard title="Códigos Canjeados (Tus Códigos)" value={promoterStats.totalCodesRedeemedByPromoter} icon={CheckCircle} />
        <StatCard title="Comisión Estimada" value={`S/ ${promoterStats.totalCommissionEarned.toFixed(2)}`} icon={DollarSign} />
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
