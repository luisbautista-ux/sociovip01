
"use client"; // For potential future client-side interactions, though stats are static for now

import { StatCard } from "@/components/admin/StatCard";
import { Building, Users, ScanLine, ListChecks, BarChart3, Ticket } from "lucide-react";
import type { AdminDashboardStats, PromotionAnalyticsData } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar, CartesianGrid } from 'recharts';


// Mock Data
const mockStats: AdminDashboardStats = {
  totalBusinesses: 15,
  totalPlatformUsers: 45,
  totalPromotionsActive: 120,
  totalQrCodesGenerated: 5670,
  totalEndUsersRegistered: 2300,
};

const mockMonthlyPromotionData: PromotionAnalyticsData[] = [
  { month: "Ene", promotionsCreated: 20, qrCodesGenerated: 800, qrCodesUtilized: 450 },
  { month: "Feb", promotionsCreated: 25, qrCodesGenerated: 950, qrCodesUtilized: 550 },
  { month: "Mar", promotionsCreated: 30, qrCodesGenerated: 1200, qrCodesUtilized: 700 },
  { month: "Abr", promotionsCreated: 22, qrCodesGenerated: 1100, qrCodesUtilized: 650 },
  { month: "May", promotionsCreated: 35, qrCodesGenerated: 1500, qrCodesUtilized: 800 },
  { month: "Jun", promotionsCreated: 28, qrCodesGenerated: 1320, qrCodesUtilized: 720 },
];


export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Dashboard de Administración</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard title="Negocios Registrados" value={mockStats.totalBusinesses} icon={Building} />
        <StatCard title="Usuarios de Plataforma" value={mockStats.totalPlatformUsers} icon={Users} />
        <StatCard title="Promociones Activas" value={mockStats.totalPromotionsActive} icon={Ticket} />
        <StatCard title="Códigos QR Generados" value={mockStats.totalQrCodesGenerated} icon={ScanLine} />
        <StatCard title="Clientes QR Registrados" value={mockStats.totalEndUsersRegistered} icon={ListChecks} />
      </div>

      <Card className="shadow-lg col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-6 w-6 mr-2 text-primary" />
            Actividad de Promociones (Últimos 6 Meses)
          </CardTitle>
          <CardDescription>Creación, generación y utilización de QR.</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px] p-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockMonthlyPromotionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  borderColor: 'hsl(var(--border))',
                  borderRadius: 'var(--radius)'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="promotionsCreated" fill="hsl(var(--chart-1))" name="Promos Creadas" radius={[4, 4, 0, 0]} />
              <Bar dataKey="qrCodesGenerated" fill="hsl(var(--chart-2))" name="QR Generados" radius={[4, 4, 0, 0]} />
              <Bar dataKey="qrCodesUtilized" fill="hsl(var(--chart-3))" name="QR Utilizados" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Add more sections as needed, e.g., Recent Activity, Top Performing Businesses */}
    </div>
  );
}
