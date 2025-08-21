
"use client";

import { StatCard } from "@/components/admin/StatCard";
import { Building, Users, ScanLine, ListChecks, BarChart3, Ticket, Star, Loader2, Info } from "lucide-react";
import type { AdminDashboardStats, BusinessManagedEntity } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar, CartesianGrid } from 'recharts';
import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, Timestamp, query, where, getCountFromServer } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { isEntityCurrentlyActivatable } from "@/lib/utils";
import { format, subMonths, parseISO } from 'date-fns';
import { es } from "date-fns/locale";


// Mock Data for chart (will remain mock for now)
const mockMonthlyPromotionData = Array.from({ length: 6 }, (_, i) => {
  const monthDate = subMonths(new Date(), 5 - i);
  return {
    month: format(monthDate, "MMM yy", { locale: es }), // Format month for chart
    promotionsCreated: Math.floor(Math.random() * 15) + 5,
    qrCodesGenerated: Math.floor(Math.random() * 200) + 50,
    qrCodesUtilized: Math.floor(Math.random() * 100) + 20,
  };
});


export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats>({
    totalBusinesses: 0,
    totalPlatformUsers: 0,
    totalSocioVipMembers: 0,
    totalPromotionsActive: 0,
    totalQrCodesGenerated: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAdminStats = useCallback(async () => {
    setIsLoading(true);
    console.log("AdminDashboard: Starting fetchAdminStats...");
    try {
      // Use getCountFromServer for efficient counting without reading all documents
      const businessesCountSnap = await getCountFromServer(collection(db, "businesses"));
      const platformUsersCountSnap = await getCountFromServer(collection(db, "platformUsers"));
      const socioVipMembersCountSnap = await getCountFromServer(collection(db, "socioVipMembers"));
      // const qrClientsCountSnap = await getCountFromServer(collection(db, "qrClients")); // Temporarily removed due to permission errors
      const allActiveEntitiesQuery = query(collection(db, "businessEntities"), where("isActive", "==", true));
      const activeEntitiesSnap = await getCountFromServer(allActiveEntitiesQuery);
      
      let qrCodesGeneratedCount = 0;
      console.warn("AdminDashboard: Calculation for total generated codes has been temporarily disabled to prevent permission-denied errors from collection-wide reads.");
       toast({
            title: "Cálculo de Códigos Omitido",
            description: "No se calculó el total de códigos generados para asegurar la carga del dashboard. Esta es una medida temporal.",
            variant: "default",
            duration: 8000,
        });
      
      console.log("AdminDashboard: Fetched counts - businesses:", businessesCountSnap.data().count, "platformUsers:", platformUsersCountSnap.data().count, "socioVipMembers:", socioVipMembersCountSnap.data().count);
      console.log("AdminDashboard: Fetched active entities count:", activeEntitiesSnap.data().count);
      console.log("AdminDashboard: Calculated total generated codes (temporarily 0):", qrCodesGeneratedCount);


      const newStats: AdminDashboardStats = {
        totalBusinesses: businessesCountSnap.data().count,
        totalPlatformUsers: platformUsersCountSnap.data().count,
        totalSocioVipMembers: socioVipMembersCountSnap.data().count,
        // totalQrClients: qrClientsCountSnap.data().count, // Temporarily removed
        totalPromotionsActive: activeEntitiesSnap.data().count,
        totalQrCodesGenerated: qrCodesGeneratedCount, // Temporarily 0
      };
      setStats(newStats);
      console.log("AdminDashboard: Stats state updated with:", newStats);

    } catch (error: any) {
      console.error("AdminDashboard: Error fetching admin dashboard stats:", error.code, error.message, error);
      toast({
        title: "Error al Cargar Estadísticas",
        description: `No se pudieron obtener las estadísticas principales. Error: ${error.message}. Revisa la consola y tus reglas de Firestore.`,
        variant: "destructive",
        duration: 10000,
      });
      setStats({ // Reset stats on error
        totalBusinesses: 0,
        totalPlatformUsers: 0,
        totalSocioVipMembers: 0,
        totalPromotionsActive: 0,
        totalQrCodesGenerated: 0,
      });
    } finally {
      setIsLoading(false);
      console.log("AdminDashboard: fetchAdminStats finished, isLoading set to false.");
    }
  }, [toast]);

  useEffect(() => {
    fetchAdminStats();
  }, [fetchAdminStats]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Cargando estadísticas del dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Dashboard de Administración</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        <StatCard title="Negocios Registrados" value={stats.totalBusinesses} icon={Building} />
        <StatCard title="Usuarios de Plataforma" value={stats.totalPlatformUsers} icon={Users} />
        <StatCard title="Socios VIP Activos" value={stats.totalSocioVipMembers} icon={Star} /> 
        <StatCard title="Promociones/Eventos Activos" value={stats.totalPromotionsActive} icon={Ticket} />
        <StatCard title="Códigos Creados (Total)" value={stats.totalQrCodesGenerated} icon={ScanLine} description="Cálculo omitido temporalmente" />
        {/* <StatCard title="Clientes QR Registrados" value={stats.totalQrClients} icon={ListChecks} /> */}
      </div>

      <Card className="shadow-lg col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-6 w-6 mr-2 text-primary" />
            Actividad de Promociones (Últimos 6 Meses)
          </CardTitle>
          <CardDescription>Creación de promociones, códigos creados y códigos canjeados. (Datos de ejemplo para el gráfico)</CardDescription>
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
              <Bar dataKey="qrCodesGenerated" fill="hsl(var(--chart-2))" name="Códigos Creados" radius={[4, 4, 0, 0]} />
              <Bar dataKey="qrCodesUtilized" fill="hsl(var(--chart-3))" name="Códigos Canjeados" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Actividad Reciente del Sistema</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[150px] flex flex-col items-center justify-center text-center">
           <Info className="h-12 w-12 text-primary/60 mb-3" />
           <p className="text-muted-foreground">
            La actividad reciente del sistema se mostrará aquí una vez que se integre el registro de auditoría.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

