
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2, CheckCircle, QrCode, DollarSign } from "lucide-react";
import { StatCard } from "@/components/admin/StatCard"; // Re-using StatCard

// Mock Data for Promoter Dashboard
const mockPromoterStats = {
  totalEntitiesAssigned: 3,
  totalCodesGeneratedByPromoter: 50,
  totalCodesRedeemedByPromoter: 25,
  totalCommissionEarned: 125.50, // Example currency
};

const mockRecentActivity = [
  { id: 1, text: "Generaste 10 códigos para 'Noche de Karaoke Estelar'.", date: "Hace 2 horas" },
  { id: 2, text: "Se canjeó un código (KARAOK01) que generaste.", date: "Ayer" },
  { id: 3, text: "Asignada nueva promoción: 'Martes de Alitas'.", date: "Hace 2 días" },
];

export default function PromoterDashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary flex items-center">
        <BarChart2 className="h-8 w-8 mr-2" /> Dashboard del Promotor
      </h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Entidades Asignadas" value={mockPromoterStats.totalEntitiesAssigned} icon={Gift} />
        <StatCard title="Códigos Generados por Ti" value={mockPromoterStats.totalCodesGeneratedByPromoter} icon={QrCode} />
        <StatCard title="Códigos Canjeados (Tus Códigos)" value={mockPromoterStats.totalCodesRedeemedByPromoter} icon={CheckCircle} />
        <StatCard title="Comisión Estimada" value={`S/ ${mockPromoterStats.totalCommissionEarned.toFixed(2)}`} icon={DollarSign} />
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
