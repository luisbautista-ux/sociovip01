
"use client";

import { StatCard } from "@/components/admin/StatCard"; // Re-using StatCard for now
import { Ticket, Calendar, Users, BarChart3, ScanLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
// Mock data specific to a business would be fetched here
// For example, active promotions for *this* business, recent redemptions, etc.

export default function BusinessDashboardPage() {
  // Mock stats for this business
  const mockBusinessStats = {
    activePromotions: 5,
    upcomingEvents: 2,
    totalRedemptionsToday: 25,
    newCustomersThisWeek: 10, // Customers interacting with this business's entities
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Dashboard de Mi Negocio</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Promociones Activas" value={mockBusinessStats.activePromotions} icon={Ticket} />
        <StatCard title="Eventos Próximos" value={mockBusinessStats.upcomingEvents} icon={Calendar} />
        <StatCard title="Canjes Hoy" value={mockBusinessStats.totalRedemptionsToday} icon={ScanLine} />
        <StatCard title="Nuevos Clientes (Semana)" value={mockBusinessStats.newCustomersThisWeek} icon={Users} />
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-6 w-6 mr-2 text-primary" />
            Rendimiento Reciente de Promociones
          </CardTitle>
          <CardDescription>Visualiza cómo están funcionando tus promociones.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground">Aquí iría un gráfico de rendimiento de promociones.</p>
          {/* Placeholder for a chart component */}
        </CardContent>
      </Card>

      {/* Add more sections: e.g., Recent Activity Feed, Top Performing Promoters */}
       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><span className="font-semibold text-foreground">Promo "Happy Hour"</span> - 5 nuevos canjes.</li>
            <li><span className="font-semibold text-foreground">Juan Pérez (Promotor)</span> generó 10 nuevos códigos.</li>
            <li>Nuevo evento <span className="font-semibold text-foreground">"Noche de Salsa"</span> publicado.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
